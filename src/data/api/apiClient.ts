// ============================================================
// API CLIENT
// One place for the base URL, timeouts and error handling. A failed
// request always surfaces as an ApiError — nothing in the data layer
// substitutes sample data for a response that did not arrive.
// ============================================================

const rawBaseUrl = import.meta.env.VITE_API_BASE_URL;

/** REST API origin from VITE_API_BASE_URL, or null when the app is not configured to use a backend. */
export const API_BASE_URL: string | null = rawBaseUrl?.trim() ? rawBaseUrl.trim().replace(/\/+$/, '') : null;

const TIMEOUT_MS = 10_000;

export type ApiErrorKind = 'network' | 'timeout' | 'http' | 'invalid-response' | 'not-configured';

export class ApiError extends Error {
  constructor(public kind: ApiErrorKind, message: string, public status?: number) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT';
  body?: unknown;
  signal?: AbortSignal;
  /** Returns null instead of throwing when the server answers 404 */
  allowNotFound?: boolean;
}

export async function apiRequest<T>(path: string, parse: (data: unknown) => T, options: RequestOptions & { allowNotFound: true }): Promise<T | null>;
export async function apiRequest<T>(path: string, parse: (data: unknown) => T, options?: RequestOptions): Promise<T>;
export async function apiRequest<T>(path: string, parse: (data: unknown) => T, options: RequestOptions = {}): Promise<T | null> {
  if (!API_BASE_URL) {
    throw new ApiError('not-configured', 'No API is configured. Set VITE_API_BASE_URL to connect a backend.');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new ApiError('timeout', `The server did not respond within ${TIMEOUT_MS / 1000} seconds.`)), TIMEOUT_MS);
  const onAbort = () => controller.abort(options.signal?.reason);
  options.signal?.addEventListener('abort', onAbort);

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      headers: { Accept: 'application/json', ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });

    if (response.status === 404 && options.allowNotFound) return null;
    if (!response.ok) {
      throw new ApiError('http', `The server answered ${response.status} ${response.statusText} for ${path}.`.replace('  ', ' '), response.status);
    }

    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw new ApiError('invalid-response', `The server's answer for ${path} was not valid JSON.`);
    }
    return parse(data);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    // A caller-initiated abort is not an error to report; let it propagate untouched
    if (options.signal?.aborted) throw error;
    if (controller.signal.reason instanceof ApiError) throw controller.signal.reason;
    throw new ApiError('network', `Could not reach the API at ${API_BASE_URL}.`);
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', onAbort);
  }
}

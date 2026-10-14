import { clearSession, getSession } from './session';

// ============================================================
// API CLIENT
// One place for the base URL, authentication, timeouts and error
// handling. A failed request always surfaces as an ApiError — nothing
// in the data layer substitutes sample data for a response that did
// not arrive.
// ============================================================

const rawBaseUrl = import.meta.env.VITE_API_BASE_URL;

/** REST API base from VITE_API_BASE_URL (e.g. https://kairos-backend.onrender.com/api), or null when no backend is configured. */
export const API_BASE_URL: string | null = rawBaseUrl?.trim() ? rawBaseUrl.trim().replace(/\/+$/, '') : null;

// A free Render service can take close to a minute to wake up, so allow for it
const TIMEOUT_MS = 70_000;

export type ApiErrorKind = 'network' | 'timeout' | 'http' | 'unauthorized' | 'invalid-response' | 'not-configured';

export class ApiError extends Error {
  constructor(public kind: ApiErrorKind, message: string, public status?: number) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Called when the API rejects the session (401), so the app can ask the athlete to sign in again. */
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
  /** Returns null instead of throwing when the server answers 404 */
  allowNotFound?: boolean;
  /** Send the request without the session token (sign-in and registration) */
  anonymous?: boolean;
}

/** Turns an RFC 7807 problem document into one readable sentence. */
async function problemMessage(response: Response, path: string): Promise<string> {
  try {
    const problem = await response.json() as { detail?: string; errors?: { field?: string; message?: string }[] };
    const fields = (problem.errors ?? [])
      .map(e => (e.field ? `${e.field} ${e.message}` : e.message))
      .filter(Boolean);
    if (problem.detail) return fields.length ? `${problem.detail} ${fields.join('; ')}.` : problem.detail;
  } catch {
    // not JSON
  }
  return `The server answered ${response.status} for ${path}.`;
}

export async function apiRequest<T>(path: string, parse: (data: unknown) => T, options: RequestOptions & { allowNotFound: true }): Promise<T | null>;
export async function apiRequest<T>(path: string, parse: (data: unknown) => T, options?: RequestOptions): Promise<T>;
export async function apiRequest<T>(path: string, parse: (data: unknown) => T, options: RequestOptions = {}): Promise<T | null> {
  if (!API_BASE_URL) {
    throw new ApiError('not-configured', 'No API is configured. Set VITE_API_BASE_URL to connect a backend.');
  }

  const session = options.anonymous ? null : getSession();
  if (!options.anonymous && !session) {
    onUnauthorized?.();
    throw new ApiError('unauthorized', 'Sign in to continue.', 401);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new ApiError('timeout', `The server did not respond within ${TIMEOUT_MS / 1000} seconds.`)), TIMEOUT_MS);
  const onAbort = () => controller.abort(options.signal?.reason);
  options.signal?.addEventListener('abort', onAbort);

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(session ? { Authorization: `Bearer ${session.token}` } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });

    if (response.status === 401 && !options.anonymous) {
      clearSession();
      onUnauthorized?.();
      throw new ApiError('unauthorized', 'Your session has expired. Sign in again.', 401);
    }
    if (response.status === 404 && options.allowNotFound) return null;
    if (!response.ok) {
      throw new ApiError(response.status === 401 ? 'unauthorized' : 'http', await problemMessage(response, path), response.status);
    }
    if (response.status === 204) return parse(undefined);

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
    throw new ApiError('network', `Could not reach the Kairos API at ${API_BASE_URL}.`);
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', onAbort);
  }
}

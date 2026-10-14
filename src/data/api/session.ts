// ============================================================
// AUTH SESSION
// The access token issued by the Kairos API. It is kept in this
// browser's localStorage so a refresh does not sign the athlete out;
// it holds no athlete records. A token past its expiry is discarded.
// ============================================================

export interface AuthSession {
  token: string;
  /** ISO timestamp from the server */
  expiresAt: string;
  email: string;
}

const SESSION_KEY = 'kairos.v1.session';

let current: AuthSession | null = readStoredSession();

function readStoredSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AuthSession>;
    if (typeof parsed.token !== 'string' || typeof parsed.expiresAt !== 'string' || typeof parsed.email !== 'string') return null;
    return parsed as AuthSession;
  } catch {
    return null;
  }
}

function isExpired(session: AuthSession): boolean {
  const expires = Date.parse(session.expiresAt);
  return Number.isNaN(expires) || expires <= Date.now();
}

/** The current session, or null when signed out or expired. */
export function getSession(): AuthSession | null {
  if (current && isExpired(current)) clearSession();
  return current;
}

export function setSession(session: AuthSession): void {
  current = session;
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // Storage blocked: the session lasts until the tab is closed
  }
}

export function clearSession(): void {
  current = null;
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // nothing stored
  }
}

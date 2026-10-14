import { ApiError, apiRequest } from './apiClient';
import { AuthSession, clearSession, setSession } from './session';

// ============================================================
// ACCOUNTS
// Sign-in and registration against the Kairos API. The password is
// sent once over HTTPS and never stored by the frontend.
// ============================================================

interface AuthResponseDto {
  token: string;
  expiresAt: string;
  user: { id: string; email: string };
}

function parseAuthResponse(data: unknown): AuthResponseDto {
  const value = data as Partial<AuthResponseDto> | null;
  if (!value || typeof value.token !== 'string' || typeof value.expiresAt !== 'string' || typeof value.user?.email !== 'string') {
    throw new ApiError('invalid-response', 'The sign-in response from the server was not understood.');
  }
  return value as AuthResponseDto;
}

async function authenticate(path: string, email: string, password: string): Promise<AuthSession> {
  const response = await apiRequest(path, parseAuthResponse, { method: 'POST', body: { email, password }, anonymous: true });
  const session = { token: response.token, expiresAt: response.expiresAt, email: response.user.email };
  setSession(session);
  return session;
}

export const signIn = (email: string, password: string) => authenticate('/v1/auth/login', email, password);

export const register = (email: string, password: string) => authenticate('/v1/auth/register', email, password);

export function signOut(): void {
  clearSession();
}

export const MIN_PASSWORD_LENGTH = 10;

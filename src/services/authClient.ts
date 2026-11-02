import type { AuthSessionResponse, AuthState, AuthUser } from '../types/auth';
import type { AuthCoordination } from './authCoordination';
import { createSessionClient } from './authSessionClient';
import {
  isIsoDateTime, isRecord, isUuid, PlatformApiError,
  type PlatformHttpOptions, type PlatformRequestOptions,
} from './platformHttp';

export function parseAuthUser(value: unknown): AuthUser {
  if (!isRecord(value) || !isUuid(value.id) || !(value.email === null || typeof value.email === 'string')
    || typeof value.displayName !== 'string' || [...value.displayName].length > 100
    || !Array.isArray(value.roles) || !value.roles.every(role => role === 'user' || role === 'admin')) {
    throw new PlatformApiError('protocol', 'O serviço retornou um perfil inválido.');
  }
  return { id: value.id, email: value.email, displayName: value.displayName, roles: [...value.roles] as AuthUser['roles'] };
}
export function parseAuthSession(value: unknown): AuthSessionResponse {
  if (!isRecord(value) || typeof value.authenticated !== 'boolean') {
    throw new PlatformApiError('protocol', 'O serviço retornou uma sessão inválida.');
  }
  if (!value.authenticated) {
    if (value.user !== null || value.csrfToken !== null || value.expiresAt !== null) {
      throw new PlatformApiError('protocol', 'O serviço retornou uma sessão inválida.');
    }
    return { authenticated: false, user: null, csrfToken: null, expiresAt: null };
  }
  if (typeof value.csrfToken !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(value.csrfToken)
    || !isIsoDateTime(value.expiresAt) || !value.expiresAt.endsWith('Z')) {
    throw new PlatformApiError('protocol', 'O serviço retornou uma sessão inválida.');
  }
  return { authenticated: true, user: parseAuthUser(value.user), csrfToken: value.csrfToken, expiresAt: value.expiresAt };
}
export interface AuthClient {
  readonly googleLoginUrl: string;
  getGoogleLoginUrl(returnTo?: string): string;
  getState(): AuthState;
  subscribe(listener: () => void): () => void;
  getSession(): Promise<AuthState>;
  revalidate(): Promise<AuthState>;
  refresh(): Promise<AuthState>;
  logout(): Promise<void>;
  dismissNotice(): void;
  me(options?: { signal?: AbortSignal }): Promise<AuthUser>;
  request<T>(path: string, options: PlatformRequestOptions, parse: (value: unknown) => T): Promise<T>;
  expire(): void;
  dispose(): void;
}

/** One client per provider; session coordination is activated lazily after mount. */
export interface AuthClientOptions extends PlatformHttpOptions { coordination?: AuthCoordination }
export function createAuthClient(baseUrl: string, options: AuthClientOptions = {}): AuthClient {
  return createSessionClient(baseUrl, options, parseAuthSession, parseAuthUser);
}

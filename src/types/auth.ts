import type { PlatformApiError } from '../services/platformHttp';

export interface AuthUser {
  id: string;
  email: string | null;
  displayName: string;
  roles: Array<'user' | 'admin'>;
}
export interface AuthSessionResponse {
  authenticated: boolean;
  user: AuthUser | null;
  csrfToken: string | null;
  expiresAt: string | null;
}
/** The public state intentionally excludes CSRF and session credentials. */
export interface AuthState {
  status: 'loading' | 'anonymous' | 'authenticated' | 'unavailable' | 'error';
  user: AuthUser | null;
  expiresAt: string | null;
  error?: PlatformApiError | null;
  /** Absolute advisory cooldown, shared by every session consumer in this tab. */
  retryAt?: number;
}

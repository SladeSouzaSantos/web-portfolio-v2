import { createContext, useCallback, useContext, useEffect, useRef, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { platformConfig } from '../config/platform';
import { createAuthClient, type AuthClient } from '../services/authClient';
import type { AuthState } from '../types/auth';

interface AuthContextValue {
  state: AuthState;
  client: AuthClient | null;
  login(): void;
  logout(): Promise<void>;
  refresh(): Promise<void>;
  reload(): Promise<void>;
}
const disabledState: AuthState = { status: 'unavailable', user: null, expiresAt: null, error: null };
const noopSubscribe = () => () => {};
const disabledSnapshot = () => disabledState;
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const clientRef = useRef<AuthClient | null>(null);
  if (!clientRef.current && platformConfig.enabled) clientRef.current = createAuthClient(platformConfig.apiBaseUrl);
  const client = clientRef.current;
  const state = useSyncExternalStore(client?.subscribe ?? noopSubscribe, client?.getState ?? disabledSnapshot, disabledSnapshot);
  const disposalTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    clearTimeout(disposalTimer.current);
    if (client) void client.getSession().catch(() => { /* Error is included in the public session state. */ });
    // StrictMode immediately remounts effects. A true unmount cancels pending work.
    return () => { disposalTimer.current = setTimeout(() => client?.dispose(), 0); };
  }, [client]);
  useEffect(() => {
    if (!client || state.status !== 'authenticated' || !state.expiresAt) return;
    const delay = Math.max(0, Date.parse(state.expiresAt) - Date.now());
    const timer = setTimeout(() => client.expire(), Math.min(delay, 2_147_483_647));
    return () => clearTimeout(timer);
  }, [client, state.status, state.expiresAt]);
  const login = useCallback(() => {
    if (client && state.status !== 'unavailable' && Date.now() >= (state.retryAt ?? 0)) window.location.assign(client.googleLoginUrl);
  }, [client, state.status, state.retryAt]);
  const logout = useCallback(async () => { if (client) await client.logout(); }, [client]);
  const refresh = useCallback(async () => { if (client) await client.refresh(); }, [client]);
  const reload = useCallback(async () => { if (client) await client.getSession(); }, [client]);
  return <AuthContext.Provider value={{ state, client, login, logout, refresh, reload }}>{children}</AuthContext.Provider>;
}
export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth deve ser utilizado dentro de AuthProvider.');
  return value;
}

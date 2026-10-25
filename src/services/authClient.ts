import type { AuthSessionResponse, AuthState, AuthUser } from '../types/auth';
import {
  createPlatformHttp, isIsoDateTime, isRecord, isUuid, PlatformApiError,
  type PlatformHttpOptions, type PlatformRequestOptions,
} from './platformHttp';

const anonymous = (): AuthState => ({ status: 'anonymous', user: null, expiresAt: null, error: null });
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
  getState(): AuthState;
  subscribe(listener: () => void): () => void;
  getSession(): Promise<AuthState>;
  refresh(): Promise<AuthState>;
  logout(): Promise<void>;
  me(options?: { signal?: AbortSignal }): Promise<AuthUser>;
  request<T>(path: string, options: PlatformRequestOptions, parse: (value: unknown) => T): Promise<T>;
  expire(): void;
  dispose(): void;
}

/** A single instance is shared by the entire application, never one per component. */
export function createAuthClient(baseUrl: string, options: PlatformHttpOptions = {}): AuthClient {
  const http = createPlatformHttp(baseUrl, options);
  let session: AuthSessionResponse | undefined;
  let state: AuthState = { status: 'loading', user: null, expiresAt: null, error: null };
  const listeners = new Set<() => void>();
  const controllers = new Set<AbortController>();
  let loading: Promise<AuthState> | undefined;
  let refreshing: Promise<AuthState> | undefined;
  let loggingOut: Promise<void> | undefined;
  let mutationTail: Promise<unknown> = Promise.resolve();
  let generation = 0;
  let disposed = false;
  let retryAt = 0;
  let cooldownError: PlatformApiError | undefined;

  const emit = (next: AuthState) => {
    if (disposed) return;
    state = { ...next, retryAt };
    listeners.forEach(listener => listener());
  };
  function cooldownFailure() {
    return Date.now() < retryAt ? cooldownError : undefined;
  }
  function clear(error?: PlatformApiError) {
    session = undefined;
    generation += 1;
    emit({ ...anonymous(), ...(error && { error }) });
  }
  function failure(error: unknown, epoch: number) {
    if (disposed || epoch !== generation) return;
    if (error instanceof PlatformApiError && error.status === 401) clear(error);
    else if (error instanceof PlatformApiError && error.status === 404 && error.code === 'AUTH_DISABLED') {
      session = undefined;
      emit({ status: 'unavailable', user: null, expiresAt: null, error });
    }
  }
  function adopt(next: AuthSessionResponse, epoch: number): AuthState {
    if (disposed || epoch !== generation) return state;
    session = next;
    if (next.authenticated && next.user && next.expiresAt && Date.parse(next.expiresAt) > Date.now()) {
      emit({ status: 'authenticated', user: next.user, expiresAt: next.expiresAt, error: null });
    } else emit(anonymous());
    return state;
  }
  async function call<T>(path: string, requestOptions: PlatformRequestOptions, parse: (value: unknown) => T): Promise<T> {
    if (disposed) throw new PlatformApiError('aborted', 'A consulta foi cancelada.');
    const coolingDown = cooldownFailure();
    if (coolingDown) throw coolingDown;
    const epoch = generation;
    const controller = new AbortController();
    const abort = () => controller.abort();
    requestOptions.signal?.addEventListener('abort', abort, { once: true });
    if (requestOptions.signal?.aborted) controller.abort();
    controllers.add(controller);
    try {
      return await http.request(path, { ...requestOptions, credentials: 'include', signal: controller.signal }, parse);
    } catch (error) {
      if (error instanceof PlatformApiError && error.retryAt !== undefined && error.retryAt > retryAt) {
        retryAt = error.retryAt;
        cooldownError = error;
        emit(state);
      }
      failure(error, epoch);
      throw error;
    } finally {
      requestOptions.signal?.removeEventListener('abort', abort);
      controllers.delete(controller);
    }
  }
  function serial<T>(operation: () => Promise<T>): Promise<T> {
    const result = mutationTail.then(operation, operation);
    mutationTail = result.then(() => undefined, () => undefined);
    return result;
  }
  function getSession(): Promise<AuthState> {
    if (refreshing) return refreshing;
    if (loading) return loading;
    const coolingDown = cooldownFailure();
    if (coolingDown) return Promise.reject(coolingDown);
    const epoch = generation;
    const task = Promise.resolve().then(async () => {
      try {
        const result = await call('/api/v1/auth/session', {}, parseAuthSession);
        return adopt(result, epoch);
      } catch (error) {
        if (!disposed && epoch === generation && state.status !== 'unavailable') {
          if (error instanceof PlatformApiError && error.status === 401) return state;
          session = undefined;
          emit({ status: 'error', user: null, expiresAt: null,
            error: error instanceof PlatformApiError ? error : new PlatformApiError('network', 'Não foi possível consultar a sessão.') });
        }
        if (error instanceof PlatformApiError && [401, 404].includes(error.status ?? 0)) return state;
        throw error;
      }
    });
    loading = task;
    void task.then(() => { if (loading === task) loading = undefined; }, () => { if (loading === task) loading = undefined; });
    return task;
  }
  async function requireSession(load = true) {
    if (!session && load) await getSession();
    if (!session?.authenticated || !session.csrfToken || !session.expiresAt || Date.parse(session.expiresAt) <= Date.now()) {
      const error = new PlatformApiError('http', 'Entre novamente para continuar.', { status: 401, code: 'AUTH_REQUIRED' });
      clear(error);
      throw error;
    }
    return session;
  }
  function refresh(): Promise<AuthState> {
    if (loggingOut) return Promise.reject(new PlatformApiError('busy', 'O encerramento da sessão está em andamento.'));
    if (refreshing) return refreshing;
    const coolingDown = cooldownFailure();
    if (coolingDown) return Promise.reject(coolingDown);
    const task = Promise.resolve().then(async () => {
      try {
        // Resolve the initial session before entering the rotation queue.
        if (!session && loading) await loading;
        if (!session) {
          const epoch = generation;
          adopt(await call('/api/v1/auth/session', {}, parseAuthSession), epoch);
        }
        return await serial(async () => {
          const current = await requireSession(false);
          const epoch = ++generation; // Older session reads cannot restore the previous CSRF.
          const result = await call('/api/v1/auth/refresh', {
            method: 'POST', headers: { 'X-CSRF-Token': current.csrfToken! },
          }, parseAuthSession);
          return adopt(result, epoch);
        });
      } catch (error) {
        // A failed rotation may already have changed the cookie on the server.
        // Discard the old CSRF and require a conscious session lookup/login.
        if (!disposed && error instanceof PlatformApiError && error.status !== 401
          && !(error.status === 404 && error.code === 'AUTH_DISABLED')) {
          session = undefined;
          generation += 1;
          emit({ status: 'error', user: null, expiresAt: null, error });
        }
        throw error;
      }
    });
    refreshing = task;
    void task.then(() => { if (refreshing === task) refreshing = undefined; }, () => { if (refreshing === task) refreshing = undefined; });
    return task;
  }
  async function request<T>(path: string, requestOptions: PlatformRequestOptions, parse: (value: unknown) => T): Promise<T> {
    if (loggingOut) throw new PlatformApiError('busy', 'O encerramento da sessão está em andamento.');
    const coolingDown = cooldownFailure();
    if (coolingDown) throw coolingDown;
    if (refreshing) await refreshing;
    const current = await requireSession();
    if (current.expiresAt && Date.parse(current.expiresAt) - Date.now() < 30_000) await refresh();
    if (requestOptions.method !== 'POST') return call(path, requestOptions, parse);
    return serial(async () => {
      const latest = await requireSession(false);
      return call(path, { ...requestOptions, headers: { ...requestOptions.headers, 'X-CSRF-Token': latest.csrfToken! } }, parse);
    });
  }
  function logout(): Promise<void> {
    if (loggingOut) return loggingOut;
    const coolingDown = cooldownFailure();
    if (coolingDown) return Promise.reject(coolingDown);
    const task = Promise.resolve().then(async () => {
      try {
        if (refreshing) await refreshing;
        await requireSession();
        await serial(async () => {
          const current = await requireSession(false);
          ++generation;
          await call('/api/v1/auth/logout', { method: 'POST', headers: { 'X-CSRF-Token': current.csrfToken! } }, value => {
            if (value !== undefined) throw new PlatformApiError('protocol', 'O serviço retornou uma resposta inválida.');
          });
        });
      } finally { clear(); }
    });
    loggingOut = task;
    void task.then(() => { if (loggingOut === task) loggingOut = undefined; }, () => { if (loggingOut === task) loggingOut = undefined; });
    return task;
  }
  return {
    googleLoginUrl: `${baseUrl.replace(/\/+$/, '')}/api/v1/auth/login/google`,
    getState: () => state,
    subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); },
    getSession, refresh, logout, request,
    me: (requestOptions = {}) => request('/api/v1/me', requestOptions, parseAuthUser),
    expire: () => {
      if (state.status !== 'authenticated' || !state.expiresAt || Date.parse(state.expiresAt) > Date.now()) return;
      if (refreshing) {
        // A bounded rotation can outlive the previous cookie's expiry. Hide the
        // stale identity while keeping its generation valid for the new session.
        emit({ status: 'loading', user: null, expiresAt: null, error: null });
      } else clear();
    },
    dispose: () => {
      disposed = true;
      generation += 1;
      session = undefined;
      controllers.forEach(controller => controller.abort());
      controllers.clear();
      listeners.clear();
    },
  };
}

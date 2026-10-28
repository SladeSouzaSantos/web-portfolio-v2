import type { AuthClient, AuthClientOptions } from './authClient';
import type { AuthSessionNotice, AuthSessionResponse, AuthState, AuthUser } from '../types/auth';
import { createAuthCoordination, type AuthCoordination } from './authCoordination';
import { createPlatformHttp, PlatformApiError, type PlatformRequestOptions } from './platformHttp';
import { safeLoginReturnTo } from './authNavigation';

const anonymous = (): AuthState => ({ status: 'anonymous', user: null, expiresAt: null, error: null });
const stale = () => new PlatformApiError('aborted', 'Uma consulta anterior foi descartada porque a sessão mudou.');
const required = () => new PlatformApiError('http', 'Entre novamente para continuar.', { status: 401, code: 'AUTH_REQUIRED' });
const checkRequired = () => new PlatformApiError('busy', 'Verifique a sessão antes de continuar.', { code: 'AUTH_SESSION_CHECK_REQUIRED' });
type ActiveSession = AuthSessionResponse & { user: AuthUser; csrfToken: string; expiresAt: string };
const active = (value: AuthSessionResponse | undefined): value is ActiveSession =>
  !!value?.authenticated && !!value.user && !!value.csrfToken && !!value.expiresAt && Date.parse(value.expiresAt) > Date.now();

/** Credentials remain tab-local. Notifications only invalidate; the API grants identity. */
export function createSessionClient(baseUrl: string, options: AuthClientOptions,
  parseSession: (value: unknown) => AuthSessionResponse, parseUser: (value: unknown) => AuthUser): AuthClient {
  const http = createPlatformHttp(baseUrl, options);
  let session: AuthSessionResponse | undefined;
  let state: AuthState = { status: 'loading', user: null, expiresAt: null, error: null };
  let notice: AuthSessionNotice | null = null;
  const listeners = new Set<() => void>();
  const controllers = new Map<AbortController, boolean>();
  let coordination: AuthCoordination | undefined;
  let unsubscribe: (() => void) | undefined;
  let loading: Promise<AuthState> | undefined;
  let refreshing: Promise<AuthState> | undefined;
  let loggingOut: Promise<void> | undefined;
  let tail: Promise<unknown> = Promise.resolve();
  let generation = 0;
  let disposed = false;
  let blocked = false;
  let retryAt = 0;
  let cooldownError: PlatformApiError | undefined;
  let exclusiveDepth = 0;
  let remotePending = false;
  let resyncQueued = false;
  let lastReadAt = 0;
  let remoteRotationVersion = 0;
  let adoptedRotationVersion = 0;
  const cooling = () => Date.now() < retryAt ? cooldownError : undefined;
  function emit(next: AuthState) {
    if (disposed) return;
    state = { ...next, notice, retryAt };
    listeners.forEach(listener => listener());
  }
  function invalidate(error?: PlatformApiError, status: AuthState['status'] = 'anonymous') {
    session = undefined;
    ++generation;
    loading = undefined;
    controllers.forEach((reading, controller) => { if (reading) controller.abort(); });
    emit({ status, user: null, expiresAt: null, error: error ?? null });
  }
  function publish(type: Parameters<AuthCoordination['publish']>[0]) { coordination?.publish(type); }
  function resync() {
    if (resyncQueued || disposed || blocked || loggingOut) return;
    resyncQueued = true;
    queueMicrotask(() => {
      resyncQueued = false;
      if (!disposed && !blocked && !loggingOut) void getSession().catch(() => {});
    });
  }
  function remoteChanged() {
    if (disposed || blocked || loggingOut) return;
    invalidate(undefined, 'loading');
    resync();
  }
  function coordinator() {
    // Delay browser resources until an effect/method runs, avoiding StrictMode render leaks.
    if (!coordination) {
      coordination = options.coordination ?? createAuthCoordination(baseUrl);
      unsubscribe = coordination.subscribe(event => {
        if (disposed) return;
        if (event.type === 'session-changed') ++remoteRotationVersion;
        if (event.type === 'logout-confirmed') {
          blocked = true;
          notice = null;
          invalidate();
        } else if (event.type === 'session-invalidated') {
          blocked = true;
          if (notice?.kind !== 'logout-uncertain') notice = { kind: 'session-check-required',
            message: 'A sessão mudou ou não pôde ser confirmada em outra aba. Verifique a sessão antes de continuar.' };
          invalidate(undefined, 'error');
        } else if (exclusiveDepth) remotePending = true;
        else remoteChanged();
      });
    }
    return coordination;
  }
  async function exclusive<T>(operation: (signal: AbortSignal) => Promise<T>, signal?: AbortSignal): Promise<T> {
    return coordinator().runExclusive(async lockedSignal => {
      if (disposed) throw stale();
      ++exclusiveDepth;
      try { return await operation(lockedSignal); }
      finally {
        --exclusiveDepth;
        if (!exclusiveDepth && remotePending) { remotePending = false; queueMicrotask(remoteChanged); }
      }
    }, signal);
  }
  function failure(error: unknown, epoch: number) {
    if (disposed || epoch !== generation || !(error instanceof PlatformApiError)) return;
    if (error.status === 401 || (error.status === 403 && ['AUTH_ADMIN_ONLY', 'AUTH_FORBIDDEN'].includes(error.code ?? ''))) {
      blocked = true;
      if (error.status === 403) notice = { kind: 'session-check-required', message: 'Acesso negado. Apenas o administrador tem acesso.' };
      invalidate(error);
      publish('session-invalidated');
    } else if (error.status === 403 && ['AUTH_CSRF', 'CSRF_INVALID'].includes(error.code ?? '')) {
      blocked = true;
      notice = { kind: 'session-check-required', message: 'A proteção da sessão mudou. Verifique a sessão antes de tentar a operação novamente.' };
      invalidate(error, 'error');
    } else if (error.status === 404 && error.code === 'AUTH_DISABLED') {
      blocked = true;
      invalidate(error, 'unavailable');
    }
  }
  async function call<T>(path: string, requestOptions: PlatformRequestOptions, parse: (value: unknown) => T): Promise<T> {
    if (disposed) throw stale();
    const cooldown = cooling();
    if (cooldown) throw cooldown;
    const epoch = generation;
    const controller = new AbortController();
    const abort = () => controller.abort();
    requestOptions.signal?.addEventListener('abort', abort, { once: true });
    if (requestOptions.signal?.aborted) controller.abort();
    controllers.set(controller, requestOptions.method !== 'POST');
    try {
      const result = await http.request(path, { ...requestOptions, credentials: 'include', signal: controller.signal }, parse);
      if (disposed || epoch !== generation) throw stale();
      return result;
    } catch (error) {
      if (!disposed && epoch === generation && error instanceof PlatformApiError && error.retryAt !== undefined && error.retryAt > retryAt) {
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
  function adopt(next: AuthSessionResponse, epoch: number, manual = false) {
    if (disposed || epoch !== generation) return;
    session = next;
    adoptedRotationVersion = remoteRotationVersion;
    if (manual) {
      blocked = false;
      if (notice?.kind === 'logout-not-sent' || notice?.kind === 'logout-uncertain' || notice?.kind === 'logout-active') notice = active(next)
        ? { kind: 'logout-active', message: 'A sessão continua ativa no servidor. Para encerrá-la, use o logout novamente se desejar.' }
        : { kind: 'logout-inactive', message: 'Nenhuma sessão ativa foi encontrada neste navegador.' };
      else if (notice?.kind === 'session-check-required' || notice?.kind === 'coordination-required') notice = null;
    }
    if (!loggingOut) emit(active(next)
      ? { status: 'authenticated', user: next.user, expiresAt: next.expiresAt, error: null } : anonymous());
  }
  async function readSession(signal?: AbortSignal, manual = false) {
    const epoch = generation;
    const previouslyActive = active(session);
    const next = await call('/api/v1/auth/session', { signal }, parseSession);
    lastReadAt = Date.now();
    adopt(next, epoch, manual);
    if (previouslyActive && !active(next)) { blocked = true; publish('session-invalidated'); }
    return next;
  }
  function serial<T>(operation: () => Promise<T>): Promise<T> {
    const result = tail.then(operation, operation);
    tail = result.then(() => undefined, () => undefined);
    return result;
  }
  function getSession(): Promise<AuthState> {
    if (disposed) return Promise.reject(stale());
    if (loggingOut) return Promise.reject(new PlatformApiError('busy', 'O encerramento da sessão está em andamento.'));
    if (refreshing) return refreshing;
    if (loading) return loading;
    const cooldown = cooling();
    if (cooldown) return Promise.reject(cooldown);
    const epoch = generation;
    const task = Promise.resolve().then(async () => {
      try {
        if (coordinator().supported) {
          try { await exclusive(signal => readSession(signal, true)); }
          catch (error) {
            // A policy-blocked Web Locks API must not block a read-only lookup.
            // Only reads have this fallback; no protected POST uses it.
            if (!(error instanceof PlatformApiError && error.kind === 'busy' && error.code === 'AUTH_COORDINATION_UNAVAILABLE')) throw error;
            await readSession(undefined, true);
          }
        } else await readSession(undefined, true);
        return state;
      } catch (error) {
        if (!disposed && epoch === generation && state.status !== 'unavailable') {
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
  function current() { if (!active(session)) throw required(); return session; }
  function writable() {
    if (blocked) throw checkRequired();
    if (!coordinator().supported) {
      notice = { kind: 'coordination-required', message: 'Este navegador não permite coordenar alterações da sessão entre abas. Consulte a sessão ou use um navegador compatível para alterar dados ou sair.' };
      emit(state);
      throw new PlatformApiError('busy', notice.message, { code: 'AUTH_COORDINATION_UNAVAILABLE' });
    }
  }
  async function rotate(value: ActiveSession, signal: AbortSignal) {
    const epoch = ++generation;
    try {
      adopt(await call('/api/v1/auth/refresh', { method: 'POST', signal,
        headers: { 'X-CSRF-Token': value.csrfToken } }, parseSession), epoch);
      publish('session-changed');
      return state;
    } catch (error) {
      if (!disposed) {
        blocked = true;
        if (!(error instanceof PlatformApiError && [401, 404].includes(error.status ?? 0))) {
          notice = { kind: 'session-check-required', message: 'Não foi possível confirmar a renovação. Verifique a sessão antes de continuar.' };
          invalidate(error instanceof PlatformApiError ? error : undefined, 'error');
        }
        publish('session-invalidated');
      }
      throw error;
    }
  }
  function refresh(): Promise<AuthState> {
    if (loggingOut) return Promise.reject(new PlatformApiError('busy', 'O encerramento da sessão está em andamento.'));
    if (refreshing) return refreshing;
    const cooldown = cooling();
    if (cooldown) return Promise.reject(cooldown);
    const observedCsrf = session?.csrfToken;
    const initialLoad = loading;
    const rotationAtStart = remoteRotationVersion;
    const rotationAwaitingValidation = adoptedRotationVersion !== rotationAtStart;
    const task = serial(async () => {
      writable();
      if (!observedCsrf && initialLoad) await initialLoad;
      const baseline = observedCsrf ?? session?.csrfToken;
      return exclusive(async signal => {
        writable();
        ++generation;
        await readSession(signal);
        const latest = current();
        // A received rotation hint may have cleared the baseline while its GET
        // was pending. It can skip a duplicate POST only after this active GET;
        // the event never grants identity or supplies credentials.
        if (rotationAwaitingValidation || remoteRotationVersion !== rotationAtStart
          || (baseline && baseline !== latest.csrfToken)) return state;
        return rotate(latest, signal);
      });
    });
    refreshing = task;
    void task.then(() => { if (refreshing === task) refreshing = undefined; }, () => { if (refreshing === task) refreshing = undefined; });
    return task;
  }
  async function request<T>(path: string, requestOptions: PlatformRequestOptions, parse: (value: unknown) => T): Promise<T> {
    if (loggingOut) throw new PlatformApiError('busy', 'O encerramento da sessão está em andamento.');
    const cooldown = cooling();
    if (cooldown) throw cooldown;
    if (refreshing) await refreshing;
    if (blocked) throw checkRequired();
    if (!session) await getSession();
    const value = current();
    if (requestOptions.method !== 'POST') {
      const epoch = generation;
      // Let StrictMode cleanup/caller cancellation retire an obsolete read before
      // fetch starts. An invalidation during this yield must also retire it.
      await Promise.resolve();
      if (disposed || blocked || loggingOut || epoch !== generation) throw stale();
      if (Date.parse(value.expiresAt) - Date.now() < 30_000 && coordinator().supported) await refresh();
      return call(path, requestOptions, parse);
    }
    return serial(async () => {
      if (loggingOut) throw new PlatformApiError('busy', 'O encerramento da sessão está em andamento.');
      writable();
      return exclusive(async signal => {
        writable();
        ++generation;
        await readSession(signal);
        let latest = current();
        if (Date.parse(latest.expiresAt) - Date.now() < 30_000) { await rotate(latest, signal); latest = current(); }
        const headers = new Headers(requestOptions.headers);
        headers.set('X-CSRF-Token', latest.csrfToken);
        return call(path, { ...requestOptions, signal, headers: Object.fromEntries(headers) }, parse);
      }, requestOptions.signal);
    });
  }
  function logout(): Promise<void> {
    if (loggingOut) return loggingOut;
    let postDispatched = false;
    let confirmed = false;
    const previousUncertain = notice?.kind === 'logout-uncertain';
    const confirm = () => {
      blocked = true;
      notice = { kind: 'logout-confirmed', message: 'Sessão encerrada.' };
      invalidate();
      publish('logout-confirmed');
    };
    const fail = (error: unknown) => {
      blocked = true;
      if (postDispatched || previousUncertain) notice = { kind: 'logout-uncertain',
        message: 'Não foi possível confirmar o encerramento da sessão. Verifique a sessão antes de tentar sair novamente.' };
      else {
        const code = error instanceof PlatformApiError ? error.code : undefined;
        const reason = code === 'AUTH_COORDINATION_UNAVAILABLE'
          ? 'Este navegador não permite coordenar alterações da sessão entre abas. Use um navegador compatível.'
          : code === 'AUTH_COORDINATION_TIMEOUT' || code === 'AUTH_COORDINATION_BUSY'
            ? 'A sessão está ocupada em outra aba. Aguarde e tente novamente manualmente.'
            : cooling()
              ? 'O serviço pediu uma pausa nas consultas. Aguarde o prazo indicado antes de verificar a sessão.'
              : 'Não foi possível verificar a sessão para sair. Verifique a sessão antes de tentar novamente.';
        notice = { kind: 'logout-not-sent', message: 'O logout não foi executado. Nenhum pedido de encerramento foi enviado. ' + reason };
      }
      invalidate(error instanceof PlatformApiError ? error : undefined, 'error');
      if (postDispatched) publish('session-invalidated');
    };
    const cooldown = cooling();
    if (cooldown) { fail(cooldown); return Promise.reject(cooldown); }
    emit({ status: 'loading', user: null, expiresAt: null, error: null });
    const task = Promise.resolve().then(async () => {
      try {
        const cooldown = cooling();
        if (cooldown) throw cooldown;
        if (refreshing) await refreshing;
        await serial(async () => {
          writable();
          await exclusive(async signal => {
            writable();
            ++generation;
            await readSession(signal);
            if (!active(session)) {
              blocked = true;
              notice = { kind: 'logout-inactive', message: 'Nenhuma sessão ativa foi encontrada neste navegador.' };
              invalidate();
              publish('session-invalidated');
              return;
            }
            await call('/api/v1/auth/logout', { method: 'POST', signal,
              headers: { 'X-CSRF-Token': session.csrfToken },
              onDispatch: () => { postDispatched = true; },
            }, value => {
              if (value !== undefined) throw new PlatformApiError('protocol', 'O serviço retornou uma resposta inválida.');
              confirmed = true;
            });
          });
        });
        if (confirmed) confirm();
      } catch (error) {
        // A valid ACK wins over a later coordination/cancellation error.
        if (confirmed) { confirm(); return; }
        fail(error);
        throw error;
      }
    });
    loggingOut = task;
    void task.then(() => { if (loggingOut === task) loggingOut = undefined; }, () => { if (loggingOut === task) loggingOut = undefined; });
    return task;
  }
  return {
    googleLoginUrl: baseUrl.replace(/\/+$/, '') + '/api/v1/auth/login/google',
    getGoogleLoginUrl(returnTo) {
      const path = safeLoginReturnTo(returnTo);
      return baseUrl.replace(/\/+$/, '') + '/api/v1/auth/login/google' + (path === undefined ? '' : '?' + new URLSearchParams({ returnTo: path }));
    },
    getState: () => state,
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    getSession, refresh, logout, request,
    revalidate: () => disposed || blocked || loggingOut || state.status === 'unavailable' || Date.now() - lastReadAt < 1000
      ? Promise.resolve(state) : getSession(),
    dismissNotice() {
      if (notice?.kind === 'logout-not-sent' || notice?.kind === 'logout-uncertain' || notice?.kind === 'session-check-required') return;
      notice = null;
      emit(state);
    },
    me: (requestOptions = {}) => request('/api/v1/me', requestOptions, parseUser),
    expire() {
      if (state.status !== 'authenticated' || !state.expiresAt || Date.parse(state.expiresAt) > Date.now()) return;
      if (refreshing) emit({ status: 'loading', user: null, expiresAt: null, error: null });
      else { invalidate(undefined, 'loading'); resync(); }
    },
    dispose() {
      disposed = true;
      ++generation;
      session = undefined;
      unsubscribe?.();
      (coordination ?? options.coordination)?.dispose();
      controllers.forEach((_reading, controller) => controller.abort());
      controllers.clear();
      listeners.clear();
      state = { ...anonymous(), notice, retryAt };
    },
  };
}

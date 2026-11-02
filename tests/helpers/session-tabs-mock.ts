import type { BrowserContext, Page, Route } from '@playwright/test';
import type { AuthClient } from '../../src/services/authClient';
import type { AuthState } from '../../src/types/auth';
import { adminMeeting, MOCK_MEETING_ID, MOCK_USER_ID, platformError } from './platform-mock';

export const SESSION_COOKIE = 'phasscode-session';
export const SESSION_PATH = '/api/v1/auth/session';
export const REFRESH_PATH = '/api/v1/auth/refresh';
export const LOGOUT_PATH = '/api/v1/auth/logout';
export const ADMIN_PATH = '/api/v1/admin/meetings';
export const UNCERTAIN_LOGOUT = 'Não foi possível confirmar o encerramento da sessão. Verifique a sessão antes de tentar sair novamente.';
export const ACTIVE_SESSION = 'A sessão continua ativa no servidor. Para encerrá-la, use o logout novamente se desejar.';
export const NO_SESSION = 'Nenhuma sessão ativa foi encontrada neste navegador.';
export const coordinationName = (baseURL: string) => `phasscode-auth:v1:${baseURL.replace(/\/+$/, '')}`;

type GateKind = 'refresh' | 'logout' | 'command';
type Failure = 'network-before' | 'network-after' | 'timeout' | 403 | 503;
interface ServerSession { cookie: string; csrf: string; expiresAt: number; rotated: boolean }
export interface RecordedSessionRequest {
  method: string;
  path: string;
  cookie: string | undefined;
  csrf: string | undefined;
  origin: string | undefined;
  accepted?: boolean;
  status?: number;
}
export interface ResponseGate { release(): void; readonly entered: Promise<void> }

export async function installSessionTabsMock(context: BrowserContext, baseURL: string) {
  const origin = new URL(baseURL).origin;
  if (origin !== 'http://127.0.0.1:4178') throw new Error('F2 requires its own HTTP loopback origin.');
  const requests: RecordedSessionRequest[] = [];
  const unexpected: string[] = [];
  const external: string[] = [];
  const runtimeErrors: string[] = [];
  context.on('page', page => page.on('pageerror', error => runtimeErrors.push(error.message)));
  for (const page of context.pages()) page.on('pageerror', error => runtimeErrors.push(error.message));
  const sessions = new Map<string, ServerSession>();
  let generation = 0;
  let familyRevoked = false;
  let admin = true;
  let logoutFailure: Failure | undefined;
  let commandFailure: 'AUTH_CSRF' | 'AUTH_ADMIN_ONLY' | undefined;
  let commitRefreshBeforeReply = false;
  let current = nextSession();
  const queuedGates = new Map<GateKind, Array<{ wait: Promise<void>; enter(): void; release(): void }>>();
  const allGates: Array<{ release(): void }> = [];
  const writes: Array<{ action: string; generation: number }> = [];
  function nextSession(): ServerSession {
    const suffix = (++generation).toString(36).padStart(3, '0');
    const session = { cookie: `${'s'.repeat(40)}${suffix}`, csrf: `${'c'.repeat(40)}${suffix}`,
      expiresAt: Date.now() + 600_000, rotated: false };
    sessions.set(session.cookie, session);
    return session;
  }
  function active(session: ServerSession | undefined): session is ServerSession {
    return !!session && !session.rotated && !familyRevoked && admin && session.expiresAt > Date.now();
  }
  const cookieHeader = (value: string) => `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax`;
  const clearCookie = `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
  async function reply(route: Route, entry: RecordedSessionRequest, status: number, body?: unknown, headers: Record<string, string> = {}) {
    entry.status = status;
    try {
      await route.fulfill({ status, headers: { 'Cache-Control': 'no-store', ...headers },
        ...(status !== 204 && { json: body }) });
    } catch { /* A deliberately closed/aborted tab may no longer accept a reply. */ }
  }
  async function gate(kind: GateKind) {
    const next = queuedGates.get(kind)?.shift();
    if (next) { next.enter(); await next.wait; }
  }
  function holdNext(kind: GateKind): ResponseGate {
    let release!: () => void;
    let enter!: () => void;
    const wait = new Promise<void>(resolve => { release = resolve; });
    const entered = new Promise<void>(resolve => { enter = resolve; });
    const item = { wait, enter, release };
    queuedGates.set(kind, [...queuedGates.get(kind) ?? [], item]);
    allGates.push(item);
    return { release, entered };
  }
  await context.addCookies([{ name: SESSION_COOKIE, value: current.cookie, url: origin,
    httpOnly: true, sameSite: 'Lax', secure: false }]);
  await context.route('**/*', async route => {
    if (new URL(route.request().url()).origin === origin) await route.continue();
    else { external.push(route.request().url()); await route.abort('blockedbyclient'); }
  });
  await context.route('**/api/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const headers = await request.allHeaders();
    const cookie = headers.cookie?.split(';').map(item => item.trim())
      .find(item => item.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
    const session = cookie ? sessions.get(cookie) : undefined;
    const entry: RecordedSessionRequest = {
      method: request.method(), path: url.pathname, cookie,
      csrf: headers['x-csrf-token'], origin: headers.origin,
    };
    requests.push(entry);
    if (url.origin !== origin) {
      external.push(url.href);
      await route.abort('blockedbyclient');
      return;
    }
    if (entry.method === 'GET' && entry.path === SESSION_PATH) {
      await reply(route, entry, 200, active(session) ? {
        authenticated: true,
        user: { id: MOCK_USER_ID, email: 'synthetic-admin@example.test', displayName: 'Administrador sintético', roles: ['admin', 'user'] },
        csrfToken: session.csrf, expiresAt: new Date(session.expiresAt).toISOString(),
      } : { authenticated: false, user: null, csrfToken: null, expiresAt: null },
      !active(session) && cookie ? { 'Set-Cookie': clearCookie } : {});
      return;
    }
    if (entry.method === 'GET' && entry.path === ADMIN_PATH) {
      await reply(route, entry, active(session) ? 200 : 401,
        active(session) ? { items: [adminMeeting('PENDING')], nextCursor: null } : platformError('AUTH_REQUIRED'));
      return;
    }
    if (entry.method === 'GET' && entry.path === '/api/v1/auth/login/google') {
      await reply(route, entry, 200, { synthetic: true });
      return;
    }
    const command = /^\/api\/v1\/admin\/meetings\/[^/]+\/(approve|reject|cancel)$/.exec(entry.path);
    if (entry.method !== 'POST' || (!command && ![REFRESH_PATH, LOGOUT_PATH].includes(entry.path))) {
      unexpected.push(`${entry.method} ${entry.path}`);
      await reply(route, entry, 503, platformError('UNEXPECTED_TEST_REQUEST'));
      return;
    }
    // Refresh checks the old session's Origin/CSRF before detecting replay, as
    // the real API does. A mismatched CSRF alone does not revoke the family.
    const mayInspectRotated = entry.path === REFRESH_PATH && session && !familyRevoked;
    if (!active(session) && !mayInspectRotated) {
      await reply(route, entry, 401, platformError('AUTH_REQUIRED'));
      return;
    }
    if (entry.origin !== origin || entry.csrf !== session?.csrf) {
      await reply(route, entry, 403, platformError('AUTH_CSRF'));
      return;
    }
    if (!admin) { await reply(route, entry, 403, platformError('AUTH_ADMIN_ONLY')); return; }
    entry.accepted = true;
    if (entry.path === REFRESH_PATH) {
      const rotate = () => {
        if (session!.rotated || session!.expiresAt <= Date.now()) {
          if (session!.rotated) familyRevoked = true;
          return undefined;
        }
        session!.rotated = true;
        current = nextSession();
        return current;
      };
      let rotated = commitRefreshBeforeReply ? rotate() : undefined;
      await gate('refresh');
      if (!commitRefreshBeforeReply) rotated = rotate();
      if (!rotated) { await reply(route, entry, 401, platformError('AUTH_REQUIRED')); return; }
      await reply(route, entry, 200, {
        authenticated: true,
        user: { id: MOCK_USER_ID, email: 'synthetic-admin@example.test', displayName: 'Administrador sintético', roles: ['admin', 'user'] },
        csrfToken: rotated.csrf, expiresAt: new Date(rotated.expiresAt).toISOString(),
      }, { 'Set-Cookie': cookieHeader(rotated.cookie) });
      return;
    }
    if (entry.path === LOGOUT_PATH) {
      const failure = logoutFailure;
      logoutFailure = undefined;
      await gate('logout');
      if (failure === 'network-before' || failure === 'timeout') {
        entry.status = 0;
        await route.abort(failure === 'timeout' ? 'timedout' : 'internetdisconnected').catch(() => {});
        return;
      }
      if (typeof failure === 'number') {
        await reply(route, entry, failure, platformError(failure === 403 ? 'AUTH_CSRF' : 'AUTH_UNAVAILABLE'));
        return;
      }
      familyRevoked = true;
      if (failure === 'network-after') {
        entry.status = 0;
        await route.abort('internetdisconnected').catch(() => {});
      } else await reply(route, entry, 204, undefined, { 'Set-Cookie': clearCookie });
      return;
    }
    await gate('command');
    if (commandFailure) {
      const failure = commandFailure;
      commandFailure = undefined;
      await reply(route, entry, 403, platformError(failure));
      return;
    }
    writes.push({ action: command![1], generation });
    await reply(route, entry, 200, adminMeeting(command![1] === 'approve' ? 'APPROVED' : command![1] === 'reject' ? 'REJECTED' : 'CANCELLED'));
  });
  return {
    requests, unexpected, external, runtimeErrors, writes, holdNext,
    posts: (path: string) => requests.filter(entry => entry.method === 'POST' && entry.path === path),
    sessions: () => requests.filter(entry => entry.method === 'GET' && entry.path === SESSION_PATH),
    current: () => ({ ...current }),
    familyRevoked: () => familyRevoked,
    failNextLogout: (failure: Failure) => { logoutFailure = failure; },
    failNextCommand: (failure: 'AUTH_CSRF' | 'AUTH_ADMIN_ONLY') => { commandFailure = failure; },
    revoke: () => { familyRevoked = true; },
    expire: () => { current.expiresAt = Date.now() - 1; },
    commitRefreshBeforeReply: () => { commitRefreshBeforeReply = true; },
    dispose: () => { allGates.forEach(item => item.release()); },
  };
}
export type SessionTabsMock = Awaited<ReturnType<typeof installSessionTabsMock>>;

interface OperationResult { ok: boolean; state: AuthState; error?: { kind?: string; status?: number; code?: string } }
interface BrowserDriver { client: AuthClient; tasks: Record<string, Promise<OperationResult>> }
declare global {
  interface Window {
    __f2Driver?: BrowserDriver;
    __f2Messages?: Array<{ name: string; data: unknown }>;
    __f2DropMessages?: boolean;
    __f2LockHeld?: boolean;
  }
}

/** Test-owned instrumentation: no production export, debug globals or secrets. */
export async function instrumentSessionApis(context: BrowserContext, options: { noChannel?: boolean; noLocks?: boolean; dropMessages?: boolean } = {}) {
  await context.addInitScript(options => {
    window.__f2Messages = [];
    window.__f2DropMessages = options.dropMessages;
    if (options.noLocks) Object.defineProperty(navigator, 'locks', { value: undefined, configurable: true });
    const NativeChannel = window.BroadcastChannel;
    if (options.noChannel) Object.defineProperty(window, 'BroadcastChannel', { value: undefined, configurable: true });
    else if (NativeChannel) window.BroadcastChannel = class extends NativeChannel {
      override postMessage(data: unknown) {
        window.__f2Messages!.push({ name: this.name, data: structuredClone(data) });
        if (!window.__f2DropMessages) super.postMessage(data);
      }
    };
  }, options);
}

export async function attachBrowserClient(page: Page, baseURL: string, timeoutMs = 5000, lockTimeoutMs?: number) {
  await page.evaluate(async ({ baseURL, timeoutMs, lockTimeoutMs }) => {
    const path = '/src/services/authClient.ts';
    const { createAuthClient } = await import(path) as typeof import('../../src/services/authClient');
    const coordinationPath = '/src/services/authCoordination.ts';
    const { createAuthCoordination } = await import(coordinationPath) as typeof import('../../src/services/authCoordination');
    const coordination = lockTimeoutMs === undefined ? undefined : createAuthCoordination(baseURL, { lockTimeoutMs });
    window.__f2Driver = { client: createAuthClient(baseURL, { timeoutMs, ...(coordination && { coordination }) }), tasks: {} };
    await window.__f2Driver.client.getSession();
  }, { baseURL, timeoutMs, lockTimeoutMs });
}

export async function startOperation(page: Page, name: string, action: 'refresh' | 'logout' | 'session' | 'approve' | 'reject' | 'cancel') {
  await page.evaluate(({ name, action, meetingId }) => {
    const driver = window.__f2Driver!;
    const task = action === 'refresh' ? driver.client.refresh()
      : action === 'logout' ? driver.client.logout()
        : action === 'session' ? driver.client.getSession()
          : driver.client.request(`/api/v1/admin/meetings/${meetingId}/${action}`, { method: 'POST' }, value => value);
    driver.tasks[name] = task.then(() => ({ ok: true, state: driver.client.getState() }), error => ({
      ok: false, state: driver.client.getState(), error: { kind: error.kind, status: error.status, code: error.code },
    }));
  }, { name, action, meetingId: MOCK_MEETING_ID });
}
export async function operationResult(page: Page, name: string): Promise<OperationResult> {
  return page.evaluate(name => window.__f2Driver!.tasks[name], name);
}
export async function browserState(page: Page) { return page.evaluate(() => window.__f2Driver!.client.getState()); }
export async function settleBrowserEvents(page: Page) {
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}

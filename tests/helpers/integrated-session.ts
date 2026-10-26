import type { APIRequestContext, BrowserContext, Page, Response } from '@playwright/test';
import type { AuthClient } from '../../src/services/authClient';
import type { AuthSessionResponse, AuthState } from '../../src/types/auth';

export const FRONTEND_URL = 'http://127.0.0.1:5173';
export const API_URL = 'http://127.0.0.1:3000';
export const OIDC_URL = 'http://127.0.0.1:4400';
export const CONTROL_URL = 'http://127.0.0.1:4401';
export const SESSION_PATH = '/api/v1/auth/session';
export const REFRESH_PATH = '/api/v1/auth/refresh';
export const LOGOUT_PATH = '/api/v1/auth/logout';
export const ADMIN_PATH = '/api/v1/admin/meetings';
export const CALLBACK_PATH = '/api/v1/auth/callback/google';
export const UNCERTAIN_LOGOUT = 'Não foi possível confirmar o encerramento da sessão.';
export const coordinationName = `phasscode-auth:v1:${API_URL}`;

export interface IntegratedSnapshot {
  ownershipNonce: string;
  migrations: Array<{ name: string; checksum: string }>;
  users: number;
  sessions: { total: number; active: number; revoked: number; expired: number; families: number };
  proposals: number;
  meetings: Array<{ id: string; status: string; version: number }>;
  audit: Array<{ meetingId: string; action: string; version: number }>;
  outbox: Array<{ meetingId: string; kind: string; version: number; attempts: number; processed: boolean }>;
  notifications: number;
  redisKeys: number;
  requests: Array<{ method: string; path: string; status?: number; completed: boolean }>;
  activeRequests: number;
}
export interface IntegratedGate {
  id: string;
  entered: boolean;
  released: boolean;
  completed: boolean;
}
export type AuthorizationScenario = 'admin' | 'denied' | 'cancel' | 'wrong-state' | 'wrong-nonce'
  | 'wrong-issuer' | 'wrong-audience' | 'wrong-signature' | 'provider-error';

function controlHeaders() {
  const key = process.env.B2_CONTROL_KEY ?? process.env.PHASSCODE_B2_CONTROL_KEY;
  if (!key) throw new Error('The isolated B2 control key is required.');
  return { 'X-E2E-Control-Key': key };
}

/** Playwright transport errors can include request headers/URLs in their call
 * log. Do not let callback codes or test credentials escape through that path.
 */
export async function integratedRequest(request: APIRequestContext, url: string,
  options: NonNullable<Parameters<APIRequestContext['fetch']>[1]> = {}) {
  try { return await request.fetch(url, options); }
  catch { throw new Error('The real local API request failed; credential-bearing transport details are omitted.'); }
}

/** Separate test-only control plane. Never installed in, or sent to, the app. */
export function integratedControl(request: APIRequestContext) {
  async function call<T>(method: 'GET' | 'POST', path: string, data?: unknown, origin = CONTROL_URL): Promise<T> {
    const response = await integratedRequest(request, `${origin}${path}`, { method, headers: controlHeaders(),
      ...(method === 'POST' && { data: data ?? {} }) });
    if (!response.ok()) throw new Error(`Isolated control request failed: ${method} ${path}, HTTP ${response.status()}.`);
    return await response.json() as T;
  }
  return {
    reset: () => call<{ ok: boolean }>('POST', '/reset'),
    snapshot: () => call<IntegratedSnapshot>('GET', '/snapshot'),
    changeSessions: (action: 'revoke' | 'expire' | 'remove-admin') => call<{ ok: boolean }>('POST', `/sessions/${action}`),
    gate: (path: string, phase: 'before' | 'after', effect: 'hold' | 'drop') =>
      call<{ id: string }>('POST', '/gates', { path, phase, effect }),
    gateState: (id: string) => call<IntegratedGate>('GET', `/gates/${encodeURIComponent(id)}`),
    release: (id: string) => call<{ ok: boolean }>('POST', `/gates/${encodeURIComponent(id)}/release`),
    bearer: (cookie: string) => call<{ token: string }>('POST', '/bearer', { cookie }),
    authorization: (scenario: AuthorizationScenario, subject?: string) =>
      call<{ id: string }>('POST', '/__control/authorization', { scenario, ...(subject && { subject }) }, OIDC_URL),
  };
}
export type IntegratedControl = ReturnType<typeof integratedControl>;

export async function beginIntegratedLogin(page: Page, context: BrowserContext, control: IntegratedControl,
  scenario: AuthorizationScenario = 'admin', returnTo = '/#sobre'): Promise<Response> {
  const plan = await control.authorization(scenario);
  if (typeof plan.id !== 'string' || !plan.id) throw new Error('The local OIDC plan is invalid.');
  await context.addCookies([{ name: 'e2e-oidc-plan', value: plan.id, domain: '127.0.0.1', path: '/authorize',
    httpOnly: true, secure: false, sameSite: 'Lax' }]);
  await page.goto(`${FRONTEND_URL}${returnTo}`);
  await page.getByRole('button', { name: 'Abrir prévia de login', exact: true }).click();
  const callback = page.waitForResponse(response => {
    const url = new URL(response.url());
    return url.origin === API_URL && url.pathname === CALLBACK_PATH;
  });
  await page.getByRole('button', { name: '[ ENTRAR COM GOOGLE ]', exact: true }).click();
  return callback;
}

export async function integratedCookie(context: BrowserContext) {
  const cookies = (await context.cookies(`${API_URL}${SESSION_PATH}`))
    .filter(cookie => cookie.httpOnly && cookie.name !== 'e2e-oidc-plan');
  if (cookies.length !== 1) throw new Error('Exactly one real API session cookie was expected.');
  return cookies[0];
}
export async function integratedSession(context: BrowserContext): Promise<AuthSessionResponse> {
  // BrowserContext.request inherits the browser proxy, but its HTTP tunnel uses
  // CONNECT, deliberately forbidden by the allowlist proxy. Use a real browser
  // fetch so the session lookup shares the cookie jar and the browser transport.
  const page = context.pages().find(page => page.url().startsWith(`${FRONTEND_URL}/`));
  if (!page) throw new Error('The real frontend page is required for session lookup.');
  const response = await page.evaluate(async url => {
    const response = await fetch(url, { credentials: 'include' });
    return { status: response.status, body: response.ok ? await response.json() : null };
  }, `${API_URL}${SESSION_PATH}`);
  if (response.status !== 200) throw new Error(`Real session lookup failed: HTTP ${response.status}.`);
  const result = response.body as AuthSessionResponse;
  if (typeof result.authenticated !== 'boolean') throw new Error('Real session response is invalid.');
  return result;
}

interface IntegratedOperationResult {
  ok: boolean;
  state: AuthState;
  error?: { kind?: string; status?: number; code?: string };
}
interface IntegratedDriver {
  client: AuthClient;
  tasks: Record<string, Promise<IntegratedOperationResult>>;
}
declare global {
  interface Window {
    __f3Driver?: IntegratedDriver;
    __f3Messages?: Array<{ name: string; data: unknown }>;
    __f3DropMessages?: boolean;
  }
}

/** Browser API fault injection only: no HTTP interception or response fixtures. */
export async function instrumentIntegratedBrowser(context: BrowserContext,
  options: { noLocks?: boolean; noChannel?: boolean; dropMessages?: boolean } = {}) {
  await context.addInitScript(options => {
    window.__f3Messages = [];
    window.__f3DropMessages = options.dropMessages;
    if (options.noLocks) Object.defineProperty(navigator, 'locks', { value: undefined, configurable: true });
    const NativeChannel = window.BroadcastChannel;
    if (options.noChannel) Object.defineProperty(window, 'BroadcastChannel', { value: undefined, configurable: true });
    else if (NativeChannel) window.BroadcastChannel = class extends NativeChannel {
      override postMessage(data: unknown) {
        window.__f3Messages!.push({ name: this.name, data: structuredClone(data) });
        if (!window.__f3DropMessages) super.postMessage(data);
      }
    };
  }, options);
}

/** Imports the production client through Vite; the client calls real Fastify. */
export async function attachIntegratedClient(page: Page, timeoutMs = 5000) {
  await page.evaluate(async ({ apiUrl, timeoutMs }) => {
    window.__f3Driver?.client.dispose();
    const modulePath = '/src/services/authClient.ts';
    const { createAuthClient } = await import(modulePath) as typeof import('../../src/services/authClient');
    window.__f3Driver = { client: createAuthClient(apiUrl, { timeoutMs }), tasks: {} };
    await window.__f3Driver.client.getSession();
  }, { apiUrl: API_URL, timeoutMs });
}
export async function startIntegratedOperation(page: Page, name: string,
  action: 'session' | 'refresh' | 'logout' | 'approve' | 'reject' | 'cancel', meetingId?: string) {
  await page.evaluate(({ name, action, meetingId }) => {
    const driver = window.__f3Driver!;
    if (!driver) throw new Error('The integrated browser client is not attached.');
    const operation = action === 'session' ? driver.client.getSession()
      : action === 'refresh' ? driver.client.refresh()
        : action === 'logout' ? driver.client.logout()
          : driver.client.request(`/api/v1/admin/meetings/${meetingId}/${action}`, { method: 'POST' }, value => value);
    driver.tasks[name] = operation.then(() => ({ ok: true, state: driver.client.getState() }), error => ({
      ok: false, state: driver.client.getState(), error: { kind: error.kind, status: error.status, code: error.code },
    }));
  }, { name, action, meetingId });
}
export function integratedResult(page: Page, name: string): Promise<IntegratedOperationResult> {
  return page.evaluate(name => window.__f3Driver!.tasks[name], name);
}
export function integratedState(page: Page) { return page.evaluate(() => window.__f3Driver!.client.getState()); }

/** Public app client coverage, distinct from the currently Orbe-only form UI. */
export async function createIntegratedMeeting(page: Page, suffix = 'principal', repeat = false) {
  return page.evaluate(async ({ apiUrl, suffix, repeat }) => {
    const modulePath = '/src/services/meetingsClient.ts';
    const { createMeetingsClient } = await import(modulePath) as typeof import('../../src/services/meetingsClient');
    const client = createMeetingsClient(apiUrl);
    const from = new Date();
    from.setUTCDate(from.getUTCDate() + 1);
    from.setUTCHours(0, 0, 0, 0);
    const to = new Date(from.getTime() + 6 * 86_400_000);
    const available = await client.availability(from.toISOString(), to.toISOString());
    if (!available.slots.length) throw new Error('The isolated Calendar adapter returned no future test slot.');
    const proposal = await client.prepareProposal({ start: available.slots[0].start, name: `Visitante E2E ${suffix}`,
      email: 'visitor@example.test', topic: `Integração descartável ${suffix}` });
    const input = { proposalId: proposal.proposalId, confirmationToken: proposal.confirmationToken,
      consent: true as const, consentVersion: proposal.consentVersion };
    const key = crypto.randomUUID();
    const created = await client.confirmRequest(input, key);
    const duplicate = repeat ? await client.confirmRequest(input, key) : created;
    const status = await client.status(created.id, created.meetingToken);
    return { id: created.id, duplicateId: duplicate.id, proposalId: proposal.proposalId,
      status: created.status, observedStatus: status.status };
  }, { apiUrl: API_URL, suffix, repeat });
}

/** Records only public request metadata; never headers, bodies, query or tokens. */
export function observeIntegratedContext(context: BrowserContext) {
  const requests: Array<{ method: string; path: string }> = [];
  const responses: Array<{ method: string; path: string; status: number }> = [];
  const externalOrigins = new Set<string>();
  const runtimeErrors: string[] = [];
  const allowed = new Set([FRONTEND_URL, API_URL, OIDC_URL]);
  context.on('request', request => {
    const url = new URL(request.url());
    if (!allowed.has(url.origin)) externalOrigins.add(url.origin);
    if (url.origin === API_URL) requests.push({ method: request.method(), path: url.pathname });
  });
  context.on('response', response => {
    const url = new URL(response.url());
    if (url.origin === API_URL) responses.push({ method: response.request().method(), path: url.pathname, status: response.status() });
  });
  const watch = (page: Page) => page.on('pageerror', error => runtimeErrors.push(error.name));
  context.pages().forEach(watch);
  context.on('page', watch);
  return { requests, responses, externalOrigins, runtimeErrors };
}

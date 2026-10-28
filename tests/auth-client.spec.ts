import { expect, test } from '@playwright/test';
import { createAuthClient as createProductionAuthClient, parseAuthSession, type AuthClientOptions } from '../src/services/authClient';
import { createAuthCoordination, type AuthCoordinationChannel, type AuthLockManager } from '../src/services/authCoordination';
import { createPlatformHttp, PlatformApiError } from '../src/services/platformHttp';

const API = 'https://phase3-api.invalid';
const ID = '11111111-1111-4111-8111-111111111111';
const TOKEN = 'a'.repeat(43);
const ROTATED = 'b'.repeat(43);
// A test-only exclusive queue models Web Locks. Production never uses this fallback.
function testLocks(): AuthLockManager {
  let tail: Promise<unknown> = Promise.resolve();
  return { request: (name, _options, callback) => {
    const operation = tail.then(() => callback({ name }));
    tail = operation.catch(() => {});
    return operation;
  } };
}
function createAuthClient(baseUrl: string, options: AuthClientOptions = {}) {
  return createProductionAuthClient(baseUrl, { ...options,
    coordination: options.coordination ?? createAuthCoordination(baseUrl, { locks: testLocks(), channelFactory: null }) });
}
const ANON = { authenticated: false, user: null, csrfToken: null, expiresAt: null };
const session = (csrfToken = TOKEN, expiresAt = new Date(Date.now() + 600_000).toISOString()) => ({
  authenticated: true, user: { id: ID, email: 'test@example.test', displayName: 'Aventureiro', roles: ['user'] },
  csrfToken, expiresAt,
});
function json(value: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}
type FakeResponse = Response | ((options: RequestInit | undefined) => Promise<Response>);
function fakeFetch(...responses: FakeResponse[]) {
  const calls: Array<{ url: string; options: RequestInit | undefined }> = [];
  const fetch: typeof globalThis.fetch = async (input, options) => {
    calls.push({ url: String(input), options });
    const response = responses.shift();
    if (!response) throw new Error('Unexpected isolated request.');
    return typeof response === 'function' ? response(options) : response;
  };
  return { fetch, calls };
}
function deferred() {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>(complete => { resolve = complete; });
  return { promise, resolve };
}
function rejectOnAbort(options: RequestInit | undefined): Promise<Response> {
  return new Promise((_resolve, reject) => {
    options?.signal?.addEventListener('abort', () => reject(new DOMException('cancelled', 'AbortError')), { once: true });
  });
}

test('session initialization is shared and exposes no CSRF in public state', async () => {
  const response = deferred();
  const fake = fakeFetch(() => response.promise);
  const client = createAuthClient(API, { fetch: fake.fetch });
  const first = client.getSession();
  const second = client.getSession();
  expect(first).toBe(second);
  response.resolve(json(session()));
  await first;
  expect(fake.calls).toHaveLength(1);
  expect(client.getState()).toMatchObject({ status: 'authenticated', user: { roles: ['user'] } });
  expect(JSON.stringify(client.getState())).not.toContain(TOKEN);
  expect(fake.calls[0].options).toMatchObject({ credentials: 'include', cache: 'no-store', redirect: 'error' });
  expect(new Headers(fake.calls[0].options?.headers).has('Authorization')).toBe(false);
  expect(client.googleLoginUrl).toBe(`${API}/api/v1/auth/login/google`);
});

test('manual Google login URL binds only a safe relative return path without making a request', () => {
  const fake = fakeFetch(json(ANON));
  const client = createAuthClient(`${API}/`, { fetch: fake.fetch });
  const url = new URL(client.getGoogleLoginUrl('/administracao?origem=google#admin-orbe-records'));
  expect(`${url.origin}${url.pathname}`).toBe(client.googleLoginUrl);
  expect(url.searchParams.getAll('returnTo')).toEqual(['/administracao?origem=google#admin-orbe-records']);
  expect(url.hash).toBe('');
  expect(client.getGoogleLoginUrl('//evil.example.test')).toBe(client.googleLoginUrl);
  expect(client.getGoogleLoginUrl('https://evil.example.test')).toBe(client.googleLoginUrl);
  expect(client.getGoogleLoginUrl()).toBe(client.googleLoginUrl);
  expect(fake.calls).toHaveLength(0);
  expect(client.getState()).toMatchObject({ status: 'loading', user: null });
  client.dispose();
});

test('manual login excludes callback errors, OAuth/private values and unrecognized fragments', () => {
  const client = createAuthClient(API);
  const url = new URL(client.getGoogleLoginUrl('/?origem=legado&auth_error=AUTH_ADMIN_ONLY&code=private&state=secret&access_token=secret&email=private%40example.test#private-token'));
  expect(url.searchParams.get('returnTo')).toBe('/?origem=legado');
  expect(client.getState().user).toBeNull();
  client.dispose();
});

test('a login URL or error marker does not authenticate without the cookie-backed session API', async () => {
  const fake = fakeFetch(json(ANON));
  const client = createAuthClient(API, { fetch: fake.fetch });
  client.getGoogleLoginUrl('/?auth_error=AUTH_ADMIN_ONLY#sobre');
  expect(client.getState().status).toBe('loading');
  await client.getSession();
  expect(client.getState()).toMatchObject({ status: 'anonymous', user: null, expiresAt: null });
  expect(fake.calls.map(call => call.url)).toEqual([`${API}/api/v1/auth/session`]);
  expect(fake.calls[0].options?.credentials).toBe('include');
  expect(new Headers(fake.calls[0].options?.headers).has('Authorization')).toBe(false);
  client.dispose();
});

test('anonymous session cannot perform an authenticated mutation', async () => {
  const fake = fakeFetch(json(ANON));
  const client = createAuthClient(API, { fetch: fake.fetch });
  await client.getSession();
  await expect(client.request(`/api/v1/admin/meetings/${ID}/approve`, { method: 'POST' }, value => value))
    .rejects.toMatchObject({ status: 401, code: 'AUTH_REQUIRED' });
  expect(fake.calls).toHaveLength(1);
  expect(client.getState().status).toBe('anonymous');
});

test('a policy-blocked Web Locks API permits a session GET but never falls back for POST', async () => {
  const fake = fakeFetch(json(session()));
  const coordination = createAuthCoordination(API, { channelFactory: null,
    locks: { request: async () => { throw new DOMException('Policy blocked', 'SecurityError'); } } });
  const client = createAuthClient(API, { fetch: fake.fetch, coordination });
  expect((await client.getSession()).status).toBe('authenticated');
  await expect(client.refresh()).rejects.toMatchObject({ code: 'AUTH_COORDINATION_UNAVAILABLE' });
  await expect(client.request(`/api/v1/admin/meetings/${ID}/approve`, { method: 'POST' }, value => value))
    .rejects.toMatchObject({ code: 'AUTH_COORDINATION_UNAVAILABLE' });
  expect(fake.calls.map(call => call.url)).toEqual([`${API}/api/v1/auth/session`]);
  client.dispose();
});

test('concurrent refresh uses one rotation and following command uses current CSRF without body', async () => {
  const response = deferred();
  const fake = fakeFetch(json(session()), json(session()), () => response.promise, json(session(ROTATED)), json({ accepted: true }));
  const client = createAuthClient(API, { fetch: fake.fetch });
  await client.getSession();
  const first = client.refresh();
  const second = client.refresh();
  expect(first).toBe(second);
  const command = client.request(`/api/v1/admin/meetings/${ID}/approve`, {
    method: 'POST', headers: { 'x-csrf-token': TOKEN, 'X-CSRF-Token': 'stale-copy' },
  }, value => value);
  await expect.poll(() => fake.calls.length).toBe(3);
  response.resolve(json(session(ROTATED)));
  await Promise.all([first, second, command]);
  expect(fake.calls.map(call => call.url.split('/').at(-1))).toEqual(['session', 'session', 'refresh', 'session', 'approve']);
  expect(new Headers(fake.calls[2].options?.headers).get('X-CSRF-Token')).toBe(TOKEN);
  expect(new Headers(fake.calls[4].options?.headers).get('X-CSRF-Token')).toBe(ROTATED);
  expect(fake.calls[4].options?.body).toBeUndefined();
  expect(fake.calls[4].options?.credentials).toBe('include');
  expect(JSON.stringify(client.getState())).not.toContain(ROTATED);
});

test('explicit refresh before session initialization loads CSRF and rotates once', async () => {
  const fake = fakeFetch(json(session()), json(session(ROTATED)));
  const client = createAuthClient(API, { fetch: fake.fetch });
  const first = client.refresh();
  expect(client.refresh()).toBe(first);
  await first;
  expect(fake.calls.map(call => [call.url.split('/').at(-1), call.options?.method])).toEqual([
    ['session', 'GET'], ['refresh', 'POST'],
  ]);
  expect(new Headers(fake.calls[1].options?.headers).get('X-CSRF-Token')).toBe(TOKEN);
  expect(client.getState().status).toBe('authenticated');
  expect(JSON.stringify(client.getState())).not.toContain(ROTATED);
  client.dispose();
});

test('refresh adopts a changed known CSRF without another rotation even without a channel', async () => {
  const fake = fakeFetch(json(session()), json(session(ROTATED)));
  const client = createAuthClient(API, { fetch: fake.fetch });
  await client.getSession();
  await client.refresh();
  expect(fake.calls.map(call => call.options?.method)).toEqual(['GET', 'GET']);
  expect(client.getState().status).toBe('authenticated');
  client.dispose();
});

test('refresh waits for initial session and keeps its baseline when another tab rotates', async () => {
  const initial = deferred();
  const fake = fakeFetch(() => initial.promise, json(session(ROTATED)));
  const client = createAuthClient(API, { fetch: fake.fetch });
  const loading = client.getSession();
  const rotation = client.refresh();
  initial.resolve(json(session()));
  await Promise.all([loading, rotation]);
  expect(fake.calls.map(call => call.options?.method)).toEqual(['GET', 'GET']);
  expect(client.getState().status).toBe('authenticated');
  client.dispose();
});

test('explicit first refresh of an anonymous session never POSTs', async () => {
  const fake = fakeFetch(json(ANON));
  const client = createAuthClient(API, { fetch: fake.fetch });
  await expect(client.refresh()).rejects.toMatchObject({ status: 401 });
  expect(fake.calls.map(call => call.options?.method)).toEqual(['GET']);
  expect(client.getState().user).toBeNull();
  client.dispose();
});

test('refresh adopts a notified rotation while revalidation is pending instead of rotating again', async () => {
  const pending = deferred();
  const fake = fakeFetch(json(session()), () => pending.promise, json(session(ROTATED)));
  const channel: AuthCoordinationChannel = { onmessage: null, postMessage() {}, close() {} };
  const coordination = createAuthCoordination(API, { locks: testLocks(), channelFactory: () => channel });
  const client = createAuthClient(API, { fetch: fake.fetch, coordination });
  await client.getSession();
  channel.onmessage!({ data: { version: 1, id: ID, source: ID, type: 'session-changed' } } as MessageEvent);
  await expect.poll(() => fake.calls.length).toBe(2);
  expect(client.getState().user).toBeNull(); // The event alone cannot authenticate.
  const refresh = client.refresh();
  pending.resolve(json(session(ROTATED)));
  await refresh;
  expect(fake.calls.map(call => call.options?.method)).toEqual(['GET', 'GET', 'GET']);
  expect(client.getState().status).toBe('authenticated');
  client.dispose();
});

test('first refresh adopts a rotation notified while waiting for the lock, after an active API check', async () => {
  const held = deferred();
  const delegate = testLocks();
  let requests = 0;
  const locks: AuthLockManager = { request: (...args) => { ++requests; return delegate.request(...args); } };
  const fake = fakeFetch(json(session(ROTATED)));
  const channel: AuthCoordinationChannel = { onmessage: null, postMessage() {}, close() {} };
  const coordination = createAuthCoordination(API, { locks, channelFactory: () => channel });
  const client = createAuthClient(API, { fetch: fake.fetch, coordination });
  const owner = coordination.runExclusive(async () => { await held.promise; });
  const refresh = client.refresh();
  await expect.poll(() => requests).toBe(2);
  channel.onmessage!({ data: { version: 1, id: ID, source: ID, type: 'session-changed' } } as MessageEvent);
  // Let the advisory event invalidate without releasing the real exclusion.
  await Promise.resolve();
  expect(client.getState().user).toBeNull();
  expect(fake.calls).toHaveLength(0);
  held.resolve(json({}));
  await Promise.all([owner, refresh]);
  expect(fake.calls.map(call => call.options?.method)).toEqual(['GET']);
  expect(client.getState().status).toBe('authenticated');
  client.dispose();
});

for (const mode of ['absent', 'policy-blocked', 'waiting-timeout'] as const) {
  test('logout never sent keeps a known result for Web Locks ' + mode, async () => {
    let deny = false;
    const locks: AuthLockManager = { request: async (name, _options, operation) => {
      if (deny && mode === 'policy-blocked') throw new DOMException('Policy blocked', 'SecurityError');
      if (deny) return new Promise(() => {});
      return operation({ name });
    } };
    const fake = fakeFetch(json(session()));
    const coordination = createAuthCoordination(API, { locks: mode === 'absent' ? null : locks,
      channelFactory: null, lockTimeoutMs: 10 });
    const client = createAuthClient(API, { fetch: fake.fetch, coordination });
    await client.getSession();
    deny = true;
    await expect(client.logout()).rejects.toMatchObject({ code: mode === 'waiting-timeout'
      ? 'AUTH_COORDINATION_TIMEOUT' : 'AUTH_COORDINATION_UNAVAILABLE' });
    expect(client.getState()).toMatchObject({ status: 'error', user: null, notice: { kind: 'logout-not-sent' } });
    expect(client.getState().notice?.message).toContain('O logout não foi executado.');
    expect(client.getState().notice?.message).not.toContain('Não foi possível confirmar o encerramento');
    expect(fake.calls.map(call => call.options?.method)).toEqual(['GET']);
    client.dismissNotice();
    expect(client.getState().notice?.kind).toBe('logout-not-sent');
    client.dispose();
  });
}

test('failed logout preflight does not claim a POST was sent', async () => {
  const fake = fakeFetch(json(session()), json({ error: { code: 'AUTH_UNAVAILABLE' } }, 503));
  const client = createAuthClient(API, { fetch: fake.fetch });
  await client.getSession();
  await expect(client.logout()).rejects.toMatchObject({ status: 503 });
  expect(client.getState().notice).toMatchObject({ kind: 'logout-not-sent' });
  expect(fake.calls.map(call => call.options?.method)).toEqual(['GET', 'GET']);
  client.dispose();
});

test('a coordination error after a valid logout ACK cannot make logout uncertain', async () => {
  let failAfter = false;
  const fake = fakeFetch(json(session()), json(session()), new Response(null, { status: 204 }));
  const coordination = createAuthCoordination(API, { channelFactory: null, locks: {
    request: async (name, _options, operation) => {
      const result = await operation({ name });
      if (failAfter) throw new PlatformApiError('aborted', 'Late cancellation');
      return result;
    },
  } });
  const client = createAuthClient(API, { fetch: fake.fetch, coordination });
  await client.getSession();
  failAfter = true;
  await client.logout();
  expect(client.getState()).toMatchObject({ status: 'anonymous', notice: { kind: 'logout-confirmed' } });
  expect(fake.calls.filter(call => call.options?.method === 'POST')).toHaveLength(1);
  client.dispose();
});

test('logout waits for refresh, rotates once and clears all local session state', async () => {
  const response = deferred();
  const fake = fakeFetch(json(session()), json(session()), () => response.promise, json(session(ROTATED)), new Response(null, { status: 204 }));
  const client = createAuthClient(API, { fetch: fake.fetch });
  await client.getSession();
  const rotation = client.refresh();
  const firstLogout = client.logout();
  expect(client.logout()).toBe(firstLogout);
  await expect.poll(() => fake.calls.length).toBe(3);
  response.resolve(json(session(ROTATED)));
  await Promise.all([rotation, firstLogout]);
  expect(new Headers(fake.calls[4].options?.headers).get('X-CSRF-Token')).toBe(ROTATED);
  expect(fake.calls[4].url).toBe(`${API}/api/v1/auth/logout`);
  expect(client.getState()).toMatchObject({ status: 'anonymous', user: null, expiresAt: null });
});

test('rotation waits for an in-flight administrative command and subsequent commands use its CSRF', async () => {
  const decisionResponse = deferred();
  const fake = fakeFetch(json(session()), json(session()), () => decisionResponse.promise, json(session()), json(session(ROTATED)), json(session(ROTATED)), json({ done: true }));
  const client = createAuthClient(API, { fetch: fake.fetch });
  await client.getSession();
  const first = client.request(`/api/v1/admin/meetings/${ID}/approve`, { method: 'POST' }, value => value);
  await expect.poll(() => fake.calls.length).toBe(3);
  const rotation = client.refresh();
  const second = client.request(`/api/v1/admin/meetings/${ID}/cancel`, { method: 'POST' }, value => value);
  expect(fake.calls).toHaveLength(3);
  decisionResponse.resolve(json({ done: true }));
  await Promise.all([first, rotation, second]);
  expect(fake.calls.map(call => call.url.split('/').at(-1))).toEqual(['session', 'session', 'approve', 'session', 'refresh', 'session', 'cancel']);
  expect(new Headers(fake.calls[6].options?.headers).get('X-CSRF-Token')).toBe(ROTATED);
});

test('an older session read cannot restore authentication after logout', async () => {
  const stale = deferred();
  const fake = fakeFetch(json(session()), () => stale.promise, json(session()), new Response(null, { status: 204 }));
  const client = createAuthClient(API, { fetch: fake.fetch });
  await client.getSession();
  const olderRead = client.getSession();
  await expect.poll(() => fake.calls.length).toBe(2);
  const ending = client.logout();
  // The authoritative read also owns the lock; logout cannot overtake it.
  expect(fake.calls.filter(call => call.url.endsWith('/auth/logout'))).toHaveLength(0);
  stale.resolve(json(session()));
  await olderRead;
  await ending;
  expect(client.getState().status).toBe('anonymous');
});

test('401 clears identity, does not retry the command and preserves safe error metadata', async () => {
  const fake = fakeFetch(json(session()), json(session()), json({ error: { code: 'AUTH_REQUIRED', message: 'internal stack secret', correlationId: ID } }, 401));
  const client = createAuthClient(API, { fetch: fake.fetch });
  await client.getSession();
  const result = client.request(`/api/v1/admin/meetings/${ID}/reject`, { method: 'POST' }, value => value);
  await expect(result).rejects.toMatchObject({ status: 401, code: 'AUTH_REQUIRED', correlationId: ID });
  expect(fake.calls).toHaveLength(3);
  expect(client.getState().status).toBe('anonymous');
  expect(JSON.stringify(client.getState())).not.toContain('internal stack secret');
});

test('403 rejects a decision once without inventing admin permission or rotating automatically', async () => {
  const fake = fakeFetch(json(session()), json(session()), json({ error: { code: 'AUTH_CSRF', message: 'private', correlationId: ID } }, 403));
  const client = createAuthClient(API, { fetch: fake.fetch });
  await client.getSession();
  await expect(client.request(`/api/v1/admin/meetings/${ID}/cancel`, { method: 'POST' }, value => value))
    .rejects.toMatchObject({ status: 403, code: 'AUTH_CSRF' });
  expect(fake.calls).toHaveLength(3);
  expect(client.getState()).toMatchObject({ status: 'error', user: null, notice: { kind: 'session-check-required' } });
});

test('uncertain refresh drops stale CSRF and requires session lookup before another command', async () => {
  const fake = fakeFetch(json(session()), json(session()), async () => { throw new TypeError('rotation could have completed'); },
    json(session(ROTATED)), json(session(ROTATED)), json({ done: true }));
  const client = createAuthClient(API, { fetch: fake.fetch });
  await client.getSession();
  await expect(client.refresh()).rejects.toMatchObject({ kind: 'network' });
  expect(client.getState()).toMatchObject({ status: 'error', user: null, expiresAt: null });
  expect(fake.calls).toHaveLength(3);
  await client.getSession(); // Explicit UI lookup recovers cookie-backed session safely.
  await client.request(`/api/v1/admin/meetings/${ID}/approve`, { method: 'POST' }, value => value);
  expect(new Headers(fake.calls[5].options?.headers).get('X-CSRF-Token')).toBe(ROTATED);
  expect(fake.calls.filter(call => call.url.endsWith('/auth/refresh'))).toHaveLength(1);
});

test('failed refresh prevents a queued logout mutation and still clears local identity', async () => {
  const fake = fakeFetch(json(session()), json(session()), json({ error: { code: 'AUTH_CSRF', message: 'private', correlationId: ID } }, 403));
  const client = createAuthClient(API, { fetch: fake.fetch });
  await client.getSession();
  const rotation = client.refresh();
  const ending = client.logout();
  await expect(rotation).rejects.toMatchObject({ status: 403 });
  await expect(ending).rejects.toMatchObject({ status: 403 });
  expect(fake.calls).toHaveLength(3);
  expect(client.getState()).toMatchObject({ status: 'error', user: null, notice: { kind: 'logout-not-sent' } });
  expect(fake.calls.some(call => call.url.endsWith('/auth/logout'))).toBe(false);
});

test('AUTH_DISABLED yields explicitly unavailable session', async () => {
  const fake = fakeFetch(json({ error: { code: 'AUTH_DISABLED', message: 'disabled', correlationId: ID } }, 404));
  const client = createAuthClient(API, { fetch: fake.fetch });
  await client.getSession();
  expect(client.getState()).toMatchObject({ status: 'unavailable', user: null, error: { code: 'AUTH_DISABLED' } });
});

test('runtime validation rejects partial identities and unsupported roles', async () => {
  for (const invalid of [
    { ...session(), user: { ...session().user, roles: ['owner'] } },
    { ...session(), csrfToken: 'wrong' },
    { ...session(), expiresAt: 'tomorrow' },
    { ...ANON, user: session().user },
  ]) {
    expect(() => parseAuthSession(invalid)).toThrow(PlatformApiError);
  }
  const fake = fakeFetch(json({ ...session(), user: { ...session().user, id: 'not-a-uuid' } }));
  const client = createAuthClient(API, { fetch: fake.fetch });
  await expect(client.getSession()).rejects.toMatchObject({ kind: 'protocol' });
  expect(client.getState()).toMatchObject({ status: 'error', user: null });
});

test('just-in-time renewal updates CSRF before an authenticated command', async () => {
  const expiring = new Date(Date.now() + 20_000).toISOString();
  const fake = fakeFetch(json(session(TOKEN, expiring)), json(session(TOKEN, expiring)), json(session(ROTATED)), json({ done: true }));
  const client = createAuthClient(API, { fetch: fake.fetch });
  await client.getSession();
  await client.request(`/api/v1/admin/meetings/${ID}/approve`, { method: 'POST' }, value => value);
  expect(fake.calls.map(call => call.url)).toEqual([
    `${API}/api/v1/auth/session`, `${API}/api/v1/auth/session`, `${API}/api/v1/auth/refresh`, `${API}/api/v1/admin/meetings/${ID}/approve`,
  ]);
  expect(new Headers(fake.calls[3].options?.headers).get('X-CSRF-Token')).toBe(ROTATED);
});

for (const result of ['rotated', 'unauthorized'] as const) {
  test(`expiry during an in-flight refresh waits for its final ${result} response`, async () => {
    const originalNow = Date.now;
    const startedAt = originalNow();
    const pending = deferred();
    const expiresAt = new Date(startedAt + 10_000).toISOString();
    const fake = fakeFetch(json(session(TOKEN, expiresAt)), json(session(TOKEN, expiresAt)), () => pending.promise);
    const client = createAuthClient(API, { fetch: fake.fetch });
    await client.getSession();
    const rotation = client.refresh();
    const outcome = rotation.then(value => ({ value }), error => ({ error }));
    await expect.poll(() => fake.calls.length).toBe(3);
    try {
      Date.now = () => startedAt + 20_000;
      client.expire();
      expect(client.getState()).toMatchObject({ status: 'loading', user: null, expiresAt: null });
      pending.resolve(result === 'rotated'
        ? json(session(ROTATED, new Date(startedAt + 600_000).toISOString()))
        : json({ error: { code: 'AUTH_REQUIRED', message: 'private', correlationId: ID } }, 401));
      const completed = await outcome;
      if (result === 'rotated') {
        expect(completed).not.toHaveProperty('error');
        expect(client.getState()).toMatchObject({ status: 'authenticated', user: { id: ID },
          expiresAt: new Date(startedAt + 600_000).toISOString() });
      } else {
        expect(completed).toMatchObject({ error: { status: 401, code: 'AUTH_REQUIRED' } });
        expect(client.getState()).toMatchObject({ status: 'anonymous', user: null, expiresAt: null });
      }
      expect(fake.calls).toHaveLength(3);
    } finally {
      Date.now = originalNow;
      client.dispose();
    }
  });
}

test('expired session does not loop refresh and profile response is validated', async () => {
  const expired = session(TOKEN, new Date(Date.now() - 1000).toISOString());
  const fake = fakeFetch(json(expired), json(expired));
  const client = createAuthClient(API, { fetch: fake.fetch });
  await client.getSession();
  expect(client.getState().status).toBe('anonymous');
  await expect(client.refresh()).rejects.toMatchObject({ status: 401 });
  expect(fake.calls).toHaveLength(2);
  const profileFake = fakeFetch(json(session()), json(session().user));
  const profileClient = createAuthClient(API, { fetch: profileFake.fetch });
  await profileClient.getSession();
  expect(await profileClient.me()).toMatchObject({ id: ID, roles: ['user'] });
});

test('network uncertainty never retries and retry-after is public sanitized metadata', async () => {
  const fake = fakeFetch(async () => { throw new TypeError('private network detail'); });
  const http = createPlatformHttp(API, { fetch: fake.fetch });
  await expect(http.request('/api/v1/meetings/requests', { method: 'POST', body: { private: 'secret' } }, value => value))
    .rejects.toMatchObject({ kind: 'network' });
  expect(fake.calls).toHaveLength(1);
  const limited = fakeFetch(json({ error: { code: 'RATE_LIMITED', message: 'internal secret', correlationId: ID } }, 429, { 'Retry-After': '9' }));
  const limitedHttp = createPlatformHttp(API, { fetch: limited.fetch });
  await expect(limitedHttp.request('/api/v1/auth/session', {}, value => value)).rejects.toMatchObject({
    status: 429, retryAfterSeconds: 9, correlationId: ID,
  });
});

for (const status of [429, 503]) {
  test(`session ${status} shares an absolute Retry-After deadline without requests or renewed waiting`, async () => {
    const fake = fakeFetch(json({ error: { code: 'RATE_LIMITED', message: 'private', correlationId: ID } }, status,
      { 'Retry-After': '1' }), json(session()));
    const client = createAuthClient(API, { fetch: fake.fetch });
    await expect(client.getSession()).rejects.toMatchObject({ status, retryAfterSeconds: 1 });
    const deadline = client.getState().retryAt!;
    expect(deadline).toBeGreaterThan(Date.now());
    for (const blocked of [client.getSession(), client.refresh(), client.logout(), client.me(),
      client.request(`/api/v1/admin/meetings/${ID}/approve`, { method: 'POST' }, value => value)]) {
      await expect(blocked).rejects.toMatchObject({ status, retryAt: deadline });
    }
    expect(client.getState().retryAt).toBe(deadline);
    expect(client.getState().notice?.kind).toBe('logout-not-sent');
    expect(fake.calls).toHaveLength(1);
    await new Promise(resolve => setTimeout(resolve, Math.max(0, deadline - Date.now()) + 5));
    expect(fake.calls).toHaveLength(1); // Expiry alone never polls or retries.
    await client.getSession();
    expect(fake.calls).toHaveLength(2);
    expect(client.getState().status).toBe('authenticated');
  });
}

test('timeouts and explicit cancellation abort the underlying operation', async () => {
  const fake = fakeFetch(rejectOnAbort);
  const http = createPlatformHttp(API, { fetch: fake.fetch, timeoutMs: 10 });
  let dispatched = 0;
  const onDispatch = () => { dispatched += 1; };
  await expect(http.request('/api/v1/auth/session', { onDispatch }, value => value)).rejects.toMatchObject({ kind: 'timeout' });
  expect(dispatched).toBe(1);
  expect(fake.calls).toHaveLength(1);
  expect(fake.calls[0].options?.signal?.aborted).toBe(true);
  const controller = new AbortController();
  controller.abort();
  await expect(http.request('/api/v1/auth/session', { signal: controller.signal, onDispatch }, value => value)).rejects.toMatchObject({ kind: 'aborted' });
  expect(dispatched).toBe(1);
  expect(fake.calls).toHaveLength(1);
});

test('dispose aborts pending initialization and ignores its late response', async () => {
  const late = deferred();
  const fake = fakeFetch(() => late.promise);
  const client = createAuthClient(API, { fetch: fake.fetch });
  const initial = client.getSession();
  const rejected = expect(initial).rejects.toMatchObject({ kind: 'aborted' });
  await expect.poll(() => fake.calls.length).toBe(1);
  let changes = 0;
  client.subscribe(() => { changes += 1; });
  client.dispose();
  late.resolve(json(session()));
  await rejected;
  expect(changes).toBe(0);
  expect(client.getState().user).toBeNull();
});

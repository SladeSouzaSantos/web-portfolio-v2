import { expect, test } from '@playwright/test';
import { createAuthClient, parseAuthSession } from '../src/services/authClient';
import { createPlatformHttp, PlatformApiError } from '../src/services/platformHttp';

const API = 'https://phase3-api.invalid';
const ID = '11111111-1111-4111-8111-111111111111';
const TOKEN = 'a'.repeat(43);
const ROTATED = 'b'.repeat(43);
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

test('concurrent refresh uses one rotation and following command uses current CSRF without body', async () => {
  const response = deferred();
  const fake = fakeFetch(json(session()), () => response.promise, json({ accepted: true }));
  const client = createAuthClient(API, { fetch: fake.fetch });
  await client.getSession();
  const first = client.refresh();
  const second = client.refresh();
  expect(first).toBe(second);
  const command = client.request(`/api/v1/admin/meetings/${ID}/approve`, { method: 'POST' }, value => value);
  await expect.poll(() => fake.calls.length).toBe(2);
  response.resolve(json(session(ROTATED)));
  await Promise.all([first, second, command]);
  expect(fake.calls).toHaveLength(3);
  expect(new Headers(fake.calls[1].options?.headers).get('X-CSRF-Token')).toBe(TOKEN);
  expect(new Headers(fake.calls[2].options?.headers).get('X-CSRF-Token')).toBe(ROTATED);
  expect(fake.calls[2].options?.body).toBeUndefined();
  expect(fake.calls[2].options?.credentials).toBe('include');
  expect(JSON.stringify(client.getState())).not.toContain(ROTATED);
});

test('logout waits for refresh, rotates once and clears all local session state', async () => {
  const response = deferred();
  const fake = fakeFetch(json(session()), () => response.promise, new Response(null, { status: 204 }));
  const client = createAuthClient(API, { fetch: fake.fetch });
  await client.getSession();
  const rotation = client.refresh();
  const firstLogout = client.logout();
  expect(client.logout()).toBe(firstLogout);
  await expect.poll(() => fake.calls.length).toBe(2);
  response.resolve(json(session(ROTATED)));
  await Promise.all([rotation, firstLogout]);
  expect(new Headers(fake.calls[2].options?.headers).get('X-CSRF-Token')).toBe(ROTATED);
  expect(fake.calls[2].url).toBe(`${API}/api/v1/auth/logout`);
  expect(client.getState()).toMatchObject({ status: 'anonymous', user: null, expiresAt: null });
});

test('rotation waits for an in-flight administrative command and subsequent commands use its CSRF', async () => {
  const decisionResponse = deferred();
  const fake = fakeFetch(json(session()), () => decisionResponse.promise, json(session(ROTATED)), json({ done: true }));
  const client = createAuthClient(API, { fetch: fake.fetch });
  await client.getSession();
  const first = client.request(`/api/v1/admin/meetings/${ID}/approve`, { method: 'POST' }, value => value);
  await expect.poll(() => fake.calls.length).toBe(2);
  const rotation = client.refresh();
  const second = client.request(`/api/v1/admin/meetings/${ID}/cancel`, { method: 'POST' }, value => value);
  expect(fake.calls).toHaveLength(2);
  decisionResponse.resolve(json({ done: true }));
  await Promise.all([first, rotation, second]);
  expect(fake.calls.map(call => call.url.split('/').at(-1))).toEqual(['session', 'approve', 'refresh', 'cancel']);
  expect(new Headers(fake.calls[3].options?.headers).get('X-CSRF-Token')).toBe(ROTATED);
});

test('an older session read cannot restore authentication after logout', async () => {
  const stale = deferred();
  const fake = fakeFetch(json(session()), () => stale.promise, new Response(null, { status: 204 }));
  const client = createAuthClient(API, { fetch: fake.fetch });
  await client.getSession();
  const olderRead = client.getSession();
  await expect.poll(() => fake.calls.length).toBe(2);
  await client.logout();
  stale.resolve(json(session()));
  await olderRead;
  expect(client.getState().status).toBe('anonymous');
});

test('401 clears identity, does not retry the command and preserves safe error metadata', async () => {
  const fake = fakeFetch(json(session()), json({ error: { code: 'AUTH_REQUIRED', message: 'internal stack secret', correlationId: ID } }, 401));
  const client = createAuthClient(API, { fetch: fake.fetch });
  await client.getSession();
  const result = client.request(`/api/v1/admin/meetings/${ID}/reject`, { method: 'POST' }, value => value);
  await expect(result).rejects.toMatchObject({ status: 401, code: 'AUTH_REQUIRED', correlationId: ID });
  expect(fake.calls).toHaveLength(2);
  expect(client.getState().status).toBe('anonymous');
  expect(JSON.stringify(client.getState())).not.toContain('internal stack secret');
});

test('403 rejects a decision once without inventing admin permission or rotating automatically', async () => {
  const fake = fakeFetch(json(session()), json({ error: { code: 'CSRF_INVALID', message: 'private', correlationId: ID } }, 403));
  const client = createAuthClient(API, { fetch: fake.fetch });
  await client.getSession();
  await expect(client.request(`/api/v1/admin/meetings/${ID}/cancel`, { method: 'POST' }, value => value))
    .rejects.toMatchObject({ status: 403, code: 'CSRF_INVALID' });
  expect(fake.calls).toHaveLength(2);
  expect(client.getState().user?.roles).toEqual(['user']);
});

test('uncertain refresh drops stale CSRF and requires session lookup before another command', async () => {
  const fake = fakeFetch(json(session()), async () => { throw new TypeError('rotation could have completed'); },
    json(session(ROTATED)), json({ done: true }));
  const client = createAuthClient(API, { fetch: fake.fetch });
  await client.getSession();
  await expect(client.refresh()).rejects.toMatchObject({ kind: 'network' });
  expect(client.getState()).toMatchObject({ status: 'error', user: null, expiresAt: null });
  expect(fake.calls).toHaveLength(2);
  await client.getSession(); // Explicit UI lookup recovers cookie-backed session safely.
  await client.request(`/api/v1/admin/meetings/${ID}/approve`, { method: 'POST' }, value => value);
  expect(new Headers(fake.calls[3].options?.headers).get('X-CSRF-Token')).toBe(ROTATED);
  expect(fake.calls.filter(call => call.url.endsWith('/auth/refresh'))).toHaveLength(1);
});

test('failed refresh prevents a queued logout mutation and still clears local identity', async () => {
  const fake = fakeFetch(json(session()), json({ error: { code: 'CSRF_INVALID', message: 'private', correlationId: ID } }, 403));
  const client = createAuthClient(API, { fetch: fake.fetch });
  await client.getSession();
  const rotation = client.refresh();
  const ending = client.logout();
  await expect(rotation).rejects.toMatchObject({ status: 403 });
  await expect(ending).rejects.toMatchObject({ status: 403 });
  expect(fake.calls).toHaveLength(2);
  expect(client.getState().status).toBe('anonymous');
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
  const fake = fakeFetch(json(session(TOKEN, new Date(Date.now() + 20_000).toISOString())), json(session(ROTATED)), json({ done: true }));
  const client = createAuthClient(API, { fetch: fake.fetch });
  await client.getSession();
  await client.request(`/api/v1/admin/meetings/${ID}/approve`, { method: 'POST' }, value => value);
  expect(fake.calls.map(call => call.url)).toEqual([
    `${API}/api/v1/auth/session`, `${API}/api/v1/auth/refresh`, `${API}/api/v1/admin/meetings/${ID}/approve`,
  ]);
  expect(new Headers(fake.calls[2].options?.headers).get('X-CSRF-Token')).toBe(ROTATED);
});

for (const result of ['rotated', 'unauthorized'] as const) {
  test(`expiry during an in-flight refresh waits for its final ${result} response`, async () => {
    const originalNow = Date.now;
    const startedAt = originalNow();
    const pending = deferred();
    const fake = fakeFetch(json(session(TOKEN, new Date(startedAt + 10_000).toISOString())), () => pending.promise);
    const client = createAuthClient(API, { fetch: fake.fetch });
    await client.getSession();
    const rotation = client.refresh();
    const outcome = rotation.then(value => ({ value }), error => ({ error }));
    await expect.poll(() => fake.calls.length).toBe(2);
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
      expect(fake.calls).toHaveLength(2);
    } finally {
      Date.now = originalNow;
      client.dispose();
    }
  });
}

test('expired session does not loop refresh and profile response is validated', async () => {
  const fake = fakeFetch(json(session(TOKEN, new Date(Date.now() - 1000).toISOString())));
  const client = createAuthClient(API, { fetch: fake.fetch });
  await client.getSession();
  expect(client.getState().status).toBe('anonymous');
  await expect(client.refresh()).rejects.toMatchObject({ status: 401 });
  expect(fake.calls).toHaveLength(1);
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
  await expect(http.request('/api/v1/auth/session', {}, value => value)).rejects.toMatchObject({ kind: 'timeout' });
  expect(fake.calls).toHaveLength(1);
  expect(fake.calls[0].options?.signal?.aborted).toBe(true);
  const controller = new AbortController();
  controller.abort();
  await expect(http.request('/api/v1/auth/session', { signal: controller.signal }, value => value)).rejects.toMatchObject({ kind: 'aborted' });
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

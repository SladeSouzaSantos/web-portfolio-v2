import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import {
  ADMIN_PATH, API_URL, attachIntegratedClient, beginIntegratedLogin, CALLBACK_PATH,
  coordinationName, createIntegratedMeeting, FRONTEND_URL, instrumentIntegratedBrowser,
  integratedControl, integratedCookie, integratedRequest, integratedResult, integratedSession, integratedState,
  LOGOUT_PATH, observeIntegratedContext, REFRESH_PATH, SESSION_PATH, startIntegratedOperation,
  UNCERTAIN_LOGOUT, type IntegratedControl, type IntegratedSnapshot,
} from './helpers/integrated-session';

// Reset and test-owned DB mutations must never overlap separate scenarios.
test.describe.configure({ mode: 'serial' });
let observations: ReturnType<typeof observeIntegratedContext>;

test.beforeEach(async ({ context, request }) => {
  observations = observeIntegratedContext(context);
  await integratedControl(request).reset();
  await context.clearCookies();
});
test.afterEach(async ({ request }) => {
  expect([...observations.externalOrigins]).toEqual([]);
  expect(observations.runtimeErrors).toEqual([]);
  await expect.poll(async () => (await integratedControl(request).snapshot()).activeRequests).toBe(0);
});

const postCount = (snapshot: IntegratedSnapshot, path: string) => snapshot.requests
  .filter(entry => entry.method === 'POST' && entry.path.split('?')[0] === path).length;
async function waitForGate(control: IntegratedControl, id: string) {
  await expect.poll(async () => (await control.gateState(id)).entered).toBe(true);
}
async function pendingLock(page: Page) {
  await expect.poll(() => page.evaluate(async name => {
    const locks = await navigator.locks.query();
    return locks.pending?.some(lock => lock.name === name) ?? false;
  }, coordinationName)).toBe(true);
}
async function loginAdmin(page: Page, context: BrowserContext, control: IntegratedControl, returnTo = '/#sobre') {
  const callback = await beginIntegratedLogin(page, context, control, 'admin', returnTo);
  expect(callback.status()).toBe(302);
  await expect(page.getByRole('button', { name: 'Abrir baú do aventureiro', exact: true })).toBeVisible();
  return callback;
}
function isolatedPersistence(snapshot: IntegratedSnapshot) {
  expect(typeof snapshot.ownershipNonce === 'string' && snapshot.ownershipNonce.length > 0).toBe(true);
  expect(snapshot.migrations.length).toBeGreaterThan(0);
  expect(snapshot.migrations.every(migration => /^[a-f0-9]{64}$/i.test(migration.checksum))).toBe(true);
  expect(snapshot.notifications).toBe(0);
  expect(snapshot.outbox.every(row => row.attempts === 0 && !row.processed)).toBe(true);
}

test('real OIDC login preserves a safe return, HttpOnly session and reload; callback replay cannot create a session', async ({ page, context, request }) => {
  const control = integratedControl(request);
  const callback = await loginAdmin(page, context, control, '/?origem=google#experiencia');
  await expect.poll(() => page.url() === `${FRONTEND_URL}/?origem=google#experiencia`).toBe(true);
  const cookie = await integratedCookie(context);
  expect(cookie.httpOnly).toBe(true);
  expect(cookie.sameSite).toBe('Lax');
  expect(cookie.secure).toBe(false); // Explicitly scoped HTTP loopback, not production HTTPS.
  expect(await page.evaluate(name => document.cookie.includes(name), cookie.name)).toBe(false);
  const session = await integratedSession(context);
  expect(session.authenticated).toBe(true);
  expect(session.user?.roles.includes('admin')).toBe(true);
  const before = await control.snapshot();
  expect(before.users).toBe(1);
  expect(before.sessions.active).toBe(1);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Abrir baú do aventureiro', exact: true })).toBeVisible();
  // Reuse the original browser proof as well as the consumed state/code. Without
  // this cookie the server would reject before checking transaction consumption.
  const loginProof = (await callback.request().allHeaders()).cookie;
  expect(typeof loginProof === 'string' && loginProof.includes('phasscode-login=')).toBe(true);
  const replay = await integratedRequest(request, callback.url(), { maxRedirects: 0,
    headers: { Accept: 'application/json', Cookie: `${loginProof}; ${cookie.name}=${cookie.value}` } });
  expect(replay.status()).toBe(401);
  const body = await replay.json();
  expect(body.error?.code === 'AUTH_LOGIN_FAILED').toBe(true);
  expect((await integratedSession(context)).authenticated).toBe(true);
  const after = await control.snapshot();
  expect(after.sessions.total).toBe(before.sessions.total);
  expect(postCount(after, REFRESH_PATH)).toBe(0);
  expect(after.requests.some(entry => entry.path.split('?')[0] === CALLBACK_PATH && entry.status === 401)).toBe(true);
  isolatedPersistence(after);
});

test('real admin-only denial returns a safe frontend notice without persisting the denied identity', async ({ page, context, request }) => {
  const control = integratedControl(request);
  const callback = await beginIntegratedLogin(page, context, control, 'denied', '/?origem=google#experiencia');
  expect(callback.status()).toBe(303);
  await expect(page.getByRole('alert')).toHaveText('Acesso negado. Apenas o administrador tem acesso.');
  await expect.poll(() => page.url() === `${FRONTEND_URL}/?origem=google#experiencia`).toBe(true);
  await expect(page.getByRole('button', { name: 'Abrir prévia de login', exact: true })).toBeVisible();
  const snapshot = await control.snapshot();
  expect(snapshot.users).toBe(0);
  expect(snapshot.sessions.total).toBe(0);
  expect(snapshot.requests.filter(entry => entry.path.split('?')[0] === '/api/v1/auth/login/google')).toHaveLength(1);
});

for (const scenario of ['wrong-nonce', 'wrong-issuer', 'wrong-audience', 'wrong-signature', 'provider-error', 'cancel'] as const) {
  test(`real OIDC rejects ${scenario} and the frontend renders only a public local error`, async ({ page, context, request }) => {
    const control = integratedControl(request);
    const callback = await beginIntegratedLogin(page, context, control, scenario);
    expect(callback.status()).toBe(303);
    await expect(page.getByRole('alert')).toContainText(/Não foi possível|temporariamente indisponível/);
    await expect.poll(() => {
      const url = new URL(page.url());
      return url.origin === FRONTEND_URL && !url.searchParams.has('auth_error')
        && !url.searchParams.has('code') && !url.searchParams.has('state');
    }).toBe(true);
    expect((await integratedSession(context)).authenticated).toBe(false);
    const snapshot = await control.snapshot();
    expect(snapshot.users).toBe(0);
    expect(snapshot.sessions.total).toBe(0);
  });
}

test('an invalid OIDC state is rejected without a trusted redirect or persisted session', async ({ page, context, request }) => {
  const control = integratedControl(request);
  const callback = await beginIntegratedLogin(page, context, control, 'wrong-state');
  expect(callback.status()).toBe(401);
  expect(new URL(callback.url()).origin === API_URL).toBe(true);
  const body = await callback.json();
  expect(body.error?.code === 'AUTH_LOGIN_FAILED').toBe(true);
  const snapshot = await control.snapshot();
  expect(snapshot.users).toBe(0);
  expect(snapshot.sessions.total).toBe(0);
  await page.goto(`${FRONTEND_URL}/#sobre`);
  await expect(page.getByRole('button', { name: 'Abrir prévia de login', exact: true })).toBeVisible();
});

test('the real login transaction receives only the allowlisted relative return destination', async ({ page, context, request }) => {
  const control = integratedControl(request);
  const loginRequest = page.waitForRequest(request => {
    const url = new URL(request.url());
    return url.origin === API_URL && url.pathname === '/api/v1/auth/login/google';
  });
  await loginAdmin(page, context, control, '/?origem=google&private=synthetic-private-value#experiencia');
  const destination = new URL((await loginRequest).url()).searchParams.get('returnTo');
  expect(destination === '/?origem=google#experiencia').toBe(true);
  await expect.poll(() => page.url() === `${FRONTEND_URL}/?origem=google#experiencia`).toBe(true);
});

test('the public production client persists one request for repeated idempotent confirmation', async ({ page, request }) => {
  const control = integratedControl(request);
  await page.goto(`${FRONTEND_URL}/#sobre`);
  const before = await control.snapshot();
  expect(before.meetings).toHaveLength(0);
  const created = await createIntegratedMeeting(page, 'idempotência', true);
  expect(created.id === created.duplicateId).toBe(true);
  expect(created.status).toBe('PENDING');
  expect(created.observedStatus).toBe('PENDING');
  const after = await control.snapshot();
  expect(after.proposals).toBe(before.proposals + 1);
  expect(after.meetings).toHaveLength(1);
  expect(after.meetings[0].id === created.id).toBe(true);
  expect(after.meetings[0].status).toBe('PENDING');
  expect(postCount(after, '/api/v1/meetings/requests')).toBe(2);
  isolatedPersistence(after);
});

for (const decision of [
  { action: 'approve', label: 'APROVAR', status: 'APPROVED' },
  { action: 'reject', label: 'REJEITAR', status: 'REJECTED' },
  { action: 'cancel', label: 'CANCELAR', status: 'CANCELLED' },
] as const) {
  test(`React confirms ${decision.action} against real Fastify and verifies PostgreSQL audit/outbox`, async ({ page, context, request }) => {
    const control = integratedControl(request);
    await page.goto(`${FRONTEND_URL}/#sobre`);
    const meeting = await createIntegratedMeeting(page, decision.action);
    await loginAdmin(page, context, control);
    await page.getByRole('button', { name: 'Abrir baú do aventureiro', exact: true }).click();
    await page.getByRole('button', { name: '[ IR PARA A SALA DO ADMINISTRADOR ]', exact: true }).click();
    const card = page.getByRole('article', { name: `Pedido de Visitante E2E ${decision.action}`, exact: true });
    await expect(card).toBeVisible();
    const before = await control.snapshot();
    await card.getByRole('button', { name: decision.label, exact: true }).click();
    const confirmation = page.getByRole('dialog', { name: '[ CONFIRMAR DECISÃO ]', exact: true });
    await expect(confirmation).toBeVisible();
    expect(postCount(await control.snapshot(), `${ADMIN_PATH}/${meeting.id}/${decision.action}`)).toBe(0);
    await confirmation.getByRole('button', { name: `CONFIRMAR ${decision.label}`, exact: true }).click();
    await expect(confirmation).toHaveCount(0);
    await expect.poll(async () => (await control.snapshot()).meetings.find(row => row.id === meeting.id)?.status).toBe(decision.status);
    const after = await control.snapshot();
    const row = after.meetings.find(row => row.id === meeting.id)!;
    expect(row.version).toBeGreaterThan(before.meetings[0].version);
    expect(after.audit.filter(row => row.meetingId === meeting.id).length)
      .toBeGreaterThan(before.audit.filter(row => row.meetingId === meeting.id).length);
    expect(after.audit.some(audit => audit.meetingId === meeting.id && audit.version === row.version)).toBe(true);
    if (decision.action === 'approve') {
      expect(after.outbox.filter(row => row.meetingId === meeting.id).length)
        .toBeGreaterThan(before.outbox.filter(row => row.meetingId === meeting.id).length);
    }
    expect(postCount(after, `${ADMIN_PATH}/${meeting.id}/${decision.action}`)).toBe(1);
    isolatedPersistence(after);
  });
}

test('real B1 commands reject Bearer alone and missing/invalid cookie, Origin or CSRF without changing PostgreSQL', async ({ page, context, request }) => {
  const control = integratedControl(request);
  await loginAdmin(page, context, control);
  const meeting = await createIntegratedMeeting(page, 'autorização');
  const cookie = await integratedCookie(context);
  const session = await integratedSession(context);
  const bearer = await control.bearer(cookie.value);
  const cookieHeader = `${cookie.name}=${cookie.value}`;
  const before = await control.snapshot();
  const read = await integratedRequest(request, `${API_URL}${ADMIN_PATH}`, { headers: { Authorization: `Bearer ${bearer.token}` } });
  expect(read.status()).toBe(200); // The real JWT is valid for reads, not a fabricated failing credential.
  const samples: Array<{ headers: Record<string, string>; status: number }> = [
    { headers: { Authorization: `Bearer ${bearer.token}`, Origin: FRONTEND_URL }, status: 401 },
    { headers: { Cookie: cookieHeader, Origin: FRONTEND_URL }, status: 403 },
    { headers: { Cookie: cookieHeader, Origin: FRONTEND_URL, 'X-CSRF-Token': 'x'.repeat(43) }, status: 403 },
    { headers: { Cookie: cookieHeader, 'X-CSRF-Token': session.csrfToken! }, status: 403 },
    { headers: { Cookie: cookieHeader, Origin: 'https://unauthorized.invalid', 'X-CSRF-Token': session.csrfToken! }, status: 403 },
    { headers: { Cookie: `${cookie.name}=${'x'.repeat(43)}`, Origin: FRONTEND_URL, 'X-CSRF-Token': session.csrfToken! }, status: 401 },
  ];
  for (const sample of samples) {
    const response = await integratedRequest(request, `${API_URL}${ADMIN_PATH}/${meeting.id}/approve`, { method: 'POST', headers: sample.headers });
    expect(response.status()).toBe(sample.status);
  }
  const contractResponse = await integratedRequest(request, `${API_URL}/api/v1/openapi.json`);
  expect(contractResponse.status()).toBe(200);
  const contract = await contractResponse.json();
  for (const action of ['approve', 'reject', 'cancel']) {
    const operation = contract.paths[`${ADMIN_PATH}/{id}/${action}`].post;
    expect(operation.security).toEqual([{ sessionCookie: [] }]);
    for (const name of ['Origin', 'X-CSRF-Token']) {
      expect(operation.parameters.some((parameter: { in: string; name: string; required?: boolean }) =>
        parameter.in === 'header' && parameter.name === name && parameter.required)).toBe(true);
    }
    for (const status of ['401', '403']) expect(Object.hasOwn(operation.responses, status)).toBe(true);
  }
  const after = await control.snapshot();
  expect(after.meetings).toEqual(before.meetings);
  expect(after.audit).toEqual(before.audit);
  expect(after.outbox).toEqual(before.outbox);
});

for (const action of ['revoke', 'expire', 'remove-admin'] as const) {
  test(`real persisted ${action} removes administrative access without retrying a command`, async ({ page, context, request }) => {
    const control = integratedControl(request);
    await loginAdmin(page, context, control);
    const meeting = await createIntegratedMeeting(page, action);
    await attachIntegratedClient(page);
    await control.changeSessions(action);
    await startIntegratedOperation(page, 'refused', 'approve', meeting.id);
    const result = await integratedResult(page, 'refused');
    expect(result.ok).toBe(false);
    expect(result.state.user === null).toBe(true);
    const snapshot = await control.snapshot();
    expect(postCount(snapshot, `${ADMIN_PATH}/${meeting.id}/approve`)).toBe(0);
    expect(snapshot.meetings[0].status).toBe('PENDING');
    if (action === 'expire') expect(snapshot.sessions.expired).toBeGreaterThan(0);
    if (action === 'revoke') expect(snapshot.sessions.revoked).toBeGreaterThan(0);
  });
}

for (const mode of ['channel', 'no-channel', 'lost-messages'] as const) {
  test(`two real session tabs rotate once without stale CSRF or session-family replay: ${mode}`, async ({ page, context, request }) => {
    const control = integratedControl(request);
    await instrumentIntegratedBrowser(context, { noChannel: mode === 'no-channel', dropMessages: mode === 'lost-messages' });
    await loginAdmin(page, context, control);
    const oldCookie = await integratedCookie(context);
    const oldSession = await integratedSession(context);
    const other = await context.newPage();
    const gate = await control.gate(REFRESH_PATH, 'before', 'hold');
    try {
      await attachIntegratedClient(page);
      await other.goto(`${FRONTEND_URL}/#sobre`);
      await attachIntegratedClient(other);
      await startIntegratedOperation(page, 'rotate', 'refresh');
      await waitForGate(control, gate.id);
      await startIntegratedOperation(other, 'rotate', 'refresh');
      await pendingLock(other);
      expect(postCount(await control.snapshot(), REFRESH_PATH)).toBe(1);
      await control.release(gate.id);
      expect((await integratedResult(page, 'rotate')).ok).toBe(true);
      expect((await integratedResult(other, 'rotate')).ok).toBe(true);
      const currentCookie = await integratedCookie(context);
      const currentSession = await integratedSession(context);
      expect(currentCookie.value === oldCookie.value).toBe(false);
      expect(currentSession.csrfToken === oldSession.csrfToken).toBe(false);
      expect(currentSession.authenticated).toBe(true);
      const snapshot = await control.snapshot();
      expect(postCount(snapshot, REFRESH_PATH)).toBe(1);
      expect(snapshot.sessions.active).toBe(1);
      expect(snapshot.sessions.families).toBe(1);
      for (const tab of [page, other]) {
        const safe = await tab.evaluate(({ secrets }) => {
          const messages = window.__f3Messages ?? [];
          const stored = JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage }, messages });
          return messages.every(message => Object.keys(message.data as object).sort().join(',') === 'id,source,type,version')
            && secrets.every(secret => !stored.includes(secret));
        }, { secrets: [oldCookie.value, currentCookie.value, oldSession.csrfToken!, currentSession.csrfToken!] });
        expect(safe).toBe(true);
      }
    } finally { await control.release(gate.id); await other.close(); }
  });
}

test('a real rotation notification makes the other tab rehydrate from the API without rebroadcasting a profile', async ({ page, context, request }) => {
  const control = integratedControl(request);
  await instrumentIntegratedBrowser(context);
  await loginAdmin(page, context, control);
  const other = await context.newPage();
  try {
    await attachIntegratedClient(page);
    await other.goto(`${FRONTEND_URL}/#sobre`);
    await attachIntegratedClient(other);
    let reads = 0;
    other.on('response', response => {
      const url = new URL(response.url());
      if (url.origin === API_URL && url.pathname === SESSION_PATH) reads += 1;
    });
    await startIntegratedOperation(page, 'rotate', 'refresh');
    expect((await integratedResult(page, 'rotate')).ok).toBe(true);
    await expect.poll(() => reads).toBeGreaterThan(0);
    await expect.poll(async () => (await integratedState(other)).status).toBe('authenticated');
    const safe = await other.evaluate(() => (window.__f3Messages ?? []).length === 0);
    expect(safe).toBe(true); // Adoption of a GET response never publishes another change.
    expect((await control.snapshot()).sessions.active).toBe(1);
  } finally { await other.close(); }
});

test('a missed real logout notification is recovered on focus by consulting the API', async ({ page, context, request }) => {
  const control = integratedControl(request);
  await instrumentIntegratedBrowser(context, { dropMessages: true });
  await loginAdmin(page, context, control);
  const other = await context.newPage();
  try {
    await other.goto(`${FRONTEND_URL}/#sobre`);
    await expect(other.getByRole('button', { name: 'Abrir baú do aventureiro', exact: true })).toBeVisible();
    await other.clock.install();
    await other.clock.fastForward(1001); // Advance the local revalidation throttle, not server/session time.
    await page.bringToFront();
    await page.getByRole('button', { name: 'Abrir baú do aventureiro', exact: true }).click();
    await page.getByRole('button', { name: '[ TRANCAR BAÚ (LOGOUT) ]', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Sessão encerrada.' })).toBeVisible();
    const before = await control.snapshot();
    await other.bringToFront();
    await other.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(other.getByRole('button', { name: 'Abrir prévia de login', exact: true })).toBeVisible();
    const after = await control.snapshot();
    expect(after.requests.filter(entry => entry.path.split('?')[0] === SESSION_PATH).length)
      .toBeGreaterThan(before.requests.filter(entry => entry.path.split('?')[0] === SESSION_PATH).length);
    expect(postCount(after, LOGOUT_PATH)).toBe(1);
    expect(after.sessions.active).toBe(0);
  } finally { await other.close(); }
});

test('real administrative mutation waits for a rotating session and commits with the current CSRF', async ({ page, context, request }) => {
  const control = integratedControl(request);
  // Isolate the Web Lock/CSRF race within the real 20/minute server limit.
  // Broadcast notification and rehydration are covered in their own scenario.
  await instrumentIntegratedBrowser(context, { noChannel: true });
  await loginAdmin(page, context, control);
  const meeting = await createIntegratedMeeting(page, 'concorrente');
  const other = await context.newPage();
  const gate = await control.gate(REFRESH_PATH, 'before', 'hold');
  try {
    await attachIntegratedClient(page);
    await other.goto(`${FRONTEND_URL}/#sobre`);
    await attachIntegratedClient(other);
    await startIntegratedOperation(page, 'rotate', 'refresh');
    await waitForGate(control, gate.id);
    await startIntegratedOperation(other, 'approve', 'approve', meeting.id);
    await pendingLock(other);
    expect(postCount(await control.snapshot(), `${ADMIN_PATH}/${meeting.id}/approve`)).toBe(0);
    await control.release(gate.id);
    expect((await integratedResult(page, 'rotate')).ok).toBe(true);
    expect((await integratedResult(other, 'approve')).ok).toBe(true);
    const after = await control.snapshot();
    expect(after.meetings[0].status).toBe('APPROVED');
    expect(postCount(after, `${ADMIN_PATH}/${meeting.id}/approve`)).toBe(1);
    expect(after.sessions.active).toBe(1);
    isolatedPersistence(after);
  } finally { await control.release(gate.id); await other.close(); }
});

test('confirmed React logout revokes the real session and invalidates the other tab without another POST', async ({ page, context, request }) => {
  const control = integratedControl(request);
  await loginAdmin(page, context, control);
  const other = await context.newPage();
  try {
    await other.goto(`${FRONTEND_URL}/#sobre`);
    await expect(other.getByRole('button', { name: 'Abrir baú do aventureiro', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Abrir baú do aventureiro', exact: true }).click();
    await page.getByRole('button', { name: '[ TRANCAR BAÚ (LOGOUT) ]', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Sessão encerrada.' })).toBeVisible();
    await expect(other.getByRole('button', { name: 'Abrir prévia de login', exact: true })).toBeVisible();
    const snapshot = await control.snapshot();
    expect(snapshot.sessions.active).toBe(0);
    expect(snapshot.sessions.revoked).toBeGreaterThan(0);
    expect(postCount(snapshot, LOGOUT_PATH)).toBe(1);
    expect((await integratedSession(context)).authenticated).toBe(false);
  } finally { await other.close(); }
});

test('a real committed logout with dropped ACK preserves global uncertainty and recovers only through GET', async ({ page, context, request }) => {
  const control = integratedControl(request);
  await loginAdmin(page, context, control);
  const gate = await control.gate(LOGOUT_PATH, 'after', 'drop');
  try {
    await page.getByRole('button', { name: 'Abrir baú do aventureiro', exact: true }).click();
    await page.getByRole('button', { name: '[ TRANCAR BAÚ (LOGOUT) ]', exact: true }).click();
    await waitForGate(control, gate.id);
    expect((await control.snapshot()).sessions.active).toBe(0);
    expect((await control.gateState(gate.id)).completed).toBe(true);
    await control.release(gate.id);
    await expect(page.getByRole('alert').filter({ hasText: UNCERTAIN_LOGOUT })).toBeVisible();
    // The open chest becomes the login dialog when local identity is discarded.
    // Close it through the UI before navigating; the global warning must remain.
    await page.getByRole('button', { name: 'Fechar login', exact: true }).click();
    await page.getByRole('link', { name: 'Projetos', exact: true }).click();
    await page.getByRole('link', { name: /ARQUIVO DE MISSÕES EXPLORAR OUTROS PROJETOS/ }).click();
    await expect(page.getByRole('alert').filter({ hasText: UNCERTAIN_LOGOUT })).toBeVisible();
    const before = await control.snapshot();
    await page.getByRole('button', { name: 'VERIFICAR SESSÃO', exact: true }).click();
    await expect(page.locator('.auth-session-notice')).toContainText('Nenhuma sessão ativa foi encontrada neste navegador.');
    const after = await control.snapshot();
    expect(postCount(after, LOGOUT_PATH)).toBe(1);
    expect(after.requests.filter(entry => entry.path.split('?')[0] === SESSION_PATH).length)
      .toBeGreaterThan(before.requests.filter(entry => entry.path.split('?')[0] === SESSION_PATH).length);
  } finally { await control.release(gate.id); }
});

test('a real committed logout with an ACK held past the HTTP timeout is not replayed', async ({ page, context, request }) => {
  const control = integratedControl(request);
  await loginAdmin(page, context, control);
  const gate = await control.gate(LOGOUT_PATH, 'after', 'hold');
  try {
    await page.clock.install();
    await page.getByRole('button', { name: 'Abrir baú do aventureiro', exact: true }).click();
    await page.getByRole('button', { name: '[ TRANCAR BAÚ (LOGOUT) ]', exact: true }).click();
    await waitForGate(control, gate.id);
    expect((await control.snapshot()).sessions.active).toBe(0);
    await page.clock.fastForward(30_001);
    await expect(page.getByRole('alert').filter({ hasText: UNCERTAIN_LOGOUT })).toBeVisible();
    await page.getByRole('button', { name: 'Fechar login', exact: true }).click();
    expect(postCount(await control.snapshot(), LOGOUT_PATH)).toBe(1);
    await control.release(gate.id);
    await page.getByRole('button', { name: 'VERIFICAR SESSÃO', exact: true }).click();
    await expect(page.locator('.auth-session-notice')).toContainText('Nenhuma sessão ativa foi encontrada neste navegador.');
    expect(postCount(await control.snapshot(), LOGOUT_PATH)).toBe(1);
  } finally { await control.release(gate.id); }
});

test('the real UI without Web Locks never sends logout or an administrative POST and recovers by GET', async ({ page, context, request }) => {
  const control = integratedControl(request);
  await instrumentIntegratedBrowser(context, { noLocks: true });
  await loginAdmin(page, context, control);
  const meeting = await createIntegratedMeeting(page, 'sem-lock');
  await attachIntegratedClient(page);
  for (const action of ['refresh', 'approve'] as const) {
    await startIntegratedOperation(page, action, action, meeting.id);
    expect((await integratedResult(page, action)).error?.code === 'AUTH_COORDINATION_UNAVAILABLE').toBe(true);
  }
  await page.getByRole('button', { name: 'Abrir baú do aventureiro', exact: true }).click();
  await page.getByRole('button', { name: '[ TRANCAR BAÚ (LOGOUT) ]', exact: true }).click();
  const notice = page.locator('.auth-session-notice');
  await expect(notice.getByRole('alert')).toContainText('O logout não foi executado.');
  await expect(notice).not.toContainText(UNCERTAIN_LOGOUT);
  await page.getByRole('button', { name: 'Fechar login', exact: true }).click();
  const before = await control.snapshot();
  expect(postCount(before, REFRESH_PATH)).toBe(0);
  expect(postCount(before, LOGOUT_PATH)).toBe(0);
  expect(postCount(before, `${ADMIN_PATH}/${meeting.id}/approve`)).toBe(0);
  expect(before.sessions.active).toBe(1);
  await notice.getByRole('button', { name: 'VERIFICAR SESSÃO', exact: true }).click();
  await expect(notice).toContainText('A sessão continua ativa no servidor.');
  expect(postCount(await control.snapshot(), LOGOUT_PATH)).toBe(0);
});

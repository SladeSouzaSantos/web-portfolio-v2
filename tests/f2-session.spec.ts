import { expect, test, type Page } from '@playwright/test';
import {
  ACTIVE_SESSION, ADMIN_PATH, attachBrowserClient, browserState, coordinationName,
  installSessionTabsMock, instrumentSessionApis, LOGOUT_PATH, NO_SESSION, operationResult,
  REFRESH_PATH, SESSION_COOKIE, settleBrowserEvents, startOperation, UNCERTAIN_LOGOUT,
  type SessionTabsMock,
} from './helpers/session-tabs-mock';

async function open(page: Page, baseURL: string) {
  await page.goto('/#sobre');
  await expect(page.getByRole('button', { name: 'Abrir baú do aventureiro', exact: true })).toBeVisible();
  await attachBrowserClient(page, baseURL);
}
function healthy(mock: SessionTabsMock) {
  expect(mock.unexpected).toEqual([]);
  expect(mock.external).toEqual([]);
  expect(mock.runtimeErrors).toEqual([]);
  expect(mock.familyRevoked()).toBe(false);
}

for (const mode of ['channel', 'no-channel', 'lost-messages'] as const) {
  test('two tabs rotate once and use fresh cookie/CSRF: ' + mode, async ({ page, context, baseURL }) => {
    await instrumentSessionApis(context, { noChannel: mode === 'no-channel', dropMessages: mode === 'lost-messages' });
    const mock = await installSessionTabsMock(context, baseURL!);
    const other = await context.newPage();
    try {
      await open(page, baseURL!);
      await open(other, baseURL!);
      const before = mock.current();
      const gate = mock.holdNext('refresh');
      await startOperation(page, 'refresh', 'refresh');
      await gate.entered;
      await startOperation(other, 'refresh', 'refresh');
      gate.release();
      expect((await operationResult(page, 'refresh')).ok).toBe(true);
      expect((await operationResult(other, 'refresh')).ok).toBe(true);
      expect(mock.posts(REFRESH_PATH)).toHaveLength(1);
      expect(mock.current().csrf).not.toBe(before.csrf);
      const cookie = (await context.cookies()).find(item => item.name === SESSION_COOKIE)!;
      expect(cookie).toMatchObject({ value: mock.current().cookie, httpOnly: true, sameSite: 'Lax' });
      expect(await page.evaluate(() => document.cookie)).not.toContain(SESSION_COOKIE);
      await startOperation(other, 'approve', 'approve');
      expect((await operationResult(other, 'approve')).ok).toBe(true);
      const commands = mock.requests.filter(entry => entry.method === 'POST' && entry.path.startsWith(ADMIN_PATH));
      expect(commands).toHaveLength(1);
      expect(commands[0]).toMatchObject({ cookie: cookie.value, csrf: mock.current().csrf, origin: baseURL });
      const messages = await page.evaluate(() => window.__f2Messages!);
      for (const { data } of messages) {
        expect(Object.keys(data as object).sort()).toEqual(['id', 'source', 'type', 'version']);
        for (const secret of [before.cookie, before.csrf, mock.current().csrf, 'synthetic-admin@example.test']) expect(JSON.stringify(data)).not.toContain(secret);
      }
      const stored = await other.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage }, state: window.__f2Driver!.client.getState() }));
      expect(stored).not.toContain(mock.current().csrf);
      expect(stored).not.toContain(mock.current().cookie);
      healthy(mock);
    } finally { mock.dispose(); await other.close(); }
  });
}

test('channel invalidates and rehydrates from API without broadcasting profile or causing a loop', async ({ page, context, baseURL }) => {
  await instrumentSessionApis(context);
  const mock = await installSessionTabsMock(context, baseURL!);
  const other = await context.newPage();
  try {
    await open(page, baseURL!); await open(other, baseURL!);
    const before = mock.sessions().length;
    await startOperation(page, 'rotate', 'refresh');
    await operationResult(page, 'rotate');
    await expect.poll(() => mock.sessions().length).toBeGreaterThan(before + 1);
    await expect.poll(async () => (await browserState(other)).status).toBe('authenticated');
    await settleBrowserEvents(other);
    const messages = await other.evaluate(() => window.__f2Messages!);
    expect(messages).toHaveLength(0); // GET adoption never sends another event.
    healthy(mock);
  } finally { mock.dispose(); await other.close(); }
});

test('administrative mutation waits for rotation and rotation waits for an in-flight mutation', async ({ page, context, baseURL }) => {
  const mock = await installSessionTabsMock(context, baseURL!);
  const other = await context.newPage();
  try {
    await open(page, baseURL!); await open(other, baseURL!);
    const rotate = mock.holdNext('refresh');
    await startOperation(page, 'rotate', 'refresh'); await rotate.entered;
    await startOperation(other, 'approve', 'approve');
    expect(mock.writes).toHaveLength(0);
    rotate.release();
    expect((await operationResult(page, 'rotate')).ok).toBe(true);
    expect((await operationResult(other, 'approve')).ok).toBe(true);
    const command = mock.holdNext('command');
    await startOperation(other, 'cancel', 'cancel'); await command.entered;
    const rotations = mock.posts(REFRESH_PATH).length;
    await startOperation(page, 'again', 'refresh');
    expect(mock.posts(REFRESH_PATH)).toHaveLength(rotations);
    command.release();
    expect((await operationResult(other, 'cancel')).ok).toBe(true);
    expect((await operationResult(page, 'again')).ok).toBe(true);
    expect(mock.writes.map(write => write.action)).toEqual(['approve', 'cancel']);
    healthy(mock);
  } finally { mock.dispose(); await other.close(); }
});

test('confirmed React logout removes the other tab identity without a second logout', async ({ page, context, baseURL }) => {
  const mock = await installSessionTabsMock(context, baseURL!);
  const other = await context.newPage();
  try {
    await open(page, baseURL!); await open(other, baseURL!);
    await page.getByRole('button', { name: 'Abrir baú do aventureiro', exact: true }).click();
    await page.getByRole('button', { name: '[ TRANCAR BAÚ (LOGOUT) ]', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Sessão encerrada.' })).toBeVisible();
    await expect.poll(async () => (await browserState(other)).status).toBe('anonymous');
    await expect(other.getByRole('button', { name: 'Abrir prévia de login', exact: true })).toBeVisible();
    expect(mock.posts(LOGOUT_PATH)).toHaveLength(1);
    expect(mock.familyRevoked()).toBe(true);
    expect(mock.unexpected).toEqual([]);
    expect(mock.runtimeErrors).toEqual([]);
  } finally { mock.dispose(); await other.close(); }
});

for (const failure of ['network-before', 'network-after', 403, 503] as const) {
  test('uncertain logout survives redirect, archive and reopen; recovery is only GET: ' + failure, async ({ page, context, baseURL }) => {
    const mock = await installSessionTabsMock(context, baseURL!);
    try {
      await page.goto('/administracao');
      await expect(page.getByRole('heading', { name: '[ PAINEL DO MESTRE ]', exact: true })).toBeVisible();
      mock.failNextLogout(failure);
      await page.getByRole('button', { name: 'Abrir baú do aventureiro', exact: true }).click();
      await page.getByRole('button', { name: '[ TRANCAR BAÚ (LOGOUT) ]', exact: true }).click();
      await expect(page.getByRole('alert').filter({ hasText: UNCERTAIN_LOGOUT })).toBeVisible();
      await expect(page).toHaveURL(/\/#sobre$/);
      await page.getByRole('link', { name: 'Projetos', exact: true }).click();
      await page.getByRole('link', { name: /ARQUIVO DE MISSÕES EXPLORAR OUTROS PROJETOS/ }).click();
      await expect(page.getByRole('alert').filter({ hasText: UNCERTAIN_LOGOUT })).toBeVisible();
      expect(mock.posts(LOGOUT_PATH)).toHaveLength(1);
      await page.getByRole('button', { name: 'VERIFICAR SESSÃO', exact: true }).click();
      await expect(page.locator('.auth-session-notice')).toContainText(failure === 'network-after' ? NO_SESSION : ACTIVE_SESSION);
      expect(mock.posts(LOGOUT_PATH)).toHaveLength(1);
      expect(mock.unexpected).toEqual([]);
      expect(mock.external).toEqual([]);
      expect(mock.runtimeErrors).toEqual([]);
    } finally { mock.dispose(); }
  });
}

test('HTTP timeout hides stale identity and keeps logout unconfirmed without replay', async ({ page, context, baseURL }) => {
  const mock = await installSessionTabsMock(context, baseURL!);
  try {
    await open(page, baseURL!);
    mock.failNextLogout('timeout');
    const gate = mock.holdNext('logout');
    await page.clock.install();
    await page.getByRole('button', { name: 'Abrir baú do aventureiro', exact: true }).click();
    await page.getByRole('button', { name: '[ TRANCAR BAÚ (LOGOUT) ]', exact: true }).click();
    await gate.entered;
    await page.clock.fastForward(30_001);
    await expect(page.getByRole('alert').filter({ hasText: UNCERTAIN_LOGOUT })).toBeVisible();
    expect(mock.posts(LOGOUT_PATH)).toHaveLength(1);
    gate.release();
    await expect(page.getByRole('button', { name: 'Abrir prévia de login', exact: true })).toBeVisible();
    expect(mock.posts(LOGOUT_PATH)).toHaveLength(1);
  } finally { mock.dispose(); }
});

for (const change of ['revoke', 'expire'] as const) {
  test('API ' + change + ' prevents writes and cannot be replaced by a notification', async ({ page, context, baseURL }) => {
    const mock = await installSessionTabsMock(context, baseURL!);
    try {
      await open(page, baseURL!);
      mock[change]();
      await startOperation(page, 'approve', 'approve');
      expect(await operationResult(page, 'approve')).toMatchObject({ ok: false, error: { status: 401 } });
      expect(mock.writes).toHaveLength(0);
      expect(mock.requests.filter(entry => entry.method === 'POST')).toHaveLength(0);
      expect((await browserState(page)).user).toBeNull();
    } finally { mock.dispose(); }
  });
}

test('without Web Locks, session reads remain usable but refresh/logout/commands never POST', async ({ page, context, baseURL }) => {
  await instrumentSessionApis(context, { noLocks: true });
  const mock = await installSessionTabsMock(context, baseURL!);
  try {
    await open(page, baseURL!);
    for (const action of ['refresh', 'approve', 'logout'] as const) {
      await startOperation(page, action, action);
      const result = await operationResult(page, action);
      expect(result).toMatchObject({ ok: false, error: { code: 'AUTH_COORDINATION_UNAVAILABLE' } });
      if (action === 'logout') {
        expect(result.state.notice).toMatchObject({ kind: 'logout-not-sent' });
        expect(result.state.notice?.message).toContain('O logout não foi executado.');
        expect(result.state.notice?.message).toContain('navegador');
        expect(result.state.notice?.message).not.toContain(UNCERTAIN_LOGOUT);
      }
    }
    await startOperation(page, 'verify', 'session');
    expect((await operationResult(page, 'verify')).state.status).toBe('authenticated');
    expect(mock.requests.filter(entry => entry.method === 'POST')).toHaveLength(0);
    healthy(mock);
  } finally { mock.dispose(); }
});

test('React logout without Web Locks keeps the not-sent notice across navigation and chest reopen; recovery only reads session', async ({ page, context, baseURL }) => {
  await instrumentSessionApis(context, { noLocks: true });
  const mock = await installSessionTabsMock(context, baseURL!);
  try {
    await page.goto('/administracao');
    await expect(page.getByRole('heading', { name: '[ PAINEL DO MESTRE ]', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Abrir baú do aventureiro', exact: true }).click();
    await page.getByRole('button', { name: '[ TRANCAR BAÚ (LOGOUT) ]', exact: true }).click();
    const notice = page.locator('.auth-session-notice');
    const alert = notice.getByRole('alert');
    await expect(alert).toContainText('O logout não foi executado.');
    await expect(alert).toContainText('navegador');
    await expect(notice).not.toContainText(UNCERTAIN_LOGOUT);
    await expect(page).toHaveURL(/\/#sobre$/);
    expect(mock.requests.filter(entry => entry.method === 'POST')).toHaveLength(0);

    await page.getByRole('link', { name: 'Projetos', exact: true }).click();
    await page.getByRole('link', { name: /ARQUIVO DE MISSÕES EXPLORAR OUTROS PROJETOS/ }).click();
    await expect(page).toHaveURL(/\/projetos$/);
    await expect(alert).toContainText('O logout não foi executado.');
    await page.getByRole('link', { name: '← VOLTAR AO PORTFÓLIO', exact: true }).click();
    await expect(page).toHaveURL(/\/#projetos$/);
    await expect(alert).toContainText('O logout não foi executado.');
    await page.getByRole('button', { name: 'Abrir prévia de login', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: /^Fechar (baú|login)$/ }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(alert).toContainText('O logout não foi executado.');
    await page.getByRole('button', { name: 'Abrir prévia de login', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: /^Fechar (baú|login)$/ }).click();
    await expect(alert).toContainText('O logout não foi executado.');
    expect(mock.requests.filter(entry => entry.method === 'POST')).toHaveLength(0);

    const readsBeforeRecovery = mock.sessions().length;
    await notice.getByRole('button', { name: 'VERIFICAR SESSÃO', exact: true }).click();
    await expect.poll(() => mock.sessions().length).toBeGreaterThan(readsBeforeRecovery);
    await expect(notice).toContainText(ACTIVE_SESSION);
    expect(mock.requests.filter(entry => entry.method === 'POST')).toHaveLength(0);
    healthy(mock);
  } finally { mock.dispose(); }
});

for (const code of ['AUTH_CSRF', 'AUTH_ADMIN_ONLY'] as const) {
  test('HTTP 403 ' + code + ' invalidates stale identity and never retries a command', async ({ page, context, baseURL }) => {
    const mock = await installSessionTabsMock(context, baseURL!);
    try {
      await open(page, baseURL!);
      mock.failNextCommand(code);
      await startOperation(page, 'refused', 'approve');
      expect(await operationResult(page, 'refused')).toMatchObject({ ok: false, error: { status: 403, code } });
      expect((await browserState(page)).user).toBeNull();
      await startOperation(page, 'blocked', 'approve');
      expect(await operationResult(page, 'blocked')).toMatchObject({ ok: false, error: { code: 'AUTH_SESSION_CHECK_REQUIRED' } });
      expect(mock.requests.filter(entry => entry.method === 'POST')).toHaveLength(1);
      expect(mock.writes).toHaveLength(0);
      await startOperation(page, 'lookup', 'session');
      expect((await operationResult(page, 'lookup')).ok).toBe(true);
      expect(mock.requests.filter(entry => entry.method === 'POST')).toHaveLength(1);
    } finally { mock.dispose(); }
  });
}

test('waiting timeout never steals a lock or performs work outside it', async ({ page, context, baseURL }) => {
  const mock = await installSessionTabsMock(context, baseURL!);
  const other = await context.newPage();
  try {
    await open(page, baseURL!); await open(other, baseURL!);
    await attachBrowserClient(other, baseURL!, 5000, 100);
    const gate = mock.holdNext('refresh');
    await startOperation(page, 'hold', 'refresh'); await gate.entered;
    await startOperation(other, 'wait', 'refresh');
    expect(await operationResult(other, 'wait')).toMatchObject({ ok: false, error: { code: 'AUTH_COORDINATION_TIMEOUT' } });
    expect(mock.posts(REFRESH_PATH)).toHaveLength(1);
    gate.release();
    expect((await operationResult(page, 'hold')).ok).toBe(true);
    healthy(mock);
  } finally { mock.dispose(); await other.close(); }
});

test('closing a tab releases its native lock; the surviving tab rechecks the server', async ({ page, context, baseURL }) => {
  const mock = await installSessionTabsMock(context, baseURL!);
  const owner = await context.newPage();
  try {
    await open(page, baseURL!); await open(owner, baseURL!);
    await owner.evaluate(name => {
      void navigator.locks.request(name, async () => {
        window.__f2LockHeld = true;
        await new Promise(() => {});
      });
    }, coordinationName(baseURL!));
    await expect.poll(() => owner.evaluate(() => window.__f2LockHeld)).toBe(true);
    await startOperation(page, 'waiting', 'refresh');
    expect(mock.posts(REFRESH_PATH)).toHaveLength(0);
    await owner.close();
    expect((await operationResult(page, 'waiting')).ok).toBe(true);
    expect(mock.posts(REFRESH_PATH)).toHaveLength(1);
    healthy(mock);
  } finally { mock.dispose(); if (!owner.isClosed()) await owner.close(); }
});

test('cookie rotation committed before a closed tab loses its ACK is not replayed', async ({ page, context, baseURL }) => {
  const mock = await installSessionTabsMock(context, baseURL!);
  const owner = await context.newPage();
  try {
    await open(page, baseURL!); await open(owner, baseURL!);
    mock.commitRefreshBeforeReply();
    const gate = mock.holdNext('refresh');
    await startOperation(owner, 'lost', 'refresh'); await gate.entered;
    await owner.close();
    gate.release();
    await startOperation(page, 'survivor', 'refresh');
    expect(await operationResult(page, 'survivor')).toMatchObject({ ok: false, error: { status: 401 } });
    expect(mock.posts(REFRESH_PATH)).toHaveLength(1);
    expect(mock.familyRevoked()).toBe(false);
  } finally { mock.dispose(); if (!owner.isClosed()) await owner.close(); }
});

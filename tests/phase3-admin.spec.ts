import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from './fixtures';
import {
  adminMeeting, anonymousSession, authenticatedSession, meetingStatus, mockPlatform, platformError,
  MOCK_CSRF_TOKEN, MOCK_PLATFORM_CORRELATION_ID,
} from './helpers/platform-mock';
import { deferredReply } from './helpers/orbe-mock';
import type { MeetingStatus } from '../src/types/meetings';

const ADMIN_PATH = '/api/v1/admin/meetings';
const adminHeading = (page: Page) => page.getByRole('heading', { name: '[ PAINEL DO MESTRE ]', exact: true });
const confirmation = (page: Page) => page.getByRole('dialog', { name: '[ CONFIRMAR DECISÃO ]', exact: true });
const item = () => adminMeeting('PENDING');
const list = (items = [item()], nextCursor: string | null = null) => ({ items, nextCursor });

async function visitAdmin(page: Page) {
  await page.goto('/administracao');
  await expect(adminHeading(page)).toBeVisible();
  await expect(page.getByRole('button', { name: 'ATUALIZAR PEDIDOS', exact: true })).toBeEnabled();
}

test('autenticação desabilitada preserva o agendamento público independente de login', async ({ page }) => {
  const api = await mockPlatform(page, [
    { path: '/api/v1/auth/session', status: 404, body: platformError('AUTH_DISABLED') },
    { path: '/api/v1/meetings/availability', body: { timeZone: 'America/Fortaleza', durationMinutes: 30, simulated: false, slots: [] } },
  ]);
  await page.goto('/');
  await page.getByRole('button', { name: 'Abrir prévia de login', exact: true }).click();
  const portal = page.getByRole('dialog', { name: '[ PORTAL DE AUTENTICAÇÃO ]', exact: true });
  await expect(portal.getByRole('alert')).toContainText('A autenticação está indisponível');
  await expect(portal.getByRole('button', { name: '[ ENTRAR COM GOOGLE ]', exact: true })).toHaveCount(0);
  await portal.getByRole('button', { name: '[ SOLICITAR REUNIÃO SEM LOGIN ]', exact: true }).click();
  const agenda = page.getByRole('dialog', { name: '[ CONSELHO DA JORNADA ]', exact: true });
  await expect(agenda).toBeVisible();
  await agenda.getByRole('button', { name: 'Consultar horários', exact: true }).click();
  await expect(agenda.getByText('Nenhum horário disponível neste período. Escolha outra data.', { exact: true })).toBeVisible();
  expect(api.requests.filter(request => request.method() === 'POST')).toHaveLength(0);
  expect(api.unexpected).toEqual([]);
});

for (const status of [429, 503]) {
  test(`baú respeita Retry-After ${status} ao reabrir e recupera sessão só por clique`, async ({ page }) => {
    await page.clock.install();
    const api = await mockPlatform(page, [
      { path: '/api/v1/auth/session', status, body: platformError(status === 429 ? 'RATE_LIMITED' : 'SERVICE_UNAVAILABLE'),
        headers: { 'Retry-After': '10' } },
      { path: '/api/v1/auth/session', body: authenticatedSession('user') },
    ]);
    await page.goto('/');
    const trigger = page.getByRole('button', { name: 'Abrir prévia de login', exact: true });
    await trigger.click();
    const portal = page.getByRole('dialog', { name: '[ PORTAL DE AUTENTICAÇÃO ]', exact: true });
    const recover = portal.getByRole('button', { name: '[ CONSULTAR SESSÃO NOVAMENTE ]', exact: true });
    await expect(recover).toBeDisabled();
    await expect(portal.getByRole('button', { name: '[ ENTRAR COM GOOGLE ]', exact: true })).toBeDisabled();
    await expect(portal.getByText(/antes de consultar ou alterar a sessão novamente/)).toBeVisible();
    await page.clock.fastForward(6_000);
    await page.keyboard.press('Escape');
    await trigger.click();
    await expect(recover).toBeDisabled();
    await page.clock.fastForward(4_100);
    await expect(recover).toBeEnabled();
    await expect(portal.getByText(/antes de consultar ou alterar a sessão novamente/)).toHaveCount(0);
    expect(api.requests).toHaveLength(1);
    await recover.click();
    await expect(page.getByRole('dialog', { name: '[ BAÚ DO AVENTUREIRO ]', exact: true })).toBeVisible();
    expect(api.requests).toHaveLength(2);
    expect(api.requests.every(request => request.method() === 'GET')).toBe(true);
    expect(api.unexpected).toEqual([]);
  });
}

for (const role of ['anonymous', 'user'] as const) {
  test(`${role} é redirecionado da administração sem consultar endpoints administrativos`, async ({ page }) => {
    const api = await mockPlatform(page, [{ path: '/api/v1/auth/session',
      body: role === 'anonymous' ? anonymousSession() : authenticatedSession('user') }]);
    await page.goto('/administracao');
    await expect(page).toHaveURL(/\/#sobre$/);
    await expect(adminHeading(page)).toHaveCount(0);
    expect(api.requests.filter(request => request.url().includes('/admin/'))).toHaveLength(0);
    const triggerName = role === 'anonymous' ? 'Abrir prévia de login' : 'Abrir baú do aventureiro';
    await page.getByRole('button', { name: triggerName, exact: true }).click();
    await expect(page.getByRole('button', { name: '[ PAINEL DO MESTRE ]', exact: true })).toHaveCount(0);
    expect(api.unexpected).toEqual([]);
  });
}

test('administrador abre painel pelo baú, pagina por cursor e filtra a situação sem acumular páginas antigas', async ({ page }) => {
  const second = adminMeeting('PENDING', { id: '22111111-1111-4111-8111-111111111111', name: 'Segundo visitante' });
  const failed = adminMeeting('FAILED', { id: '33111111-1111-4111-8111-111111111111', name: 'Pedido falho', failureCode: 'CALENDAR_UNAVAILABLE' });
  const cursor = 'opaque-cursor+from-server';
  const api = await mockPlatform(page, [
    { path: '/api/v1/auth/session', body: authenticatedSession('admin') },
    { path: ADMIN_PATH, body: list([item()], cursor) },
    { path: ADMIN_PATH, body: list([second]) },
    { path: ADMIN_PATH, body: list([failed]) },
  ]);
  await page.goto('/');
  await page.getByRole('button', { name: 'Abrir baú do aventureiro', exact: true }).click();
  await page.getByRole('button', { name: '[ PAINEL DO MESTRE ]', exact: true }).click();
  await expect(adminHeading(page)).toBeVisible();
  await expect(page.locator('.phase3-admin-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'CARREGAR MAIS PEDIDOS', exact: true }).click();
  await expect(page.locator('.phase3-admin-card')).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'CARREGAR MAIS PEDIDOS', exact: true })).toHaveCount(0);
  await page.getByLabel('FILTRAR SITUAÇÃO', { exact: true }).selectOption('FAILED');
  await expect(page.locator('.phase3-admin-card')).toHaveCount(1);
  await expect(page.locator('.phase3-admin-card')).toContainText('Pedido falho');
  await expect(page.locator('.phase3-admin-card')).toContainText('CALENDAR_UNAVAILABLE');
  await expect(page.locator('.phase3-admin-card')).not.toContainText('Segundo visitante');
  const queries = api.requests.filter(request => new URL(request.url()).pathname === ADMIN_PATH)
    .map(request => new URL(request.url()).searchParams);
  expect(queries).toHaveLength(3);
  expect(queries[0].get('limit')).toBe('25');
  expect(queries[0].has('cursor')).toBe(false);
  expect(queries[1].get('cursor')).toBe(cursor);
  expect(queries[2].get('status')).toBe('FAILED');
  expect(queries[2].has('cursor')).toBe(false);
  expect(api.unexpected).toEqual([]);
});

test('listagem vazia é informativa e conteúdo HTML de visitante permanece texto', async ({ page }) => {
  const payload = '<img src=x onerror="document.documentElement.dataset.adminInjected=1">';
  const api = await mockPlatform(page, [
    { path: '/api/v1/auth/session', body: authenticatedSession('admin') },
    { path: ADMIN_PATH, body: list([]) },
    { path: ADMIN_PATH, body: list([adminMeeting('PENDING', { topic: payload })]) },
  ]);
  await visitAdmin(page);
  await expect(page.getByText('Nenhum pedido encontrado para este filtro.', { exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.getByRole('button', { name: 'ATUALIZAR PEDIDOS', exact: true }).click();
  await expect(page.locator('.phase3-admin-topic')).toHaveText(payload);
  await expect(page.locator('.phase3-admin-topic img')).toHaveCount(0);
  await expect(page.locator('html')).not.toHaveAttribute('data-admin-injected');
  expect(api.unexpected).toEqual([]);
});

for (const scenario of [
  { action: 'approve', label: 'APROVAR', result: 'APPROVED', title: 'Aprovada, aguardando a agenda' },
  { action: 'reject', label: 'REJEITAR', result: 'REJECTED', title: 'Não aprovada' },
  { action: 'cancel', label: 'CANCELAR', result: 'CANCELLED', title: 'Cancelamento registrado' },
] as const) {
  test(`${scenario.action} exige confirmação explícita e envia só cookie e CSRF, sem corpo`, async ({ page, context }) => {
    await context.addCookies([{ name: '__Host-phasscode-session', value: 'mock-http-only-session',
      url: 'https://phase3-api.invalid', httpOnly: true, secure: true, sameSite: 'None' }]);
    const pending = deferredReply();
    const updated = { ...item(), ...meetingStatus(scenario.result) };
    const api = await mockPlatform(page, [
      { path: '/api/v1/auth/session', body: authenticatedSession('admin') },
      { path: ADMIN_PATH, body: list() },
      { method: 'POST', path: `${ADMIN_PATH}/${item().id}/${scenario.action}`, body: meetingStatus(scenario.result), waitFor: pending.promise },
      { path: ADMIN_PATH, body: list([updated]) },
    ]);
    await visitAdmin(page);
    const card = page.locator('.phase3-admin-card').first();
    const trigger = card.getByRole('button', { name: scenario.label, exact: true });
    await trigger.click();
    await expect(confirmation(page)).toContainText('Esta decisão pode iniciar operações na agenda e notificações externas.');
    expect(api.requests.filter(request => request.method() === 'POST')).toHaveLength(0);
    await page.keyboard.press('Escape');
    await expect(confirmation(page)).toHaveCount(0);
    await expect(trigger).toBeFocused();
    expect(api.requests.filter(request => request.method() === 'POST')).toHaveLength(0);
    await trigger.click();
    const confirm = confirmation(page).getByRole('button', { name: `CONFIRMAR ${scenario.label}`, exact: true });
    await confirm.click();
    await expect(confirmation(page).getByRole('button', { name: 'PROCESSANDO...', exact: true })).toBeDisabled();
    await confirmation(page).getByRole('button', { name: 'PROCESSANDO...', exact: true }).evaluate(button => {
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await expect.poll(() => api.requests.filter(request => request.method() === 'POST').length).toBe(1);
    pending.release();
    await expect(confirmation(page)).toHaveCount(0);
    await expect(card.getByRole('heading', { name: scenario.title, exact: true })).toBeVisible();
    if (scenario.result === 'APPROVED') await expect(card.getByRole('heading', { name: 'Confirmada na agenda', exact: true })).toHaveCount(0);
    const command = api.requests.find(request => request.method() === 'POST')!;
    expect(command.postData()).toBeNull();
    expect(command.headers()['x-csrf-token']).toBe(MOCK_CSRF_TOKEN);
    expect(command.headers()['authorization']).toBeUndefined();
    expect((await command.allHeaders()).cookie).toContain('__Host-phasscode-session=mock-http-only-session');
    const exposed = await page.evaluate(() => JSON.stringify({ url: location.href,
      local: { ...localStorage }, session: { ...sessionStorage }, html: document.documentElement.outerHTML, cookies: document.cookie }));
    expect(exposed).not.toContain(MOCK_CSRF_TOKEN);
    expect(exposed).not.toContain('mock-http-only-session');
    expect(api.requests.every(request => !request.url().includes(MOCK_CSRF_TOKEN))).toBe(true);
    expect(api.unexpected).toEqual([]);
  });
}

test('401 durante decisão remove identidade e redireciona sem repetir mutação', async ({ page }) => {
  const api = await mockPlatform(page, [
    { path: '/api/v1/auth/session', body: authenticatedSession('admin') },
    { path: ADMIN_PATH, body: list() },
    { method: 'POST', path: `${ADMIN_PATH}/${item().id}/approve`, status: 401, body: platformError('AUTH_REQUIRED') },
  ]);
  await visitAdmin(page);
  await page.locator('.phase3-admin-card').getByRole('button', { name: 'APROVAR', exact: true }).click();
  await confirmation(page).getByRole('button', { name: 'CONFIRMAR APROVAR', exact: true }).click();
  await expect(page).toHaveURL(/\/#sobre$/);
  await expect(adminHeading(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Abrir prévia de login', exact: true })).toBeVisible();
  expect(api.requests.filter(request => request.method() === 'POST')).toHaveLength(1);
  expect(api.unexpected).toEqual([]);
});

for (const status of [403, 409] as const) {
  test(`${status} em decisão apresenta erro público e correlação sem reenviar automaticamente`, async ({ page }) => {
    const code = status === 403 ? 'CSRF_INVALID' : 'MEETING_SLOT_UNAVAILABLE';
    const api = await mockPlatform(page, [
      { path: '/api/v1/auth/session', body: authenticatedSession('admin') },
      { path: ADMIN_PATH, body: list() },
      { method: 'POST', path: `${ADMIN_PATH}/${item().id}/approve`, status,
        body: { error: { code, message: 'internal-private-stack', correlationId: MOCK_PLATFORM_CORRELATION_ID } } },
      ...(status === 409 ? [{ path: ADMIN_PATH, body: list([{ ...item(), ...meetingStatus('APPROVED') }]) }] : []),
    ]);
    await visitAdmin(page);
    await page.locator('.phase3-admin-card').getByRole('button', { name: 'APROVAR', exact: true }).click();
    await confirmation(page).getByRole('button', { name: 'CONFIRMAR APROVAR', exact: true }).click();
    await expect(confirmation(page)).toHaveCount(0);
    await expect(page.getByRole('alert')).toContainText(MOCK_PLATFORM_CORRELATION_ID);
    await expect(page.getByRole('alert')).not.toContainText('internal-private-stack');
    expect(api.requests.filter(request => request.method() === 'POST')).toHaveLength(1);
    await expect.poll(() => api.requests.filter(request => new URL(request.url()).pathname === ADMIN_PATH).length).toBe(status === 409 ? 2 : 1);
    if (status === 409) await expect(page.getByRole('heading', { name: 'Aprovada, aguardando a agenda', exact: true })).toBeVisible();
    expect(api.unexpected).toEqual([]);
  });
}

test('Retry-After libera consulta consciente ao terminar sem polling nem retry automático', async ({ page }) => {
  const api = await mockPlatform(page, [
    { path: '/api/v1/auth/session', body: authenticatedSession('admin') },
    { path: ADMIN_PATH, status: 503, body: platformError(), headers: { 'Retry-After': '1' } },
    { path: ADMIN_PATH, body: list() },
  ]);
  await page.goto('/administracao');
  await expect(page.getByRole('alert')).toBeVisible();
  const update = page.getByRole('button', { name: 'ATUALIZAR PEDIDOS', exact: true });
  await expect(update).toBeDisabled();
  await expect(update).toBeEnabled();
  await expect(page.getByText(/antes de consultar novamente/)).toHaveCount(0);
  expect(api.requests.filter(request => new URL(request.url()).pathname === ADMIN_PATH)).toHaveLength(1);
  await update.click();
  await expect(page.locator('.phase3-admin-card')).toHaveCount(1);
  expect(api.requests.filter(request => new URL(request.url()).pathname === ADMIN_PATH)).toHaveLength(2);
  expect(api.unexpected).toEqual([]);
});

test('sair e reabrir o painel durante Retry-After preserva o prazo original sem prolongar a espera', async ({ page }) => {
  await page.clock.install();
  const api = await mockPlatform(page, [
    { path: '/api/v1/auth/session', body: authenticatedSession('admin') },
    { path: ADMIN_PATH, status: 503, body: platformError(), headers: { 'Retry-After': '10' } },
    { path: ADMIN_PATH, body: list() },
  ]);
  await page.goto('/administracao');
  await expect(page.getByRole('alert')).toBeVisible();
  const update = page.getByRole('button', { name: 'ATUALIZAR PEDIDOS', exact: true });
  await expect(update).toBeDisabled();
  await page.clock.fastForward(6_000);
  await page.getByRole('button', { name: 'VOLTAR AO PORTFÓLIO', exact: true }).click();
  await expect(page).toHaveURL(/\/#sobre$/);
  await page.getByRole('button', { name: 'Abrir baú do aventureiro', exact: true }).click();
  await page.getByRole('button', { name: '[ PAINEL DO MESTRE ]', exact: true }).click();
  await expect(adminHeading(page)).toBeVisible();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(update).toBeDisabled();
  expect(api.requests.filter(request => new URL(request.url()).pathname === ADMIN_PATH)).toHaveLength(1);
  await page.clock.fastForward(4_100);
  await expect(update).toBeEnabled();
  await expect(page.getByText(/antes de consultar novamente/)).toHaveCount(0);
  expect(api.requests.filter(request => new URL(request.url()).pathname === ADMIN_PATH)).toHaveLength(1);
  await update.click();
  await expect(page.locator('.phase3-admin-card')).toHaveCount(1);
  expect(api.requests.filter(request => new URL(request.url()).pathname === ADMIN_PATH)).toHaveLength(2);
  expect(api.requests.every(request => request.method() === 'GET')).toBe(true);
  expect(api.unexpected).toEqual([]);
});

test('Escape interrompe espera de decisão e informa incerteza sem atualizar pela resposta tardia', async ({ page }) => {
  const pending = deferredReply();
  const api = await mockPlatform(page, [
    { path: '/api/v1/auth/session', body: authenticatedSession('admin') },
    { path: ADMIN_PATH, body: list() },
    { method: 'POST', path: `${ADMIN_PATH}/${item().id}/approve`, waitFor: pending.promise, body: meetingStatus('APPROVED') },
  ]);
  await visitAdmin(page);
  const trigger = page.locator('.phase3-admin-card').getByRole('button', { name: 'APROVAR', exact: true });
  await trigger.click();
  await confirmation(page).getByRole('button', { name: 'CONFIRMAR APROVAR', exact: true }).click();
  await expect.poll(() => api.requests.filter(request => request.method() === 'POST').length).toBe(1);
  await page.keyboard.press('Escape');
  await expect(confirmation(page)).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(page.getByRole('alert')).toContainText('A decisão pode ter sido registrada no servidor');
  pending.release();
  await expect(page.getByRole('heading', { name: 'Aguardando análise', exact: true })).toBeVisible();
  expect(api.requests.filter(request => request.method() === 'POST')).toHaveLength(1);
  expect(api.requests.filter(request => new URL(request.url()).pathname === ADMIN_PATH)).toHaveLength(1);
  expect(api.unexpected).toEqual([]);
});

for (const width of [320, 375, 768, 1440]) {
  test(`painel e confirmação mantêm layout e teclado em ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const api = await mockPlatform(page, [
      { path: '/api/v1/auth/session', body: authenticatedSession('admin') },
      { path: ADMIN_PATH, body: list([adminMeeting('PENDING', { email: 'endereco.longo.para.validar.quebra.de.linha@example.test' })]) },
    ]);
    await visitAdmin(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const trigger = page.locator('.phase3-admin-card').getByRole('button', { name: 'APROVAR', exact: true });
    await trigger.click();
    const dialog = confirmation(page);
    const close = dialog.getByRole('button', { name: 'Fechar confirmação', exact: true });
    await expect(close).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(dialog.getByRole('button', { name: 'VOLTAR SEM DECIDIR', exact: true })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(close).toBeFocused();
    const bounds = await dialog.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1);
    expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    if (width === 320) {
      const audit = await new AxeBuilder({ page }).analyze();
      expect(audit.violations).toEqual([]);
    }
    await page.keyboard.press('Escape');
    await expect(trigger).toBeFocused();
    expect(api.requests.filter(request => request.method() === 'POST')).toHaveLength(0);
    expect(api.unexpected).toEqual([]);
  });
}

test('filtro apresenta os seis estados sem interpretar APPROVED como CONFIRMED', async ({ page }) => {
  const states: MeetingStatus[] = ['PENDING', 'APPROVED', 'CONFIRMED', 'REJECTED', 'CANCELLED', 'FAILED'];
  const api = await mockPlatform(page, [
    { path: '/api/v1/auth/session', body: authenticatedSession('admin') },
    { path: ADMIN_PATH, body: list(states.map((status, index) => adminMeeting(status,
      { id: `${index + 1}1111111-1111-4111-8111-111111111111`, name: `Visitante ${status}` }))) },
  ]);
  await visitAdmin(page);
  await expect(page.locator('.phase3-admin-card')).toHaveCount(6);
  await expect(page.getByLabel('FILTRAR SITUAÇÃO', { exact: true }).locator('option')).toHaveCount(7);
  await expect(page.getByRole('heading', { name: 'Aprovada, aguardando a agenda', exact: true })).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'Confirmada na agenda', exact: true })).toHaveCount(1);
  await expect(page.getByText('A decisão de cancelamento foi registrada. A remoção na agenda externa ainda pode estar em verificação.', { exact: true })).toBeVisible();
  expect(api.unexpected).toEqual([]);
});

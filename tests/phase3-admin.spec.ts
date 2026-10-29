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
const meetingSummary = (page: Page) => page.getByRole('region', { name: 'Resumo dos pedidos carregados', exact: true });
const meetingMetric = (page: Page, label: string) => meetingSummary(page)
  .getByText(label, { exact: true }).locator('..').locator('dd');
const item = () => adminMeeting('PENDING');
const list = (items = [item()], nextCursor: string | null = null) => ({ items, nextCursor });

async function visitAdmin(page: Page) {
  await page.goto('/administracao');
  await expect(adminHeading(page)).toBeVisible();
  await expect(page.getByRole('button', { name: 'ATUALIZAR PEDIDOS', exact: true })).toBeEnabled();
}

test('autenticação desabilitada mantém o baú restrito e não consulta agenda nem administração', async ({ page }) => {
  const api = await mockPlatform(page, [
    { path: '/api/v1/auth/session', status: 404, body: platformError('AUTH_DISABLED') },
  ]);
  await page.goto('/');
  await page.getByRole('button', { name: 'Abrir prévia de login', exact: true }).click();
  const portal = page.getByRole('dialog', { name: '[ PORTAL DE AUTENTICAÇÃO ]', exact: true });
  await expect(portal.getByRole('alert')).toContainText('A autenticação está indisponível');
  await expect(portal.getByRole('button', { name: '[ ENTRAR COM GOOGLE ]', exact: true })).toHaveCount(0);
  await expect(portal.getByRole('button', { name: /SOLICITAR REUNIÃO|IR PARA A SALA DO ADMINISTRADOR|ATUALIZAR SESSÃO|RENOVAR SESSÃO/ })).toHaveCount(0);
  expect(api.requests).toHaveLength(1);
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
    await expect(page.getByRole('button', { name: '[ IR PARA A SALA DO ADMINISTRADOR ]', exact: true })).toHaveCount(0);
    if (role === 'user') {
      const chest = page.getByRole('dialog', { name: '[ BAÚ DO AVENTUREIRO ]', exact: true });
      await expect(chest).toContainText(/não tem permissão/i);
      await expect(chest.getByRole('button', { name: '[ ENTRAR COM GOOGLE ]', exact: true })).toHaveCount(0);
      await expect(chest.getByRole('button', { name: '[ TRANCAR BAÚ (LOGOUT) ]', exact: true })).toBeVisible();
    }
    expect(api.unexpected).toEqual([]);
  });
}

for (const entry of ['/', '/#sobre']) {
  test(`sessão admin em ${entry} respeita o destino e permite entrar e voltar da administração`, async ({ page }) => {
    const api = await mockPlatform(page, [
      { path: '/api/v1/auth/session', body: authenticatedSession('admin') },
      { path: ADMIN_PATH, body: list([]) },
      { path: ADMIN_PATH, body: list([]) },
    ]);
    await page.goto(entry);
    if (entry === '/#sobre') {
      await expect(page).toHaveURL(/\/#sobre$/);
      await expect(adminHeading(page)).toHaveCount(0);
      expect(api.requests.filter(request => new URL(request.url()).pathname === ADMIN_PATH)).toHaveLength(0);
      await page.getByRole('button', { name: 'Abrir baú do aventureiro', exact: true }).click();
      await page.getByRole('button', { name: '[ IR PARA A SALA DO ADMINISTRADOR ]', exact: true }).click();
    }
    await expect(page).toHaveURL(/\/administracao$/);
    await expect(adminHeading(page)).toBeVisible();
    await expect(page.getByText('Nenhum pedido encontrado para este filtro.', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'VOLTAR AO PORTFÓLIO', exact: true }).click();
    await expect(page).toHaveURL(/\/#sobre$/);
    const trigger = page.getByRole('button', { name: 'Abrir baú do aventureiro', exact: true });
    await trigger.click();
    const chest = page.getByRole('dialog', { name: '[ BAÚ DO AVENTUREIRO ]', exact: true });
    await expect(chest.getByRole('button', { name: /SOLICITAR REUNIÃO|ATUALIZAR SESSÃO|RENOVAR SESSÃO|ENTRAR COM GOOGLE/ })).toHaveCount(0);
    await expect(chest.getByRole('button', { name: '[ TRANCAR BAÚ (LOGOUT) ]', exact: true })).toBeEnabled();
    expect(api.requests.filter(request => new URL(request.url()).pathname === ADMIN_PATH)).toHaveLength(1);
    await chest.getByRole('button', { name: '[ IR PARA A SALA DO ADMINISTRADOR ]', exact: true }).click();
    await expect(page).toHaveURL(/\/administracao$/);
    await expect(adminHeading(page)).toBeVisible();
    await expect.poll(() => api.requests.filter(request => new URL(request.url()).pathname === ADMIN_PATH).length).toBe(2);
    expect(api.requests.filter(request => request.url().endsWith('/auth/session'))).toHaveLength(1);
    expect(api.requests.every(request => request.method() === 'GET')).toBe(true);
    expect(api.unexpected).toEqual([]);
  });
}

test('administrador pagina por cursor e filtra a situação sem acumular páginas antigas', async ({ page }) => {
  const second = adminMeeting('PENDING', { id: '22111111-1111-4111-8111-111111111111', name: 'Segundo visitante' });
  const failed = adminMeeting('FAILED', { id: '33111111-1111-4111-8111-111111111111', name: 'Pedido falho', failureCode: 'CALENDAR_UNAVAILABLE' });
  const cursor = 'opaque-cursor+from-server';
  const api = await mockPlatform(page, [
    { path: '/api/v1/auth/session', body: authenticatedSession('admin') },
    { path: ADMIN_PATH, body: list([item()], cursor) },
    { path: ADMIN_PATH, body: list([second]) },
    { path: ADMIN_PATH, body: list([failed]) },
  ]);
  await visitAdmin(page);
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

test('registros do Orbe exibem conversas, assuntos e intenção de forma administrativa', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', request => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith('/api/v1/') && request.method() !== 'OPTIONS') requests.push(`${request.method()} ${path}`);
  });
  const summary = 'Assuntos identificados: Tecnologias. Intenção provável: dúvida técnica.';
  const api = await mockPlatform(page, [
    { path: '/api/v1/auth/session', body: authenticatedSession('admin') },
    { path: ADMIN_PATH, body: list([]) },
    { path: '/api/v1/admin/conversations', body: {
      retentionDays: 7,
      generatedAt: '2026-10-28T15:00:00.000Z',
      totals: { conversations: 1, questions: 2 },
      intents: [{ name: 'technical', total: 1 }],
      topics: [{ name: 'Tecnologias', total: 1 }],
      items: [{
        id: '11111111-1111-4111-8111-111111111111',
        intent: 'technical', summary, topics: ['Tecnologias'], turns: 2,
        createdAt: '2026-10-28T14:00:00.000Z',
        updatedAt: '2026-10-28T15:00:00.000Z',
      }],
      nextOffset: null,
    } },
  ]);
  await visitAdmin(page);
  const records = page.getByRole('region', { name: '[ REGISTROS DO ORBE ]', exact: true });
  await expect(records.getByText('CONVERSAS ÚNICAS', { exact: true })).toBeVisible();
  await expect(records.getByText('PERGUNTAS RESPONDIDAS', { exact: true })).toBeVisible();
  await expect(records.getByText('Dúvida técnica: 1', { exact: true })).toBeVisible();
  await expect(records.getByText('Tecnologias: 1', { exact: true })).toBeVisible();
  await expect(records.getByText(summary, { exact: true })).toBeVisible();
  await expect(records).toContainText('últimos 7 dias');
  await page.getByRole('link', { name: 'REGISTROS DO ORBE', exact: true }).click();
  await expect(records).toBeFocused();
  await page.getByRole('link', { name: 'AGENDA E PEDIDOS', exact: true }).click();
  await expect(page.locator('#admin-meeting-agenda')).toBeFocused();
  await expect(page).toHaveURL(/\/administracao$/);
  expect(requests).toEqual(expect.arrayContaining([
    'GET /api/v1/auth/session', `GET ${ADMIN_PATH}`, 'GET /api/v1/admin/conversations',
  ]));
  expect(api.unexpected).toEqual([]);
});

test('resumo contabiliza somente pedidos carregados e confirmações, com escopo parcial até terminar a paginação', async ({ page }) => {
  const confirmed = adminMeeting('CONFIRMED', { name: 'Confirmada de teste' });
  const pending = adminMeeting('PENDING', { id: '22111111-1111-4111-8111-111111111111' });
  const approved = adminMeeting('APPROVED', { id: '33111111-1111-4111-8111-111111111111' });
  const cancelled = adminMeeting('CANCELLED', { id: '44111111-1111-4111-8111-111111111111' });
  const api = await mockPlatform(page, [
    { path: '/api/v1/auth/session', body: authenticatedSession('admin') },
    { path: ADMIN_PATH, body: list([confirmed, pending], 'second-page') },
    // The repeated item must not inflate either the list or the summary.
    { path: ADMIN_PATH, body: list([confirmed, approved, cancelled]) },
  ]);
  await visitAdmin(page);
  await expect(meetingMetric(page, 'Pedidos carregados')).toHaveText('2');
  await expect(meetingMetric(page, 'Confirmadas')).toHaveText('1');
  await expect(meetingMetric(page, 'Aguardando análise')).toHaveText('1');
  await expect(meetingMetric(page, 'Aguardando agenda')).toHaveText('0');
  await expect(meetingMetric(page, 'Canceladas')).toHaveText('0');
  await expect(meetingSummary(page)).toContainText(/parcial/i);
  await page.getByRole('button', { name: 'CARREGAR MAIS PEDIDOS', exact: true }).click();
  await expect(page.locator('.phase3-admin-card')).toHaveCount(4);
  await expect(meetingMetric(page, 'Pedidos carregados')).toHaveText('4');
  await expect(meetingMetric(page, 'Confirmadas')).toHaveText('1');
  await expect(meetingMetric(page, 'Aguardando análise')).toHaveText('1');
  await expect(meetingMetric(page, 'Aguardando agenda')).toHaveText('1');
  await expect(meetingMetric(page, 'Canceladas')).toHaveText('1');
  await expect(meetingSummary(page)).not.toContainText(/parcial/i);
  await expect(page.getByRole('button', { name: 'CARREGAR MAIS PEDIDOS', exact: true })).toHaveCount(0);
  expect(api.requests.filter(request => new URL(request.url()).pathname === ADMIN_PATH)).toHaveLength(2);
  expect(api.unexpected).toEqual([]);
});

test('busca e ordenação atuam nos registros carregados sem novas requisições nem ocultar paginação', async ({ page }) => {
  const ana = adminMeeting('PENDING', { name: 'Ana Silva', email: 'ana@example.test', topic: 'Backend Java',
    createdAt: '2026-10-01T12:00:00.000Z', start: '2027-01-20T12:00:00.000Z', end: '2027-01-20T12:30:00.000Z' });
  const bruno = adminMeeting('CONFIRMED', { id: '22111111-1111-4111-8111-111111111111',
    name: 'Bruno Alves', email: 'bruno@example.test', topic: 'Mobile Flutter',
    createdAt: '2026-10-03T12:00:00.000Z', start: '2027-01-19T12:00:00.000Z', end: '2027-01-19T12:30:00.000Z' });
  const cecilia = adminMeeting('APPROVED', { id: '33111111-1111-4111-8111-111111111111',
    name: 'Cecilia Ramos', email: 'talentos@empresa.test', topic: 'Backend TypeScript',
    createdAt: '2026-10-02T12:00:00.000Z', start: '2027-01-21T12:00:00.000Z', end: '2027-01-21T12:30:00.000Z' });
  const api = await mockPlatform(page, [
    { path: '/api/v1/auth/session', body: authenticatedSession('admin') },
    { path: ADMIN_PATH, body: list([ana, bruno, cecilia], 'another-page') },
  ]);
  await visitAdmin(page);
  const cards = page.locator('.phase3-admin-card');
  const search = page.getByLabel('BUSCAR NOS PEDIDOS CARREGADOS', { exact: true });
  const sort = page.getByLabel('ORDENAR PEDIDOS CARREGADOS', { exact: true });
  await expect(sort).toHaveValue('received');
  await expect(cards).toHaveText([/Bruno Alves/, /Cecilia Ramos/, /Ana Silva/]);
  await sort.selectOption('start');
  await expect(cards).toHaveText([/Bruno Alves/, /Ana Silva/, /Cecilia Ramos/]);
  await search.fill('  ANA SILVA  ');
  await expect(cards).toHaveCount(1);
  await expect(cards).toHaveAttribute('aria-label', 'Pedido de Ana Silva');
  await search.fill(' TALENTOS@EMPRESA.TEST ');
  await expect(cards).toHaveCount(1);
  await expect(cards).toHaveAttribute('aria-label', 'Pedido de Cecilia Ramos');
  await search.fill(' BACKEND ');
  await expect(cards).toHaveCount(2);
  await expect(meetingMetric(page, 'Pedidos carregados')).toHaveText('3');
  await expect(meetingMetric(page, 'Confirmadas')).toHaveText('1');
  await search.fill('nenhum resultado esperado');
  await expect(cards).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'CARREGAR MAIS PEDIDOS', exact: true })).toBeEnabled();
  await search.fill('');
  await expect(cards).toHaveCount(3);
  const edit = cards.first().getByRole('button', { name: 'ALTERAR REUNIÃO', exact: true });
  await expect(edit).toBeDisabled();
  await expect(edit).toHaveAttribute('aria-describedby', 'admin-edit-unavailable');
  await expect(page.locator('#admin-edit-unavailable')).toContainText('ainda não está disponível');
  expect(api.requests.filter(request => new URL(request.url()).pathname !== '/api/v1/admin/conversations')).toHaveLength(2);
  expect(api.requests.every(request => request.method() === 'GET')).toBe(true);
  expect(api.unexpected).toEqual([]);
});

test('loading e erro não apresentam resumo sem dados nem inventam métricas zero', async ({ page }) => {
  const pending = deferredReply();
  const api = await mockPlatform(page, [
    { path: '/api/v1/auth/session', body: authenticatedSession('admin') },
    { path: ADMIN_PATH, status: 503, body: platformError(), waitFor: pending.promise },
  ]);
  try {
    await page.goto('/administracao');
    await expect(adminHeading(page)).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: '[ CONSULTANDO PEDIDOS... ]' })).toBeVisible();
    await expect(meetingSummary(page)).toHaveCount(0);
  } finally { pending.release(); }
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(meetingSummary(page)).toHaveCount(0);
  expect(api.requests.filter(request => new URL(request.url()).pathname === ADMIN_PATH)).toHaveLength(1);
  expect(api.unexpected).toEqual([]);
});

test('cancelar reunião CONFIRMED exige confirmação explícita e envia CSRF sem corpo', async ({ page }) => {
  const confirmed = adminMeeting('CONFIRMED', { name: 'Reunião confirmada' });
  const cancelled = { ...confirmed, ...meetingStatus('CANCELLED') };
  const api = await mockPlatform(page, [
    { path: '/api/v1/auth/session', body: authenticatedSession('admin') },
    { path: ADMIN_PATH, body: list([confirmed]) },
    { method: 'POST', path: `${ADMIN_PATH}/${confirmed.id}/cancel`, body: meetingStatus('CANCELLED') },
    { path: ADMIN_PATH, body: list([cancelled]) },
  ]);
  await visitAdmin(page);
  const card = page.getByRole('article', { name: 'Pedido de Reunião confirmada', exact: true });
  await expect(card.getByRole('heading', { name: 'Confirmada na agenda', exact: true })).toBeVisible();
  await card.getByRole('button', { name: 'CANCELAR', exact: true }).click();
  await expect(confirmation(page)).toContainText('Reunião confirmada');
  expect(api.requests.filter(request => request.method() === 'POST')).toHaveLength(0);
  await confirmation(page).getByRole('button', { name: 'CONFIRMAR CANCELAR', exact: true }).click();
  await expect(confirmation(page)).toHaveCount(0);
  await expect(card.getByRole('heading', { name: 'Cancelamento registrado', exact: true })).toBeVisible();
  const commands = api.requests.filter(request => request.method() === 'POST');
  expect(commands).toHaveLength(1);
  expect(commands[0].postData()).toBeNull();
  expect(commands[0].headers()['x-csrf-token']).toBe(MOCK_CSRF_TOKEN);
  expect(commands[0].headers().authorization).toBeUndefined();
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
    const code = status === 403 ? 'AUTH_CSRF' : 'MEETING_SLOT_UNAVAILABLE';
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
  await page.getByRole('button', { name: '[ IR PARA A SALA DO ADMINISTRADOR ]', exact: true }).click();
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

for (const theme of ['escuro', 'claro'] as const) {
  test(`dashboard mantém acessibilidade em 320px no tema ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    const api = await mockPlatform(page, [
      { path: '/api/v1/auth/session', body: authenticatedSession('admin') },
      { path: ADMIN_PATH, body: list([adminMeeting('PENDING', { email: 'endereco.longo.para.validar.quebra.de.linha@example.test' })]) },
    ]);
    await visitAdmin(page);
    if (theme === 'claro') {
      await page.getByRole('button', { name: 'Ativar tema claro', exact: true }).click();
      await expect(page.locator('body')).toHaveClass(/modo-claro/);
    }
    await expect(meetingSummary(page)).toBeVisible();
    const audit = await new AxeBuilder({ page }).include('.admin-dashboard').analyze();
    expect(audit.violations).toEqual([]);
    expect(api.requests.filter(request => new URL(request.url()).pathname !== '/api/v1/admin/conversations')).toHaveLength(2);
    expect(api.requests.every(request => request.method() === 'GET')).toBe(true);
    expect(api.unexpected).toEqual([]);
  });
}

for (const width of [320, 375, 768, 1440]) {
  test(`painel e confirmação mantêm layout e teclado em ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const api = await mockPlatform(page, [
      { path: '/api/v1/auth/session', body: authenticatedSession('admin') },
      { path: ADMIN_PATH, body: list([adminMeeting('PENDING', { email: 'endereco.longo.para.validar.quebra.de.linha@example.test' })]) },
    ]);
    await visitAdmin(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const chestTrigger = page.getByRole('button', { name: 'Abrir baú do aventureiro', exact: true });
    for (const theme of ['escuro', 'claro'] as const) {
      if (theme === 'claro') {
        await page.getByRole('button', { name: 'Ativar tema claro', exact: true }).click();
        await expect(page.locator('body')).toHaveClass(/modo-claro/);
      }
      await page.getByRole('link', { name: 'REGISTROS DO ORBE', exact: true }).focus();
      await page.keyboard.press('Enter');
      const records = page.getByRole('region', { name: '[ REGISTROS DO ORBE ]', exact: true });
      await expect(records).toBeFocused();
      await expect(records.getByRole('heading', { name: '[ REGISTROS DO ORBE ]', exact: true, level: 2 })).toBeVisible();
      await expect(records.getByText('CONVERSAS ÚNICAS', { exact: true })).toBeVisible();
      await expect(records.getByText('PERGUNTAS RESPONDIDAS', { exact: true })).toBeVisible();
      await page.getByRole('link', { name: 'AGENDA E PEDIDOS', exact: true }).focus();
      await page.keyboard.press('Enter');
      await expect(page.locator('#admin-meeting-agenda')).toBeFocused();
      await expect(page.getByRole('heading', { name: '[ AGENDA E PEDIDOS ]', exact: true, level: 2 })).toBeVisible();
      await expect(page).toHaveURL(/\/administracao$/);
      for (const section of [records, meetingSummary(page), page.locator('#admin-meeting-agenda')]) {
        const sectionBounds = await section.boundingBox();
        expect(sectionBounds).not.toBeNull();
        expect(sectionBounds!.x).toBeGreaterThanOrEqual(0);
        expect(sectionBounds!.x + sectionBounds!.width).toBeLessThanOrEqual(width + 1);
        expect(await section.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      }
      await chestTrigger.click();
      const chest = page.getByRole('dialog', { name: '[ BAÚ DO AVENTUREIRO ]', exact: true });
      const chestClose = chest.getByRole('button', { name: 'Fechar baú', exact: true });
      const enterRoom = chest.getByRole('button', { name: '[ IR PARA A SALA DO ADMINISTRADOR ]', exact: true });
      const logout = chest.getByRole('button', { name: '[ TRANCAR BAÚ (LOGOUT) ]', exact: true });
      await expect(chest.getByRole('button')).toHaveCount(3);
      await expect(enterRoom).toBeEnabled();
      await expect(logout).toBeEnabled();
      await expect(chestClose).toBeFocused();
      await page.keyboard.press('Shift+Tab');
      await expect(logout).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(chestClose).toBeFocused();
      const chestBounds = await chest.boundingBox();
      expect(chestBounds).not.toBeNull();
      expect(chestBounds!.x).toBeGreaterThanOrEqual(0);
      expect(chestBounds!.x + chestBounds!.width).toBeLessThanOrEqual(width + 1);
      expect(await chest.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      expect(await enterRoom.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (width === 320) {
        const audit = await new AxeBuilder({ page }).analyze();
        expect(audit.violations).toEqual([]);
      }
      await page.keyboard.press('Escape');
      await expect(chest).toHaveCount(0);
      await expect(chestTrigger).toBeFocused();
    }
    await page.getByRole('button', { name: 'Ativar tema escuro', exact: true }).click();
    await expect(page.locator('body')).not.toHaveClass(/modo-claro/);
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

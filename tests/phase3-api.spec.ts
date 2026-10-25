import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from './fixtures';
import {
  anonymousSession, authenticatedSession, meetingProposal, meetingStatus, mockPlatform, platformError,
  MOCK_CONFIRMATION_TOKEN, MOCK_CSRF_TOKEN, MOCK_MEETING_TOKEN,
} from './helpers/platform-mock';
import { chatResponse, deferredReply, mockChat } from './helpers/orbe-mock';
import type { MeetingProposal, MeetingStatus } from '../src/types/meetings';

const loginTrigger = (page: Page) => page.getByRole('button', { name: 'Abrir prévia de login', exact: true });
const meetingDialog = (page: Page) => page.getByRole('dialog', { name: '[ CONSELHO DA JORNADA ]', exact: true });
const orbTrigger = (page: Page) => page.getByRole('button', { name: 'Abrir guia do portfólio', exact: true });

async function reopenMeetings(page: Page) {
  await orbTrigger(page).click();
  await page.getByRole('button', { name: 'REVISAR PROPOSTA DE REUNIÃO', exact: true }).click();
  await expect(meetingDialog(page)).toBeVisible();
}

async function openMeetings(page: Page, lightTheme = false) {
  await mockChat(page, [{ body: chatResponse({
    answer: 'Revise a proposta antes de enviar qualquer solicitação.',
    actions: [{ type: 'confirm_meeting_request', proposal: meetingProposal() }],
  }) }]);
  await page.goto('/');
  if (lightTheme) {
    await page.getByRole('button', { name: 'Ativar tema claro', exact: true }).click();
    await expect(page.locator('body')).toHaveClass(/modo-claro/);
  }
  await orbTrigger(page).click();
  const orbe = page.getByRole('dialog', { name: /CONSULTAR ORBE MÁGICO/ });
  await orbe.getByRole('textbox', { name: 'Sua pergunta ao orbe' }).fill('Quero revisar uma proposta de reunião.');
  await orbe.getByRole('button', { name: 'ENVIAR', exact: true }).click();
  await orbe.getByRole('button', { name: 'REVISAR PROPOSTA DE REUNIÃO', exact: true }).click();
  await expect(meetingDialog(page)).toBeVisible();
  await meetingDialog(page).getByRole('button', { name: 'Alterar dados / novo horário', exact: true }).click();
}

function availability(proposal: MeetingProposal, simulated = false) {
  return { timeZone: proposal.summary.timeZone, durationMinutes: 30, simulated,
    slots: [{ start: proposal.summary.start, end: proposal.summary.end }] };
}

async function fillMeetingDraft(page: Page) {
  const dialog = meetingDialog(page);
  await dialog.getByRole('button', { name: 'Consultar horários', exact: true }).click();
  await dialog.getByRole('radio').first().check();
  await dialog.getByLabel('Nome', { exact: true }).fill('Visitante de teste');
  await dialog.getByLabel('E-mail', { exact: true }).fill('visitor@example.test');
  await dialog.getByLabel('Assunto', { exact: true }).fill('Conversa sobre desenvolvimento Java');
}

async function prepareMeeting(page: Page) {
  await fillMeetingDraft(page);
  await meetingDialog(page).getByRole('button', { name: 'Preparar proposta', exact: true }).click();
  await expect(meetingDialog(page).getByRole('heading', { name: 'Revise sua solicitação', exact: true })).toBeVisible();
}

function preparationReplies(proposal: MeetingProposal) {
  return [
    { path: '/api/v1/auth/session', body: anonymousSession() },
    { path: '/api/v1/meetings/availability', body: availability(proposal) },
    { method: 'POST', path: '/api/v1/meetings/proposals', body: proposal },
  ];
}

test('visitante consulta sessão e inicia Google por navegação interceptada, sem formulário de senha', async ({ page }) => {
  const api = await mockPlatform(page, [{ path: '/api/v1/auth/session', body: anonymousSession() }]);
  await page.route('**/api/v1/auth/login/google', route => route.fulfill({
    contentType: 'text/html', body: '<!doctype html><html lang="pt-BR"><title>Login interceptado</title><body>OAuth de teste</body></html>',
  }));
  await page.goto('/#experiencia');
  await loginTrigger(page).click();
  const dialog = page.getByRole('dialog', { name: '[ PORTAL DE AUTENTICAÇÃO ]', exact: true });
  await expect(dialog.locator('input')).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: /IR PARA A SALA DO ADMINISTRADOR/ })).toHaveCount(0);
  await dialog.getByRole('button', { name: '[ ENTRAR COM GOOGLE ]', exact: true }).click();
  await expect(page).toHaveURL('https://phase3-api.invalid/api/v1/auth/login/google');
  await expect(page.getByText('OAuth de teste', { exact: true })).toBeVisible();
  expect(api.requests.filter(request => request.url().includes('/auth/session'))).toHaveLength(1);
  expect(api.unexpected).toEqual([]);
});

test('sessão user informa falta de permissão e permite somente logout sem conceder administração', async ({ page }) => {
  const session = authenticatedSession();
  const api = await mockPlatform(page, [
    { path: '/api/v1/auth/session', body: session },
    { method: 'POST', path: '/api/v1/auth/logout', status: 204 },
  ]);
  await page.goto('/');
  await page.getByRole('button', { name: 'Abrir baú do aventureiro', exact: true }).click();
  const menu = page.getByRole('dialog', { name: '[ BAÚ DO AVENTUREIRO ]', exact: true });
  await expect(menu).toContainText('Visitante de teste');
  await expect(menu).toContainText(/não tem permissão/i);
  await expect(menu.getByRole('button', { name: /IR PARA A SALA DO ADMINISTRADOR|ENTRAR COM GOOGLE|SOLICITAR REUNIÃO|ATUALIZAR SESSÃO|RENOVAR SESSÃO/ })).toHaveCount(0);
  await menu.getByRole('button', { name: '[ TRANCAR BAÚ (LOGOUT) ]', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '[ PORTAL DE AUTENTICAÇÃO ]', exact: true })).toBeVisible();
  await expect(loginTrigger(page)).toBeVisible();
  const mutations = api.requests.filter(request => request.method() === 'POST');
  expect(mutations).toHaveLength(1);
  expect(mutations[0].headers()['x-csrf-token']).toBe(MOCK_CSRF_TOKEN);
  expect(mutations.every(request => request.postData() === null)).toBe(true);
  const storage = await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }));
  expect(storage).not.toContain(MOCK_CSRF_TOKEN);
  expect(await page.content()).not.toContain(MOCK_CSRF_TOKEN);
  expect(api.unexpected).toEqual([]);
});

test('sessão vencida não abre baú autenticado', async ({ page }) => {
  const session = authenticatedSession();
  session.expiresAt = new Date(Date.now() - 1000).toISOString();
  const api = await mockPlatform(page, [{ path: '/api/v1/auth/session', body: session }]);
  await page.goto('/');
  await loginTrigger(page).click();
  await expect(page.getByRole('dialog', { name: '[ PORTAL DE AUTENTICAÇÃO ]', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Abrir baú do aventureiro', exact: true })).toHaveCount(0);
  expect(api.unexpected).toEqual([]);
});

for (const scenario of [
  { status: 401, code: 'AUTH_REQUIRED', google: true },
  { status: 403, code: 'ORIGIN_NOT_ALLOWED', google: true },
  { status: 404, code: 'AUTH_DISABLED', google: false },
  { status: 503, code: 'SERVICE_UNAVAILABLE', google: true },
]) {
  test(`sessão HTTP ${scenario.status} informa falha segura sem retry automático`, async ({ page }) => {
    const api = await mockPlatform(page, [{ path: '/api/v1/auth/session', status: scenario.status, body: platformError(scenario.code) }]);
    await page.goto('/');
    await loginTrigger(page).click();
    const dialog = page.getByRole('dialog', { name: '[ PORTAL DE AUTENTICAÇÃO ]', exact: true });
    await expect(dialog.getByRole('alert')).toBeVisible();
    await expect(dialog.getByRole('button', { name: '[ ENTRAR COM GOOGLE ]', exact: true })).toHaveCount(scenario.google ? 1 : 0);
    await expect(dialog.getByRole('button', { name: /SOLICITAR REUNIÃO|ATUALIZAR SESSÃO|RENOVAR SESSÃO/ })).toHaveCount(0);
    expect(api.requests).toHaveLength(1);
    expect(api.unexpected).toEqual([]);
  });
}

test('disponibilidade só é consultada após clique e respeita janela de sete dias e fuso retornado', async ({ page }) => {
  const proposal = meetingProposal();
  const api = await mockPlatform(page, [
    { path: '/api/v1/auth/session', body: anonymousSession() },
    { path: '/api/v1/meetings/availability', body: availability(proposal) },
  ]);
  await openMeetings(page);
  expect(api.requests).toHaveLength(1);
  const dialog = meetingDialog(page);
  await dialog.getByRole('button', { name: 'Consultar horários', exact: true }).click();
  await expect(dialog.getByRole('radio')).toHaveCount(1);
  await expect(dialog).toContainText('Fuso horário: America/Fortaleza. Duração: 30 minutos.');
  const request = api.requests.find(request => request.url().includes('/meetings/availability'))!;
  const query = new URL(request.url()).searchParams;
  expect(Date.parse(query.get('to')!) - Date.parse(query.get('from')!)).toBe(7 * 86_400_000);
  expect(request.headers()['x-csrf-token']).toBeUndefined();
  expect(request.headers()['x-meeting-token']).toBeUndefined();
  expect(api.unexpected).toEqual([]);
});

test('agenda vazia e simulada é estado informativo, sem inventar horários', async ({ page }) => {
  const api = await mockPlatform(page, [
    { path: '/api/v1/auth/session', body: anonymousSession() },
    { path: '/api/v1/meetings/availability', body: { timeZone: 'America/Fortaleza', durationMinutes: 30, simulated: true, slots: [] } },
  ]);
  await openMeetings(page);
  await meetingDialog(page).getByRole('button', { name: 'Consultar horários', exact: true }).click();
  await expect(meetingDialog(page)).toContainText('Nenhum horário disponível neste período. Escolha outra data.');
  await expect(meetingDialog(page)).toContainText('Modo simulado: horários de teste.');
  await expect(meetingDialog(page).getByRole('radio')).toHaveCount(0);
  await expect(meetingDialog(page).getByRole('alert')).toHaveCount(0);
  expect(api.unexpected).toEqual([]);
});

test('validação impede proposta sem slot e com dados inválidos', async ({ page }) => {
  const proposal = meetingProposal();
  const api = await mockPlatform(page, [
    { path: '/api/v1/auth/session', body: anonymousSession() },
    { path: '/api/v1/meetings/availability', body: availability(proposal) },
  ]);
  await openMeetings(page);
  const dialog = meetingDialog(page);
  await dialog.getByRole('button', { name: 'Consultar horários', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Preparar proposta', exact: true })).toBeDisabled();
  await dialog.getByRole('radio').check();
  await dialog.getByLabel('Nome', { exact: true }).fill('Visitante');
  await dialog.getByLabel('E-mail', { exact: true }).fill('email-invalido');
  await dialog.getByLabel('Assunto', { exact: true }).fill('Conversa de teste');
  await dialog.getByRole('button', { name: 'Preparar proposta', exact: true }).click();
  await expect(dialog.getByLabel('E-mail', { exact: true })).toBeFocused();
  expect(api.requests.filter(request => request.method() === 'POST')).toHaveLength(0);
  expect(api.unexpected).toEqual([]);
});

test('proposta apresenta resumo exato, exige consentimento e confirma só após clique explícito', async ({ page }) => {
  const proposal = meetingProposal();
  proposal.summary.name = 'Nome normalizado pelo servidor';
  proposal.summary.topic = '<img src=x onerror="document.documentElement.dataset.meetingInjected=1">';
  const pending = deferredReply();
  const api = await mockPlatform(page, [
    ...preparationReplies(proposal),
    { method: 'POST', path: '/api/v1/meetings/requests', waitFor: pending.promise,
      body: { ...meetingStatus(), meetingToken: MOCK_MEETING_TOKEN } },
  ]);
  await openMeetings(page);
  await prepareMeeting(page);
  const dialog = meetingDialog(page);
  await expect(dialog).toContainText('Nome normalizado pelo servidor');
  await expect(dialog).toContainText(proposal.summary.topic);
  await expect(dialog.locator('img')).toHaveCount(0);
  await expect(page.locator('html')).not.toHaveAttribute('data-meeting-injected');
  const confirm = dialog.getByRole('button', { name: 'Confirmar solicitação', exact: true });
  await expect(confirm).toBeDisabled();
  expect(api.requests.filter(request => request.url().endsWith('/meetings/requests'))).toHaveLength(0);
  await dialog.getByRole('checkbox').check();
  expect(api.requests.filter(request => request.url().endsWith('/meetings/requests'))).toHaveLength(0);
  try {
    await confirm.click();
    // The ledger changes the label on the first attempt, even while it is pending.
    await expect(dialog.locator('form button[type="submit"]')).toBeDisabled();
    await dialog.locator('form').evaluate(form => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await expect.poll(() => api.requests.filter(request => request.url().endsWith('/meetings/requests')).length).toBe(1);
  } finally { pending.release(); }
  await expect(dialog.getByRole('heading', { name: 'Aguardando análise', exact: true })).toBeVisible();
  const request = api.requests.find(request => request.url().endsWith('/meetings/requests'))!;
  expect(request.postDataJSON()).toEqual({ proposalId: proposal.proposalId,
    confirmationToken: MOCK_CONFIRMATION_TOKEN, consent: true, consentVersion: proposal.consentVersion });
  expect(request.headers()['idempotency-key']).toMatch(/^[0-9a-f-]{36}$/i);
  expect(request.headers()['x-csrf-token']).toBeUndefined();
  const exposed = await page.evaluate(() => JSON.stringify({ url: location.href,
    local: { ...localStorage }, session: { ...sessionStorage }, html: document.documentElement.outerHTML }));
  for (const token of [MOCK_CONFIRMATION_TOKEN, MOCK_MEETING_TOKEN]) expect(exposed).not.toContain(token);
  expect(api.unexpected).toEqual([]);
});

test('proposta expirada bloqueia a primeira confirmação e permite preparar outra', async ({ page }) => {
  const proposal = meetingProposal({ expiresAt: new Date(Date.now() - 1000).toISOString() });
  const api = await mockPlatform(page, preparationReplies(proposal));
  await openMeetings(page);
  await prepareMeeting(page);
  const dialog = meetingDialog(page);
  await dialog.getByRole('checkbox').check();
  await expect(dialog).toContainText('Esta proposta expirou.');
  await expect(dialog.getByRole('button', { name: 'Confirmar solicitação', exact: true })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Alterar dados / novo horário', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Consultar horários', exact: true })).toBeVisible();
  expect(api.requests.filter(request => request.url().endsWith('/meetings/requests'))).toHaveLength(0);
  expect(api.unexpected).toEqual([]);
});

test('nova tentativa consciente após 503 reutiliza corpo e chave de idempotência, inclusive após reabrir', async ({ page }) => {
  const proposal = meetingProposal();
  const api = await mockPlatform(page, [
    ...preparationReplies(proposal),
    { method: 'POST', path: '/api/v1/meetings/requests', status: 503, body: platformError() },
    { method: 'POST', path: '/api/v1/meetings/requests', body: { ...meetingStatus(), meetingToken: MOCK_MEETING_TOKEN } },
  ]);
  await openMeetings(page);
  await prepareMeeting(page);
  await meetingDialog(page).getByRole('checkbox').check();
  await meetingDialog(page).getByRole('button', { name: 'Confirmar solicitação', exact: true }).click();
  await expect(meetingDialog(page).getByRole('alert')).toBeVisible();
  expect(api.requests.filter(request => request.url().endsWith('/meetings/requests'))).toHaveLength(1);
  await meetingDialog(page).getByRole('button', { name: 'Fechar agendamento', exact: true }).click();
  await reopenMeetings(page);
  await meetingDialog(page).getByRole('checkbox').check();
  await meetingDialog(page).getByRole('button', { name: 'Tentar confirmar novamente', exact: true }).click();
  await expect(meetingDialog(page).getByRole('heading', { name: 'Aguardando análise', exact: true })).toBeVisible();
  const requests = api.requests.filter(request => request.url().endsWith('/meetings/requests'));
  expect(requests).toHaveLength(2);
  expect(requests[0].postData()).toBe(requests[1].postData());
  expect(requests[0].headers()['idempotency-key']).toBe(requests[1].headers()['idempotency-key']);
  expect(api.unexpected).toEqual([]);
});

test('acompanha os seis estados sem polling e envia o token privado somente no header', async ({ page }) => {
  const proposal = meetingProposal();
  const transitions: Array<{ status: MeetingStatus; title: string; detail: string }> = [
    { status: 'APPROVED', title: 'Aprovada, aguardando a agenda', detail: 'Aguarde a confirmação da agenda.' },
    { status: 'CONFIRMED', title: 'Confirmada na agenda', detail: 'Isso não representa aceite do visitante' },
    { status: 'REJECTED', title: 'Não aprovada', detail: 'A solicitação não foi aprovada.' },
    { status: 'CANCELLED', title: 'Cancelamento registrado', detail: 'ainda pode estar em verificação' },
    { status: 'FAILED', title: 'Não confirmada', detail: 'o horário pode continuar protegido' },
  ];
  const api = await mockPlatform(page, [
    ...preparationReplies(proposal),
    { method: 'POST', path: '/api/v1/meetings/requests', body: { ...meetingStatus(), meetingToken: MOCK_MEETING_TOKEN } },
    ...transitions.map(({ status }) => ({ path: /\/meetings\/requests\/[^/]+\/status$/, body: meetingStatus(status) })),
  ]);
  await openMeetings(page);
  await prepareMeeting(page);
  await meetingDialog(page).getByRole('checkbox').check();
  await meetingDialog(page).getByRole('button', { name: 'Confirmar solicitação', exact: true }).click();
  const state = meetingDialog(page).getByRole('region', { name: 'Estado da solicitação', exact: true });
  await expect(state).toContainText('O horário ainda não está reservado.');
  for (const transition of transitions) {
    await meetingDialog(page).getByRole('button', { name: 'Atualizar estado', exact: true }).click();
    await expect(state.getByRole('heading', { name: transition.title, exact: true })).toBeVisible();
    await expect(state).toContainText(transition.detail);
  }
  const statusRequests = api.requests.filter(request => request.url().endsWith('/status'));
  expect(statusRequests).toHaveLength(5);
  for (const request of statusRequests) {
    expect(request.headers()['x-meeting-token']).toBe(MOCK_MEETING_TOKEN);
    expect(request.url()).not.toContain(MOCK_MEETING_TOKEN);
  }
  expect(api.unexpected).toEqual([]);
});

for (const scenario of [
  { status: 409, code: 'MEETING_SLOT_UNAVAILABLE', message: 'O horário deixou de estar disponível.' },
  { status: 503, code: 'CALENDAR_UNAVAILABLE', message: 'A agenda está temporariamente indisponível.' },
]) {
  test(`agenda HTTP ${scenario.status} informa conflito/indisponibilidade e Retry-After sem retry`, async ({ page }) => {
    const api = await mockPlatform(page, [
      { path: '/api/v1/auth/session', body: anonymousSession() },
      { path: '/api/v1/meetings/availability', status: scenario.status, headers: { 'Retry-After': '30' }, body: platformError(scenario.code) },
    ]);
    await openMeetings(page);
    const dialog = meetingDialog(page);
    await dialog.getByRole('button', { name: 'Consultar horários', exact: true }).click();
    await expect(dialog.getByRole('alert')).toContainText(scenario.message);
    await expect(dialog).toContainText(/Aguarde \d+s/);
    await expect(dialog.getByRole('button', { name: 'Consultar horários', exact: true })).toBeDisabled();
    expect(api.requests.filter(request => request.url().includes('/meetings/availability'))).toHaveLength(1);
    expect(api.unexpected).toEqual([]);
  });
}

test('fechar cancela disponibilidade pendente e ignora resposta tardia ao reabrir', async ({ page }) => {
  const proposal = meetingProposal();
  const pending = deferredReply();
  const api = await mockPlatform(page, [
    { path: '/api/v1/auth/session', body: anonymousSession() },
    { path: '/api/v1/meetings/availability', waitFor: pending.promise, body: availability(proposal) },
  ]);
  await openMeetings(page);
  const dialog = meetingDialog(page);
  await dialog.getByRole('button', { name: 'Consultar horários', exact: true }).click();
  await expect(dialog).toContainText('[ CONSULTANDO OS REGISTROS DA AGENDA... ]');
  await expect.poll(() => api.requests.filter(request => request.url().includes('/meetings/availability')).length).toBe(1);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(orbTrigger(page)).toBeFocused();
  pending.release();
  await reopenMeetings(page);
  await dialog.getByRole('button', { name: 'Alterar dados / novo horário', exact: true }).click();
  await expect(dialog.getByRole('radio')).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Consultar horários', exact: true })).toBeEnabled();
  expect(api.requests.filter(request => request.url().includes('/meetings/availability'))).toHaveLength(1);
  expect(api.unexpected).toEqual([]);
});

for (const width of [320, 375, 768, 1440]) {
  test(`agenda permanece acessível por teclado e sem cortes em ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width < 768 ? 720 : 900 });
    const proposal = meetingProposal();
    const api = await mockPlatform(page, preparationReplies(proposal));
    await openMeetings(page, width === 375 || width === 1440);
    const dialog = meetingDialog(page);
    const close = dialog.getByRole('button', { name: 'Fechar agendamento', exact: true });
    await close.focus();
    await expect(close).toBeFocused();
    await prepareMeeting(page);
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    const bounds = await dialog.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1);
    expect(bounds!.height).toBeLessThanOrEqual(width < 768 ? 720 : 900);
    const violations = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(violations.violations.map(({ id, impact }) => ({ id, impact }))).toEqual([]);
    await close.focus();
    await page.keyboard.press('Shift+Tab');
    await expect(dialog.getByRole('button', { name: 'Alterar dados / novo horário', exact: true })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(close).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(orbTrigger(page)).toBeFocused();
    expect(api.unexpected).toEqual([]);
  });
}

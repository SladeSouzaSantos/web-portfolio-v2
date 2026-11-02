import type { Request } from '@playwright/test';
import { expect, test } from './fixtures';
import { chatResponse, mockChat } from './helpers/orbe-mock';
import { anonymousSession, authenticatedSession, meetingProposal, mockPlatform } from './helpers/platform-mock';

interface Profile { authEnabled: boolean; meetingsEnabled: boolean; orbeEnabled: boolean }
const sessionPath = '/api/v1/auth/session';
const adminPath = '/api/v1/admin/meetings';
const reviewAction = 'REVISAR PROPOSTA DE REUNIÃO';
const meetingRequests = (requests: Request[]) => requests.filter(request => /\/(?:admin\/)?meetings(?:\/|\?)/.test(request.url()));

test('flags: módulos independentes e painel sem consultas de reuniões desativadas', async ({ page, baseURL }, testInfo) => {
  const { authEnabled, meetingsEnabled } = testInfo.project.metadata as unknown as Profile;
  const api = await mockPlatform(page, authEnabled ? [
    { path: sessionPath, body: authenticatedSession('admin') },
    ...(meetingsEnabled ? [{ path: adminPath, body: { items: [], nextCursor: null } }] : []),
  ] : [], baseURL);
  await page.goto('/');
  if (authEnabled) {
    await expect(page).toHaveURL(/\/administracao$/);
    await expect(page.getByRole('heading', { name: '[ PAINEL DO MESTRE ]', exact: true })).toBeVisible();
    if (meetingsEnabled) {
      await expect(page.getByText('Nenhum pedido encontrado para este filtro.', { exact: true })).toBeVisible();
      expect(meetingRequests(api.requests)).toHaveLength(1);
    } else {
      await expect(page.getByRole('status')).toContainText('As reuniões estão desativadas neste ambiente.');
      await expect(page.locator('#admin-meeting-agenda')).toHaveCount(0);
      expect(meetingRequests(api.requests)).toHaveLength(0);
    }
    await page.getByRole('button', { name: 'VOLTAR AO PORTFÓLIO', exact: true }).click();
  } else {
    await page.getByRole('button', { name: 'Abrir prévia de login', exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText('O portal de autenticação está indisponível neste ambiente.');
    await expect(page.getByRole('button', { name: '[ ENTRAR COM GOOGLE ]', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Fechar login', exact: true }).click();
    expect(api.requests).toHaveLength(0);
  }
  // The existing portfolio and its navigation remain available in every profile.
  await page.getByRole('link', { name: 'Experiência', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'CRÔNICAS DA JORNADA', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Projetos', exact: true }).click();
  await page.getByRole('link', { name: /ARQUIVO DE MISSÕES EXPLORAR OUTROS PROJETOS/ }).click();
  await expect(page).toHaveURL(/\/projetos$/);
  expect(api.requests.filter(request => request.url().includes(sessionPath))).toHaveLength(authEnabled ? 1 : 0);
  expect(api.unexpected).toEqual([]);
});

test('flags: Orbe só anuncia e apresenta reuniões quando o módulo está ativo', async ({ page, baseURL }, testInfo) => {
  const { authEnabled, meetingsEnabled, orbeEnabled } = testInfo.project.metadata as unknown as Profile;
  const api = await mockPlatform(page, [
    ...(authEnabled ? [{ path: sessionPath, body: anonymousSession() }] : []),
    { path: '/api/v1/meetings/availability', body: { timeZone: 'America/Fortaleza', durationMinutes: 30, simulated: true, slots: [] } },
  ], baseURL);
  // Even an unsolicited action must be ignored when meetings are disabled.
  const chat = await mockChat(page, [{ body: chatResponse({
    answer: 'Proposta simulada para revisar pelo formulário.',
    actions: [{ type: 'confirm_meeting_request', proposal: meetingProposal() }],
  }) }]);
  await page.goto('/#sobre');
  await page.getByRole('button', { name: 'Abrir guia do portfólio', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: /CONSULTAR ORBE MÁGICO/ });
  await dialog.getByRole('textbox', { name: 'Sua pergunta ao orbe', exact: true }).fill('Quais projetos Pedro desenvolveu?');
  await dialog.getByRole('button', { name: 'ENVIAR', exact: true }).click();
  await expect(dialog.locator('.chat-msg')).toHaveCount(3);
  expect(chat.requests).toHaveLength(orbeEnabled ? 1 : 0);
  if (orbeEnabled) {
    expect(chat.requests[0].headers()['x-orbe-capabilities']).toBe(meetingsEnabled ? 'meetings-v1' : undefined);
  }
  if (orbeEnabled && meetingsEnabled) {
    await dialog.getByRole('button', { name: reviewAction, exact: true }).click();
    const scheduler = page.getByRole('dialog', { name: /CONSELHO DA JORNADA/ });
    await expect(scheduler.getByRole('heading', { name: 'Revise sua solicitação', exact: true })).toBeVisible();
    await scheduler.getByRole('button', { name: 'Alterar dados / novo horário', exact: true }).click();
    await scheduler.getByRole('button', { name: 'Consultar horários', exact: true }).click();
    await expect(scheduler).toContainText('Nenhum horário disponível neste período.');
    expect(meetingRequests(api.requests)).toHaveLength(1);
    expect(meetingRequests(api.requests)[0].headers()['x-csrf-token']).toBeUndefined();
  } else {
    await expect(dialog.getByRole('button', { name: reviewAction, exact: true })).toHaveCount(0);
    expect(meetingRequests(api.requests)).toHaveLength(0);
  }
  expect(api.requests.filter(request => request.url().includes(sessionPath))).toHaveLength(authEnabled ? 1 : 0);
  expect(api.unexpected).toEqual([]);
});

const errors = [
  ['AUTH_ADMIN_ONLY', 'Acesso negado. Apenas o administrador tem acesso.'],
  ['AUTH_REQUIRED', 'Não foi possível validar o login. Entre novamente pelo botão de login.'],
  ['AUTH_LOGIN_FAILED', 'Não foi possível concluir o login. Tente novamente pelo botão de login.'],
  ['AUTH_PROVIDER_UNAVAILABLE', 'O Google está temporariamente indisponível. Tente entrar novamente mais tarde.'],
  ['AUTH_UNAVAILABLE', 'O serviço de autenticação está temporariamente indisponível. Tente novamente mais tarde.'],
  ['<img src=x onerror=alert(1)>', 'Não foi possível concluir o login. Tente novamente pelo botão de login.'],
] as const;
for (const [code, message] of errors) {
  test(`callback: ${code} usa mensagem local, limpa a URL e não repete login`, async ({ page, baseURL }) => {
    const api = await mockPlatform(page, [{ path: sessionPath, body: anonymousSession() }], baseURL);
    const suffix = '?origem=google&tag=a%20b&tag=a%2Bb&returnTo=%2Fprojetos#experiencia';
    await page.goto(`/?auth_error=${encodeURIComponent(code)}&${suffix.slice(1)}`);
    await expect(page.getByRole('alert')).toHaveText(message);
    await expect(page).toHaveURL(`${baseURL}/${suffix}`);
    await expect(page.getByRole('heading', { name: 'CRÔNICAS DA JORNADA', exact: true })).toBeVisible();
    await expect(page.locator('.auth-callback-notice img')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Abrir baú do aventureiro', exact: true })).toHaveCount(0);
    expect(api.requests.map(request => new URL(request.url()).pathname)).toEqual([sessionPath]);
    expect(api.unexpected).toEqual([]);
  });
}

for (const marker of ['auth_error=', 'auth_error=AUTH_ADMIN_ONLY&auth_error=AUTH_UNAVAILABLE']) {
  test(`callback: marcador ambíguo ${marker} tem fallback seguro`, async ({ page, baseURL }) => {
    const api = await mockPlatform(page, [{ path: sessionPath, body: anonymousSession() }], baseURL);
    await page.goto(`/?${marker}#sobre`);
    await expect(page.getByRole('alert')).toHaveText('Não foi possível concluir o login. Tente novamente pelo botão de login.');
    await expect(page).toHaveURL(`${baseURL}/#sobre`);
    expect(api.requests).toHaveLength(1);
    expect(api.unexpected).toEqual([]);
  });
}

for (const path of ['/administracao', '/index.html']) {
  test(`callback: aviso sobrevive ao redirecionamento de ${path} e à navegação`, async ({ page, baseURL }) => {
    const api = await mockPlatform(page, [{ path: sessionPath, body: anonymousSession() }], baseURL);
    await page.goto(`${path}?origem=google&auth_error=AUTH_ADMIN_ONLY#experiencia`);
    await expect(page).toHaveURL(`${baseURL}/?origem=google#experiencia`);
    await expect(page.getByRole('alert')).toHaveText('Acesso negado. Apenas o administrador tem acesso.');
    await page.getByRole('link', { name: 'Projetos', exact: true }).click();
    await page.getByRole('link', { name: /ARQUIVO DE MISSÕES EXPLORAR OUTROS PROJETOS/ }).click();
    await expect(page.getByRole('alert')).toHaveText('Acesso negado. Apenas o administrador tem acesso.');
    await page.getByRole('button', { name: 'Fechar aviso de autenticação', exact: true }).click();
    await expect(page.getByRole('alert')).toHaveCount(0);
    expect(api.requests).toHaveLength(1);
    expect(api.unexpected).toEqual([]);
  });
}

test('callback: Google autorizado simulado confirma identidade pela API e preserva returnTo', async ({ page, baseURL }) => {
  const api = await mockPlatform(page, [
    { path: sessionPath, body: anonymousSession() },
    { path: sessionPath, body: authenticatedSession('admin') },
  ], baseURL);
  const logins: Request[] = [];
  await page.route('**/api/v1/auth/login/google?*', async route => {
    logins.push(route.request());
    const returnTo = new URL(route.request().url()).searchParams.get('returnTo');
    expect(returnTo).toBe('/?origem=google#experiencia');
    await route.fulfill({ status: 302, headers: { location: `${baseURL}${returnTo}` } });
  });
  await page.goto('/?origem=google#experiencia');
  await page.getByRole('button', { name: 'Abrir prévia de login', exact: true }).click();
  const portal = page.getByRole('dialog', { name: '[ PORTAL DE AUTENTICAÇÃO ]', exact: true });
  await expect(portal).toContainText('Acesso exclusivo à administração.');
  await expect(portal.locator('input')).toHaveCount(0);
  await portal.getByRole('button', { name: '[ ENTRAR COM GOOGLE ]', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Abrir baú do aventureiro', exact: true })).toBeVisible();
  await expect(page).toHaveURL(`${baseURL}/?origem=google#experiencia`);
  await expect(page.getByRole('heading', { name: 'CRÔNICAS DA JORNADA', exact: true })).toBeVisible();
  expect(logins).toHaveLength(1);
  expect(api.requests.filter(request => request.url().includes(sessionPath))).toHaveLength(2);
  expect(api.unexpected).toEqual([]);
});

test('callback: conta recusada simulada fica anônima com aviso e nova tentativa somente manual', async ({ page, baseURL }) => {
  const api = await mockPlatform(page, [
    { path: sessionPath, body: anonymousSession() },
    { path: sessionPath, body: anonymousSession() },
  ], baseURL);
  let logins = 0;
  await page.route('**/api/v1/auth/login/google?*', async route => {
    logins += 1;
    await route.fulfill({ status: 302, headers: { location: `${baseURL}/?auth_error=AUTH_ADMIN_ONLY#sobre` } });
  });
  await page.goto('/#sobre');
  await page.getByRole('button', { name: 'Abrir prévia de login', exact: true }).click();
  await page.getByRole('button', { name: '[ ENTRAR COM GOOGLE ]', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Acesso negado. Apenas o administrador tem acesso.');
  await expect(page).toHaveURL(`${baseURL}/#sobre`);
  await page.getByRole('button', { name: 'Abrir prévia de login', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Acesso exclusivo à administração.');
  expect(logins).toBe(1);
  expect(api.requests).toHaveLength(2);
  expect(api.unexpected).toEqual([]);
});

test('callback: parâmetros de sucesso ou papel não autenticam o visitante', async ({ page, baseURL }) => {
  const api = await mockPlatform(page, [{ path: sessionPath, body: anonymousSession() }], baseURL);
  await page.goto('/administracao?authenticated=true&role=admin&auth_success=true');
  await expect(page).toHaveURL(`${baseURL}/#sobre`);
  await expect(page.getByRole('heading', { name: '[ PAINEL DO MESTRE ]', exact: true })).toHaveCount(0);
  expect(api.requests.map(request => new URL(request.url()).pathname)).toEqual([sessionPath]);
  expect(api.unexpected).toEqual([]);
});

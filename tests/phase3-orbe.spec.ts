import type { Page, Request } from '@playwright/test';
import { expect, test } from './fixtures';
import { chatResponse, deferredReply, mockChat, MOCK_CONVERSATION_ID, MOCK_CONVERSATION_TOKEN } from './helpers/orbe-mock';
import { anonymousSession, meetingProposal, meetingStatus, mockPlatform,
  MOCK_CONFIRMATION_TOKEN, MOCK_MEETING_TOKEN } from './helpers/platform-mock';

const REVIEW_ACTION = 'REVISAR PROPOSTA DE REUNIÃO';
function actionReply(overrides: Record<string, unknown> = {}) {
  return chatResponse({ answer: 'Preparei uma proposta para sua revisão. A confirmação depende de você.',
    actions: [{ type: 'confirm_meeting_request', proposal: meetingProposal() }],
    meta: { provider: 'mock', simulated: true, promptVersion: 'orbe-v4-test' }, ...overrides });
}
async function openOrbe(page: Page) {
  await page.goto('/#sobre');
  await page.getByRole('button', { name: 'Abrir guia do portfólio', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: /CONSULTAR ORBE MÁGICO/ });
  return { dialog, input: dialog.getByRole('textbox', { name: 'Sua pergunta ao orbe' }),
    send: dialog.getByRole('button', { name: 'ENVIAR', exact: true }) };
}
function requestCreations(requests: Request[]) {
  return requests.filter(request => request.method() === 'POST' && new URL(request.url()).pathname === '/api/v1/meetings/requests');
}

test('Orbe actions opt in on every message, open one shared review and confirm only after explicit consent', async ({ page, context }) => {
  const delayed = deferredReply();
  const allRequests: Request[] = [];
  const logs: string[] = [];
  page.on('request', request => allRequests.push(request));
  page.on('console', message => logs.push(message.text()));
  const platform = await mockPlatform(page, [
    { path: '/api/v1/auth/session', body: anonymousSession() },
    { method: 'POST', path: '/api/v1/meetings/requests', status: 201,
      body: { ...meetingStatus(), meetingToken: MOCK_MEETING_TOKEN }, waitFor: delayed.promise },
  ]);
  const chat = await mockChat(page, [{ body: actionReply() }, { body: chatResponse({
    conversationToken: undefined, answer: 'A confirmação é feita pelo formulário, sem compartilhar seus tokens com o chat.',
  }) }]);
  const { dialog, input, send } = await openOrbe(page);
  await input.fill('Quero conversar sobre um projeto Java.');
  await send.click();
  await expect(dialog.getByRole('button', { name: REVIEW_ACTION })).toBeVisible();
  expect(requestCreations(platform.requests)).toHaveLength(0);
  await input.fill('A proposta já está confirmada?');
  await send.click();
  await expect(dialog.getByRole('log')).toContainText('A confirmação é feita pelo formulário');
  for (const request of chat.requests) expect(request.headers()['x-orbe-capabilities']).toBe('meetings-v1');
  expect(chat.requests[1].postDataJSON()).toEqual({ conversationId: MOCK_CONVERSATION_ID, message: 'A proposta já está confirmada?' });

  await dialog.getByRole('button', { name: REVIEW_ACTION }).click();
  const review = page.getByRole('dialog', { name: /CONSELHO DA JORNADA/ });
  await expect(review.getByRole('heading', { name: 'Revise sua solicitação' })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await expect(page.locator('#root')).toHaveAttribute('inert', '');
  await expect(review).toContainText(meetingProposal().summary.email);
  const confirm = review.getByRole('button', { name: 'Confirmar solicitação', exact: true });
  await expect(review.locator('form button[type="submit"]')).toBeDisabled();
  expect(requestCreations(platform.requests)).toHaveLength(0);
  await review.getByRole('checkbox', { name: /Li o resumo e autorizo/ }).check();
  await confirm.click();
  await expect(review.getByRole('status')).toContainText('CONSULTANDO OS REGISTROS DA AGENDA');
  await expect(review.locator('form button[type="submit"]')).toBeDisabled();
  await review.locator('form').evaluate(form => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
  await expect.poll(() => requestCreations(platform.requests).length).toBe(1);
  delayed.release();
  await expect(review.getByRole('heading', { name: 'Aguardando análise', exact: true })).toBeVisible();
  expect(requestCreations(platform.requests)).toHaveLength(1);
  expect(requestCreations(platform.requests)[0].postDataJSON()).toEqual({
    proposalId: meetingProposal().proposalId, confirmationToken: MOCK_CONFIRMATION_TOKEN,
    consent: true, consentVersion: meetingProposal().consentVersion,
  });
  expect(requestCreations(platform.requests)[0].headers()['idempotency-key']).toMatch(/^[0-9a-f-]{36}$/i);

  const stored = await page.evaluate(() => ({ dom: document.documentElement.outerHTML,
    local: { ...localStorage }, session: { ...sessionStorage }, url: location.href }));
  for (const token of [MOCK_CONVERSATION_TOKEN, MOCK_CONFIRMATION_TOKEN, MOCK_MEETING_TOKEN]) {
    expect(JSON.stringify(stored)).not.toContain(token);
    expect(JSON.stringify(await context.cookies())).not.toContain(token);
    expect(logs.join('\n')).not.toContain(token);
    expect(allRequests.map(request => request.url()).join('\n')).not.toContain(token);
  }
  for (const request of chat.requests) {
    expect(request.postData()).not.toContain(MOCK_CONFIRMATION_TOKEN);
    expect(request.postData()).not.toContain(MOCK_MEETING_TOKEN);
    expect(request.postData()).not.toContain('visitor@example.test');
  }
  expect(platform.unexpected).toEqual([]);
});

test('closing and reopening an Orbe proposal preserves review and prevents another request for the same proposal', async ({ page }) => {
  const platform = await mockPlatform(page, [
    { path: '/api/v1/auth/session', body: anonymousSession() },
    { method: 'POST', path: '/api/v1/meetings/requests', status: 201,
      body: { ...meetingStatus(), meetingToken: MOCK_MEETING_TOKEN } },
  ]);
  await mockChat(page, [{ body: actionReply() }]);
  const { dialog, input, send } = await openOrbe(page);
  await input.fill('Prepare uma proposta de reunião.');
  await send.click();
  await dialog.getByRole('button', { name: REVIEW_ACTION }).click();
  const agenda = page.getByRole('dialog', { name: /CONSELHO DA JORNADA/ });
  await expect(agenda.getByRole('heading', { name: 'Revise sua solicitação' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(requestCreations(platform.requests)).toHaveLength(0);
  await page.getByRole('button', { name: 'Abrir guia do portfólio', exact: true }).click();
  await page.getByRole('button', { name: REVIEW_ACTION }).click();
  await expect(agenda.getByRole('heading', { name: 'Revise sua solicitação' })).toBeVisible();
  await agenda.getByRole('checkbox', { name: /Li o resumo e autorizo/ }).check();
  await agenda.getByRole('button', { name: 'Confirmar solicitação', exact: true }).click();
  await expect(agenda.getByRole('heading', { name: 'Aguardando análise', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Abrir guia do portfólio', exact: true }).click();
  await page.getByRole('button', { name: REVIEW_ACTION }).click();
  await expect(agenda.getByRole('heading', { name: 'Aguardando análise', exact: true })).toBeVisible();
  await expect(agenda.getByRole('button', { name: 'Confirmar solicitação', exact: true })).toHaveCount(0);
  expect(requestCreations(platform.requests)).toHaveLength(1);
  expect(platform.unexpected).toEqual([]);
});

test('new conversation removes old actions, resets chat credentials and leaves meetings unconfirmed', async ({ page }) => {
  const platform = await mockPlatform(page, [{ path: '/api/v1/auth/session', body: anonymousSession() }]);
  const chat = await mockChat(page, [{ body: actionReply() }, {}]);
  const { dialog, input, send } = await openOrbe(page);
  await input.fill('Prepare uma proposta sem confirmar.');
  await send.click();
  await expect(dialog.getByRole('button', { name: REVIEW_ACTION })).toBeVisible();
  await dialog.getByRole('button', { name: 'NOVA CONVERSA', exact: true }).click();
  await expect(dialog.getByRole('button', { name: REVIEW_ACTION })).toHaveCount(0);
  await input.fill('Quais tecnologias Pedro utiliza?');
  await send.click();
  await expect(dialog.getByRole('log')).toContainText('Java, Spring Boot e TypeScript');
  expect(chat.requests[1].postDataJSON()).toEqual({ message: 'Quais tecnologias Pedro utiliza?' });
  expect(chat.requests[1].headers()['x-conversation-token']).toBeUndefined();
  expect(chat.requests[1].headers()['x-orbe-capabilities']).toBe('meetings-v1');
  expect(requestCreations(platform.requests)).toHaveLength(0);
});

test('Orbe proposal review works on mobile using keyboard and reduced motion without automatic requests', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const platform = await mockPlatform(page, [{ path: '/api/v1/auth/session', body: anonymousSession() }]);
  await mockChat(page, [{ body: actionReply() }]);
  const { dialog, input } = await openOrbe(page);
  await input.fill('Quero revisar uma proposta.');
  await input.press('Enter');
  const action = dialog.getByRole('button', { name: REVIEW_ACTION });
  await action.focus();
  await page.keyboard.press('Enter');
  const review = page.getByRole('dialog', { name: /CONSELHO DA JORNADA/ });
  await expect(review.getByRole('heading', { name: 'Revise sua solicitação' })).toBeVisible();
  const consent = review.getByRole('checkbox', { name: /Li o resumo e autorizo/ });
  await consent.focus();
  await page.keyboard.press('Space');
  await expect(consent).toBeChecked();
  await expect(review.getByRole('button', { name: 'Confirmar solicitação', exact: true })).toBeEnabled();
  expect(await review.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  const close = review.getByRole('button', { name: 'Fechar agendamento', exact: true });
  await close.focus();
  await page.keyboard.press('Shift+Tab');
  await expect(review.getByRole('button', { name: 'Alterar dados / novo horário' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(requestCreations(platform.requests)).toHaveLength(0);
});

test('expired proposals received from the Orbe cannot be confirmed for the first time', async ({ page }) => {
  const platform = await mockPlatform(page, [{ path: '/api/v1/auth/session', body: anonymousSession() }]);
  await mockChat(page, [{ body: actionReply({ actions: [{ type: 'confirm_meeting_request',
    proposal: meetingProposal({ expiresAt: new Date(Date.now() - 60_000).toISOString() }) }] }) }]);
  const { dialog, input, send } = await openOrbe(page);
  await input.fill('Mostre a proposta preparada.');
  await send.click();
  await dialog.getByRole('button', { name: REVIEW_ACTION }).click();
  const review = page.getByRole('dialog', { name: /CONSELHO DA JORNADA/ });
  await expect(review).toContainText('Esta proposta expirou');
  await review.getByRole('checkbox', { name: /Li o resumo e autorizo/ }).check();
  await expect(review.getByRole('button', { name: 'Confirmar solicitação', exact: true })).toBeDisabled();
  expect(requestCreations(platform.requests)).toHaveLength(0);
});

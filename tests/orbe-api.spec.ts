import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import {
  chatError, chatResponse, deferredReply, mockChat,
  MOCK_CONVERSATION_ID, MOCK_CONVERSATION_TOKEN, MOCK_CORRELATION_ID,
} from './helpers/orbe-mock';
import { meetingProposal } from './helpers/platform-mock';

async function openChat(page: Page) {
  await page.goto('/#sobre');
  const trigger = page.getByRole('button', { name: 'Abrir guia do portfólio', exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: /CONSULTAR ORBE MÁGICO/ });
  await expect(dialog).toBeVisible();
  return {
    trigger,
    dialog,
    input: dialog.getByRole('textbox', { name: 'Sua pergunta ao orbe', exact: true }),
    send: dialog.getByRole('button', { name: 'ENVIAR', exact: true }),
    close: dialog.getByRole('button', { name: 'Fechar guia do portfólio', exact: true }),
    history: dialog.getByRole('log', { name: 'Conversa com o orbe' }),
  };
}

test('janela possui um único histórico e apresenta recrutamento mesmo ao restaurar cache', async ({ page }) => {
  await mockChat(page, [{}]);
  const { dialog, input, send } = await openChat(page);
  await expect(dialog).toHaveCount(1);
  await expect(dialog.getByRole('log', { name: 'Conversa com o orbe' })).toHaveCount(1);
  await expect(dialog.getByLabel('Limite de perguntas')).toHaveCount(1);
  await expect(dialog).toContainText('requisitos de uma vaga');
  await expect(dialog).toContainText('24 horas');
  await input.fill('Qual é a experiência de Pedro?');
  await send.click();
  await expect(dialog.getByRole('log')).toContainText('Java, Spring Boot e TypeScript');
  await page.reload();
  await page.getByRole('button', { name: 'Abrir guia do portfólio' }).click();
  const restored = page.getByRole('dialog', { name: /CONSULTAR ORBE MÁGICO/ });
  await expect(restored.getByRole('log')).toHaveCount(1);
  await expect(restored.getByText(/Saudações! Sou Orbe/)).toHaveCount(1);
  await expect(restored.getByText('Qual é a experiência de Pedro?')).toHaveCount(1);
  await restored.getByRole('button', { name: 'Maximizar chat' }).click();
  await expect(restored.getByRole('log')).toHaveCount(1);
  await expect(restored.getByLabel('Limite de perguntas')).toHaveCount(1);
});
test('legado mantém chat público sem capacidade ou confirmação de reuniões', async ({ page }) => {
  const meetingMutations: string[] = [];
  page.on('request', request => {
    if (request.method() === 'POST' && /\/api\/v1\/meetings(?:\/|$)/.test(request.url())) meetingMutations.push(request.url());
  });
  const mock = await mockChat(page, [{ body: chatResponse({
    answer: 'A resposta pública permanece disponível sem os recursos opcionais.',
    actions: [{ type: 'confirm_meeting_request', proposal: meetingProposal() }],
  }) }]);
  const { dialog, input, send, history } = await openChat(page);
  await expect(dialog.getByRole('button', { name: 'Nova conversa', exact: true })).toBeVisible();
  await input.fill('Quais tecnologias Pedro utiliza?');
  await send.click();
  await expect(history).toContainText('A resposta pública permanece disponível');
  await expect(dialog.getByRole('button', { name: 'REVISAR PROPOSTA DE REUNIÃO' })).toHaveCount(0);
  expect(mock.requests).toHaveLength(1);
  expect(mock.requests[0].headers()['x-orbe-capabilities']).toBeUndefined();
  expect(meetingMutations).toEqual([]);
});

test('Shift+Enter adiciona quebra de linha sem enviar; Enter envia o texto completo', async ({ page }) => {
  const mock = await mockChat(page, [{}]);
  const { input, history, dialog } = await openChat(page);
  await expect(dialog).toContainText('Shift + Enter pula linha');
  await input.fill('Primeira pergunta');
  await input.press('Shift+Enter');
  await input.type('Segunda linha');
  await expect(input).toHaveValue('Primeira pergunta\\nSegunda linha'.replace('\\n', '\n'));
  expect(mock.requests).toHaveLength(0);
  await input.press('Enter');
  await expect(history.locator('.user-msg')).toContainText('Primeira pergunta');
  await expect(history.locator('.user-msg')).toContainText('Segunda linha');
  await expect(history).toContainText('Java, Spring Boot e TypeScript');
  expect(mock.requests).toHaveLength(1);
  expect(mock.requests[0].postDataJSON()).toEqual({ message: 'Primeira pergunta\\nSegunda linha'.replace('\\n', '\n') });
});

test('maximizar e restaurar mantém mensagens, sessão e requisição em andamento', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const pending = deferredReply();
  const mock = await mockChat(page, [{ waitFor: pending.promise }]);
  const { input, send, history, dialog } = await openChat(page);
  await input.fill('Qual é a experiência de Pedro?');
  await send.click();
  await expect(history.locator('.user-msg')).toContainText('experiência de Pedro');
  const original = await dialog.boundingBox();
  await dialog.getByRole('button', { name: 'Maximizar chat' }).click();
  await expect(dialog).toHaveClass(/orb-chat-panel-expanded/);
  const maximized = await dialog.boundingBox();
  expect(maximized!.width).toBeGreaterThan(original!.width);
  await expect(send).toBeDisabled();
  await dialog.getByRole('button', { name: 'Restaurar tamanho do chat' }).click();
  await expect(dialog).not.toHaveClass(/orb-chat-panel-expanded/);
  expect(mock.requests).toHaveLength(1);
  pending.release();
  await expect(history).toContainText('Java, Spring Boot e TypeScript');
  await expect(input).toHaveValue('');
  expect(mock.requests).toHaveLength(1);
});

test('cria e continua a conversa sem persistir ou expor o token', async ({ page, context }) => {
  const consoleMessages: string[] = [];
  page.on('console', message => consoleMessages.push(message.text()));
  const continued = chatResponse({ answer: 'A continuação utiliza a mesma conversa.' });
  delete (continued as Partial<typeof continued>).conversationToken;
  const mock = await mockChat(page, [{}, { body: continued }]);
  const { dialog, trigger, close, input, send, history } = await openChat(page);
  await expect(dialog).toContainText(/provedor de IA/i);
  await expect(dialog).toContainText(/temporariamente/i);
  await expect(dialog).toContainText(/dados pessoais sensíveis/i);
  await input.fill('Quais tecnologias Pedro utiliza?');
  await send.click();
  await expect(history).toContainText('Java, Spring Boot e TypeScript');
  await close.click();
  await expect(dialog).toHaveCount(0);
  await trigger.click();
  await expect(history).toContainText('Quais tecnologias Pedro utiliza?');
  await expect(history).toContainText('Java, Spring Boot e TypeScript');
  expect(mock.requests).toHaveLength(1);
  await input.fill('Quais projetos utilizam Java?');
  await send.click();
  await expect(history).toContainText('A continuação utiliza a mesma conversa.');
  expect(mock.requests).toHaveLength(2);
  expect(mock.requests[0].url()).toBe('https://orbe-api.invalid/api/v1/chat');
  expect(mock.requests[0].postDataJSON()).toEqual({ message: 'Quais tecnologias Pedro utiliza?' });
  expect(mock.requests[0].headers()['x-conversation-token']).toBeUndefined();
  expect(mock.requests[1].postDataJSON()).toEqual({
    conversationId: MOCK_CONVERSATION_ID, message: 'Quais projetos utilizam Java?',
  });
  expect(mock.requests[1].headers()['x-conversation-token']).toBe(MOCK_CONVERSATION_TOKEN);
  for (const request of mock.requests) {
    expect(request.headers()['content-type']).toContain('application/json');
    expect(request.headers().authorization).toBeUndefined();
    expect(request.headers().cookie).toBeUndefined();
    expect(request.url()).not.toContain(MOCK_CONVERSATION_TOKEN);
    expect(request.postDataJSON()).not.toHaveProperty('model');
  }
  const stored = await page.evaluate(() => ({
    local: { ...localStorage }, session: { ...sessionStorage }, dom: document.documentElement.outerHTML,
  }));
  expect(JSON.stringify(stored)).not.toContain(MOCK_CONVERSATION_TOKEN);
  expect(JSON.stringify(await context.cookies())).not.toContain(MOCK_CONVERSATION_TOKEN);
  expect(consoleMessages.join('\n')).not.toContain(MOCK_CONVERSATION_TOKEN);
});

test('exibe loading e bloqueia cliques e submits repetidos', async ({ page }) => {
  const pending = deferredReply();
  const mock = await mockChat(page, [{ waitFor: pending.promise }]);
  const { dialog, input, send, history } = await openChat(page);
  await input.fill('Quais são os projetos?');
  await send.click();
  await expect(history.locator('.user-msg')).toContainText('Quais são os projetos?');
  await expect(dialog.getByRole('status')).toContainText('ORBE CONSULTANDO OS REGISTROS');
  await expect(send).toBeDisabled();
  await dialog.locator('form').evaluate(form => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
  expect(mock.requests).toHaveLength(1);
  pending.release();
  await expect(history).toContainText('Java, Spring Boot e TypeScript');
  await expect(send).toBeEnabled();
  await expect(history.locator('.user-msg')).toHaveCount(1);
  await expect(history.locator('.orb-msg')).toHaveCount(2);
});

test('renderiza resposta como texto e filtra protocolos e links duplicados das fontes', async ({ page }) => {
  const attack = '<img src=x onerror="document.documentElement.dataset.injected=1"><script>alert(1)</script>';
  const mock = await mockChat(page, [{ body: chatResponse({
    answer: attack,
    sources: [
      { type: 'project', id: 'portfolio', title: 'Portfólio PHASSCODE', url: 'https://github.com/SladeSouzaSantos/web-portfolio-v2' },
      { type: 'project', id: 'duplicate', title: 'Referência duplicada', url: 'https://github.com/SladeSouzaSantos/web-portfolio-v2' },
      { type: 'profile', id: 'http', title: 'Referência HTTP', url: 'http://example.org/profile' },
      { type: 'platform', id: 'js', title: 'Referência sem link seguro', url: 'javascript:alert(1)' },
      { type: 'service', id: 'data', title: 'Dados sem link seguro', url: 'data:text/html,unsafe' },
      { type: 'profile', id: 'no-url', title: 'Trajetória profissional' },
    ],
  }) }]);
  const { input, send, history } = await openChat(page);
  await input.fill('<b>Pergunta como texto</b>');
  await send.click();
  await expect(history).toContainText(attack);
  await expect(history.locator('img, script, b')).toHaveCount(0);
  await expect(page.locator('html')).not.toHaveAttribute('data-injected');
  await expect(history).toContainText('PROJETOS RELACIONADOS');
  await expect(history).not.toContainText('Trajetória profissional');
  const links = history.getByRole('link');
  await expect(links).toHaveCount(1);
  for (const link of await links.all()) {
    await expect(link).toHaveAttribute('href', /^https?:\/\//);
    await expect(link).toHaveAttribute('rel', /noopener/);
    await expect(link).toHaveAttribute('rel', /noreferrer/);
  }
  expect(mock.requests).toHaveLength(1);
});

test('sinaliza resposta simulada sem apresentá-la como resposta real', async ({ page }) => {
  await mockChat(page, [{ body: chatResponse({
    meta: { provider: 'mock', simulated: true, promptVersion: 'test-only' },
  }) }]);
  const { input, send, dialog } = await openChat(page);
  await input.fill('Quais tecnologias utiliza?');
  await send.click();
  await expect(dialog).toContainText(/resposta simulada/i);
});

test('recarregar a página mantém o texto local, mas não persiste ID/token e ignora resposta pendente', async ({ page }) => {
  const pending = deferredReply();
  const mock = await mockChat(page, [{}, { waitFor: pending.promise, body: chatResponse({ answer: 'Resposta antiga descartada.' }) }, {}]);
  const { dialog, trigger, input, send, history } = await openChat(page);
  await input.fill('Primeira pergunta');
  await send.click();
  await expect(history).toContainText('Java, Spring Boot e TypeScript');
  await input.fill('Pergunta antiga pendente');
  await send.click();
  await expect.poll(() => mock.requests.length).toBe(2);
  await page.reload();
  pending.release();
  await trigger.click();
  await expect(dialog).toBeVisible();
  await expect(history.locator('.user-msg')).toHaveCount(2);
  await expect(history.locator('.orb-msg')).toHaveCount(2);
  await expect(input).toHaveValue('');
  await expect(send).toBeEnabled();
  await expect(dialog.getByRole('button', { name: 'Nova conversa', exact: true })).toBeVisible();
  expect(mock.requests[1].postDataJSON()).toEqual({
    conversationId: MOCK_CONVERSATION_ID, message: 'Pergunta antiga pendente',
  });
  expect(mock.requests[1].headers()['x-conversation-token']).toBe(MOCK_CONVERSATION_TOKEN);
  await input.fill('Nova consulta');
  await send.click();
  await expect(history).toContainText('Java, Spring Boot e TypeScript');
  await expect(history).not.toContainText('Resposta antiga descartada.');
  expect(mock.requests).toHaveLength(3);
  expect(mock.requests[2].postDataJSON()).toEqual({ message: 'Nova consulta' });
  expect(mock.requests[2].headers()['x-conversation-token']).toBeUndefined();
});

test('copia a conversa e Nova conversa remove o cache e reinicia a sessão', async ({ page }) => {
  const mock = await mockChat(page, [{}, {}]);
  const { dialog, input, send, history } = await openChat(page);
  await input.fill('Primeira pergunta');
  await send.click();
  await expect(history).toContainText('Java, Spring Boot e TypeScript');
  await expect(dialog).toContainText('1/20 perguntas');
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await dialog.getByRole('button', { name: 'Copiar conversa' }).click();
  await expect(dialog.getByRole('status')).toContainText('Conversa copiada');
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain('[VOCÊ]: Primeira pergunta');
  expect(copied).toContain('[ORBE]:');
  const cache = await page.evaluate(() => localStorage.getItem('phasscode:orbe:transcript:v1'));
  expect(cache).toContain('Primeira pergunta');
  expect(cache).not.toContain(MOCK_CONVERSATION_TOKEN);
  expect(cache).not.toContain(MOCK_CONVERSATION_ID);
  await dialog.getByRole('button', { name: 'Nova conversa' }).click();
  await expect(history.locator('.user-msg')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('phasscode:orbe:transcript:v1'))).toBeNull();
  await input.fill('Segunda pergunta');
  await send.click();
  await expect(history).toContainText('Java, Spring Boot e TypeScript');
  expect(mock.requests[1].postDataJSON()).toEqual({ message: 'Segunda pergunta' });
  expect(mock.requests[1].headers()['x-conversation-token']).toBeUndefined();
});

test('20 perguntas por conversa impedem o envio adicional e não afetam o backend', async ({ page }) => {
  const mock = await mockChat(page, Array.from({ length: 20 }, (_, i) => i === 0 ? {} : {
    body: (() => { const body = chatResponse({ answer: 'Confirmação ' + i }); delete (body as Partial<typeof body>).conversationToken; return body; })(),
  }));
  const { dialog, input, send } = await openChat(page);
  for (let i = 0; i < 20; i++) {
    await input.fill('Pergunta ' + i);
    await send.click();
    await expect(dialog.getByRole('log')).toContainText(i === 0 ? 'Java, Spring Boot e TypeScript' : 'Confirmação ' + i);
  }
  await expect(dialog.getByText('20/20 perguntas nesta conversa')).toBeVisible();
  await expect(send).toBeDisabled();
  expect(mock.requests).toHaveLength(20);
  await dialog.getByRole('button', { name: 'Nova conversa' }).click();
  await expect(send).toBeEnabled();
});

test('404 limpa a sessão e permite uma nova conversa preservando a pergunta', async ({ page }) => {
  const mock = await mockChat(page, [{}, { status: 404, body: chatError('CONVERSATION_NOT_FOUND') }, {}]);
  const { dialog, input, send, history } = await openChat(page);
  await input.fill('Iniciar uma conversa');
  await send.click();
  await expect(history).toContainText('Java, Spring Boot e TypeScript');
  await input.fill('Continuar conversa expirada');
  await send.click();
  await expect(dialog.getByRole('alert')).toContainText(MOCK_CORRELATION_ID);
  await expect(input).toHaveValue('Continuar conversa expirada');
  await send.click();
  await expect(input).toHaveValue('');
  await expect.poll(() => mock.requests.length).toBe(3);
  expect(mock.requests[1].headers()['x-conversation-token']).toBe(MOCK_CONVERSATION_TOKEN);
  expect(mock.requests[2].headers()['x-conversation-token']).toBeUndefined();
  expect(mock.requests[2].postDataJSON()).toEqual({ message: 'Continuar conversa expirada' });
});

test('429 respeita Retry-After e exige uma nova tentativa consciente', async ({ page }) => {
  const mock = await mockChat(page, [
    { status: 429, body: chatError('LLM_BUDGET_EXHAUSTED'), headers: { 'Retry-After': '1', 'Access-Control-Expose-Headers': 'Retry-After' } },
    {},
  ]);
  const { dialog, input, send, history } = await openChat(page);
  await input.fill('Pergunta preservada após limite');
  await send.click();
  await expect(dialog.getByRole('alert')).toContainText(MOCK_CORRELATION_ID);
  await expect(input).toHaveValue('Pergunta preservada após limite');
  await expect(send).toBeDisabled();
  await expect(send).toBeEnabled({ timeout: 5_000 });
  expect(mock.requests).toHaveLength(1);
  await send.click();
  await expect(history).toContainText('Java, Spring Boot e TypeScript');
  expect(mock.requests).toHaveLength(2);
});

for (const status of [400, 403, 409, 413, 415, 500, 502, 503, 504]) {
  test(`erro ${status} mostra orientação segura sem retry automático e preserva texto`, async ({ page }) => {
    const mock = await mockChat(page, [{ status, body: chatError(`MOCK_${status}`) }]);
    const { dialog, input, send, history } = await openChat(page);
    const query = `Consulta com falha ${status}`;
    await input.fill(query);
    await send.click();
    await expect(dialog.getByRole('alert')).toContainText(MOCK_CORRELATION_ID);
    await expect(input).toHaveValue(query);
    await expect(send).toBeEnabled();
    await expect(history.locator('.user-msg')).toHaveCount(1);
    await expect(history.locator('.orb-msg')).toHaveCount(1);
    expect(mock.requests).toHaveLength(1);
    await expect(dialog).not.toContainText(/stack trace|node_modules|LLM_API_KEY/);
  });
}

test('falha de rede não dispara retry e mantém a pergunta editável', async ({ page }) => {
  const mock = await mockChat(page, [{ networkError: true }]);
  const { dialog, input, send } = await openChat(page);
  await input.fill('Consulta sem conexão');
  await send.click();
  await expect(dialog.getByRole('alert')).toBeVisible();
  await expect(input).toHaveValue('Consulta sem conexão');
  await expect(input).toBeEditable();
  await expect(send).toBeEnabled();
  expect(mock.requests).toHaveLength(1);
});

test('fechar cancela a consulta, ignora a resposta tardia e preserva o histórico', async ({ page }) => {
  const pending = deferredReply();
  const mock = await mockChat(page, [
    {}, { waitFor: pending.promise, body: chatResponse({ answer: 'Não mostrar resposta cancelada.' }) }, {},
  ]);
  const { dialog, trigger, input, send, close, history } = await openChat(page);
  await input.fill('Consulta concluída');
  await send.click();
  await expect(history).toContainText('Java, Spring Boot e TypeScript');
  await input.fill('Consulta a cancelar');
  await send.click();
  await expect.poll(() => mock.requests.length).toBe(2);
  await close.click();
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  pending.release();
  await trigger.click();
  await expect(history).toContainText('Consulta concluída');
  await expect(history).not.toContainText('Não mostrar resposta cancelada.');
  await expect(input).toHaveValue('Consulta a cancelar');
  await expect(send).toBeEnabled();
  await input.fill('Consulta após reabrir');
  await send.click();
  await expect(input).toHaveValue('');
  await expect.poll(() => mock.requests.length).toBe(3);
  expect(mock.requests[2].postDataJSON()).toEqual({
    conversationId: MOCK_CONVERSATION_ID, message: 'Consulta após reabrir',
  });
  expect(mock.requests[2].headers()['x-conversation-token']).toBe(MOCK_CONVERSATION_TOKEN);
});

test('desmontar o Orbe cancela a consulta e uma montagem nova inicia outra sessão', async ({ page }) => {
  const pending = deferredReply();
  const mock = await mockChat(page, [
    { waitFor: pending.promise, body: chatResponse({ answer: 'Resposta de componente desmontado.' }) }, {},
  ]);
  const { input, send } = await openChat(page);
  await input.fill('Consulta antes de navegar');
  await send.click();
  await expect.poll(() => mock.requests.length).toBe(1);
  // Trigger a real React Router unmount without relying on a document reload's
  // automatic network cancellation or clicking through the modal's inert root.
  await page.evaluate(() => {
    history.pushState(null, '', '/projetos');
    dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect(page.getByRole('heading', { name: 'ARQUIVO DE MISSÕES', exact: true })).toBeVisible();
  pending.release();
  await page.goBack();
  await page.getByRole('button', { name: 'Abrir guia do portfólio', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: /CONSULTAR ORBE MÁGICO/ });
  await expect(dialog).not.toContainText('Resposta de componente desmontado.');
  await dialog.getByRole('textbox', { name: 'Sua pergunta ao orbe' }).fill('Consulta após navegação');
  await dialog.getByRole('button', { name: 'ENVIAR', exact: true }).click();
  await expect.poll(() => mock.requests.length).toBe(2);
  expect(mock.requests[1].headers()['x-conversation-token']).toBeUndefined();
  expect(mock.requests[1].postDataJSON()).toEqual({ message: 'Consulta após navegação' });
});

test('teclado, celular e movimento reduzido preservam acesso aos controles', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await mockChat(page, [{}]);
  const { dialog, input, send, close, trigger, history } = await openChat(page);
  const copy = dialog.getByRole('button', { name: 'Copiar conversa' });
  const maximize = dialog.getByRole('button', { name: 'Maximizar chat' });
  await expect(copy).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(send).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(copy).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(maximize).toBeFocused();
  await input.fill('Pergunta pelo teclado');
  await input.press('Enter');
  await expect(history).toContainText('Java, Spring Boot e TypeScript');
  for (const viewport of [{ width: 320, height: 568 }, { width: 568, height: 320 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport);
    await expect(dialog).toBeVisible();
    expect(await dialog.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
    await close.scrollIntoViewIfNeeded();
    await expect(close).toBeInViewport();
    await input.scrollIntoViewIfNeeded();
    await expect(input).toBeInViewport();
    await send.scrollIntoViewIfNeeded();
    await expect(send).toBeInViewport();
  }
  const violations = (await new AxeBuilder({ page }).include('.orb-chat-panel').analyze()).violations;
  expect(violations).toEqual([]);
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test('valida pergunta vazia e aplica o limite publicado de 2000 caracteres', async ({ page }) => {
  const mock = await mockChat(page, [{}]);
  const { input, send, history } = await openChat(page);
  await input.fill('   ');
  await send.click();
  expect(mock.requests).toHaveLength(0);
  await expect(input).toHaveAttribute('maxlength', '2000');
  await input.fill('A'.repeat(2000));
  await send.click();
  await expect(history).toContainText('Java, Spring Boot e TypeScript');
  expect(mock.requests[0].postDataJSON().message).toHaveLength(2000);
});

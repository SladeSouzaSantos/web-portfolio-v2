import { expect, test, type Page } from '@playwright/test';
import type { ChatResponse } from '../src/types/orbe';

const apiUrl = 'https://devapi.phasscode.com/api/v1/chat';
const suite = process.env.ORBE_LIVE_SUITE ?? 'smoke';
const maxMessages = suite === 'extended' ? 9 : 5;
let sentMessages = 0;

const genericRefusal =
  'Posso apresentar a experiência profissional, as competências, a formação e os projetos de Pedro Santos.';

function requirePublicEvidence(reply: ChatResponse, question: string) {
  if (!reply.answer || reply.answer.trim().length < 30) {
    throw new Error('Orbe returned a missing or abnormally short public answer.');
  }
  if (reply.answer.includes(genericRefusal)) {
    throw new Error('Orbe returned the generic out-of-scope response for a recruiter question.');
  }
  if (reply.meta.simulated || reply.meta.provider === 'mock') {
    throw new Error('Orbe DEV responded with the mock provider; this is not a live E2E result.');
  }
  if (!reply.sources.length || reply.sources.length > 10) {
    throw new Error('Public recruiter answer did not include a bounded evidence source.');
  }
  for (const source of reply.sources) {
    if (typeof source.id !== 'string' || !source.id || !source.title) {
      throw new Error('Orbe provided an invalid source identifier or title.');
    }
    if (source.url && !/^https?:\/\//i.test(source.url)) {
      throw new Error('Orbe provided a non-HTTP(S) public source URL.');
    }
  }
  if (!question.trim()) throw new Error('Empty test question.');
}

const publicExcerpt = (value: string) =>
  value
    .replace(/\bsk-[A-Za-z0-9_-]{12,}\b/g, '[REDACTED_KEY]')
    .replace(/\bBearer\s+[A-Za-z0-9._-]{12,}/gi, 'Bearer [REDACTED_TOKEN]')
    .replace(/\b[A-Za-z0-9_-]{54,}\b/g, '[REDACTED_LONG_VALUE]');

async function openOrbe(page: Page) {
  await page.goto('/#sobre', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Abrir guia do portfólio', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: /CONSULTAR ORBE MÁGICO/ });
  await expect(dialog).toBeVisible();
  return {
    dialog,
    input: dialog.getByRole('textbox', { name: 'Sua pergunta ao orbe', exact: true }),
    send: dialog.getByRole('button', { name: 'ENVIAR', exact: true }),
    history: dialog.getByRole('log', { name: 'Conversa com o orbe' }),
  };
}

type OrbeUI = Awaited<ReturnType<typeof openOrbe>>;

/** Real browser request: no route(), request mocking, automatic retries or report consent. */
async function ask(page: Page, chat: OrbeUI, question: string, previous?: ChatResponse) {
  sentMessages += 1;
  if (sentMessages > maxMessages) {
    throw new Error('Live test message budget exceeded; no additional API calls allowed.');
  }
  const messagesBefore = await chat.history.locator('.orb-msg').count();
  const replyPromise = page.waitForResponse(
    (response) => response.url() === apiUrl && response.request().method() === 'POST',
    { timeout: 75_000 },
  );

  await chat.input.fill(question);
  await chat.send.click();
  const response = await replyPromise;
  if (!response.ok()) {
    // No response bodies, tokens, correlation IDs, or provider data in CI logs.
    throw new Error(`Live Orbe endpoint failed: HTTP ${response.status()}, no retries.`);
  }

  const request = response.request();
  const payload: unknown = request.postDataJSON();
  if (!payload || typeof payload !== 'object' || !('message' in payload) ||
      (payload as { message?: unknown }).message !== question) {
    throw new Error('Browser sent an unexpected Orbe question.');
  }

  const body: unknown = await response.json();
  if (!body || typeof body !== 'object') throw new Error('Orbe returned an invalid JSON payload.');
  const reply = body as ChatResponse;
  if (typeof reply.conversationId !== 'string' || typeof reply.answer !== 'string' ||
      !Array.isArray(reply.sources) || !reply.meta || typeof reply.meta !== 'object') {
    throw new Error('Orbe response does not match its public DTO.');
  }

  if (previous) {
    if (reply.conversationId !== previous.conversationId ||
        'conversationToken' in reply ||
        (payload as { conversationId?: string }).conversationId !== previous.conversationId) {
      throw new Error('Orbe lost conversation continuity or re-emitted a private token.');
    }
    if (!request.headers()['x-conversation-token']) {
      throw new Error('Browser failed to authenticate the resumed Orbe conversation.');
    }
  } else {
    if (typeof reply.conversationToken !== 'string' ||
        (payload as { conversationId?: string }).conversationId !== undefined ||
        request.headers()['x-conversation-token']) {
      throw new Error('New conversation lacks a private token or uses a prior conversation.');
    }
  }
  requirePublicEvidence(reply, question);
  await expect(chat.history.locator('.orb-msg')).toHaveCount(messagesBefore + 1, {
    timeout: 12_000,
  });
  await expect(chat.history.locator('.user-msg').last()).toContainText(question);
  await expect(chat.history.locator('.orb-msg').last()).toBeVisible();

  // Store only a recruiter-facing public answer and source IDs. Never save
  // conversation IDs/tokens, request headers, cookies, screenshots or traces.
  await test.info().attach(`public-orbe-turn-${sentMessages}`, {
    body: JSON.stringify({
      question,
      answer: publicExcerpt(reply.answer),
      sourceIds: reply.sources.map((source) => source.id),
      simulated: reply.meta.simulated,
      provider: reply.meta.provider,
      httpStatus: response.status(),
    }, null, 2),
    contentType: 'application/json',
  });
  return reply;
}

test.describe.serial('Orbe live DEV recruiter acceptance (real UI + real API)', () => {
  test('smoke: Pedro programa? returns a substantive grounded programming profile', async ({ page }) => {
    const chat = await openOrbe(page);
    const reply = await ask(page, chat, 'Pedro programa?');
    if (!/(?:Java|Python|Flutter|TypeScript|SIGAA|PHASSCODE|programa(?:ção|dor)?)/i.test(reply.answer)) {
      throw new Error('Broad programming question omitted all expected programming evidence.');
    }
  });

  test('smoke: professional Java to short Go follow-up retains intent', async ({ page }) => {
    const chat = await openOrbe(page);
    const first = await ask(page, chat, 'Pedro tem experiência profissional com Java?');
    const next = await ask(page, chat, 'E com Go?', first);
    if (!/\bGo\b|Golang/i.test(next.answer) ||
        !/(?:n[aã]o|sem experi[eê]ncia|nunca)/i.test(next.answer)) {
      throw new Error('Go follow-up did not distinguish missing direct experience.');
    }
  });

  test('smoke: an explicit React projects question is not treated as a technology ellipsis', async ({ page }) => {
    const chat = await openOrbe(page);
    const first = await ask(page, chat, 'Pedro tem experiência profissional com Java?');
    const next = await ask(page, chat, 'E quais projetos React?', first);
    if (!/React/i.test(next.answer)) {
      throw new Error('React projects follow-up omitted the requested technology.');
    }
  });

  test('extended: Java to Go to Flutter maintains the conversation for three turns', async ({ page }) => {
    test.skip(suite !== 'extended', 'Smoke suite is limited to five live requests.');
    const chat = await openOrbe(page);
    const first = await ask(page, chat, 'Pedro tem experiência profissional com Java?');
    const go = await ask(page, chat, 'E com Go?', first);
    const flutter = await ask(page, chat, 'E com Flutter?', go);
    if (!/Flutter/i.test(flutter.answer)) {
      throw new Error('Third conversational turn omitted Flutter.');
    }
  });

  test('extended: UNISUL degree must not be described as completed', async ({ page }) => {
    test.skip(suite !== 'extended', 'Smoke suite is limited to five live requests.');
    const chat = await openOrbe(page);
    const reply = await ask(page, chat, 'Pedro já concluiu Ciência da Computação na UNISUL?');
    if (!/(?:UNISUL|Ci[eê]ncia da Computa[çc][aã]o)/i.test(reply.answer) ||
        !/(?:n[aã]o|pendente|em andamento)/i.test(reply.answer)) {
      throw new Error('UNISUL academic status was not correctly distinguished.');
    }
  });
});

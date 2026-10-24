import type { BrowserContext, Page, Request } from '@playwright/test';

export const MOCK_CONVERSATION_ID = '64739863-a04c-4a49-92d8-558be9424503';
// Synthetic test data only. These values never identify a real conversation.
export const MOCK_CONVERSATION_TOKEN = `mock-only-${'t'.repeat(43)}`;
export const MOCK_CORRELATION_ID = '3d5ec27b-cdbe-494e-bd23-e6e33679bd54';
export const CHAT_ROUTE = /\/api\/v1\/chat\/?(?:\?.*)?$/;
const MOCK_CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Expose-Headers': 'Retry-After',
};

export function chatResponse(overrides: Record<string, unknown> = {}) {
  return {
    conversationId: MOCK_CONVERSATION_ID,
    conversationToken: MOCK_CONVERSATION_TOKEN,
    answer: 'Pedro utiliza Java, Spring Boot e TypeScript em seus projetos.',
    sources: [],
    meta: { provider: 'openai-compatible', simulated: false, promptVersion: 'orbe-v3' },
    ...overrides,
  };
}

export function chatError(code = 'SERVICE_UNAVAILABLE') {
  return { error: { code, message: 'Não foi possível atender à consulta agora.', correlationId: MOCK_CORRELATION_ID } };
}

/** Every suite, including deployed smoke tests, must avoid the real AI provider. */
export async function installSafeChatMock(context: BrowserContext) {
  await context.route(CHAT_ROUTE, async route => {
    let body: { message?: string; conversationId?: string };
    try { body = route.request().postDataJSON(); } catch { body = {}; }
    const query = String(body?.message ?? '').toLocaleLowerCase('pt-BR');
    const answer = query.includes('projeto')
      ? 'Pedro desenvolveu projetos como o SDGP (Dimensionamento Solar em Flutter), o Lithology (Logs Geológicos em Java) e o ReserGas (Cálculos de Fluidos de Reservatórios).'
      : query.includes('contato') || query.includes('email') || query.includes('e-mail')
        ? 'Você pode entrar em contato pelo LinkedIn ou GitHub oficial de Pedro Santos!'
        : 'Este guia tem respostas demonstrativas. Pedro Santos possui experiência em Engenharia e Desenvolvimento de Software.';
    const response = chatResponse({ answer, meta: { provider: 'mock', simulated: true, promptVersion: 'test-only' } });
    if (body?.conversationId) delete (response as Partial<typeof response>).conversationToken;
    await route.fulfill({ headers: MOCK_CORS_HEADERS, json: response });
  });
}

export interface MockChatReply {
  status?: number;
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
  waitFor?: Promise<void>;
  networkError?: boolean;
}

export function deferredReply() {
  let release!: () => void;
  const promise = new Promise<void>(resolve => { release = resolve; });
  return { promise, release };
}

/** Page routes take precedence over the context safety mock. Never use route.continue. */
export async function mockChat(page: Page, replies: MockChatReply[]) {
  const requests: Request[] = [];
  const aborted: Request[] = [];
  page.on('requestfailed', request => {
    if (CHAT_ROUTE.test(request.url())) aborted.push(request);
  });
  await page.route(CHAT_ROUTE, async route => {
    const index = requests.push(route.request()) - 1;
    const reply = replies[index];
    if (!reply) {
      // Fail closed: an unexpected retry is recorded and stays entirely local.
      await route.fulfill({ status: 500, headers: MOCK_CORS_HEADERS, json: chatError('UNEXPECTED_TEST_REQUEST') });
      return;
    }
    if (reply.waitFor) await reply.waitFor;
    try {
      if (reply.networkError) await route.abort('internetdisconnected');
      else {
        const response: Record<string, unknown> = reply.body ?? chatResponse();
        if (!reply.body && route.request().postDataJSON()?.conversationId) {
          delete response.conversationToken;
        }
        await route.fulfill({
          status: reply.status ?? 200,
          headers: { ...MOCK_CORS_HEADERS, ...reply.headers },
          json: response,
        });
      }
    } catch {
      // An intentionally cancelled request may already be gone when a delayed
      // mock is released. No real network request is allowed as a fallback.
    }
  });
  return { requests, aborted };
}

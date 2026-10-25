import { expect, test } from '@playwright/test';
import { createOrbeClient, OrbeClientError } from '../src/services/orbeClient';
import type { ChatResponse } from '../src/types/orbe';
import type { OrbeDiagnosticEvent } from '../src/services/orbeDiagnosticEvent';
import { meetingProposal, MOCK_CONFIRMATION_TOKEN } from './helpers/platform-mock';

const API_URL = 'https://api.example.test';
const FIRST_ID = '11111111-1111-4111-8111-111111111111';
const NEXT_ID = '22222222-2222-4222-8222-222222222222';
const FIRST_TOKEN = 'test-only-first-conversation-token-12345678901';
const NEXT_TOKEN = 'test-only-next-conversation-token-123456789012';

function reply(overrides: Partial<ChatResponse> = {}): ChatResponse {
  return {
    conversationId: FIRST_ID,
    conversationToken: FIRST_TOKEN,
    answer: 'Resposta simulada exclusivamente para este teste.',
    sources: [],
    meta: { provider: 'mock', simulated: true, promptVersion: 'orbe-test' },
    ...overrides,
  };
}

function json(value: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

type FetchResult = Response | ((options: RequestInit | undefined) => Promise<Response>);

function queuedFetch(...responses: FetchResult[]) {
  const calls: { url: string; options: RequestInit | undefined }[] = [];
  const fetch: typeof globalThis.fetch = async (input, options) => {
    calls.push({ url: String(input), options });
    const response = responses.shift();
    if (!response) throw new Error('Unexpected request in the isolated fake fetch.');
    return typeof response === 'function' ? response(options) : response;
  };
  return { fetch, calls };
}

function deferredResponse() {
  let resolve!: (value: Response) => void;
  const promise = new Promise<Response>((resolvePromise) => { resolve = resolvePromise; });
  return { promise, resolve };
}

function rejectWhenAborted(options: RequestInit | undefined): Promise<Response> {
  return new Promise((_resolve, reject) => {
    options?.signal?.addEventListener('abort', () => {
      reject(new DOMException('Test request aborted.', 'AbortError'));
    }, { once: true });
  });
}

test('meeting-capable Orbe opts in on every message while proposal secrets stay out of the model and diagnostics', async () => {
  const actions = [{ type: 'confirm_meeting_request' as const, proposal: meetingProposal() }];
  const fake = queuedFetch(json(reply({ actions })), json(reply({ actions, conversationToken: undefined })));
  const events: OrbeDiagnosticEvent[] = [];
  const client = createOrbeClient(API_URL, { fetch: fake.fetch, meetingCapabilities: true,
    onDiagnostic: event => events.push(event) });
  const first = await client.send('Quero preparar uma proposta.');
  const second = await client.send('A proposta exige confirmação?');
  expect(first.actions).toEqual(actions);
  expect(second.actions).toEqual(actions);
  expect(first).not.toHaveProperty('conversationToken');
  for (const { options, url } of fake.calls) {
    expect(new Headers(options?.headers).get('X-Orbe-Capabilities')).toBe('meetings-v1');
    expect(options?.credentials).toBe('omit');
    expect(String(options?.body)).not.toContain(MOCK_CONFIRMATION_TOKEN);
    expect(String(options?.body)).not.toContain('visitor@example.test');
    expect(url).not.toContain(MOCK_CONFIRMATION_TOKEN);
  }
  expect(JSON.parse(String(fake.calls[1].options?.body))).toEqual({
    conversationId: FIRST_ID, message: 'A proposta exige confirmação?',
  });
  expect(JSON.stringify(events)).not.toContain(MOCK_CONFIRMATION_TOKEN);
  expect(JSON.stringify(events)).not.toContain(FIRST_TOKEN);
  expect(JSON.stringify(events)).not.toContain('visitor@example.test');
});

test('legacy Orbe disables capabilities and does not expose unsolicited meeting actions', async () => {
  const fake = queuedFetch(json(reply({ actions: [{ type: 'confirm_meeting_request', proposal: meetingProposal() }] })),
    json(reply({ conversationToken: undefined })));
  const client = createOrbeClient(API_URL, { fetch: fake.fetch, meetingCapabilities: false });
  expect(await client.send('Quais tecnologias Pedro usa?')).not.toHaveProperty('actions');
  expect(await client.send('Quais projetos usam Java?')).not.toHaveProperty('actions');
  for (const { options } of fake.calls) expect(new Headers(options?.headers).has('X-Orbe-Capabilities')).toBe(false);
});

for (const [name, actions] of [
  ['more than one action', [{ type: 'confirm_meeting_request', proposal: meetingProposal() }, { type: 'confirm_meeting_request', proposal: meetingProposal() }]],
  ['unknown action type', [{ type: 'approve_meeting', proposal: meetingProposal() }]],
  ['extra action property', [{ type: 'confirm_meeting_request', proposal: meetingProposal(), unexpected: true }]],
  ['short private token', [{ type: 'confirm_meeting_request', proposal: meetingProposal({ confirmationToken: 'short' }) }]],
  ['unsafe private token', [{ type: 'confirm_meeting_request', proposal: meetingProposal({ confirmationToken: `${'p'.repeat(42)}\n` }) }]],
  ['invalid summary', [{ type: 'confirm_meeting_request', proposal: { ...meetingProposal(), summary: { ...meetingProposal().summary, email: 'invalid-email' } } }]],
  ['invalid expiry', [{ type: 'confirm_meeting_request', proposal: { ...meetingProposal(), expiresAt: '2030-02-30T10:00:00Z' } }]],
] as const) {
  test(`meeting-capable Orbe rejects ${name} without adopting credentials or logging proposal secrets`, async () => {
    const fake = queuedFetch(json({ ...reply(), actions }), json(reply({ conversationId: NEXT_ID, conversationToken: NEXT_TOKEN })));
    const events: OrbeDiagnosticEvent[] = [];
    const client = createOrbeClient(API_URL, { fetch: fake.fetch, meetingCapabilities: true,
      onDiagnostic: event => events.push(event) });
    await expect(client.send('Prepare uma proposta.')).rejects.toMatchObject({ kind: 'protocol' });
    await client.send('Pergunta nova após resposta inválida.');
    expect(JSON.parse(String(fake.calls[1].options?.body))).toEqual({ message: 'Pergunta nova após resposta inválida.' });
    expect(new Headers(fake.calls[1].options?.headers).has('X-Conversation-Token')).toBe(false);
    expect(JSON.stringify(events)).not.toContain(MOCK_CONFIRMATION_TOKEN);
  });
}

test('reset removes an established chat capability while preserving explicit meetings opt-in', async () => {
  const fake = queuedFetch(json(reply({ actions: [{ type: 'confirm_meeting_request', proposal: meetingProposal() }] })),
    json(reply({ conversationId: NEXT_ID, conversationToken: NEXT_TOKEN })));
  const client = createOrbeClient(API_URL, { fetch: fake.fetch, meetingCapabilities: true });
  await client.send('Prepare uma proposta.');
  client.reset();
  const replyAfterReset = await client.send('Começar outra conversa.');
  expect(replyAfterReset.actions).toBeUndefined();
  expect(JSON.parse(String(fake.calls[1].options?.body))).toEqual({ message: 'Começar outra conversa.' });
  expect(new Headers(fake.calls[1].options?.headers).has('X-Conversation-Token')).toBe(false);
  expect(new Headers(fake.calls[1].options?.headers).get('X-Orbe-Capabilities')).toBe('meetings-v1');
});

test('isolated client creates and continues a session without exposing its token', async () => {
  const fake = queuedFetch(json(reply()), json(reply({ conversationToken: undefined })));
  const client = createOrbeClient(API_URL, { fetch: fake.fetch });

  const first = await client.send('  Quais projetos utilizam Java?  ');
  const second = await client.send('E quais tecnologias usam?');

  expect(first).not.toHaveProperty('conversationToken');
  expect(second).not.toHaveProperty('conversationToken');
  expect(fake.calls).toHaveLength(2);
  expect(fake.calls.map(({ url }) => url)).toEqual([
    `${API_URL}/api/v1/chat`, `${API_URL}/api/v1/chat`,
  ]);
  expect(JSON.parse(String(fake.calls[0].options?.body))).toEqual({ message: 'Quais projetos utilizam Java?' });
  expect(JSON.parse(String(fake.calls[1].options?.body))).toEqual({
    conversationId: FIRST_ID, message: 'E quais tecnologias usam?',
  });
  for (const { options } of fake.calls) {
    expect(options).toMatchObject({ method: 'POST', credentials: 'omit', cache: 'no-store', redirect: 'error' });
    const headers = new Headers(options?.headers);
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(headers.has('Authorization')).toBe(false);
    expect(headers.has('Cookie')).toBe(false);
    expect(Object.keys(JSON.parse(String(options?.body))).sort()).toEqual(
      headers.has('X-Conversation-Token') ? ['conversationId', 'message'] : ['message'],
    );
  }
  expect(new Headers(fake.calls[0].options?.headers).has('X-Conversation-Token')).toBe(false);
  expect(new Headers(fake.calls[1].options?.headers).get('X-Conversation-Token')).toBe(FIRST_TOKEN);
});

test('isolated client validates Unicode length and the UTF-8 JSON body limit before sending', async () => {
  const fake = queuedFetch(json(reply()));
  const client = createOrbeClient(API_URL, { fetch: fake.fetch });

  await expect(client.send(' ')).rejects.toMatchObject({ kind: 'validation' });
  await expect(client.send('\u{1f52e}'.repeat(1001))).rejects.toMatchObject({ kind: 'validation' });
  await expect(client.send('a'.repeat(2001))).rejects.toMatchObject({ kind: 'validation' });
  // JSON escapes each control character to six ASCII bytes, exceeding the HTTP limit.
  await expect(client.send(`a${'\u0000'.repeat(1400)}`)).rejects.toMatchObject({ kind: 'validation' });
  expect(fake.calls).toHaveLength(0);

  await client.send('\u{1f52e}'.repeat(1000));
  expect(fake.calls).toHaveLength(1);
  expect(new TextEncoder().encode(String(fake.calls[0].options?.body)).byteLength).toBeLessThanOrEqual(8192);
});

test('isolated client keeps the original token after a continuation attempts to replace it', async () => {
  const fake = queuedFetch(
    json(reply()),
    json(reply({ conversationToken: NEXT_TOKEN })),
    json(reply({ conversationToken: undefined })),
  );
  const client = createOrbeClient(API_URL, { fetch: fake.fetch });
  await client.send('Primeira pergunta');
  await expect(client.send('Continuação inválida')).rejects.toMatchObject({ kind: 'protocol' });
  await client.send('Nova tentativa consciente');

  expect(new Headers(fake.calls[2].options?.headers).get('X-Conversation-Token')).toBe(FIRST_TOKEN);
  expect(JSON.parse(String(fake.calls[2].options?.body)).conversationId).toBe(FIRST_ID);
});

test('isolated client clears an expired session even when the 404 body is malformed', async () => {
  const fake = queuedFetch(
    json(reply()),
    new Response('upstream error', { status: 404 }),
    json(reply({ conversationId: NEXT_ID, conversationToken: NEXT_TOKEN })),
  );
  const client = createOrbeClient(API_URL, { fetch: fake.fetch });
  await client.send('Primeira pergunta');
  await expect(client.send('Conversa expirada')).rejects.toMatchObject({ kind: 'http', status: 404 });
  await client.send('Criar outra conversa');

  expect(new Headers(fake.calls[2].options?.headers).has('X-Conversation-Token')).toBe(false);
  expect(JSON.parse(String(fake.calls[2].options?.body))).toEqual({ message: 'Criar outra conversa' });
});

for (const invalid of [
  { name: 'answer', body: { ...reply(), answer: 123 } },
  { name: 'missing initial token', body: reply({ conversationToken: undefined }) },
  { name: 'source type', body: { ...reply(), sources: [{ type: 'secret', id: 'x', title: 'Invalid source' }] } },
  { name: 'metadata', body: { ...reply(), meta: { provider: 'unknown', simulated: false, promptVersion: 'x' } } },
]) {
  test(`isolated client does not adopt a session with invalid ${invalid.name}`, async () => {
    const fake = queuedFetch(json(invalid.body), json(reply({ conversationId: NEXT_ID, conversationToken: NEXT_TOKEN })));
    const client = createOrbeClient(API_URL, { fetch: fake.fetch });
    await expect(client.send('Receber resposta inválida')).rejects.toMatchObject({ kind: 'protocol' });
    await client.send('Criar conversa válida');

    expect(new Headers(fake.calls[1].options?.headers).has('X-Conversation-Token')).toBe(false);
    expect(JSON.parse(String(fake.calls[1].options?.body))).toEqual({ message: 'Criar conversa válida' });
  });
}

test('isolated client rejects simultaneous sends and supports explicit external cancellation', async () => {
  const fake = queuedFetch(rejectWhenAborted, json(reply()));
  const client = createOrbeClient(API_URL, { fetch: fake.fetch });
  const controller = new AbortController();
  const pending = client.send('Pergunta pendente', { signal: controller.signal });
  const cancellation = expect(pending).rejects.toMatchObject({ kind: 'aborted' });

  await expect(client.send('Não duplicar')).rejects.toMatchObject({ kind: 'busy' });
  expect(fake.calls).toHaveLength(1);
  controller.abort();
  await cancellation;
  await client.send('Nova tentativa consciente');
  expect(fake.calls).toHaveLength(2);
});

test('isolated client distinguishes timeouts without retrying automatically', async () => {
  const fake = queuedFetch(rejectWhenAborted);
  const diagnostics: OrbeDiagnosticEvent[] = [];
  const client = createOrbeClient(API_URL, {
    fetch: fake.fetch, timeoutMs: 10, onDiagnostic: event => diagnostics.push(event),
  });

  await expect(client.send('Pergunta que demora')).rejects.toMatchObject({ kind: 'timeout' });
  expect(fake.calls).toHaveLength(1);
  expect(fake.calls[0].options?.signal?.aborted).toBe(true);
  expect(diagnostics.map(event => event.phase)).toEqual(['started', 'failed']);
  expect(diagnostics[1]).toMatchObject({ kind: 'timeout' });
  expect(diagnostics[1]).not.toHaveProperty('status');
});

test('isolated client reset rejects a late response without replacing the new session', async () => {
  const late = deferredResponse();
  const fake = queuedFetch(
    () => late.promise,
    json(reply({ conversationId: NEXT_ID, conversationToken: NEXT_TOKEN })),
    json(reply({ conversationId: NEXT_ID, conversationToken: undefined })),
  );
  const client = createOrbeClient(API_URL, { fetch: fake.fetch });
  const oldRequest = client.send('Conversa antiga');
  const oldCancelled = expect(oldRequest).rejects.toMatchObject({ kind: 'aborted' });
  client.reset();
  expect(fake.calls[0].options?.signal?.aborted).toBe(true);
  await client.send('Conversa nova');
  late.resolve(json(reply()));
  await oldCancelled;
  await client.send('Continuar conversa nova');

  expect(JSON.parse(String(fake.calls[1].options?.body))).toEqual({ message: 'Conversa nova' });
  expect(JSON.parse(String(fake.calls[2].options?.body)).conversationId).toBe(NEXT_ID);
  expect(new Headers(fake.calls[2].options?.headers).get('X-Conversation-Token')).toBe(NEXT_TOKEN);
});

test('isolated client reads Retry-After as seconds and HTTP date without exposing server internals', async () => {
  const retryDate = new Date(Date.now() + 121_000).toUTCString();
  const errorBody = { error: {
    code: 'LLM_BUDGET_EXHAUSTED',
    message: 'Do not expose this arbitrary upstream text.',
    correlationId: FIRST_ID,
  } };
  const fake = queuedFetch(
    json(errorBody, 429, { 'Retry-After': '30' }),
    json(errorBody, 503, { 'Retry-After': retryDate }),
  );
  const client = createOrbeClient(API_URL, { fetch: fake.fetch });

  await expect(client.send('Rate limit')).rejects.toMatchObject({
    kind: 'http', status: 429, code: 'LLM_BUDGET_EXHAUSTED', correlationId: FIRST_ID, retryAfterSeconds: 30,
  });
  let received: unknown;
  try { await client.send('Indisponibilidade'); } catch (error) { received = error; }
  expect(received).toBeInstanceOf(OrbeClientError);
  const error = received as OrbeClientError;
  const expectedSeconds = Math.max(0, Math.ceil((Date.parse(retryDate) - Date.now()) / 1000));
  expect(error.retryAfterSeconds).toBeGreaterThanOrEqual(expectedSeconds);
  expect(error.retryAfterSeconds).toBeLessThanOrEqual(expectedSeconds + 1);
  expect(error.publicMessage).not.toContain('arbitrary upstream');
  expect(fake.calls).toHaveLength(2);
});

test('isolated client converts network failures to a public error without leaking their cause', async () => {
  const fake = queuedFetch(() => Promise.reject(new Error('internal credentials and stack trace')));
  const diagnostics: OrbeDiagnosticEvent[] = [];
  const client = createOrbeClient(API_URL, { fetch: fake.fetch, onDiagnostic: event => diagnostics.push(event) });

  const request = client.send('Falha de rede');
  await expect(request).rejects.toMatchObject({ kind: 'network' });
  await expect(request).rejects.not.toThrow('internal credentials');
  expect(fake.calls).toHaveLength(1);
  expect(diagnostics[1]).toMatchObject({ phase: 'failed', kind: 'network' });
  expect(diagnostics[1]).not.toHaveProperty('status');
  expect(JSON.stringify(diagnostics)).not.toContain('internal credentials');
});

test('isolated client reports useful HTTP metadata without logging chat contents or session tokens', async () => {
  const correlationId = '33333333-3333-4333-8333-333333333333';
  const fake = queuedFetch(
    json(reply({ answer: 'PRIVATE_ANSWER' })),
    json({ error: {
      code: 'LLM_BUDGET_EXHAUSTED', message: 'PRIVATE_UPSTREAM_MESSAGE', correlationId,
    } }, 429, { 'Retry-After': '30' }),
  );
  const diagnostics: OrbeDiagnosticEvent[] = [];
  const client = createOrbeClient(API_URL, { fetch: fake.fetch, onDiagnostic: event => diagnostics.push(event) });
  await client.send('PRIVATE_FIRST_QUESTION');
  await expect(client.send('PRIVATE_SECOND_QUESTION')).rejects.toMatchObject({ status: 429 });
  expect(diagnostics.map(event => event.phase)).toEqual(['started', 'succeeded', 'started', 'failed']);
  expect(diagnostics[1]).toMatchObject({ status: 200 });
  expect(diagnostics[3]).toMatchObject({
    kind: 'http', status: 429, code: 'LLM_BUDGET_EXHAUSTED', correlationId, retryAfterSeconds: 30,
  });
  const log = JSON.stringify(diagnostics);
  expect(log).not.toContain('PRIVATE_');
  expect(log).not.toContain(FIRST_TOKEN);
  expect(log).not.toContain(FIRST_ID);
  expect(log).not.toContain('X-Conversation-Token');
  expect(fake.calls).toHaveLength(2);
});

test('isolated client can correlate a non-JSON failure using the public response header', async () => {
  const correlationId = '33333333-3333-4333-8333-333333333333';
  const fake = queuedFetch(new Response('PRIVATE_PROXY_ERROR', {
    status: 503, headers: { 'X-Correlation-Id': correlationId },
  }));
  const diagnostics: OrbeDiagnosticEvent[] = [];
  const client = createOrbeClient(API_URL, { fetch: fake.fetch, onDiagnostic: event => diagnostics.push(event) });
  await expect(client.send('PRIVATE_QUESTION')).rejects.toMatchObject({ status: 503, correlationId });
  expect(diagnostics[1]).toMatchObject({ phase: 'failed', status: 503, correlationId });
  expect(JSON.stringify(diagnostics)).not.toContain('PRIVATE_');
});

test('isolated client remains functional if development diagnostics fail', async () => {
  const fake = queuedFetch(json(reply()));
  const client = createOrbeClient(API_URL, {
    fetch: fake.fetch, onDiagnostic: () => { throw new Error('Diagnostic channel unavailable'); },
  });
  await expect(client.send('Consulta com logger indisponível')).resolves.toMatchObject({ answer: reply().answer });
  expect(fake.calls).toHaveLength(1);
});

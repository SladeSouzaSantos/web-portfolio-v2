import { expect, test } from '@playwright/test';
import { createMeetingConfirmationStore, createMeetingsClient } from '../src/services/meetingsClient';
import { parseAdminMeetingList, parseMeetingProposal, parseMeetingStatusResponse, type MeetingProposal } from '../src/types/meetings';
import { formatMeetingInstant, meetingAvailabilityWindow } from '../src/components/meetings/meetingTime';

const API = 'https://meetings.example.test';
const PROPOSAL_ID = '11111111-1111-4111-8111-111111111111';
const REQUEST_ID = '22222222-2222-4222-8222-222222222222';
const PRIVATE_TOKEN = 'm'.repeat(43);
const CORRELATION = '33333333-3333-4333-8333-333333333333';
function proposal(): MeetingProposal {
  return { proposalId: PROPOSAL_ID, confirmationToken: PRIVATE_TOKEN, expiresAt: '2030-01-02T12:30:00Z',
    summary: { start: '2030-01-03T12:00:00Z', end: '2030-01-03T12:30:00Z', timeZone: 'America/Fortaleza',
      name: 'Visitante de Teste', email: 'visitor@example.test', topic: 'Projeto Java de teste' },
    consentVersion: 'meeting-v1', simulated: true };
}
function status() {
  return { id: REQUEST_ID, status: 'PENDING', start: '2030-01-03T12:00:00Z', end: '2030-01-03T12:30:00Z',
    timeZone: 'America/Fortaleza', updatedAt: '2030-01-02T12:00:00Z' };
}
function json(body: unknown, status = 200, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}
type FakeResult = Response | ((options: RequestInit | undefined) => Promise<Response>);
function queued(...results: FakeResult[]) {
  const calls: { url: string; options: RequestInit | undefined }[] = [];
  const fetch: typeof globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    const result = results.shift();
    if (!result) throw new Error('Unexpected fake request.');
    return typeof result === 'function' ? result(options) : result;
  };
  return { fetch, calls };
}

test('meeting calendar queries preserve the API time zone and reject silently normalized dates', () => {
  expect(meetingAvailabilityWindow('2030-01-03', 'America/Fortaleza')).toEqual({
    from: '2030-01-03T03:00:00.000Z', to: '2030-01-10T03:00:00.000Z',
  });
  expect(meetingAvailabilityWindow('2030-01-03', 'Asia/Tokyo')).toEqual({
    from: '2030-01-02T15:00:00.000Z', to: '2030-01-09T15:00:00.000Z',
  });
  expect(() => meetingAvailabilityWindow('2030-02-30', 'America/Fortaleza')).toThrow();
  expect(() => meetingAvailabilityWindow('2030-01-03', 'invalid-zone')).toThrow();
  expect(formatMeetingInstant('2030-01-03T12:00:00Z', 'America/Fortaleza')).toContain('09:00');
  expect(formatMeetingInstant('2030-01-03T12:00:00Z', 'invalid-zone')).toBe('2030-01-03T12:00:00Z');
});

test('meeting DTOs enforce opaque tokens, complete statuses, private fields and cursor pagination', () => {
  expect(parseMeetingProposal(proposal())).toEqual(proposal());
  expect(() => parseMeetingProposal({ ...proposal(), confirmationToken: 'short' })).toThrow();
  expect(() => parseMeetingProposal({ ...proposal(), expiresAt: '2030-02-30T10:00:00Z' })).toThrow();
  expect(() => parseMeetingStatusResponse({ ...status(), meetingToken: PRIVATE_TOKEN })).toThrow();
  expect(() => parseMeetingStatusResponse({ ...status(), status: 'EXPIRED' })).toThrow();
  const item = { ...status(), name: 'Visitante de Teste', email: 'visitor@example.test', topic: 'Projeto Java',
    createdAt: '2030-01-02T11:00:00Z', version: 2, failureCode: null };
  expect(parseAdminMeetingList({ items: [item], nextCursor: 'opaque-cursor' })).toEqual({ items: [item], nextCursor: 'opaque-cursor' });
  expect(parseAdminMeetingList({ items: [], nextCursor: null })).toEqual({ items: [], nextCursor: null });
  expect(() => parseAdminMeetingList({ items: [{ ...item, failureCode: undefined }], nextCursor: null })).toThrow();
});

test('meeting availability sends only a seven-day ISO window and never includes credentials', async () => {
  const result = { timeZone: 'America/Fortaleza', durationMinutes: 30, simulated: true,
    slots: [{ start: proposal().summary.start, end: proposal().summary.end }] };
  const fake = queued(json(result));
  const client = createMeetingsClient(API, { fetch: fake.fetch });
  await expect(client.availability('2030-01-02T03:00:00Z', '2030-01-10T03:00:00Z')).rejects.toMatchObject({ kind: 'validation' });
  await expect(client.availability('2030-01-02', '2030-01-03')).rejects.toMatchObject({ kind: 'validation' });
  await expect(client.availability('2030-01-02T03:00:00Z', '2030-01-02T03:00:00Z')).rejects.toMatchObject({ kind: 'validation' });
  expect(fake.calls).toHaveLength(0);
  expect(await client.availability('2030-01-02T03:00:00Z', '2030-01-09T03:00:00Z')).toEqual(result);
  const url = new URL(fake.calls[0].url);
  expect(url.pathname).toBe('/api/v1/meetings/availability');
  expect(Object.fromEntries(url.searchParams)).toEqual({ from: '2030-01-02T03:00:00Z', to: '2030-01-09T03:00:00Z' });
  expect(fake.calls[0].options).toMatchObject({ method: 'GET', credentials: 'omit', cache: 'no-store' });
});

test('meeting proposal and private status keep PII out of URLs, cookies and authorization', async () => {
  const fake = queued(json(proposal(), 201), json(status()));
  const client = createMeetingsClient(API, { fetch: fake.fetch });
  await client.prepareProposal({ ...proposal().summary, name: '  Visitante de Teste  ', topic: '  Projeto Java de teste  ' });
  await client.status(REQUEST_ID, PRIVATE_TOKEN);
  expect(JSON.parse(String(fake.calls[0].options?.body))).toEqual({ start: proposal().summary.start,
    name: 'Visitante de Teste', email: 'visitor@example.test', topic: 'Projeto Java de teste' });
  expect(fake.calls[0].url).toBe(`${API}/api/v1/meetings/proposals`);
  expect(fake.calls[1].url).toBe(`${API}/api/v1/meetings/requests/${REQUEST_ID}/status`);
  expect(new Headers(fake.calls[1].options?.headers).get('X-Meeting-Token')).toBe(PRIVATE_TOKEN);
  for (const call of fake.calls) {
    expect(call.options?.credentials).toBe('omit');
    expect(new Headers(call.options?.headers).has('Authorization')).toBe(false);
    expect(new Headers(call.options?.headers).has('Cookie')).toBe(false);
    expect(call.url).not.toContain(PRIVATE_TOKEN);
    expect(call.url).not.toContain('visitor');
  }
});

test('meeting confirmation requires explicit consent and a valid idempotency key before fetch', async () => {
  const fake = queued(json({ ...status(), meetingToken: PRIVATE_TOKEN }, 201));
  const client = createMeetingsClient(API, { fetch: fake.fetch });
  const input = { proposalId: PROPOSAL_ID, confirmationToken: PRIVATE_TOKEN, consent: true as const, consentVersion: 'meeting-v1' };
  await expect(client.confirmRequest({ ...input, consent: false as unknown as true }, 'valid-key-123')).rejects.toMatchObject({ kind: 'validation' });
  await expect(client.confirmRequest(input, 'bad')).rejects.toMatchObject({ kind: 'validation' });
  expect(fake.calls).toHaveLength(0);
  await client.confirmRequest(input, 'valid-key-123');
  expect(new Headers(fake.calls[0].options?.headers).get('Idempotency-Key')).toBe('valid-key-123');
  expect(JSON.parse(String(fake.calls[0].options?.body))).toEqual(input);
  expect(fake.calls[0].options?.method).toBe('POST');
});

test('private confirmation ledger reuses exactly the same key and body after ambiguous failure', async () => {
  const fake = queued(async () => { throw new TypeError('Fake network failure.'); },
    json({ ...status(), meetingToken: PRIVATE_TOKEN }, 201));
  const client = createMeetingsClient(API, { fetch: fake.fetch });
  let generated = 0;
  const store = createMeetingConfirmationStore(client, () => { generated++; return 'test-confirmation-key-123'; });
  await expect(store.confirm(proposal())).rejects.toMatchObject({ kind: 'network' });
  expect(fake.calls).toHaveLength(1); // Never retry a mutation automatically.
  const firstAttempt = store.get(PROPOSAL_ID)!;
  expect(Object.isFrozen(firstAttempt.input)).toBe(true);
  const answer = await store.confirm(proposal());
  expect(answer.status).toBe('PENDING');
  expect(generated).toBe(1);
  expect(fake.calls[0].options?.body).toBe(fake.calls[1].options?.body);
  expect(new Headers(fake.calls[0].options?.headers).get('Idempotency-Key')).toBe(
    new Headers(fake.calls[1].options?.headers).get('Idempotency-Key'));
  expect(await store.confirm(proposal())).toBe(answer); // Reopened Orbe action must not create another request.
  expect(fake.calls).toHaveLength(2);
  store.updateStatus(parseMeetingStatusResponse({ ...status(), status: 'CONFIRMED' }));
  expect(store.get(PROPOSAL_ID)?.result?.status).toBe('CONFIRMED');
});

test('private confirmation ledger rejects duplicate clicks and keeps the same attempt after cancellation', async () => {
  const fake = queued(options => new Promise((_resolve, reject) => {
    options?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted fake request.', 'AbortError')), { once: true });
  }), json({ ...status(), meetingToken: PRIVATE_TOKEN }, 201));
  const store = createMeetingConfirmationStore(createMeetingsClient(API, { fetch: fake.fetch }), () => 'test-confirmation-key-123');
  const controller = new AbortController();
  const pending = store.confirm(proposal(), { signal: controller.signal });
  await expect(store.confirm(proposal())).rejects.toMatchObject({ kind: 'busy' });
  expect(fake.calls).toHaveLength(1);
  controller.abort();
  await expect(pending).rejects.toMatchObject({ kind: 'aborted' });
  expect(store.get(PROPOSAL_ID)?.idempotencyKey).toBe('test-confirmation-key-123');
  await store.confirm(proposal());
  expect(fake.calls[1].options?.body).toBe(fake.calls[0].options?.body);
});

for (const [statusCode, code] of [[409, 'MEETING_SLOT_UNAVAILABLE'], [429, 'RATE_LIMITED'], [503, 'CALENDAR_UNAVAILABLE']] as const) {
  test(`meeting failures preserve safe ${statusCode} metadata without exposing private response bodies`, async () => {
    const fake = queued(json({ error: { code, correlationId: CORRELATION, message: `Internal secret ${PRIVATE_TOKEN}` } },
      statusCode, { 'Retry-After': '5' }));
    const client = createMeetingsClient(API, { fetch: fake.fetch });
    const failure = await client.prepareProposal({ start: proposal().summary.start, name: proposal().summary.name,
      email: proposal().summary.email, topic: proposal().summary.topic }).catch(value => value);
    expect(failure).toMatchObject({ kind: 'http', status: statusCode, code, correlationId: CORRELATION, retryAfterSeconds: 5 });
    expect(failure.message).not.toContain(PRIVATE_TOKEN);
    expect(fake.calls).toHaveLength(1);
  });
}

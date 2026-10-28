import type { BrowserContext, Page, Request } from '@playwright/test';
import type { AuthSessionResponse } from '../../src/types/auth';
import type { AdminMeetingItem, MeetingProposal, MeetingStatus, MeetingStatusResponse } from '../../src/types/meetings';

export const PLATFORM_ROUTE = /\/api\/v1\/(?:auth|me|meetings|admin)(?:[/?]|$)/;
const ALL_API_ROUTES = /\/api\/v1(?:\/|$)/;
export const MOCK_USER_ID = '74ea66fa-9a6d-4737-b13c-b089e773dc60';
export const MOCK_MEETING_ID = '4c59c310-9275-44a9-b8d7-3bc1b1e5b117';
export const MOCK_PROPOSAL_ID = 'ce4b651c-ed1d-4bac-8cbe-82b62e91e854';
export const MOCK_CSRF_TOKEN = 'c'.repeat(43);
export const MOCK_CONFIRMATION_TOKEN = 'p'.repeat(43);
export const MOCK_MEETING_TOKEN = 'm'.repeat(43);
export const MOCK_PLATFORM_CORRELATION_ID = '6b7e0d19-448b-4e25-a119-1a354a728c5c';

export function anonymousSession(): AuthSessionResponse {
  return { authenticated: false, user: null, csrfToken: null, expiresAt: null };
}

export function authenticatedSession(role: 'user' | 'admin' = 'user'): AuthSessionResponse {
  return {
    authenticated: true,
    user: { id: MOCK_USER_ID, email: 'visitor@example.test', displayName: 'Visitante de teste', roles: [role] },
    csrfToken: MOCK_CSRF_TOKEN,
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
  };
}

export function meetingProposal(overrides: Partial<MeetingProposal> = {}): MeetingProposal {
  const start = new Date(Date.now() + 3 * 86_400_000);
  start.setUTCMinutes(0, 0, 0);
  return {
    proposalId: MOCK_PROPOSAL_ID,
    confirmationToken: MOCK_CONFIRMATION_TOKEN,
    expiresAt: new Date(Date.now() + 600_000).toISOString(),
    consentVersion: 'meetings-v1',
    simulated: false,
    summary: {
      start: start.toISOString(), end: new Date(start.getTime() + 1_800_000).toISOString(),
      timeZone: 'America/Fortaleza', name: 'Visitante de teste', email: 'visitor@example.test',
      topic: 'Conversa sobre desenvolvimento Java',
    },
    ...overrides,
  };
}

export function meetingStatus(status: MeetingStatus = 'PENDING'): MeetingStatusResponse {
  const { start, end, timeZone } = meetingProposal().summary;
  return { id: MOCK_MEETING_ID, status, start, end, timeZone, updatedAt: new Date().toISOString() };
}

export function adminMeeting(status: MeetingStatus = 'PENDING', overrides: Partial<AdminMeetingItem> = {}): AdminMeetingItem {
  const { name, email, topic } = meetingProposal().summary;
  return { ...meetingStatus(status), name, email, topic, createdAt: new Date().toISOString(),
    version: 1, failureCode: null, ...overrides };
}

export function platformError(code = 'SERVICE_UNAVAILABLE') {
  return { error: { code, message: 'O serviço não está disponível neste teste.', correlationId: MOCK_PLATFORM_CORRELATION_ID } };
}

/** Credentialed CORS must use the exact frontend origin, never a wildcard. */
export function platformCorsHeaders(origin: string) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-CSRF-Token, X-Meeting-Token, Idempotency-Key, X-Orbe-Capabilities, X-Conversation-Token',
    'Access-Control-Expose-Headers': 'Retry-After, X-Correlation-Id',
    Vary: 'Origin',
  };
}

/** Installed before navigation, including on deployed smoke tests. No API request escapes. */
export async function installSafePlatformMock(context: BrowserContext, baseURL: string) {
  const origin = new URL(baseURL).origin;
  const requests: Request[] = [];
  await context.route(ALL_API_ROUTES, async route => {
    const request = route.request();
    requests.push(request);
    const path = new URL(request.url()).pathname.replace(/\/+$/, '');
    const headers = platformCorsHeaders(origin);
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers });
    } else if (request.method() === 'GET' && path.endsWith('/auth/session')) {
      await route.fulfill({ headers, json: anonymousSession() });
    } else if (request.method() === 'GET' && path.endsWith('/meetings/availability')) {
      await route.fulfill({ headers, json: { timeZone: 'America/Fortaleza', durationMinutes: 30, simulated: true, slots: [] } });
    } else if (request.method() === 'GET' && path.endsWith('/auth/login/google')) {
      // This is the backend navigation entry point; it never reaches Google.
      await route.fulfill({ headers, contentType: 'text/html', body: '<!doctype html><html lang="pt-BR"><title>Login Google simulado</title><body>Redirecionamento OAuth interceptado pelo teste.</body></html>' });
    } else if (request.method() === 'GET' && path.endsWith('/me')) {
      await route.fulfill({ status: 401, headers, json: platformError('AUTH_REQUIRED') });
    } else {
      // Mutations are always opt-in per scenario, with no real-network fallback.
      await route.fulfill({ status: 503, headers, json: platformError('UNEXPECTED_TEST_REQUEST') });
    }
  });
  await context.route(/^https:\/\/(?:accounts\.google\.com|oauth2\.googleapis\.com|www\.googleapis\.com)(?:\/|$)/,
    route => route.fulfill({ status: 503, contentType: 'text/plain', body: 'Acesso externo desativado nos testes.' }));
  return { requests };
}

export interface MockPlatformReply {
  method?: string;
  path: string | RegExp;
  status?: number;
  body?: unknown;
  headers?: Record<string, string>;
  waitFor?: Promise<void>;
  networkError?: boolean;
}

/** A scenario queue overrides the safety fixture and records unexpected retries locally. */
export async function mockPlatform(page: Page, replies: MockPlatformReply[], baseURL = 'http://127.0.0.1:4176') {
  const requests: Request[] = [];
  const unexpected: Request[] = [];
  const consumed = new Set<number>();
  let currentSession: AuthSessionResponse | undefined;
  await page.route(PLATFORM_ROUTE, async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const headers = platformCorsHeaders(new URL(baseURL).origin);
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers });
      return;
    }
    requests.push(request);
    const index = replies.findIndex((reply, index) => !consumed.has(index)
      && (reply.method ?? 'GET') === request.method()
      && (typeof reply.path === 'string' ? reply.path === path : reply.path.test(path)));
    if (index < 0) {
      // F2 explicitly rechecks the current server session under Web Locks before
      // protected writes. Keep that GET visible in requests; never replay a POST.
      if (request.method() === 'GET' && path === '/api/v1/auth/session' && currentSession) {
        await route.fulfill({ headers, json: currentSession });
        return;
      }
      unexpected.push(request);
      await route.fulfill({ status: 503, headers, json: platformError('UNEXPECTED_TEST_REQUEST') });
      return;
    }
    consumed.add(index);
    const reply = replies[index];
    if ((reply.status ?? 200) === 200 && ['/api/v1/auth/session', '/api/v1/auth/refresh'].includes(path)) {
      currentSession = reply.body as AuthSessionResponse;
    }
    if (path === '/api/v1/auth/logout' && reply.status === 204) currentSession = anonymousSession();
    if (reply.waitFor) await reply.waitFor;
    try {
      if (reply.networkError) await route.abort('internetdisconnected');
      else if ((reply.status ?? 200) === 204) await route.fulfill({ status: 204, headers: { ...headers, ...reply.headers } });
      else await route.fulfill({ status: reply.status ?? 200, headers: { ...headers, ...reply.headers }, json: reply.body });
    } catch {
      // A deliberately cancelled request may no longer exist when its mock resolves.
    }
  });
  return { requests, unexpected };
}

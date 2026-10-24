import type { ChatApiError, ChatApiResponse, ChatMeta, ChatReply, ChatSource } from '../types/orbe';
import { reportOrbeDiagnostic } from './orbeDiagnostics';
import { sanitizeOrbeDiagnostic, type OrbeDiagnosticEvent } from './orbeDiagnosticEvent';

export const CHAT_MAX_MESSAGE_LENGTH = 2000;
export const ORBE_MAX_MESSAGE_LENGTH = CHAT_MAX_MESSAGE_LENGTH;
export const ORBE_MAX_REQUEST_BYTES = 8192;
const DEFAULT_TIMEOUT_MS = 45_000;
const UUID_PATTERN = /^([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/i;

export type OrbeErrorKind = 'validation' | 'http' | 'network' | 'timeout' | 'aborted' | 'protocol' | 'busy';

export interface OrbeErrorDetails {
  status?: number;
  code?: string;
  correlationId?: string;
  retryAfterSeconds?: number;
}

/** Contains only public messages/metadata, never request payloads or credentials. */
export class OrbeClientError extends Error {
  readonly kind: OrbeErrorKind;
  readonly publicMessage: string;
  readonly status?: number;
  readonly code?: string;
  readonly correlationId?: string;
  readonly retryAfterSeconds?: number;

  constructor(kind: OrbeErrorKind, message: string, details: OrbeErrorDetails = {}) {
    super(message);
    this.name = 'OrbeClientError';
    this.kind = kind;
    this.publicMessage = message;
    this.status = details.status;
    this.code = details.code;
    this.correlationId = details.correlationId;
    this.retryAfterSeconds = details.retryAfterSeconds;
  }
}

export interface OrbeSendOptions {
  signal?: AbortSignal;
}

export interface OrbeClient {
  send(message: string, options?: OrbeSendOptions): Promise<ChatReply>;
  reset(): void;
}

export interface OrbeClientOptions {
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
  onDiagnostic?: (event: OrbeDiagnosticEvent) => void;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasLength(value: unknown, min: number, max = Infinity): value is string {
  return typeof value === 'string' && [...value].length >= min && [...value].length <= max;
}

function isSource(value: unknown): value is ChatSource {
  if (!isObject(value)) return false;
  if (!['profile', 'project', 'service', 'platform'].includes(String(value.type))) return false;
  if (!hasLength(value.id, 1) || !hasLength(value.title, 1)) return false;
  if (value.url === undefined) return true;
  if (typeof value.url !== 'string') return false;
  try {
    // The API accepts any URI. The UI must separately allow only HTTP(S) links.
    new URL(value.url);
    return true;
  } catch {
    return false;
  }
}

function isMeta(value: unknown): value is ChatMeta {
  return isObject(value)
    && ['mock', 'openai', 'openai-compatible'].includes(String(value.provider))
    && typeof value.simulated === 'boolean'
    && typeof value.promptVersion === 'string';
}

function parseResponse(value: unknown): ChatApiResponse {
  if (!isObject(value)
    || typeof value.conversationId !== 'string'
    || !UUID_PATTERN.test(value.conversationId)
    || !hasLength(value.answer, 1, 8000)
    || !Array.isArray(value.sources)
    || value.sources.length > 10
    || !value.sources.every(isSource)
    || !isMeta(value.meta)
    || (value.conversationToken !== undefined
      && (!hasLength(value.conversationToken, 43, 128) || /[\r\n\u0000]/.test(value.conversationToken)))) {
    throw new OrbeClientError('protocol', 'O Orbe recebeu uma resposta inválida. Inicie uma nova conversa.');
  }

  return {
    conversationId: value.conversationId,
    conversationToken: value.conversationToken as string | undefined,
    answer: value.answer,
    sources: value.sources.map(({ type, id, title, url }) => ({
      type, id, title, ...(url !== undefined && { url }),
    })),
    meta: {
      provider: value.meta.provider,
      simulated: value.meta.simulated,
      promptVersion: value.meta.promptVersion,
    },
  };
}

function parseApiError(value: unknown): ChatApiError['error'] | undefined {
  if (!isObject(value) || !isObject(value.error)) return undefined;
  const { code, message, correlationId } = value.error;
  if (typeof code !== 'string' || typeof message !== 'string' || typeof correlationId !== 'string') {
    return undefined;
  }
  return { code, message, correlationId };
}

function httpMessage(status: number): string {
  if ([400, 413, 415].includes(status)) return 'A pergunta é inválida ou grande demais. Revise o texto e tente novamente.';
  if (status === 403) return 'Este endereço não está autorizado a consultar o Orbe.';
  if (status === 404) return 'A conversa expirou ou não foi encontrada. Envie a pergunta para iniciar outra conversa.';
  if (status === 409) return 'O Orbe já está processando uma pergunta desta conversa. Aguarde antes de tentar novamente.';
  if (status === 429) return 'O limite de consultas ao Orbe foi atingido. Tente novamente mais tarde.';
  if (status === 504) return 'O Orbe demorou para responder. A pergunta pode ter sido processada; tente novamente apenas se desejar.';
  return 'O Orbe está indisponível no momento. Tente novamente mais tarde.';
}

/** Retry-After is advisory only: chat messages are never automatically retried. */
function retryAfterSeconds(value: string | null): number | undefined {
  if (value === null) return undefined;
  const normalized = value.trim();
  if (/^\d+$/.test(normalized)) {
    const seconds = Number(normalized);
    return Number.isSafeInteger(seconds) ? seconds : undefined;
  }
  if (!/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)(?:[a-z]*,? )/.test(normalized)) return undefined;
  const timestamp = Date.parse(normalized);
  if (!Number.isFinite(timestamp)) return undefined;
  return Math.max(0, Math.ceil((timestamp - Date.now()) / 1000));
}

/** A new instance is a new in-memory session. No persistence, cookies or retries. */
export function createOrbeClient(baseUrl: string, options: OrbeClientOptions = {}): OrbeClient {
  let apiUrl: URL;
  try {
    apiUrl = new URL(baseUrl);
  } catch {
    throw new OrbeClientError('validation', 'O endereço da API do Orbe é inválido.');
  }
  if (!['http:', 'https:'].includes(apiUrl.protocol) || apiUrl.username || apiUrl.password) {
    throw new OrbeClientError('validation', 'O endereço da API do Orbe é inválido.');
  }
  apiUrl.pathname = `${apiUrl.pathname.replace(/\/$/, '')}/api/v1/chat`;
  apiUrl.search = '';
  apiUrl.hash = '';
  const fetchRequest = options.fetch ?? globalThis.fetch.bind(globalThis);
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new OrbeClientError('validation', 'O tempo de espera do Orbe é inválido.');
  }

  function diagnose(event: OrbeDiagnosticEvent) {
    try {
      const safeEvent = sanitizeOrbeDiagnostic(event);
      if (safeEvent) (options.onDiagnostic ?? reportOrbeDiagnostic)(safeEvent);
    } catch { /* An unavailable logger cannot change the HTTP outcome. */ }
  }

  let conversation: { id: string; token: string } | undefined;
  let generation = 0;
  let activeRequest: AbortController | undefined;

  function reset() {
    generation += 1;
    conversation = undefined;
    activeRequest?.abort();
    activeRequest = undefined;
  }

  async function send(message: string, sendOptions: OrbeSendOptions = {}): Promise<ChatReply> {
    const normalized = message.trim();
    // The published JSON Schema counts Unicode code points; the current Zod
    // backend and HTML maxlength use UTF-16. Honor the conservative limit too.
    if (!hasLength(normalized, 1, ORBE_MAX_MESSAGE_LENGTH) || normalized.length > ORBE_MAX_MESSAGE_LENGTH) {
      throw new OrbeClientError('validation', `Escreva uma pergunta com até ${ORBE_MAX_MESSAGE_LENGTH} caracteres.`);
    }
    if (sendOptions.signal?.aborted) throw new OrbeClientError('aborted', 'Consulta cancelada.');
    if (activeRequest) throw new OrbeClientError('busy', 'Aguarde a resposta do Orbe antes de enviar outra pergunta.');

    const session = conversation;
    const body = JSON.stringify({ ...(session && { conversationId: session.id }), message: normalized });
    if (new TextEncoder().encode(body).byteLength > ORBE_MAX_REQUEST_BYTES) {
      throw new OrbeClientError('validation', 'A pergunta é grande demais para envio. Reduza o texto.');
    }
    const requestGeneration = generation;
    const startedAt = Date.now();
    let responseStatus: number | undefined;
    const controller = new AbortController();
    activeRequest = controller;
    let timedOut = false;
    const abort = () => controller.abort();
    sendOptions.signal?.addEventListener('abort', abort, { once: true });
    const timeout = globalThis.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);

    function ensureActive() {
      if (timedOut) {
        throw new OrbeClientError('timeout', 'O Orbe demorou para responder. A pergunta pode ter sido processada; tente novamente apenas se desejar.');
      }
      if (controller.signal.aborted || requestGeneration !== generation) {
        throw new OrbeClientError('aborted', 'Consulta cancelada.');
      }
    }

    try {
      diagnose({ phase: 'started' });
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session) headers['X-Conversation-Token'] = session.token;
      const response = await fetchRequest(apiUrl.toString(), {
        method: 'POST',
        headers,
        body,
        cache: 'no-store',
        credentials: 'omit',
        redirect: 'error',
        signal: controller.signal,
      });
      responseStatus = response.status;
      ensureActive();
      // Invalidate expired sessions even if the error body is absent/malformed.
      if (response.status === 404) conversation = undefined;
      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        ensureActive();
        if (response.ok) {
          throw new OrbeClientError('protocol', 'O Orbe recebeu uma resposta inválida. Inicie uma nova conversa.');
        }
      }
      ensureActive();
      if (!response.ok) {
        const error = parseApiError(payload);
        throw new OrbeClientError('http', httpMessage(response.status), {
          status: response.status,
          code: error?.code,
          correlationId: error?.correlationId ?? response.headers.get('X-Correlation-Id') ?? undefined,
          retryAfterSeconds: retryAfterSeconds(response.headers.get('Retry-After')),
        });
      }

      const data = parseResponse(payload);
      if ((!session && !data.conversationToken)
        || (session && (data.conversationId !== session.id || data.conversationToken !== undefined))) {
        throw new OrbeClientError('protocol', 'O Orbe recebeu uma sessão inválida. Inicie uma nova conversa.');
      }
      ensureActive();
      if (!session && data.conversationToken) {
        conversation = { id: data.conversationId, token: data.conversationToken };
      }
      diagnose({ phase: 'succeeded', status: responseStatus, durationMs: Math.max(0, Date.now() - startedAt) });
      return { conversationId: data.conversationId, answer: data.answer, sources: data.sources, meta: data.meta };
    } catch (error) {
      try { ensureActive(); } catch (activeError) { error = activeError; }
      const failure = error instanceof OrbeClientError ? error
        : new OrbeClientError('network', 'Não foi possível consultar o Orbe. Verifique sua conexão e tente novamente se desejar.');
      diagnose({
        phase: 'failed', kind: failure.kind, status: failure.status ?? responseStatus,
        code: failure.code, correlationId: failure.correlationId,
        retryAfterSeconds: failure.retryAfterSeconds, durationMs: Math.max(0, Date.now() - startedAt),
      });
      throw failure;
    } finally {
      globalThis.clearTimeout(timeout);
      sendOptions.signal?.removeEventListener('abort', abort);
      if (activeRequest === controller) activeRequest = undefined;
    }
  }

  return { send, reset };
}

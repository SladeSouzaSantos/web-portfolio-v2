export type PlatformErrorKind = 'validation' | 'http' | 'network' | 'timeout' | 'aborted' | 'protocol' | 'busy';
export interface PlatformErrorDetails {
  status?: number;
  code?: string;
  correlationId?: string;
  retryAfterSeconds?: number;
}
/** Only public metadata belongs here; never include request bodies or credentials. */
export class PlatformApiError extends Error {
  readonly publicMessage: string;
  readonly status?: number;
  readonly code?: string;
  readonly correlationId?: string;
  readonly retryAfterSeconds?: number;
  readonly retryAt?: number;
  constructor(readonly kind: PlatformErrorKind, message: string, details: PlatformErrorDetails = {}) {
    super(message);
    this.name = 'PlatformApiError';
    this.publicMessage = message;
    this.status = details.status;
    this.code = details.code;
    this.correlationId = details.correlationId;
    this.retryAfterSeconds = details.retryAfterSeconds;
    if (details.retryAfterSeconds !== undefined && Number.isFinite(details.retryAfterSeconds) && details.retryAfterSeconds >= 0) {
      this.retryAt = Date.now() + details.retryAfterSeconds * 1000;
    }
  }
}
export interface PlatformRequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  headers?: Record<string, string>;
  credentials?: RequestCredentials;
  signal?: AbortSignal;
}
export interface PlatformHttpOptions { fetch?: typeof globalThis.fetch; timeoutMs?: number }
export interface PlatformHttp {
  request<T>(path: string, options: PlatformRequestOptions, parse: (value: unknown) => T): Promise<T>;
}
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/i.test(value);
}
export function isIsoDateTime(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(value)
    && Number.isFinite(Date.parse(value));
}
export function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined;
  if (/^\d+$/.test(value.trim())) {
    const seconds = Number(value.trim());
    return Number.isSafeInteger(seconds) ? seconds : undefined;
  }
  if (!/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)/.test(value)) return undefined;
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, Math.ceil((date - Date.now()) / 1000)) : undefined;
}
function publicHttpMessage(status: number, code?: string) {
  if (code === 'AUTH_DISABLED') return 'A autenticação está indisponível neste ambiente.';
  if (status === 401) return 'Sua sessão expirou ou não está disponível. Entre novamente.';
  if (status === 403) return 'Operação não autorizada. Confira sua permissão e atualize a sessão.';
  if (status === 404) return 'O recurso não está disponível ou o acesso não foi reconhecido.';
  if (status === 409) return 'Os dados mudaram ou existe um conflito. Atualize as informações antes de continuar.';
  if (status === 429) return 'O limite de consultas foi atingido. Aguarde antes de tentar novamente.';
  if ([400, 413, 415].includes(status)) return 'Revise os dados enviados antes de tentar novamente.';
  return 'O serviço está indisponível no momento. A operação pode ter sido processada; confira o estado antes de tentar novamente.';
}
export function createPlatformHttp(baseUrl: string, clientOptions: PlatformHttpOptions = {}): PlatformHttp {
  let base: URL;
  try { base = new URL(baseUrl); } catch { throw new PlatformApiError('validation', 'O endereço da API é inválido.'); }
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash) {
    throw new PlatformApiError('validation', 'O endereço da API é inválido.');
  }
  const fetchRequest = clientOptions.fetch ?? globalThis.fetch.bind(globalThis);
  const timeoutMs = clientOptions.timeoutMs ?? 30_000;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new PlatformApiError('validation', 'O tempo de espera é inválido.');
  const root = base.href.replace(/\/+$/, '');
  async function request<T>(path: string, options: PlatformRequestOptions, parse: (value: unknown) => T): Promise<T> {
    if (!path.startsWith('/api/v1/') || path.includes('#') || path.startsWith('//')) {
      throw new PlatformApiError('validation', 'O caminho da operação é inválido.');
    }
    const controller = new AbortController();
    let timedOut = false;
    const onAbort = () => controller.abort();
    options.signal?.addEventListener('abort', onAbort, { once: true });
    if (options.signal?.aborted) controller.abort();
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
    try {
      if (controller.signal.aborted) throw new PlatformApiError('aborted', 'A consulta foi cancelada.');
      const headers = new Headers(options.headers);
      if (options.body !== undefined) headers.set('Content-Type', 'application/json');
      const response = await fetchRequest(`${root}${path}`, {
        method: options.method ?? 'GET', credentials: options.credentials ?? 'omit',
        headers, ...(options.body !== undefined && { body: JSON.stringify(options.body) }),
        signal: controller.signal, cache: 'no-store', redirect: 'error',
      });
      if (controller.signal.aborted) throw new PlatformApiError(timedOut ? 'timeout' : 'aborted', 'A consulta foi interrompida.');
      if (!response.ok) {
        let code: string | undefined;
        let correlationId: string | undefined;
        try {
          const body: unknown = await response.json();
          if (isRecord(body) && isRecord(body.error)) {
            if (typeof body.error.code === 'string' && /^[A-Z0-9_]{1,80}$/.test(body.error.code)) code = body.error.code;
            if (isUuid(body.error.correlationId)) correlationId = body.error.correlationId;
          }
        } catch { /* Non-JSON proxy errors must not expose their body. */ }
        const responseCorrelation = response.headers.get('X-Correlation-Id');
        if (!correlationId && isUuid(responseCorrelation)) correlationId = responseCorrelation;
        throw new PlatformApiError('http', publicHttpMessage(response.status, code), {
          status: response.status, code, correlationId, retryAfterSeconds: parseRetryAfter(response.headers.get('Retry-After')),
        });
      }
      let value: unknown;
      try { value = response.status === 204 ? undefined : await response.json(); }
      catch { throw new PlatformApiError('protocol', 'O serviço retornou uma resposta inválida.'); }
      if (controller.signal.aborted) throw new PlatformApiError(timedOut ? 'timeout' : 'aborted', 'A consulta foi interrompida.');
      try { return parse(value); }
      catch (error) {
        if (error instanceof PlatformApiError) throw error;
        throw new PlatformApiError('protocol', 'O serviço retornou uma resposta inválida.');
      }
    } catch (error) {
      if (controller.signal.aborted) {
        throw new PlatformApiError(timedOut ? 'timeout' : 'aborted', timedOut
          ? 'O serviço demorou para responder. A operação pode ter sido processada; confira o estado antes de tentar novamente.'
          : 'A consulta foi cancelada. Uma operação já recebida pelo servidor pode ter sido processada.');
      }
      if (error instanceof PlatformApiError) throw error;
      throw new PlatformApiError('network', 'Não foi possível acessar o serviço. Confira sua conexão e a origem autorizada pela API.');
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', onAbort);
    }
  }
  return { request };
}

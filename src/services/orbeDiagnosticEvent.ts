export const ORBE_DIAGNOSTIC_EVENT = 'orbe:diagnostic';

type DiagnosticKind = 'validation' | 'http' | 'network' | 'timeout' | 'aborted' | 'protocol' | 'busy';

export interface OrbeDiagnosticEvent {
  phase: 'started' | 'succeeded' | 'failed';
  kind?: DiagnosticKind;
  status?: number;
  code?: string;
  correlationId?: string;
  retryAfterSeconds?: number;
  durationMs?: number;
}

// Only known public error codes can enter logs, even if upstream sends an
// unexpected code containing credentials or arbitrary text.
const publicCodes = new Set([
  'LLM_BUDGET_EXHAUSTED', 'LLM_BUDGET_UNAVAILABLE', 'CHAT_CAPACITY_REACHED',
  'DB_UNAVAILABLE', 'RATE_LIMIT_UNAVAILABLE', 'RATE_LIMITED',
  'VALIDATION_ERROR', 'INVALID_REQUEST', 'PAYLOAD_TOO_LARGE',
  'UNSUPPORTED_MEDIA_TYPE', 'CORS_ORIGIN_FORBIDDEN', 'CONVERSATION_NOT_FOUND',
  'CONVERSATION_BUSY', 'INTERNAL_ERROR', 'SERVICE_UNAVAILABLE',
  'LLM_UNAVAILABLE', 'LLM_TIMEOUT', 'LLM_PROVIDER_ERROR', 'UNKNOWN_API_ERROR',
]);
const kinds = new Set(['validation', 'http', 'network', 'timeout', 'aborted', 'protocol', 'busy']);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Rebuild a tiny allowlisted event. Never spread an error, request or response. */
export function sanitizeOrbeDiagnostic(value: unknown): OrbeDiagnosticEvent | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return;
  const record = value as Record<string, unknown>;
  if (typeof record.phase !== 'string' || !['started', 'succeeded', 'failed'].includes(record.phase)) return;
  const event: OrbeDiagnosticEvent = { phase: record.phase as OrbeDiagnosticEvent['phase'] };
  if (typeof record.kind === 'string' && kinds.has(record.kind)) event.kind = record.kind as DiagnosticKind;
  if (typeof record.status === 'number' && Number.isInteger(record.status)
    && record.status >= 100 && record.status <= 599) event.status = record.status;
  if (typeof record.code === 'string') {
    event.code = publicCodes.has(record.code) ? record.code : 'UNKNOWN_API_ERROR';
  }
  if (typeof record.correlationId === 'string' && uuid.test(record.correlationId)) {
    event.correlationId = record.correlationId;
  }
  for (const key of ['retryAfterSeconds', 'durationMs'] as const) {
    const number = record[key];
    if (typeof number === 'number' && Number.isSafeInteger(number) && number >= 0) event[key] = number;
  }
  return event;
}

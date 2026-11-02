import { PlatformApiError } from './platformHttp';

export type AuthCoordinationEventType = 'session-changed' | 'logout-confirmed' | 'session-invalidated';
export interface AuthCoordinationEvent {
  readonly version: 1;
  readonly id: string;
  readonly source: string;
  readonly type: AuthCoordinationEventType;
}
export interface AuthCoordination {
  readonly supported: boolean;
  runExclusive<T>(operation: (signal: AbortSignal) => Promise<T>, signal?: AbortSignal): Promise<T>;
  publish(type: AuthCoordinationEventType): void;
  subscribe(listener: (event: AuthCoordinationEvent) => void): () => void;
  dispose(): void;
}

/** Only the exclusive, abortable Web Locks operation is needed by this module. */
export interface AuthLockManager {
  request(name: string, options: { mode: 'exclusive'; signal: AbortSignal },
    callback: (lock: unknown) => Promise<unknown>): Promise<unknown>;
}
export interface AuthCoordinationChannel {
  onmessage: ((event: MessageEvent<unknown>) => unknown) | null;
  postMessage(message: AuthCoordinationEvent): void;
  close(): void;
}
export interface AuthCoordinationOptions {
  locks?: AuthLockManager | null;
  channelFactory?: ((name: string) => AuthCoordinationChannel) | null;
  /** Bounds acquisition only. A running operation retains its lock until it settles. */
  lockTimeoutMs?: number;
  scheduleTimeout?: (callback: () => void, delayMs: number) => () => void;
  createId?: () => string;
}

const eventTypes = new Set<AuthCoordinationEventType>(['session-changed', 'logout-confirmed', 'session-invalidated']);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const maximumPending = 32;
const maximumSeen = 128;
const unavailable = () => new PlatformApiError('busy',
  'Não foi possível coordenar a sessão entre abas. Consulte a sessão ou entre novamente.',
  { code: 'AUTH_COORDINATION_UNAVAILABLE' });
const aborted = () => new PlatformApiError('aborted', 'A coordenação da sessão foi cancelada.',
  { code: 'AUTH_COORDINATION_ABORTED' });

function namespaceFor(apiBaseUrl: string): string {
  let url: URL;
  try { url = new URL(apiBaseUrl); } catch { throw unavailable(); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password
    || apiBaseUrl.includes('?') || apiBaseUrl.includes('#')) throw unavailable();
  // The browser already scopes locks/channels to its storage origin. One API
  // namespace covers the shared cookie family, without transmitting an identity.
  return `phasscode-auth:v1:${url.href.replace(/\/+$/, '')}`;
}

function randomId(): string {
  const bytes = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes);
  else for (let index = 0; index < bytes.length; index++) bytes[index] = Math.floor(Math.random() * 256);
  // IDs are non-secret deduplication metadata, never credentials or lock tokens.
  bytes[6] = (bytes[6]! & 15) | 64;
  bytes[8] = (bytes[8]! & 63) | 128;
  const hex = [...bytes].map(value => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function browserLocks(): AuthLockManager | null {
  if (typeof window === 'undefined') return null;
  try { return navigator.locks ?? null; } catch { return null; }
}
function browserChannel(name: string): AuthCoordinationChannel {
  return new BroadcastChannel(name);
}
function parseEvent(value: unknown): AuthCoordinationEvent | null {
  try {
    if (typeof value !== 'object' || value === null || Array.isArray(value)
      || ![Object.prototype, null].includes(Object.getPrototypeOf(value))
      || Reflect.ownKeys(value).length !== 4) return null;
    const record = value as Record<string, unknown>;
    if (!['version', 'id', 'source', 'type'].every(key => Object.hasOwn(record, key))
      || record.version !== 1 || typeof record.id !== 'string' || !uuid.test(record.id)
      || typeof record.source !== 'string' || !uuid.test(record.source)
      || !eventTypes.has(record.type as AuthCoordinationEventType)) return null;
    return Object.freeze({ version: 1, id: record.id.toLowerCase(), source: record.source.toLowerCase(),
      type: record.type as AuthCoordinationEventType });
  } catch { return null; }
}

/** Notifications are advisory. The caller must GET session while holding the
 * lock before using CSRF, including when no notification was received.
 */
export function createAuthCoordination(apiBaseUrl: string, options: AuthCoordinationOptions = {}): AuthCoordination {
  const namespace = namespaceFor(apiBaseUrl);
  const lockTimeoutMs = options.lockTimeoutMs ?? 10_000;
  if (!Number.isSafeInteger(lockTimeoutMs) || lockTimeoutMs <= 0 || lockTimeoutMs > 60_000) {
    throw new PlatformApiError('validation', 'O tempo de coordenação da sessão é inválido.');
  }
  const locks = options.locks === undefined ? browserLocks() : options.locks;
  const supported = typeof locks?.request === 'function';
  const createId = options.createId ?? randomId;
  const source = createId().toLowerCase();
  if (!uuid.test(source)) throw new PlatformApiError('validation', 'O identificador de coordenação é inválido.');
  const scheduleTimeout = options.scheduleTimeout ?? ((callback, delayMs) => {
    const timer = setTimeout(callback, delayMs);
    return () => clearTimeout(timer);
  });
  const controllers = new Set<AbortController>();
  const listeners = new Set<(event: AuthCoordinationEvent) => void>();
  const seen = new Set<string>();
  // Coalescing by the three allowlisted event types bounds a notification burst.
  const notifications = new Map<AuthCoordinationEventType, AuthCoordinationEvent>();
  let deliveryQueued = false;
  let disposed = false;
  let channel: AuthCoordinationChannel | null = null;
  try {
    const factory = options.channelFactory === undefined
      ? (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined' ? browserChannel : null)
      : options.channelFactory;
    channel = factory?.(namespace) ?? null;
    if (channel) channel.onmessage = ({ data }) => {
      if (disposed) return;
      const event = parseEvent(data);
      if (!event || event.source === source) return;
      const key = `${event.source}:${event.id}`;
      if (seen.has(key)) return;
      seen.add(key);
      if (seen.size > maximumSeen) seen.delete(seen.values().next().value!);
      notifications.delete(event.type);
      notifications.set(event.type, event);
      if (deliveryQueued) return;
      deliveryQueued = true;
      queueMicrotask(() => {
        deliveryQueued = false;
        const events = [...notifications.values()];
        notifications.clear();
        if (disposed) return;
        for (const notification of events) for (const listener of listeners) {
          try { listener(notification); } catch { /* One subscriber cannot stop the other session consumers. */ }
        }
      });
    };
  } catch {
    try { channel?.close(); } catch { /* Optional messaging cannot disable Web Locks. */ }
    channel = null;
  }

  async function runExclusive<T>(operation: (signal: AbortSignal) => Promise<T>, signal?: AbortSignal): Promise<T> {
    if (disposed || signal?.aborted) throw aborted();
    if (!supported || !locks) throw unavailable();
    if (controllers.size >= maximumPending) throw new PlatformApiError('busy',
      'Há muitas operações de sessão em espera. Aguarde antes de tentar novamente.',
      { code: 'AUTH_COORDINATION_BUSY' });
    const controller = new AbortController();
    controllers.add(controller);
    let acquired = false;
    let cancelTimeout = () => {};
    const cancellation = () => controller.signal.reason instanceof PlatformApiError ? controller.signal.reason : aborted();
    const cancel = () => controller.abort(aborted());
    let rejectWaiting = () => {};
    const cancelledWhileWaiting = new Promise<never>((_resolve, reject) => {
      rejectWaiting = () => { if (!acquired) reject(cancellation()); };
      controller.signal.addEventListener('abort', rejectWaiting, { once: true });
    });
    signal?.addEventListener('abort', cancel, { once: true });
    try {
      cancelTimeout = scheduleTimeout(() => controller.abort(new PlatformApiError('timeout',
        'A sessão está ocupada em outra aba. Consulte a sessão e tente novamente manualmente.',
        { code: 'AUTH_COORDINATION_TIMEOUT' })), lockTimeoutMs);
      const request = Promise.resolve().then(() => locks.request(namespace,
        { mode: 'exclusive', signal: controller.signal }, async lock => {
          if (disposed || controller.signal.aborted) throw cancellation();
          if (!lock) throw unavailable();
          acquired = true;
          cancelTimeout();
          const result = await operation(controller.signal);
          if (controller.signal.aborted) throw cancellation();
          return result;
        }));
      // Abort bounds waiting even if an unavailable implementation ignores its
      // signal. A late callback still checks cancellation before running work.
      return await Promise.race([request, cancelledWhileWaiting]) as T;
    } catch (error) {
      if (controller.signal.aborted) throw cancellation();
      if (acquired) throw error;
      throw unavailable();
    } finally {
      cancelTimeout();
      signal?.removeEventListener('abort', cancel);
      controller.signal.removeEventListener('abort', rejectWaiting);
      controllers.delete(controller);
    }
  }

  return {
    supported,
    runExclusive,
    publish(type) {
      if (disposed || !channel || !eventTypes.has(type)) return;
      try {
        const id = createId().toLowerCase();
        if (uuid.test(id)) channel.postMessage({ version: 1, id, source, type });
      } catch { /* A missed event is recovered by the next authoritative GET under lock. */ }
    },
    subscribe(listener) {
      if (disposed) return () => {};
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const controller of controllers) controller.abort(aborted());
      if (channel) {
        channel.onmessage = null;
        try { channel.close(); } catch { /* Closing an optional channel is best effort. */ }
      }
      channel = null;
      notifications.clear();
      seen.clear();
      listeners.clear();
    },
  };
}

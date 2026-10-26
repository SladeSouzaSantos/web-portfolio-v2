import { expect, test } from '@playwright/test';
import {
  createAuthCoordination,
  type AuthCoordinationChannel, type AuthCoordinationEvent, type AuthLockManager,
} from '../src/services/authCoordination';
import { PlatformApiError } from '../src/services/platformHttp';

const API = 'https://phase3-api.invalid';
let nextId = 0;
const identifier = () => `00000000-0000-4000-8000-${(++nextId).toString(16).padStart(12, '0')}`;
function deferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((complete, fail) => { resolve = complete; reject = fail; });
  return { promise, resolve, reject };
}
async function flush() { for (let step = 0; step < 12; step++) await Promise.resolve(); }

class Timers {
  private next = 0;
  readonly pending = new Map<number, { callback: () => void; delayMs: number }>();
  schedule = (callback: () => void, delayMs: number) => {
    const id = ++this.next;
    this.pending.set(id, { callback, delayMs });
    return () => { this.pending.delete(id); };
  };
  fire() {
    const timers = [...this.pending.values()];
    this.pending.clear();
    for (const timer of timers) timer.callback();
  }
}

interface PendingLock {
  signal: AbortSignal;
  callback: (lock: unknown) => Promise<unknown>;
  resolve(value: unknown): void;
  reject(error: unknown): void;
  cancel(): void;
}
/** A deterministic model of the browser's exclusive queue, not a production fallback. */
class Locks implements AuthLockManager {
  private readonly queues = new Map<string, PendingLock[]>();
  readonly held = new Set<string>();
  readonly requests: Array<{ name: string; signal: AbortSignal }> = [];
  request(name: string, options: { mode: 'exclusive'; signal: AbortSignal }, callback: (lock: unknown) => Promise<unknown>) {
    expect(options.mode).toBe('exclusive');
    this.requests.push({ name, signal: options.signal });
    return new Promise<unknown>((resolve, reject) => {
      const entry: PendingLock = { signal: options.signal, callback, resolve, reject, cancel: () => {} };
      entry.cancel = () => {
        this.queues.set(name, (this.queues.get(name) ?? []).filter(pending => pending !== entry));
        reject(options.signal.reason);
      };
      if (options.signal.aborted) { entry.cancel(); return; }
      options.signal.addEventListener('abort', entry.cancel, { once: true });
      this.queues.set(name, [...this.queues.get(name) ?? [], entry]);
      this.grant(name);
    });
  }
  private grant(name: string) {
    if (this.held.has(name)) return;
    const entry = this.queues.get(name)?.shift();
    if (!entry) return;
    this.held.add(name);
    entry.signal.removeEventListener('abort', entry.cancel);
    const task = Promise.resolve().then(() => entry.callback({ name, mode: 'exclusive' }));
    const release = () => { this.held.delete(name); this.grant(name); };
    void task.then(value => { release(); entry.resolve(value); }, error => { release(); entry.reject(error); });
  }
}

class Channel implements AuthCoordinationChannel {
  onmessage: ((event: MessageEvent<unknown>) => unknown) | null = null;
  closed = 0;
  constructor(readonly name: string, private readonly bus: Channels) {}
  postMessage(message: AuthCoordinationEvent) {
    if (this.closed) throw new DOMException('closed', 'InvalidStateError');
    this.bus.messages.push({ name: this.name, message: structuredClone(message) });
    for (const peer of this.bus.channels) {
      if (peer !== this && !peer.closed && peer.name === this.name) peer.receive(structuredClone(message));
    }
  }
  receive(data: unknown) { this.onmessage?.({ data } as MessageEvent<unknown>); }
  close() { this.closed++; }
}
class Channels {
  readonly channels: Channel[] = [];
  readonly messages: Array<{ name: string; message: AuthCoordinationEvent }> = [];
  open = (name: string) => {
    const channel = new Channel(name, this);
    this.channels.push(channel);
    return channel;
  };
}
function coordinator(locks: AuthLockManager | null, timers = new Timers(), channels?: Channels, baseUrl = API) {
  return createAuthCoordination(baseUrl, { locks, scheduleTimeout: timers.schedule,
    channelFactory: channels?.open ?? null, createId: identifier });
}
function wire(type: AuthCoordinationEvent['type'] = 'session-changed'): AuthCoordinationEvent {
  return { version: 1, id: identifier(), source: identifier(), type };
}

test('two tabs share a canonical API lock while a different API remains independent', async () => {
  const locks = new Locks();
  const first = coordinator(locks);
  const second = coordinator(locks, undefined, undefined, 'https://PHASE3-API.invalid:443/');
  const other = coordinator(locks, undefined, undefined, 'https://another-api.invalid');
  const gate = deferred();
  const order: string[] = [];
  const owner = first.runExclusive(async () => { order.push('first'); await gate.promise; order.push('first-finished'); return 10; });
  const waiter = second.runExclusive(async () => { order.push('second'); return 20; });
  const independent = other.runExclusive(async () => { order.push('other-api'); return 30; });
  await flush();
  expect(order).toEqual(['first', 'other-api']);
  expect(locks.requests[0].name).toBe(locks.requests[1].name);
  expect(locks.requests[0].name).not.toBe(locks.requests[2].name);
  gate.resolve();
  expect(await Promise.all([owner, waiter, independent])).toEqual([10, 20, 30]);
  expect(order).toEqual(['first', 'other-api', 'first-finished', 'second']);
  for (const value of [first, second, other]) value.dispose();
});

test('an operation failure releases the real lock and preserves the original operation error', async () => {
  const locks = new Locks();
  const first = coordinator(locks);
  const second = coordinator(locks);
  const failure = new PlatformApiError('network', 'Resultado incerto.');
  const rejected = first.runExclusive(async () => { throw failure; });
  const accepted = second.runExclusive(async () => 'next');
  await expect(rejected).rejects.toBe(failure);
  await expect(accepted).resolves.toBe('next');
  expect(locks.held.size).toBe(0);
  first.dispose(); second.dispose();
});

test('acquisition timeout never executes work outside the lock and does not cancel its owner', async () => {
  const locks = new Locks();
  const timers = new Timers();
  const first = coordinator(locks);
  const second = coordinator(locks, timers);
  const gate = deferred();
  let runs = 0;
  let ownerSignal: AbortSignal | undefined;
  const owner = first.runExclusive(async signal => { ownerSignal = signal; await gate.promise; });
  const waiter = second.runExclusive(async () => { runs++; });
  const failure = expect(waiter).rejects.toMatchObject({ kind: 'timeout', code: 'AUTH_COORDINATION_TIMEOUT' });
  await flush();
  expect([...timers.pending.values()].map(timer => timer.delayMs)).toEqual([10_000]);
  timers.fire();
  await failure;
  expect(runs).toBe(0);
  expect(ownerSignal?.aborted).toBe(false);
  gate.resolve(); await owner;
  await flush();
  expect(runs).toBe(0);
  first.dispose(); second.dispose();
});

test('a broken lock implementation cannot run a late callback after acquisition timed out', async () => {
  const timers = new Timers();
  const request = deferred<unknown>();
  let grant!: (lock: unknown) => Promise<unknown>;
  const locks: AuthLockManager = { request: (_name, _options, callback) => { grant = callback; return request.promise; } };
  const client = coordinator(locks, timers);
  let runs = 0;
  const operation = client.runExclusive(async () => { runs++; });
  const failure = expect(operation).rejects.toMatchObject({ code: 'AUTH_COORDINATION_TIMEOUT' });
  await flush(); timers.fire(); await failure;
  await expect(grant({})).rejects.toMatchObject({ code: 'AUTH_COORDINATION_TIMEOUT' });
  request.resolve(undefined);
  expect(runs).toBe(0);
  client.dispose();
});

test('the acquisition timer is removed on grant and never releases an operation still in progress', async () => {
  const locks = new Locks();
  const timers = new Timers();
  const first = coordinator(locks, timers);
  const second = coordinator(locks);
  const gate = deferred();
  let secondRuns = 0;
  let firstSignal: AbortSignal | undefined;
  const owner = first.runExclusive(async signal => { firstSignal = signal; await gate.promise; });
  const waiter = second.runExclusive(async () => { secondRuns++; });
  await flush();
  expect(timers.pending.size).toBe(0);
  timers.fire(); await flush();
  expect(firstSignal?.aborted).toBe(false);
  expect(secondRuns).toBe(0);
  gate.resolve(); await Promise.all([owner, waiter]);
  expect(secondRuns).toBe(1);
  first.dispose(); second.dispose();
});

for (const cancellation of ['abort', 'dispose'] as const) {
  test(`${cancellation} of a running operation propagates its signal but retains exclusivity until settlement`, async () => {
    const locks = new Locks();
    const first = coordinator(locks);
    const second = coordinator(locks);
    const gate = deferred();
    const controller = new AbortController();
    let signal: AbortSignal | undefined;
    let settled = false;
    let nextRuns = 0;
    const owner = first.runExclusive(async received => { signal = received; await gate.promise; }, controller.signal);
    const failure = expect(owner).rejects.toMatchObject({ code: 'AUTH_COORDINATION_ABORTED' }).then(() => { settled = true; });
    const waiter = second.runExclusive(async () => { nextRuns++; });
    await flush();
    if (cancellation === 'abort') controller.abort(); else first.dispose();
    await flush();
    expect(signal?.aborted).toBe(true);
    expect(settled).toBe(false);
    expect(nextRuns).toBe(0);
    gate.resolve(); await Promise.all([failure, waiter]);
    expect(nextRuns).toBe(1);
    first.dispose(); second.dispose();
  });
}

test('disposal removes all pending requests without releasing another tab owner', async () => {
  const locks = new Locks();
  const first = coordinator(locks);
  const second = coordinator(locks);
  const gate = deferred();
  const owner = first.runExclusive(async () => { await gate.promise; });
  let runs = 0;
  const pending = [second.runExclusive(async () => { runs++; }), second.runExclusive(async () => { runs++; })];
  const failures = pending.map(request => expect(request).rejects.toMatchObject({ code: 'AUTH_COORDINATION_ABORTED' }));
  await flush(); second.dispose(); await Promise.all(failures);
  expect(locks.requests.slice(1).every(request => request.signal.aborted)).toBe(true);
  expect(locks.held.size).toBe(1);
  gate.resolve(); await owner;
  expect(runs).toBe(0);
  await expect(second.runExclusive(async () => { runs++; })).rejects.toMatchObject({ kind: 'aborted' });
  first.dispose();
});

test('pre-aborted intent never asks for a lock or executes an operation', async () => {
  const locks = new Locks();
  const client = coordinator(locks);
  const controller = new AbortController(); controller.abort();
  let runs = 0;
  await expect(client.runExclusive(async () => { runs++; }, controller.signal)).rejects.toMatchObject({ kind: 'aborted' });
  expect(locks.requests).toHaveLength(0);
  expect(runs).toBe(0);
  client.dispose();
});

test('without Web Locks even a working channel cannot authorize protected work', async () => {
  const client = coordinator(null, undefined, new Channels());
  let runs = 0;
  expect(client.supported).toBe(false);
  await expect(client.runExclusive(async () => { runs++; })).rejects.toMatchObject({
    kind: 'busy', code: 'AUTH_COORDINATION_UNAVAILABLE',
  });
  expect(runs).toBe(0);
  client.dispose();
});

test('a rejected or unavailable browser lock fails closed without operation fallback', async () => {
  for (const request of [
    () => { throw new DOMException('denied', 'SecurityError'); },
    async () => { throw new DOMException('unsupported', 'NotSupportedError'); },
    async (_name: string, _options: unknown, callback: (lock: unknown) => Promise<unknown>) => callback(null),
  ]) {
    const client = coordinator({ request });
    let runs = 0;
    await expect(client.runExclusive(async () => { runs++; })).rejects.toMatchObject({ code: 'AUTH_COORDINATION_UNAVAILABLE' });
    expect(runs).toBe(0);
    client.dispose();
  }
});

test('pending work has a finite queue and disposal clears its timers and requests', async () => {
  const timers = new Timers();
  const locks: AuthLockManager = { request: async () => new Promise(() => {}) };
  const client = coordinator(locks, timers);
  let runs = 0;
  const results = Array.from({ length: 40 }, () => client.runExclusive(async () => { runs++; }).catch(error => error as PlatformApiError));
  await flush();
  expect(timers.pending.size).toBeGreaterThan(0);
  expect(timers.pending.size).toBeLessThan(40);
  client.dispose();
  const failures = await Promise.all(results);
  expect(failures.some(error => error?.code === 'AUTH_COORDINATION_BUSY')).toBe(true);
  expect(failures.every(error => ['AUTH_COORDINATION_BUSY', 'AUTH_COORDINATION_ABORTED'].includes(error?.code ?? ''))).toBe(true);
  expect(timers.pending.size).toBe(0);
  expect(runs).toBe(0);
});

test('notification wire contains only allowlisted non-secret metadata and never echoes locally', async () => {
  const channels = new Channels();
  const first = coordinator(new Locks(), undefined, channels);
  const second = coordinator(new Locks(), undefined, channels);
  const other = coordinator(new Locks(), undefined, channels, 'https://other-api.invalid');
  const firstEvents: AuthCoordinationEvent[] = [];
  const secondEvents: AuthCoordinationEvent[] = [];
  const otherEvents: AuthCoordinationEvent[] = [];
  first.subscribe(event => firstEvents.push(event)); second.subscribe(event => secondEvents.push(event));
  other.subscribe(event => otherEvents.push(event));
  first.publish('session-changed'); await flush();
  expect(channels.messages).toHaveLength(1);
  const { name, message } = channels.messages[0];
  expect(name).toBe(`phasscode-auth:v1:${API}`);
  expect(Object.keys(message).sort()).toEqual(['id', 'source', 'type', 'version']);
  expect(message).toEqual({ version: 1, id: expect.stringMatching(/^[\da-f-]{36}$/),
    source: expect.stringMatching(/^[\da-f-]{36}$/), type: 'session-changed' });
  expect(firstEvents).toEqual([]);
  expect(secondEvents).toEqual([message]);
  expect(otherEvents).toEqual([]);
  channels.channels[0].receive(message); await flush();
  expect(firstEvents).toEqual([]);
  first.publish({ type: 'session-changed', csrfToken: 'private' } as unknown as AuthCoordinationEvent['type']);
  expect(channels.messages).toHaveLength(1);
  first.dispose(); second.dispose(); other.dispose();
});

test('malformed, extended, duplicate and self-authored events do not trigger subscribers', async () => {
  const channels = new Channels();
  const client = coordinator(new Locks(), undefined, channels);
  const events: AuthCoordinationEvent[] = [];
  client.subscribe(event => events.push(event));
  const valid = wire();
  for (const value of [null, [], 'session-changed', {}, { ...valid, version: 2 }, { ...valid, csrfToken: 'private' },
    { ...valid, type: 'refresh-now' }, { ...valid, id: 'invalid' }, { ...valid, source: 'invalid' },
    Object.create(valid), { ...valid, type: ['session-changed'] }]) channels.channels[0].receive(value);
  channels.channels[0].receive({ get version() { throw new Error('untrusted getter'); }, id: valid.id, source: valid.source, type: valid.type });
  await flush(); expect(events).toEqual([]);
  channels.channels[0].receive(valid); channels.channels[0].receive(valid);
  channels.channels[0].receive({ ...valid, id: valid.id.toUpperCase(), source: valid.source.toUpperCase() });
  await flush(); expect(events).toEqual([valid]);
  expect(Object.isFrozen(events[0])).toBe(true);
  client.dispose();
});

test('notification bursts coalesce by event type and preserve the order of their latest occurrence', async () => {
  const channels = new Channels();
  const client = coordinator(new Locks(), undefined, channels);
  const events: AuthCoordinationEvent[] = [];
  client.subscribe(event => events.push(event));
  for (let index = 0; index < 1_000; index++) channels.channels[0].receive(wire());
  const logout = wire('logout-confirmed'); const revoked = wire('session-invalidated'); const changed = wire();
  channels.channels[0].receive(logout); channels.channels[0].receive(revoked); channels.channels[0].receive(changed);
  await flush();
  expect(events).toEqual([logout, revoked, changed]);
  client.dispose();
});

test('deduplication retains only bounded history while all notifications remain advisory', async () => {
  const channels = new Channels();
  const client = coordinator(new Locks(), undefined, channels);
  const events: AuthCoordinationEvent[] = [];
  client.subscribe(event => events.push(event));
  const first = wire(); channels.channels[0].receive(first); await flush();
  for (let index = 0; index < 1_000; index++) channels.channels[0].receive(wire());
  await flush();
  channels.channels[0].receive(first); await flush();
  expect(events[0]).toEqual(first);
  expect(events.at(-1)).toEqual(first);
  expect(events).toHaveLength(3);
  client.dispose();
});

test('optional messaging failures do not disable the exclusive lock or hide operation results', async () => {
  for (const channelFactory of [
    null,
    () => { throw new DOMException('unavailable', 'SecurityError'); },
    (): AuthCoordinationChannel => ({ onmessage: null, postMessage() { throw new Error('closed'); }, close() { throw new Error('closed'); } }),
  ]) {
    const client = createAuthCoordination(API, { locks: new Locks(), channelFactory, createId: identifier });
    expect(client.supported).toBe(true);
    await expect(client.runExclusive(async () => { client.publish('session-changed'); return 'confirmed'; })).resolves.toBe('confirmed');
    expect(() => client.dispose()).not.toThrow();
  }
});

test('unsubscribe and disposal suppress queued notifications and close the channel exactly once', async () => {
  const channels = new Channels();
  const client = coordinator(new Locks(), undefined, channels);
  const events: AuthCoordinationEvent[] = [];
  const unsubscribe = client.subscribe(event => events.push(event));
  unsubscribe(); channels.channels[0].receive(wire()); await flush();
  expect(events).toEqual([]);
  client.subscribe(event => events.push(event));
  channels.channels[0].receive(wire()); client.dispose(); client.dispose(); await flush();
  expect(events).toEqual([]);
  expect(channels.channels[0].closed).toBe(1);
  client.publish('logout-confirmed');
  expect(channels.messages).toEqual([]);
});

test('a failing notification listener cannot prevent other subscribers from revalidating', async () => {
  const channels = new Channels();
  const client = coordinator(new Locks(), undefined, channels);
  const events: AuthCoordinationEvent[] = [];
  client.subscribe(() => { throw new Error('isolated subscriber'); });
  client.subscribe(event => events.push(event));
  const logout = wire('logout-confirmed'); channels.channels[0].receive(logout); await flush();
  expect(events).toEqual([logout]);
  client.dispose();
});

test('Node defaults never open the global BroadcastChannel or invent a local lock', async () => {
  expect(typeof window).toBe('undefined');
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'BroadcastChannel');
  let opened = 0;
  Object.defineProperty(globalThis, 'BroadcastChannel', { configurable: true, value: class { constructor() { opened++; } } });
  try {
    const client = createAuthCoordination(API, { createId: identifier });
    expect(client.supported).toBe(false);
    await expect(client.runExclusive(async () => 'unsafe')).rejects.toMatchObject({ code: 'AUTH_COORDINATION_UNAVAILABLE' });
    expect(opened).toBe(0);
    client.dispose();
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'BroadcastChannel', descriptor);
    else Reflect.deleteProperty(globalThis, 'BroadcastChannel');
  }
});

test('invalid namespaces and unbounded acquisition deadlines are rejected before opening a channel', () => {
  const channels = new Channels();
  for (const baseUrl of ['/relative', 'ftp://example.test', 'https://user:secret@example.test',
    'https://example.test?', 'https://example.test#', 'https://example.test?token=private']) {
    expect(() => createAuthCoordination(baseUrl, { channelFactory: channels.open })).toThrow(PlatformApiError);
  }
  for (const lockTimeoutMs of [0, -1, 60_001, Infinity, NaN, 0.5]) {
    expect(() => createAuthCoordination(API, { lockTimeoutMs, channelFactory: channels.open })).toThrow(PlatformApiError);
  }
  expect(channels.channels).toEqual([]);
});

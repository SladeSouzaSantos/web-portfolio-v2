import type { ChatSource } from '../types/orbe';

export interface CachedOrbeMessage {
  id: number;
  sender: 'orb' | 'user';
  text: string;
  sources?: ChatSource[];
  simulated?: boolean;
}

/** The public transcript contains no conversation ID, token, credentials or cookies. */
const KEY = 'phasscode:orbe:transcript:v1';
export const MAX_ORBE_USER_TURNS = 20;
export const TRANSCRIPT_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_CACHE_BYTES = 256_000;

export function restoreOrbeTranscript(): CachedOrbeMessage[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw || raw.length > MAX_CACHE_BYTES) return [];
    const state: unknown = JSON.parse(raw);
    if (!state || typeof state !== 'object' || !('expiresAt' in state) || !('messages' in state)) return [];
    const { expiresAt, messages } = state as { expiresAt: unknown; messages: unknown };
    if (typeof expiresAt !== 'number' || Date.now() >= expiresAt || !Array.isArray(messages) || messages.length > 41) {
      clearOrbeTranscript();
      return [];
    }
    if (!messages.every((m): m is CachedOrbeMessage =>
      m !== null && typeof m === 'object'
      && Number.isSafeInteger(m.id) && m.id >= 0
      && (m.sender === 'orb' || m.sender === 'user')
      && typeof m.text === 'string' && m.text.length <= 8000
      // No remote sources or other fields are trusted from browser storage.
      && Object.keys(m).every(key => ['id', 'sender', 'text', 'simulated'].includes(key))
      && (m.simulated === undefined || typeof m.simulated === 'boolean')
    )) return [];
    if (messages.filter(m => m.sender === 'user').length > MAX_ORBE_USER_TURNS) return [];
    return messages;
  } catch { return []; }
}

export function saveOrbeTranscript(messages: CachedOrbeMessage[]) {
  try {
    if (messages.length <= 1) { clearOrbeTranscript(); return; }
    const safe = messages.map(({ id, sender, text, simulated }) => ({
      id, sender, text, ...(simulated && { simulated: true }),
    }));
    // Rolling cache is intentionally short-lived, bounded, and without session credentials.
    const prior = localStorage.getItem(KEY);
    let expiresAt = Date.now() + TRANSCRIPT_TTL_MS;
    if (prior) {
      try {
        const old: unknown = JSON.parse(prior);
        if (old && typeof old === 'object' && 'expiresAt' in old &&
          typeof old.expiresAt === 'number' && old.expiresAt > Date.now()) expiresAt = old.expiresAt;
      } catch { /* Expired or corrupted cache is overwritten. */ }
    }
    const serialized = JSON.stringify({ expiresAt, messages: safe });
    if (serialized.length <= MAX_CACHE_BYTES) localStorage.setItem(KEY, serialized);
  } catch { /* Storage can be unavailable or full; chat remains functional in memory. */ }
}

export function clearOrbeTranscript() {
  try { localStorage.removeItem(KEY); } catch { /* Storage can be blocked. */ }
}

export function copyOrbeTranscript(messages: CachedOrbeMessage[]): string {
  return messages.map(({ sender, text }) =>
    `[${sender === 'orb' ? 'ORBE' : 'VOCÊ'}]: ${text}`
  ).join('\n\n');
}

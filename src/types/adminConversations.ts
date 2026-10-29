import { isIsoDateTime, isRecord, isUuid, PlatformApiError } from '../services/platformHttp';

export type ConversationIntent = 'unknown' | 'curiosity' | 'technical' | 'opportunity' | 'business' | 'meeting';
export interface ConversationInsightItem {
  id: string;
  intent: ConversationIntent;
  summary: string;
  topics: string[];
  turns: number;
  createdAt: string;
  updatedAt: string;
}
export interface AdminConversationInsights {
  retentionDays: number;
  generatedAt: string;
  totals: { conversations: number; questions: number };
  intents: { name: string; total: number }[];
  topics: { name: string; total: number }[];
  items: ConversationInsightItem[];
  nextOffset: number | null;
}

const intents: ConversationIntent[] = ['unknown', 'curiosity', 'technical', 'opportunity', 'business', 'meeting'];
const natural = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
const date = (value: unknown): value is string => isIsoDateTime(value) && value.endsWith('Z');
const fail = (): never => { throw new PlatformApiError('protocol', 'O serviço retornou indicadores inválidos.'); };

function parseCounts(input: unknown): { name: string; total: number }[] {
  if (!Array.isArray(input) || input.length > 12) return fail();
  return input.map(value => {
    if (!isRecord(value) || typeof value.name !== 'string' || value.name.length > 80 || !natural(value.total))
      return fail();
    return { name: value.name, total: value.total };
  });
}

export function parseAdminConversationInsights(value: unknown): AdminConversationInsights {
  if (!isRecord(value) || !natural(value.retentionDays) || value.retentionDays < 1 ||
    value.retentionDays > 3650 || !date(value.generatedAt) || !isRecord(value.totals) ||
    !natural(value.totals.conversations) || !natural(value.totals.questions) ||
    !(value.nextOffset === null || (natural(value.nextOffset) && value.nextOffset <= 10025)) ||
    !Array.isArray(value.items) || value.items.length > 25) return fail();
  const items: ConversationInsightItem[] = value.items.map(item => {
    if (!isRecord(item) || !isUuid(item.id) || !intents.includes(item.intent as ConversationIntent) ||
        typeof item.summary !== 'string' || item.summary.length > 300 ||
        !Array.isArray(item.topics) || item.topics.length > 8 ||
        !item.topics.every(topic => typeof topic === 'string' && topic.length <= 80) ||
        !natural(item.turns) || item.turns < 1 || !date(item.createdAt) || !date(item.updatedAt)) return fail();
    return {
      id: item.id, intent: item.intent as ConversationIntent, summary: item.summary,
      topics: [...item.topics], turns: item.turns, createdAt: item.createdAt, updatedAt: item.updatedAt,
    };
  });
  return {
    retentionDays: value.retentionDays, generatedAt: value.generatedAt,
    totals: { conversations: value.totals.conversations, questions: value.totals.questions },
    intents: parseCounts(value.intents),
    topics: parseCounts(value.topics),
    items,
    nextOffset: value.nextOffset as number | null,
  };
}

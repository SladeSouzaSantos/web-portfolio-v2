import { expect, test } from '@playwright/test';
import { parseAdminConversationInsights } from '../src/types/adminConversations';
import { createAdminConversationClient } from '../src/services/adminConversationClient';
import type { AuthClient } from '../src/services/authClient';

const id = '10f49dd5-2c11-4f59-9410-29d833c63510';
const fixture = {
  retentionDays: 7,
  generatedAt: '2026-10-28T15:00:00.000Z',
  totals: { conversations: 1, questions: 2 },
  intents: [{ name: 'meeting', total: 1 }],
  topics: [{ name: 'Agendamento', total: 1 }],
  items: [{
    id, intent: 'meeting', summary: 'Assuntos identificados: Agendamento. Intenção provável: agendamento.',
    topics: ['Agendamento'], turns: 2,
    createdAt: '2026-10-28T14:00:00.000Z', updatedAt: '2026-10-28T15:00:00.000Z',
  }],
  nextOffset: null,
};

test('decodifica indicadores administrativos estritos', () => {
  const parsed = parseAdminConversationInsights(fixture);
  expect(parsed.totals).toEqual({ conversations: 1, questions: 2 });
  expect(parsed.items[0]?.intent).toBe('meeting');
});

test('recusa dados incorretos, incluindo resumos excessivos', () => {
  expect(() => parseAdminConversationInsights({ ...fixture, items: [{ ...fixture.items[0], summary: 'x'.repeat(301) }] })).toThrow();
  expect(() => parseAdminConversationInsights({ ...fixture, totals: { conversations: -1, questions: 2 } })).toThrow();
});

test('cliente usa autenticação existente e paginação controlada', async () => {
  const called: string[] = [];
  const auth = {
    request: async (path: string, _options: unknown, parse: (value: unknown) => unknown) => {
      called.push(path);
      return parse(fixture);
    },
  } as unknown as AuthClient;
  const api = createAdminConversationClient(auth);
  const result = await api.list({ offset: 25 });
  expect(called).toEqual(['/api/v1/admin/conversations?limit=25&offset=25']);
  expect(result.items).toHaveLength(1);
});

import type { AuthClient } from './authClient';
import { parseAdminConversationInsights } from '../types/adminConversations';

export function createAdminConversationClient(auth: AuthClient) {
  return {
    list({ offset = 0, signal }: { offset?: number; signal?: AbortSignal } = {}) {
      const query = new URLSearchParams({ limit: '25', offset: String(offset) });
      return auth.request(
        '/api/v1/admin/conversations?' + query,
        { signal },
        parseAdminConversationInsights,
      );
    },
  };
}

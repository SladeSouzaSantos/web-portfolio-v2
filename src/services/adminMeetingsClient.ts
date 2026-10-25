import type { AuthClient } from './authClient';
import { parseAdminMeetingList, parseMeetingStatusResponse } from '../types/meetings';
import type { MeetingStatus } from '../types/meetings';

export type MeetingDecision = 'approve' | 'reject' | 'cancel';

/** Uses the same cookie/CSRF coordinator as the session provider. */
export function createAdminMeetingsClient(auth: AuthClient) {
  return {
    list({ cursor, status, signal }: { cursor?: string; status?: MeetingStatus; signal?: AbortSignal } = {}) {
      const query = new URLSearchParams({ limit: '25' });
      if (cursor) query.set('cursor', cursor);
      if (status) query.set('status', status);
      return auth.request(`/api/v1/admin/meetings?${query}`, { signal }, parseAdminMeetingList);
    },
    decide(id: string, decision: MeetingDecision, signal?: AbortSignal) {
      return auth.request(`/api/v1/admin/meetings/${encodeURIComponent(id)}/${decision}`,
        { method: 'POST', signal }, parseMeetingStatusResponse);
    },
  };
}

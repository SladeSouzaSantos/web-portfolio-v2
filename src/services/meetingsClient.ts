import { createPlatformHttp, isIsoDateTime, isUuid, PlatformApiError, type PlatformHttpOptions, type PlatformHttp } from './platformHttp';
import {
  isMeetingToken, parseMeetingAvailability, parseMeetingProposal, parseMeetingProposalInput,
  parseMeetingRequestInput, parseMeetingRequestResponse, parseMeetingStatusResponse,
  type MeetingAvailability, type MeetingProposal, type MeetingProposalInput,
  type MeetingRequestInput, type MeetingRequestResponse, type MeetingStatusResponse,
} from '../types/meetings';

export interface MeetingCallOptions { signal?: AbortSignal }
export interface MeetingsClient {
  availability(from: string, to: string, options?: MeetingCallOptions): Promise<MeetingAvailability>;
  prepareProposal(input: MeetingProposalInput, options?: MeetingCallOptions): Promise<MeetingProposal>;
  confirmRequest(input: MeetingRequestInput, idempotencyKey: string, options?: MeetingCallOptions): Promise<MeetingRequestResponse>;
  status(id: string, token: string, options?: MeetingCallOptions): Promise<MeetingStatusResponse>;
}
export function createMeetingsClient(baseUrl: string, options: PlatformHttpOptions & { http?: PlatformHttp } = {}): MeetingsClient {
  const http = options.http ?? createPlatformHttp(baseUrl, options);
  return {
    availability(from, to, { signal } = {}) {
      const start = Date.parse(from);
      const end = Date.parse(to);
      if (!isIsoDateTime(from) || !isIsoDateTime(to) || !Number.isFinite(start) || !Number.isFinite(end)
        || end <= start || end - start > 7 * 24 * 60 * 60 * 1000) {
        return Promise.reject(new PlatformApiError('validation', 'Escolha um período de até sete dias para consultar a agenda.'));
      }
      return http.request(`/api/v1/meetings/availability?${new URLSearchParams({ from, to })}`, { signal }, parseMeetingAvailability);
    },
    prepareProposal(input, { signal } = {}) {
      let body: MeetingProposalInput;
      try { body = parseMeetingProposalInput({ start: input.start, name: input.name.trim(), email: input.email, topic: input.topic.trim() }); }
      catch { return Promise.reject(new PlatformApiError('validation', 'Revise nome, e-mail, assunto e horário antes de continuar.')); }
      return http.request('/api/v1/meetings/proposals', { method: 'POST', body, signal }, parseMeetingProposal);
    },
    confirmRequest(input, idempotencyKey, { signal } = {}) {
      let body: MeetingRequestInput;
      try { body = parseMeetingRequestInput(input); }
      catch { return Promise.reject(new PlatformApiError('validation', 'A proposta ou seu consentimento não são válidos. Prepare uma nova proposta.')); }
      if (!/^[A-Za-z0-9:_-]{8,128}$/.test(idempotencyKey)) {
        return Promise.reject(new PlatformApiError('validation', 'Não foi possível identificar esta confirmação.'));
      }
      return http.request('/api/v1/meetings/requests', {
        method: 'POST', body, headers: { 'Idempotency-Key': idempotencyKey }, signal,
      }, parseMeetingRequestResponse);
    },
    status(id, token, { signal } = {}) {
      if (!isUuid(id) || !isMeetingToken(token)) {
        return Promise.reject(new PlatformApiError('validation', 'O acesso privado à solicitação não está disponível.'));
      }
      return http.request(`/api/v1/meetings/requests/${encodeURIComponent(id)}/status`, {
        headers: { 'X-Meeting-Token': token }, signal,
      }, parseMeetingStatusResponse);
    },
  };
}

export interface MeetingConfirmationAttempt {
  readonly input: Readonly<MeetingRequestInput>;
  readonly idempotencyKey: string;
  result?: MeetingRequestResponse;
}
/** Private per-app ledger: modal unmounts must not manufacture new confirmation keys. */
export function createMeetingConfirmationStore(client: MeetingsClient, uuid: () => string = () => crypto.randomUUID()) {
  const attempts = new Map<string, MeetingConfirmationAttempt>();
  const active = new Set<string>();
  return {
    get(proposalId: string) { return attempts.get(proposalId); },
    updateStatus(status: MeetingStatusResponse) {
      for (const attempt of attempts.values()) {
        if (attempt.result?.id === status.id) attempt.result = { ...attempt.result, ...status };
      }
    },
    async confirm(proposal: MeetingProposal, options: MeetingCallOptions = {}): Promise<MeetingRequestResponse> {
      const existing = attempts.get(proposal.proposalId);
      if (existing?.result) return existing.result;
      if (active.has(proposal.proposalId)) throw new PlatformApiError('busy', 'Esta confirmação já está em processamento.');
      const attempt = existing ?? {
        input: Object.freeze(parseMeetingRequestInput({ proposalId: proposal.proposalId,
          confirmationToken: proposal.confirmationToken, consent: true, consentVersion: proposal.consentVersion })),
        idempotencyKey: uuid(),
      };
      attempts.set(proposal.proposalId, attempt);
      active.add(proposal.proposalId);
      try {
        const result = await client.confirmRequest(attempt.input, attempt.idempotencyKey, options);
        attempt.result = result;
        return result;
      } finally { active.delete(proposal.proposalId); }
    },
  };
}

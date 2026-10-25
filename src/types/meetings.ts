import { isIsoDateTime, isRecord, isUuid, PlatformApiError } from '../services/platformHttp';

export const MEETING_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'CONFIRMED', 'CANCELLED', 'FAILED'] as const;
export type MeetingStatus = typeof MEETING_STATUSES[number];
export interface MeetingSlot { start: string; end: string }
export interface MeetingAvailability {
  timeZone: string;
  durationMinutes: number;
  simulated: boolean;
  slots: MeetingSlot[];
}
export interface MeetingProposalInput { start: string; name: string; email: string; topic: string }
export interface MeetingSummary extends MeetingProposalInput { end: string; timeZone: string }
export interface MeetingProposal {
  proposalId: string;
  confirmationToken: string;
  expiresAt: string;
  summary: MeetingSummary;
  consentVersion: string;
  simulated: boolean;
}
export interface MeetingRequestInput {
  proposalId: string;
  confirmationToken: string;
  consent: true;
  consentVersion: string;
}
export interface MeetingStatusResponse extends MeetingSlot {
  id: string;
  status: MeetingStatus;
  timeZone: string;
  updatedAt: string;
}
export interface MeetingRequestResponse extends MeetingStatusResponse { meetingToken: string }
export interface AdminMeetingItem extends MeetingStatusResponse {
  name: string;
  email: string;
  topic: string;
  createdAt: string;
  version: number;
  failureCode: string | null;
}
export interface AdminMeetingList { items: AdminMeetingItem[]; nextCursor: string | null }
export interface AdminMeetingQuery { cursor?: string; limit?: number; status?: MeetingStatus }
export type MeetingAdminItem = AdminMeetingItem;
export type MeetingAdminList = AdminMeetingList;

const PRIVATE_TOKEN = /^[A-Za-z0-9_-]{43}$/;
const EMAIL = /^(?:[A-Za-z0-9_'+\-]+\.)*[A-Za-z0-9_'+\-]*[A-Za-z0-9_+-]@(?:[A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$/;
function text(value: unknown, min = 0, max = Infinity): value is string {
  return typeof value === 'string' && value.length >= min && value.length <= max;
}
function invalid(): never {
  throw new PlatformApiError('protocol', 'A agenda retornou uma resposta inválida. Atualize as informações antes de continuar.');
}
function object(value: unknown, keys: string[]): Record<string, unknown> {
  if (!isRecord(value) || Object.keys(value).some(key => !keys.includes(key))) invalid();
  return value;
}
function instant(value: unknown): value is string {
  if (!isIsoDateTime(value)) return false;
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return month >= 1 && month <= 12 && day >= 1 && day <= days;
}
export function isMeetingToken(value: unknown): value is string {
  return typeof value === 'string' && PRIVATE_TOKEN.test(value);
}
export function isMeetingStatus(value: unknown): value is MeetingStatus {
  return typeof value === 'string' && MEETING_STATUSES.includes(value as MeetingStatus);
}
export function parseMeetingProposalInput(value: unknown): MeetingProposalInput {
  const data = object(value, ['start', 'name', 'email', 'topic']);
  if (!instant(data.start) || !text(data.name, 2, 120) || !text(data.email, 1, 254)
    || !EMAIL.test(data.email) || !text(data.topic, 3, 1000)) invalid();
  return { start: data.start, name: data.name, email: data.email, topic: data.topic };
}
function parseSummary(value: unknown): MeetingSummary {
  const data = object(value, ['start', 'end', 'name', 'email', 'topic', 'timeZone']);
  const input = parseMeetingProposalInput({ start: data.start, name: data.name, email: data.email, topic: data.topic });
  if (!instant(data.end) || !text(data.timeZone)) invalid();
  return { ...input, end: data.end, timeZone: data.timeZone };
}
export function parseMeetingProposal(value: unknown): MeetingProposal {
  const data = object(value, ['proposalId', 'confirmationToken', 'expiresAt', 'summary', 'consentVersion', 'simulated']);
  if (!isUuid(data.proposalId) || !isMeetingToken(data.confirmationToken) || !instant(data.expiresAt)
    || !text(data.consentVersion, 1) || typeof data.simulated !== 'boolean') invalid();
  return {
    proposalId: data.proposalId, confirmationToken: data.confirmationToken, expiresAt: data.expiresAt,
    summary: parseSummary(data.summary), consentVersion: data.consentVersion, simulated: data.simulated,
  };
}
export function parseMeetingRequestInput(value: unknown): MeetingRequestInput {
  const data = object(value, ['proposalId', 'confirmationToken', 'consent', 'consentVersion']);
  if (!isUuid(data.proposalId) || !isMeetingToken(data.confirmationToken) || data.consent !== true
    || !text(data.consentVersion, 1, 80)) invalid();
  return { proposalId: data.proposalId, confirmationToken: data.confirmationToken, consent: true, consentVersion: data.consentVersion };
}
function statusFields(data: Record<string, unknown>): MeetingStatusResponse {
  if (!isUuid(data.id) || !isMeetingStatus(data.status) || !instant(data.start) || !instant(data.end)
    || !instant(data.updatedAt) || !text(data.timeZone)) invalid();
  return { id: data.id, status: data.status, start: data.start, end: data.end, timeZone: data.timeZone, updatedAt: data.updatedAt };
}
const STATUS_KEYS = ['id', 'status', 'start', 'end', 'timeZone', 'updatedAt'];
export function parseMeetingStatusResponse(value: unknown): MeetingStatusResponse {
  return statusFields(object(value, STATUS_KEYS));
}
export function parseMeetingRequestResponse(value: unknown): MeetingRequestResponse {
  const data = object(value, [...STATUS_KEYS, 'meetingToken']);
  if (!isMeetingToken(data.meetingToken)) invalid();
  return { ...statusFields(data), meetingToken: data.meetingToken };
}
export function parseMeetingAvailability(value: unknown): MeetingAvailability {
  const data = object(value, ['timeZone', 'durationMinutes', 'simulated', 'slots']);
  if (!text(data.timeZone) || !Number.isSafeInteger(data.durationMinutes) || typeof data.simulated !== 'boolean'
    || !Array.isArray(data.slots) || data.slots.length > 1000) invalid();
  return {
    timeZone: data.timeZone, durationMinutes: data.durationMinutes as number, simulated: data.simulated,
    slots: data.slots.map(value => {
      const slot = object(value, ['start', 'end']);
      if (!instant(slot.start) || !instant(slot.end)) invalid();
      return { start: slot.start, end: slot.end };
    }),
  };
}
export function parseAdminMeetingList(value: unknown): AdminMeetingList {
  const data = object(value, ['items', 'nextCursor']);
  if (!Array.isArray(data.items) || data.items.length > 100 || !(data.nextCursor === null || text(data.nextCursor))) invalid();
  return {
    items: data.items.map(value => {
      const item = object(value, [...STATUS_KEYS, 'name', 'email', 'topic', 'createdAt', 'version', 'failureCode']);
      if (!text(item.name) || !text(item.email, 1) || !EMAIL.test(item.email) || !text(item.topic)
        || !instant(item.createdAt) || !Number.isSafeInteger(item.version)
        || !(item.failureCode === null || text(item.failureCode))) invalid();
      return { ...statusFields(item), name: item.name, email: item.email, topic: item.topic,
        createdAt: item.createdAt, version: item.version as number, failureCode: item.failureCode };
    }),
    nextCursor: data.nextCursor,
  };
}

import { createContext, useContext, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { platformConfig } from '../config/platform';
import { createMeetingConfirmationStore, createMeetingsClient, type MeetingsClient } from '../services/meetingsClient';
import type { MeetingAvailability, MeetingProposal, MeetingRequestResponse } from '../types/meetings';

export interface MeetingDraft { date: string; selectedStart: string; name: string; email: string; topic: string }
export interface MeetingFlow {
  draft: MeetingDraft;
  availability: MeetingAvailability | null;
  proposal: MeetingProposal | null;
  request: MeetingRequestResponse | null;
}
export function emptyMeetingFlow(): MeetingFlow {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return { draft: { date: tomorrow, selectedStart: '', name: '', email: '', topic: '' },
    availability: null, proposal: null, request: null };
}
interface MeetingsContextValue {
  client: MeetingsClient | null;
  confirmations: ReturnType<typeof createMeetingConfirmationStore> | null;
  flow: MeetingFlow;
  setFlow: Dispatch<SetStateAction<MeetingFlow>>;
  cooldownUntil: number;
  setCooldownUntil: Dispatch<SetStateAction<number>>;
}
const MeetingsContext = createContext<MeetingsContextValue | null>(null);

/** The provider outlives the dialog; private capabilities and confirmation keys remain in memory. */
export function MeetingsProvider({ children }: { children: ReactNode }) {
  const [flow, setFlow] = useState<MeetingFlow>(emptyMeetingFlow);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const privateClient = useRef<Pick<MeetingsContextValue, 'client' | 'confirmations'> | null>(null);
  if (!privateClient.current) {
    const client = platformConfig.enabled ? createMeetingsClient(platformConfig.apiBaseUrl) : null;
    privateClient.current = { client, confirmations: client ? createMeetingConfirmationStore(client) : null };
  }
  return <MeetingsContext.Provider value={{ ...privateClient.current, flow, setFlow, cooldownUntil, setCooldownUntil }}>
    {children}
  </MeetingsContext.Provider>;
}
export function useMeetings() {
  const context = useContext(MeetingsContext);
  if (!context) throw new Error('MeetingsProvider is required.');
  return context;
}

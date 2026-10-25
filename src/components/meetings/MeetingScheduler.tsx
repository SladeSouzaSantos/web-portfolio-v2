import { useEffect, useRef, useState, type FormEvent } from 'react';
import { emptyMeetingFlow, useMeetings } from '../../contexts/MeetingsContext';
import { PlatformApiError } from '../../services/platformHttp';
import type { MeetingProposal } from '../../types/meetings';
import { Modal } from '../Modal';
import { MeetingProposalReview } from './MeetingProposalReview';
import { formatMeetingInstant, MeetingStatusView } from './MeetingStatusView';
import { meetingAvailabilityWindow } from './meetingTime';
import '../../styles/meetings.css';

function meetingErrorMessage(error: PlatformApiError): string {
  if (error.code === 'MEETING_SLOT_UNAVAILABLE') return 'O horário deixou de estar disponível. Consulte a agenda e escolha outro horário.';
  if (error.code === 'CALENDAR_UNAVAILABLE') return 'A agenda está temporariamente indisponível. Tente consultar os horários mais tarde.';
  if (error.status === 404) return 'Esta proposta, solicitação ou função não está disponível. O acesso pode ter expirado; consulte novamente ou prepare outra proposta.';
  return error.publicMessage;
}
export function MeetingScheduler({ onClose, initialProposal }: { onClose: () => void; initialProposal?: MeetingProposal }) {
  const { client, confirmations, flow, setFlow, cooldownUntil, setCooldownUntil } = useMeetings();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<PlatformApiError | null>(null);
  const [now, setNow] = useState(Date.now);
  const active = useRef<AbortController | null>(null);
  const mounted = useRef(false);
  const cooldown = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));
  const zone = flow.availability?.timeZone ?? initialProposal?.summary.timeZone ?? 'America/Fortaleza';

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; active.current?.abort(); active.current = null; };
  }, []);
  useEffect(() => {
    if (!initialProposal) return;
    const result = confirmations?.get(initialProposal.proposalId)?.result ?? null;
    setFlow(current => current.proposal?.proposalId === initialProposal.proposalId ? current
      : { ...current, proposal: initialProposal, request: result });
  }, [initialProposal, confirmations, setFlow]);
  useEffect(() => {
    // Timekeeping only: no network polling. Needed for expiry and Retry-After display.
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  function close() { active.current?.abort(); onClose(); }
  async function run(operation: (signal: AbortSignal) => Promise<void>) {
    if (!client || active.current || Date.now() < cooldownUntil) return;
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    setError(null);
    try { await operation(controller.signal); }
    catch (failure) {
      if (!mounted.current || controller.signal.aborted) return;
      const reason = failure instanceof PlatformApiError ? failure
        : new PlatformApiError('network', 'Não foi possível consultar a agenda. Confira sua conexão e tente novamente se desejar.');
      if (reason.retryAfterSeconds !== undefined) setCooldownUntil(Date.now() + reason.retryAfterSeconds * 1000);
      setError(reason);
    } finally {
      if (active.current === controller) active.current = null;
      if (mounted.current && !controller.signal.aborted) setBusy(false);
    }
  }
  function updateDraft(key: keyof typeof flow.draft, value: string) {
    setFlow(current => ({ ...current, draft: { ...current.draft, [key]: value } }));
  }
  function consult(event: FormEvent) {
    event.preventDefault();
    void run(async signal => {
      const { from, to } = meetingAvailabilityWindow(flow.draft.date, zone);
      const availability = await client!.availability(from, to, { signal });
      if (!signal.aborted && mounted.current) setFlow(current => ({ ...current, availability,
        draft: { ...current.draft, selectedStart: '' } }));
    });
  }
  function prepare(event: FormEvent) {
    event.preventDefault();
    void run(async signal => {
      if (!flow.availability?.slots.some(slot => slot.start === flow.draft.selectedStart)) {
        throw new PlatformApiError('validation', 'Escolha um horário retornado pela agenda.');
      }
      const proposal = await client!.prepareProposal({ start: flow.draft.selectedStart, name: flow.draft.name,
        email: flow.draft.email, topic: flow.draft.topic }, { signal });
      if (!signal.aborted && mounted.current) setFlow(current => ({ ...current, proposal, request: null }));
    });
  }
  function confirm() {
    if (!flow.proposal || !confirmations) return;
    const proposal = flow.proposal;
    if (Date.parse(proposal.expiresAt) <= Date.now() && !confirmations.get(proposal.proposalId)) {
      setError(new PlatformApiError('validation', 'Esta proposta expirou. Prepare outra proposta antes de confirmar.'));
      return;
    }
    void run(async signal => {
      const request = await confirmations.confirm(proposal, { signal });
      if (!signal.aborted && mounted.current) setFlow(current => ({ ...current, request }));
    });
  }
  function refreshStatus() {
    if (!flow.request) return;
    const request = flow.request;
    void run(async signal => {
      const status = await client!.status(request.id, request.meetingToken, { signal });
      if (!signal.aborted) confirmations?.updateStatus(status);
      if (!signal.aborted && mounted.current) setFlow(current => ({ ...current, request: { ...request, ...status } }));
    });
  }
  function newProposal() {
    setError(null);
    setFlow(current => ({ ...current, proposal: null, request: null, availability: null,
      draft: { ...current.draft, selectedStart: '' } }));
  }

  return <Modal overlayClassName="meeting-overlay" panelClassName="meeting-panel" labelledBy="meeting-title" onClose={close}>
    <header className="meeting-header"><h2 id="meeting-title">[ CONSELHO DA JORNADA ]</h2>
      <button type="button" className="meeting-close" aria-label="Fechar agendamento" onClick={close}>
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="2" /></svg>
      </button>
    </header>
    <div className="meeting-content">
      {!client ? <p>O agendamento está indisponível neste ambiente. O restante do portfólio continua disponível.</p>
        : flow.request ? <>
          {flow.proposal?.simulated && <p className="meeting-notice">Modo simulado: solicitação de teste.</p>}
          <MeetingStatusView value={flow.request} />
          <p className="meeting-fine-print">O acesso privado fica somente nesta página. Recarregá-la perde o acompanhamento local.</p>
          <div className="meeting-actions">
            <button type="button" onClick={refreshStatus} disabled={busy || cooldown > 0}>Atualizar estado</button>
            <button type="button" onClick={() => { setFlow(emptyMeetingFlow()); setError(null); }} disabled={busy}>Outra solicitação</button>
          </div>
        </> : flow.proposal ? <MeetingProposalReview key={flow.proposal.proposalId} proposal={flow.proposal} now={now}
          busy={busy} cooldownSeconds={cooldown} attempted={Boolean(confirmations?.get(flow.proposal.proposalId))}
          onConfirm={confirm} onEdit={newProposal} /> : <>
          <p>Consulte horários e prepare uma proposta para conversar sobre projetos e oportunidades profissionais. Não é necessário entrar.</p>
          <p id="meeting-privacy" className="meeting-fine-print">Os dados deste formulário são enviados diretamente ao backend para tratar a solicitação,
            sem passar pelo chat de IA. Não informe dados pessoais sensíveis.</p>
          <form onSubmit={consult} className="meeting-date-form">
            <label htmlFor="meeting-date">Consultar sete dias a partir de</label>
            <input id="meeting-date" type="date" required value={flow.draft.date} disabled={busy}
              onChange={event => { updateDraft('date', event.target.value); setFlow(current => ({ ...current, availability: null,
                draft: { ...current.draft, selectedStart: '' } })); }} />
            <button type="submit" disabled={busy || cooldown > 0}>Consultar horários</button>
          </form>
          {flow.availability && <>
            <p>Fuso horário: {flow.availability.timeZone}. Duração: {flow.availability.durationMinutes} minutos.</p>
            {flow.availability.simulated && <p className="meeting-notice">Modo simulado: horários de teste.</p>}
            {!flow.availability.slots.length ? <p role="status">Nenhum horário disponível neste período. Escolha outra data.</p> : <form onSubmit={prepare} aria-describedby="meeting-privacy">
              <fieldset disabled={busy} className="meeting-slots"><legend>Escolha um horário disponível</legend>
                {flow.availability.slots.map(slot => <label key={slot.start}>
                  <input type="radio" name="meeting-start" value={slot.start} checked={flow.draft.selectedStart === slot.start}
                    required onChange={() => updateDraft('selectedStart', slot.start)} />
                  <span>{formatMeetingInstant(slot.start, flow.availability!.timeZone)} até {formatMeetingInstant(slot.end, flow.availability!.timeZone)}</span>
                </label>)}
              </fieldset>
              <label htmlFor="meeting-name">Nome</label><input id="meeting-name" autoComplete="name" required minLength={2} maxLength={120}
                value={flow.draft.name} disabled={busy} onChange={event => updateDraft('name', event.target.value)} />
              <label htmlFor="meeting-email">E-mail</label><input id="meeting-email" type="email" autoComplete="email" required maxLength={254}
                value={flow.draft.email} disabled={busy} onChange={event => updateDraft('email', event.target.value)} />
              <label htmlFor="meeting-topic">Assunto</label><textarea id="meeting-topic" required minLength={3} maxLength={1000} rows={4}
                value={flow.draft.topic} disabled={busy} onChange={event => updateDraft('topic', event.target.value)} />
              <button type="submit" disabled={busy || cooldown > 0 || !flow.draft.selectedStart}>Preparar proposta</button>
            </form>}
          </>}
        </>}
      {busy && <p role="status" className="meeting-notice">[ CONSULTANDO OS REGISTROS DA AGENDA... ]</p>}
      {error && <div role="alert" className="meeting-error"><p>{meetingErrorMessage(error)}</p>
        {error.correlationId && <p className="meeting-fine-print">Referência: {error.correlationId}</p>}</div>}
      {cooldown > 0 && <p role="status">Aguarde {cooldown}s antes de uma nova consulta ou tentativa.</p>}
    </div>
  </Modal>;
}

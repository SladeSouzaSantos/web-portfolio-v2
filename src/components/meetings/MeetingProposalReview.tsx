import { useState } from 'react';
import type { MeetingProposal } from '../../types/meetings';
import { formatMeetingInstant } from './MeetingStatusView';

interface ProposalReviewProps {
  proposal: MeetingProposal;
  now: number;
  busy: boolean;
  cooldownSeconds: number;
  attempted: boolean;
  onConfirm: () => void;
  onEdit: () => void;
}
/** Shared confirmation for proposals from the direct form and the Orbe. Never submits on mount. */
export function MeetingProposalReview({ proposal, now, busy, cooldownSeconds, attempted, onConfirm, onEdit }: ProposalReviewProps) {
  const [consent, setConsent] = useState(false);
  const expired = Date.parse(proposal.expiresAt) <= now;
  return <section aria-labelledby="meeting-review-title">
    <h3 id="meeting-review-title">Revise sua solicitação</h3>
    {proposal.simulated && <p className="meeting-notice">Modo simulado: esta proposta pertence a um ambiente de teste.</p>}
    <dl className="meeting-summary">
      <dt>Nome</dt><dd>{proposal.summary.name}</dd>
      <dt>E-mail</dt><dd>{proposal.summary.email}</dd>
      <dt>Assunto</dt><dd>{proposal.summary.topic}</dd>
      <dt>Início</dt><dd>{formatMeetingInstant(proposal.summary.start, proposal.summary.timeZone)}</dd>
      <dt>Fim</dt><dd>{formatMeetingInstant(proposal.summary.end, proposal.summary.timeZone)}</dd>
      <dt>Fuso horário</dt><dd>{proposal.summary.timeZone}</dd>
      <dt>Validade da proposta</dt><dd>{formatMeetingInstant(proposal.expiresAt, proposal.summary.timeZone)}</dd>
    </dl>
    <p>Ao confirmar, nome, e-mail e assunto serão enviados para análise da solicitação e comunicações relacionadas à reunião.
      O pedido ficará pendente e não reservará o horário automaticamente.</p>
    {attempted && <p className="meeting-notice">Uma confirmação já foi tentada e pode ter sido recebida pelo servidor.
      Uma nova tentativa reutilizará o mesmo pedido e a mesma identificação para evitar duplicidade.</p>}
    {expired && <p className="meeting-notice">Esta proposta expirou. {attempted
      ? 'Se uma confirmação já foi enviada, uma nova tentativa reutilizará a mesma identificação para evitar duplicidade.'
      : 'Prepare outra proposta antes de confirmar.'}</p>}
    <form onSubmit={event => {
      event.preventDefault();
      if (consent && !busy && !cooldownSeconds && (!expired || attempted)) onConfirm();
    }}>
      <label className="meeting-consent"><input type="checkbox" checked={consent} disabled={busy}
        onChange={event => setConsent(event.target.checked)} />
        Li o resumo e autorizo o tratamento desses dados para solicitar a reunião.</label>
      <p className="meeting-fine-print">Versão do consentimento: {proposal.consentVersion}</p>
      <div className="meeting-actions">
        <button type="submit" disabled={!consent || busy || cooldownSeconds > 0 || (expired && !attempted)}>
          {attempted ? 'Tentar confirmar novamente' : 'Confirmar solicitação'}
        </button>
        <button type="button" disabled={busy} onClick={onEdit}>Alterar dados / novo horário</button>
      </div>
    </form>
  </section>;
}

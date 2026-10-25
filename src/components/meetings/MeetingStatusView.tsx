import type { MeetingStatus, MeetingStatusResponse } from '../../types/meetings';
import { formatMeetingInstant } from './meetingTime';
export { formatMeetingInstant } from './meetingTime';

const STATUS_TEXT: Record<MeetingStatus, { title: string; detail: string }> = {
  PENDING: { title: 'Aguardando análise', detail: 'Sua solicitação foi enviada. O horário ainda não está reservado.' },
  APPROVED: { title: 'Aprovada, aguardando a agenda', detail: 'A administração aprovou a solicitação. Aguarde a confirmação da agenda.' },
  CONFIRMED: { title: 'Confirmada na agenda', detail: 'O evento foi verificado na agenda. Isso não representa aceite do visitante nem garante um link de videoconferência.' },
  REJECTED: { title: 'Não aprovada', detail: 'A solicitação não foi aprovada.' },
  CANCELLED: { title: 'Cancelamento registrado', detail: 'A decisão de cancelamento foi registrada. A remoção na agenda externa ainda pode estar em verificação.' },
  FAILED: { title: 'Não confirmada', detail: 'A confirmação não foi concluída. Aguarde orientação ou atualize o estado; o horário pode continuar protegido durante a reconciliação.' },
};
export function MeetingStatusView({ value }: { value: MeetingStatusResponse }) {
  const status = STATUS_TEXT[value.status];
  return <section className="meeting-status" aria-label="Estado da solicitação">
    <h3>{status.title}</h3>
    <p>{status.detail}</p>
    <dl className="meeting-summary">
      <dt>Início</dt><dd>{formatMeetingInstant(value.start, value.timeZone)}</dd>
      <dt>Fim</dt><dd>{formatMeetingInstant(value.end, value.timeZone)}</dd>
      <dt>Fuso horário</dt><dd>{value.timeZone}</dd>
      <dt>Atualizado em</dt><dd>{formatMeetingInstant(value.updatedAt, value.timeZone)}</dd>
    </dl>
  </section>;
}

import { useRef, type MouseEvent, type RefObject } from 'react';
import { AdminMeetings } from './AdminMeetings';
import { AdminConversations } from './AdminConversations';
import { platformConfig } from '../config/platform';
import '../styles/admin_dashboard.css';

function focusSection(event: MouseEvent<HTMLAnchorElement>, target: RefObject<HTMLElement | null>) {
  if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  // Keep the meeting list mounted and avoid changing the portfolio section hash.
  target.current?.focus({ preventScroll: true });
  target.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
}

export function AdminDashboard({ onReturn }: { onReturn: () => void }) {
  const recordsRef = useRef<HTMLElement>(null);
  const agendaRef = useRef<HTMLDivElement>(null);

  return <section className="admin-dashboard" aria-labelledby="admin-title">
    <header className="admin-dashboard-header">
      <p className="admin-dashboard-eyebrow">[ SALA DO ADMINISTRADOR ]</p>
      <h1 id="admin-title">[ PAINEL DO MESTRE ]</h1>
      <p>Acompanhe o interesse no portfólio e organize as conversas sobre oportunidades profissionais.</p>
      <button type="button" className="login-submit-btn admin-dashboard-return" onClick={onReturn}>
        VOLTAR AO PORTFÓLIO
      </button>
    </header>

    <nav className="admin-dashboard-navigation" aria-label="Seções da administração">
      <a href="#admin-orbe-records" onClick={event => focusSection(event, recordsRef)}>REGISTROS DO ORBE</a>
      {platformConfig.meetingsEnabled && <a href="#admin-meeting-agenda" onClick={event => focusSection(event, agendaRef)}>AGENDA E PEDIDOS</a>}
    </nav>

    <section ref={recordsRef} id="admin-orbe-records" className="admin-dashboard-records"
      aria-labelledby="admin-orbe-title" tabIndex={-1}>
      <h2 id="admin-orbe-title">[ REGISTROS DO ORBE ]</h2>
      <AdminConversations />
    </section>

    {platformConfig.meetingsEnabled ? <div ref={agendaRef} id="admin-meeting-agenda" className="admin-dashboard-agenda" tabIndex={-1}>
      <AdminMeetings />
    </div> : <p role="status" className="admin-dashboard-unavailable">As reuniões estão desativadas neste ambiente.</p>}
  </section>;
}

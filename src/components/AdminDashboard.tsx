import { useRef, type MouseEvent, type RefObject } from 'react';
import { AdminMeetings } from './AdminMeetings';
import '../styles/admin_dashboard.css';

const reports = [
  {
    title: 'PERGUNTAS RESPONDIDAS',
    description: 'Quantas perguntas receberam uma resposta do Orbe.',
  },
  {
    title: 'CONVERSAS ÚNICAS',
    description: 'Fechar e reabrir o Orbe mantém a mesma conversa. Recarregar a página permite iniciar outra.',
  },
  {
    title: 'PERGUNTAS MAIS FREQUENTES',
    description: 'Assuntos que despertam interesse sobre os projetos e a trajetória profissional.',
  },
  {
    title: 'INTENÇÕES DAS CONVERSAS',
    description: 'Curiosidade, interesse em vaga, sondagem profissional ou dúvidas técnicas; casos incertos devem ser identificados.',
  },
];

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
      <a href="#admin-meeting-agenda" onClick={event => focusSection(event, agendaRef)}>AGENDA E PEDIDOS</a>
    </nav>

    <section ref={recordsRef} id="admin-orbe-records" className="admin-dashboard-records"
      aria-labelledby="admin-orbe-title" tabIndex={-1}>
      <h2 id="admin-orbe-title">[ REGISTROS DO ORBE ]</h2>
      <p>Os relatórios do Orbe ainda não estão disponíveis.</p>
      <dl className="admin-dashboard-metrics">
        {reports.map(report => <div key={report.title} className="admin-dashboard-metric">
          <dt>{report.title}</dt>
          <dd className="admin-dashboard-unavailable">Aguardando dados</dd>
          <dd className="admin-dashboard-metric-description">{report.description}</dd>
        </div>)}
      </dl>
    </section>

    <div ref={agendaRef} id="admin-meeting-agenda" className="admin-dashboard-agenda" tabIndex={-1}>
      <AdminMeetings />
    </div>
  </section>;
}

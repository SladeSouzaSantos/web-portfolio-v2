import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router';
import { AdminDashboard } from './components/AdminDashboard';
import { Navbar } from './components/Navbar';
import { OrbAssistant } from './components/OrbAssistant';
import { MeetingScheduler } from './components/meetings/MeetingScheduler';
import { useAuth } from './contexts/AuthContext';
import { useSectionNavigation } from './hooks/useSectionNavigation';
import { useTheme } from './hooks/useTheme';
import type { Theme } from './hooks/useTheme';
import { ArquivoProjetos } from './sections/ArquivoProjetos';
import { Experiencia } from './sections/Experiencia';
import { Formacao } from './sections/Formacao';
import { Projetos } from './sections/Projetos';
import { Sobre } from './sections/Sobre';
import type { SecaoId } from './types/portfolio';
import type { MeetingProposal } from './types/meetings';

const frames: Record<SecaoId, string> = {
  sobre: 'moldura-taverna', projetos: 'moldura-guilda', experiencia: 'moldura-cronicas', academico: 'moldura-academia',
};
interface PortfolioPageProps {
  theme: Theme;
  toggleTheme: () => void;
  adminView?: boolean;
  onMeetingProposal: (proposal: MeetingProposal) => void;
}
function PortfolioPage({ theme, toggleTheme, adminView = false, onMeetingProposal }: PortfolioPageProps) {
  const section = useSectionNavigation();
  const navigate = useNavigate();
  const mainRef = useRef<HTMLElement>(null);
  return <>
    <a className="skip-link" href="#conteudo" onClick={event => {
      event.preventDefault();
      mainRef.current?.focus();
    }}>Pular para o conteúdo</a>
    <Navbar activeSection={section} theme={theme} onToggleTheme={toggleTheme}
      onNavigate={() => {}} onOpenPanel={() => navigate('/administracao')} onLogout={() => navigate('/#sobre')} />
    <main ref={mainRef} id="conteudo" className="portfolio-main" tabIndex={-1}>
      <div id="contentDisplay" className={`content-panel ${adminView ? '' : frames[section]}`}>
        {adminView ? <AdminDashboard onReturn={() => navigate('/#sobre')} /> : <>
          {section === 'sobre' && <Sobre />}
          {section === 'projetos' && <Projetos />}
          {section === 'experiencia' && <Experiencia />}
          {section === 'academico' && <Formacao />}
        </>}
      </div>
    </main>
    <OrbAssistant onMeetingProposal={onMeetingProposal} />
  </>;
}

function RequireAdmin({ children }: { children: ReactNode }) {
  const { state } = useAuth();
  if (state.status === 'loading') return <main className="portfolio-main"><p role="status">[ CONSULTANDO PERMISSÕES... ]</p></main>;
  return state.status === 'authenticated' && state.user?.roles.includes('admin')
    ? children : <Navigate to="/#sobre" replace />;
}

function LegacyRedirect({ to }: { to: string }) {
  const { search, hash } = useLocation();
  return <Navigate to={`${to}${search}${hash}`} replace />;
}

export function App() {
  const { theme, toggleTheme } = useTheme();
  const { state: auth } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const handledAdminSession = useRef<string | null>(null);
  const [meetingOpen, setMeetingOpen] = useState(false);
  const [meetingProposal, setMeetingProposal] = useState<MeetingProposal | undefined>();
  const reviewMeeting = (proposal: MeetingProposal) => { setMeetingProposal(proposal); setMeetingOpen(true); };

  useEffect(() => {
    if (auth.status === 'anonymous' || auth.status === 'unavailable') {
      handledAdminSession.current = null;
      return;
    }
    if (auth.status !== 'authenticated' || !auth.user?.roles.includes('admin')
      || handledAdminSession.current === auth.user.id) return;
    // The OAuth callback returns to the portfolio. Open the room once per
    // authenticated visit, while allowing the administrator to return home.
    handledAdminSession.current = auth.user.id;
    if (pathname === '/') void navigate('/administracao', { replace: true });
  }, [auth.status, auth.user, pathname, navigate]);

  useLayoutEffect(() => {
    const archive = /^\/projetos(?:\.html)?\/?$/.test(pathname);
    document.title = archive ? 'Arquivo de Missões | PHASSCODE' : 'Pedro Santos | PHASSCODE';
    document.querySelector<HTMLMetaElement>('meta[name="description"]')?.setAttribute('content', archive
      ? 'Arquivo de Missões do PHASSCODE — navegue pelo catálogo de projetos e tecnologias de Pedro Santos.'
      : 'Portfólio de Pedro Santos: desenvolvimento de software, projetos, experiência profissional e formação em uma jornada RPG em pixel art.');
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname]);

  const pageProps = { theme, toggleTheme, onMeetingProposal: reviewMeeting };
  return <><Routes>
    <Route path="/" element={<PortfolioPage {...pageProps} />} />
    <Route path="/administracao" element={<RequireAdmin><PortfolioPage {...pageProps} adminView /></RequireAdmin>} />
    <Route path="/projetos" element={<ArquivoProjetos />} />
    <Route path="/projetos.html" element={<LegacyRedirect to="/projetos" />} />
    <Route path="/index.html" element={<LegacyRedirect to="/" />} />
    <Route path="*" element={<LegacyRedirect to="/" />} />
  </Routes>
    {meetingOpen && <MeetingScheduler onClose={() => setMeetingOpen(false)} initialProposal={meetingProposal} />}
  </>;
}

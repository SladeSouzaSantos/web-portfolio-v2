import { useLayoutEffect, useRef } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router';
import { Navbar } from './components/Navbar';
import { OrbAssistant } from './components/OrbAssistant';
import { useSectionNavigation } from './hooks/useSectionNavigation';
import { useSectionTransition } from './hooks/useSectionTransition';
import { useTheme } from './hooks/useTheme';
import type { Theme } from './hooks/useTheme';
import { ArquivoProjetos } from './sections/ArquivoProjetos';
import { Experiencia } from './sections/Experiencia';
import { Formacao } from './sections/Formacao';
import { Projetos } from './sections/Projetos';
import { Sobre } from './sections/Sobre';
import type { SecaoId } from './types/portfolio';

const frames: Record<SecaoId, string> = {
  sobre: 'moldura-taverna', projetos: 'moldura-guilda', experiencia: 'moldura-cronicas', academico: 'moldura-academia',
};

function PortfolioPage({ theme, toggleTheme }: { theme: Theme; toggleTheme: () => void }) {
  const section = useSectionNavigation();
  const { onNavigate, overlay } = useSectionTransition(section);
  const mainRef = useRef<HTMLElement>(null);
  return <>
    <a className="skip-link" href="#conteudo" onClick={event => {
      event.preventDefault();
      mainRef.current?.focus();
    }}>Pular para o conteúdo</a>
    <Navbar activeSection={section} theme={theme} onToggleTheme={toggleTheme} onNavigate={onNavigate} />
    <main ref={mainRef} id="conteudo" className="portfolio-main" tabIndex={-1}>
      <div key={section} id="contentDisplay" data-section={section} className={`content-panel section-enter ${frames[section]}`}>
        {section === 'sobre' && <Sobre />}
        {section === 'projetos' && <Projetos />}
        {section === 'experiencia' && <Experiencia />}
        {section === 'academico' && <Formacao />}
      </div>
    </main>
    <OrbAssistant />
    {overlay}
  </>;
}

function LegacyRedirect({ to }: { to: string }) {
  const { search, hash } = useLocation();
  return <Navigate to={`${to}${search}${hash}`} replace />;
}

export function App() {
  const { theme, toggleTheme } = useTheme();
  const { pathname } = useLocation();
  useLayoutEffect(() => {
    const archive = /^\/projetos(?:\.html)?\/?$/.test(pathname);
    document.title = archive ? 'Arquivo de Missões | PHASSCODE' : 'Pedro Santos | PHASSCODE';
    document.querySelector<HTMLMetaElement>('meta[name="description"]')?.setAttribute('content', archive
      ? 'Arquivo de Missões do PHASSCODE — navegue pelo catálogo de projetos e tecnologias de Pedro Santos.'
      : 'Portfólio de Pedro Santos: desenvolvimento de software, projetos, experiência profissional e formação em uma jornada RPG em pixel art.');
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname]);
  return <Routes>
    <Route path="/" element={<PortfolioPage theme={theme} toggleTheme={toggleTheme} />} />
    <Route path="/administracao" element={<Navigate to="/#sobre" replace />} />
    <Route path="/projetos" element={<ArquivoProjetos />} />
    <Route path="/projetos.html" element={<LegacyRedirect to="/projetos" />} />
    <Route path="/index.html" element={<LegacyRedirect to="/" />} />
    <Route path="*" element={<LegacyRedirect to="/" />} />
  </Routes>;
}

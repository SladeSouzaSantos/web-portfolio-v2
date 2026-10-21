import { Link } from 'react-router';
import type { SecaoId } from '../types/portfolio';
import type { Theme } from '../hooks/useTheme';
import { assetUrl } from '../lib/assets';
import { ChestAccess } from './ChestAccess';
import { ThemeToggle } from './ThemeToggle';

const links: { id: SecaoId; label: string; title: string; icon: string }[] = [
  { id: 'sobre', label: 'SOBRE', title: 'Sobre Pedro Santos', icon: 'helm' },
  { id: 'projetos', label: 'PROJETOS', title: 'Projetos', icon: 'castle' },
  { id: 'experiencia', label: 'EXPERIÊNCIA', title: 'Experiência', icon: 'shield' },
  { id: 'academico', label: 'FORMAÇÃO', title: 'Formação acadêmica', icon: 'grimoire' },
];
interface NavbarProps {
  activeSection: SecaoId; theme: Theme; onToggleTheme: () => void;
  onNavigate: () => void; onOpenPanel: () => void; onLogout: () => void;
}
export function Navbar({ activeSection, theme, onToggleTheme, onNavigate, onOpenPanel, onLogout }: NavbarProps) {
  return <nav id="gbcNavbar" className="barra-navegacao" aria-label="Navegação principal">
    <div className="barra-navegacao-container">
      <Link to="/#sobre" className="bloco-heroi" onClick={onNavigate} aria-label="PHASSCODE — início">
        <span className="indicador-status" aria-hidden="true" /><span className="texto-logo">PHASSCODE</span>
      </Link>
      <div className="bloco-utilitarios">
        <ChestAccess onOpenPanel={onOpenPanel} onLogout={onLogout} />
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      </div>
      <div className="bloco-navegacao-centro sem-barra-rolagem">
        {links.map(link => <Link key={link.id} id={`nav-${link.id}`} to={`/#${link.id}`} onClick={onNavigate}
          className={`botao-rpg${activeSection === link.id ? ' gbc-selected' : ''}`}
          aria-label={link.title} aria-current={activeSection === link.id ? 'page' : undefined}>
          <span className="indicador-selecao" aria-hidden="true">▼</span>
          <span className="perspectiva-svg nav-section-icon"><svg className={`icon-${link.icon}`} viewBox="0 0 32 32" aria-hidden="true">
            <use href={`${assetUrl('icons.svg')}#icon-${link.icon}`} />
          </svg></span><span className="nav-section-label">{link.label}</span>
        </Link>)}
      </div>
    </div>
  </nav>;
}

import { useLayoutEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { perfil } from '../data/perfil';
import { StacksDigitadas } from '../components/StacksDigitadas';
import { useMediaQuery, useReducedMotion } from '../hooks/useMediaQuery';
import { useSceneBackground } from '../hooks/useSceneBackground';
import { assetUrl } from '../lib/assets';

gsap.registerPlugin(ScrollTrigger);

export function Sobre() {
  const desktop = useMediaQuery('(min-width: 769px)');
  const reducedMotion = useReducedMotion();
  useSceneBackground({ className: 'taverna-ativa', property: '--taverna-fundo-atual', desktop: 'taverna_bg.webp', mobile: 'taverna_bg_mobile.webp', animatedDesktop: 'taverna_bg.gif' });

  useLayoutEffect(() => {
    const panel = document.getElementById('contentDisplay');
    if (!panel) return;
    const body = document.body;
    const resize = new ResizeObserver(() => {
      body.style.setProperty('--mesa-width', `${panel.offsetWidth * (1888 / 1100)}px`);
      ScrollTrigger.refresh();
    });
    resize.observe(panel);
    body.style.setProperty('--mesa-width', `${panel.offsetWidth * (1888 / 1100)}px`);
    const context = gsap.context(() => {
      if (desktop && !reducedMotion) {
        gsap.to(body, {
          '--mesa-y': '0px', ease: 'none',
          scrollTrigger: { trigger: panel, start: 'bottom-=50px bottom', endTrigger: body, end: 'bottom bottom', scrub: true, invalidateOnRefresh: true },
        });
      }
    }, panel);
    let active = true;
    const image = new Image();
    if (desktop && !reducedMotion) {
      image.onload = () => { if (active) body.style.setProperty('--taverna-mesa-atual', `url("${assetUrl('taverna_table.gif')}")`); };
      image.src = assetUrl('taverna_table.gif');
    }
    return () => {
      active = false;
      image.onload = null;
      resize.disconnect();
      context.revert();
      body.style.removeProperty('--mesa-width');
      body.style.removeProperty('--mesa-y');
      body.style.removeProperty('--taverna-mesa-atual');
    };
  }, [desktop, reducedMotion]);

  return <section aria-labelledby="perfil-nome">
    <div className="placa-taverna-topo">MENU</div>
    <div className="menu-rpg-grid">
      <div className="painel-rpg painel-perfil">
        <div className="avatar-perfil-wrapper">
          <img src={assetUrl('avatar_cavaleiro.webp')} alt="Avatar Cavaleiro Pedro Santos" className="avatar-perfil-img" />
        </div>
        <h1 id="perfil-nome" className="perfil-nome">{perfil.nome}</h1>
        <span className="perfil-cargo">{perfil.cargo}</span>
        <StacksDigitadas />
        <div className="perfil-social-links">
          {perfil.redes.map(rede => <a key={rede.nome} href={rede.url} target={rede.url.startsWith('https:') ? '_blank' : undefined}
            rel={rede.url.startsWith('https:') ? 'noopener noreferrer' : undefined} className="social-btn" aria-label={rede.nome}>
            <svg className="icon-social-svg" viewBox="0 0 64 64" aria-hidden="true"><use href={`${assetUrl('icons.svg')}#${rede.icone}`} /></svg>
          </a>)}
        </div>
      </div>
      <div className="painel-rpg painel-descricao">
        <h2 className="descricao-titulo">[ SUMÁRIO DO HERÓI ]</h2>
        <p className="descricao-texto">
          Engenheiro de Software e Desenvolvedor com sólida base em sistemas e energias renováveis, atualmente focado no ecossistema <strong>Java</strong> e <strong>Inteligência Artificial</strong>.
          {' '}Combino rigor arquitetural e algoritmos inteligentes para criar soluções escaláveis, de alta performance e impacto real.
        </p>
        <div className="descricao-stats">
          <div className="stat-box"><span className="stat-label">FOCO PRINCIPAL:</span><span className="stat-value">JAVA & IA</span></div>
          <div className="stat-box"><span className="stat-label">MISSÃO:</span><span className="stat-value">CÓDIGO LIMPO & ESCALÁVEL</span></div>
        </div>
      </div>
      <div className="painel-rpg painel-skills">
        <div className="skills-grid-categorias">
          {perfil.competencias.map(categoria => <div className="skill-categoria-box" key={categoria.titulo}>
            <h2 className="skill-cat-titulo">{categoria.titulo}</h2>
            <div className="skill-tags">{categoria.habilidades.map(item => <span className="skill-tag" key={item}>{item}</span>)}</div>
          </div>)}
        </div>
      </div>
    </div>
  </section>;
}

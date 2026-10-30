import { useState } from 'react';
import { Link } from 'react-router';
import { Modal } from '../components/Modal';
import { projetos } from '../data/projetos';
import { useSceneBackground } from '../hooks/useSceneBackground';
import type { Projeto } from '../types/portfolio';

type Filtro = Projeto['categoria'] | 'todos';

const filtros: { id: Filtro; rotulo: string }[] = [
  { id: 'todos', rotulo: '✦ TODOS' },
  { id: 'ia', rotulo: '✧ IA & SEGURANÇA' },
  { id: 'mobile', rotulo: '▣ MOBILE' },
  { id: 'ferramentas', rotulo: '⚒ FERRAMENTAS' },
];

export function ArquivoProjetos() {
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [projetoAberto, setProjetoAberto] = useState<Projeto | null>(null);
  const projetosVisiveis = projetos.filter(projeto => filtro === 'todos' || projeto.categoria === filtro);

  useSceneBackground({
    className: 'arquivo-ativa',
    property: '--arquivo-fundo-atual',
    desktop: 'guilda-bg.webp',
    mobile: 'guilda-bg-mobile.webp',
  });

  return (
    <>
      <header className="topbar">
        <nav className="topbar__inner" aria-label="Navegação principal">
          <Link className="brand" to="/" aria-label="Voltar à página inicial do PHASSCODE">PHASSCODE</Link>
          <Link className="back-top" to="/#projetos">← VOLTAR AO PORTFÓLIO</Link>
        </nav>
      </header>
      <main className="arquivo-container section-enter">
        <section className="arquivo-mural" aria-labelledby="arquivo-titulo">
          <div className="arquivo-mural__interior">
            <h1 id="arquivo-titulo">ARQUIVO DE MISSÕES</h1>
            <p className="subtitulo">EXPLORE OUTROS PROJETOS</p>
            <div className="arquivo-filtros" role="group" aria-label="Filtrar projetos">
              {filtros.map(item => (
                <button
                  key={item.id}
                  type="button"
                  className="arquivo-filtro"
                  data-filtro={item.id}
                  aria-pressed={filtro === item.id}
                  onClick={() => setFiltro(item.id)}
                >
                  {item.rotulo}
                </button>
              ))}
            </div>
            <div className="arquivo-grid" id="arquivo-grid" data-total={projetosVisiveis.length} aria-live="polite">
              {projetosVisiveis.map(projeto => (
                <article className="arquivo-card" key={projeto.id}>
                  <span className="arquivo-card__icone" aria-hidden="true">{projeto.icone}</span>
                  <img className="arquivo-card__imagem" src={projeto.imagem} alt="" loading="lazy" decoding="async" />
                  <h2 className="arquivo-card__titulo">{projeto.nome}</h2>
                  <span className="arquivo-card__linha" aria-hidden="true" />
                  <p className="arquivo-card__tipo">{projeto.tipo}</p>
                  <p className="arquivo-card__descricao">{projeto.subtitulo}</p>
                  <button
                    className="arquivo-card__abrir"
                    type="button"
                    data-projeto={projeto.id}
                    aria-label={`Ver detalhes de ${projeto.nome}`}
                    onClick={() => setProjetoAberto(projeto)}
                  >
                    ▶ VER DETALHES
                  </button>
                </article>
              ))}
              {projetosVisiveis.length === 0 && <p id="arquivo-vazio" className="arquivo-vazio">NENHUMA MISSÃO NESTA CATEGORIA.</p>}
            </div>
            <p className="arquivo-rodape">CINCO MISSÕES SELECIONADAS — PROJETOS E EVIDÊNCIAS.</p>
            <Link className="retornar" to="/#projetos">← RETORNAR AO PORTFÓLIO</Link>
          </div>
        </section>
      </main>
      {projetoAberto && (
        <Modal
          overlayClassName="arquivo-overlay"
          panelClassName="arquivo-modal"
          labelledBy="arquivo-modal-titulo"
          describedBy="arquivo-modal-descricao"
          onClose={() => setProjetoAberto(null)}
        >
          <button type="button" className="arquivo-modal__fechar" aria-label="Fechar detalhes" onClick={() => setProjetoAberto(null)}>
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M5 5l14 14M19 5L5 19" fill="none" stroke="currentColor" strokeWidth="3" />
            </svg>
          </button>
          <p className="arquivo-modal__rotulo">[ REGISTRO DA MISSÃO ]</p>
          <h2 id="arquivo-modal-titulo">{projetoAberto.nome}</h2>
          <p>{projetoAberto.tipo}</p>
          <p id="arquivo-modal-descricao">{projetoAberto.descricao}</p>
          <figure className="projeto-detalhe__figura">
            <img src={projetoAberto.imagem} alt={projetoAberto.imagemAlt} loading="lazy" />
            {projetoAberto.observacao && <figcaption>{projetoAberto.observacao}</figcaption>}
          </figure>
          <h3 className="arquivo-modal__arsenal">DESAFIOS E SOLUÇÕES</h3>
          <ul className="projeto-detalhe__desafios">
            {projetoAberto.detalhes.map(item => <li key={item}>{item}</li>)}
          </ul>
          <h3 className="arquivo-modal__arsenal">ARSENAL UTILIZADO</h3>
          <ul className="arquivo-modal__tec">
            {projetoAberto.tecnologias.map(tecnologia => <li key={tecnologia}>{tecnologia}</li>)}
          </ul>
          {(projetoAberto.repositorio || projetoAberto.demonstracao) && (
            <div className="arquivo-modal__links">
              {projetoAberto.repositorio && <a href={projetoAberto.repositorio} target="_blank" rel="noopener noreferrer">GITHUB ↗</a>}
              {projetoAberto.demonstracao && <a href={projetoAberto.demonstracao} target="_blank" rel="noopener noreferrer">{projetoAberto.demonstracaoRotulo ?? 'DEMONSTRAÇÃO ↗'}</a>}
            </div>
          )}
        </Modal>
      )}
    </>
  );
}

import { useState } from 'react';
import { Link } from 'react-router';
import { Modal } from '../components/Modal';
import { CartazMissao } from '../components/CartazMissao';
import { ProjetoMidia } from '../components/ProjetoMidia';
import { arquivoProjetos } from '../data/arquivoProjetos';
import { useSceneBackground } from '../hooks/useSceneBackground';
import type { Projeto } from '../types/portfolio';

type Filtro = Projeto['categoria'] | 'todos';

const filtros: { id: Filtro; rotulo: string }[] = [
  { id: 'todos', rotulo: '✦ TODOS' },
  { id: 'frontend', rotulo: '✧ FRONT-END' },
  { id: 'backend', rotulo: '⚒ BACKEND & DEVOPS' },
  { id: 'ia', rotulo: '⬡ IA & DADOS' },
  { id: 'engenharia', rotulo: '☀ ENGENHARIA' },
  { id: 'minijogos', rotulo: '♫ MINIJOGOS' },
];

export function ArquivoProjetos() {
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [projetoAberto, setProjetoAberto] = useState<Projeto | null>(null);
  const projetosVisiveis = arquivoProjetos.filter(projeto => filtro === 'todos' || projeto.categoria === filtro);

  useSceneBackground({
    className: 'arquivo-ativa',
    property: '--arquivo-fundo-atual',
    desktop: 'guilda-bg.webp',
    mobile: 'guilda-bg-mobile.webp',
    animatedDesktop: 'guilda-bg.gif',
    animatedMobile: 'guilda-bg-mobile.gif',
  });

  return (
    <>
      <header className="topbar">
        <nav className="topbar__inner" aria-label="Navegação principal">
          <Link className="brand" to="/" aria-label="Voltar à página inicial do PHASSCODE">PHASSCODE</Link>
          <Link className="back-top" to="/#projetos">← VOLTAR À GUILDA</Link>
        </nav>
      </header>
      <main className="arquivo-container section-enter">
        <section className="guilda-mural arquivo-mural" aria-labelledby="arquivo-titulo">
          <div className="guilda-mural__interior arquivo-mural__interior">
            <h1 id="arquivo-titulo" className="guilda-secao__titulo">ARQUIVO DE MISSÕES</h1>
            <p className="arquivo-intro">MISSÕES COMPLEMENTARES • EXPERIMENTOS • MINIJOGOS</p>
            <div className="arquivo-filtros" role="group" aria-label="Filtrar projetos">
              {filtros.map(item => (
                <button
                  key={item.id}
                  type="button"
                  className="arquivo-filtro"
                  data-filtro={item.id}
                  aria-pressed={filtro === item.id}
                  onClick={() => setFiltro(item.id)}
                >{item.rotulo}</button>
              ))}
            </div>
            <div className="guilda-projetos-grid arquivo-grid" id="arquivo-grid" data-total={projetosVisiveis.length} aria-live="polite">
              {projetosVisiveis.map((projeto, index) => (
                <CartazMissao
                  key={projeto.id}
                  projeto={projeto}
                  indice={index}
                  arquivo
                  onOpen={() => setProjetoAberto(projeto)}
                />
              ))}
              {projetosVisiveis.length === 0 && <p className="arquivo-vazio">NENHUMA MISSÃO NESTA CATEGORIA.</p>}
            </div>
            <div className="guilda-arquivo arquivo-placa-rodape">
              <a
                className="guilda-arquivo__placa"
                href="https://github.com/SladeSouzaSantos?tab=repositories"
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="guilda-arquivo__texto">
                  <span className="guilda-arquivo__titulo">REPOSITÓRIOS DO AVENTUREIRO</span>
                  <span className="guilda-arquivo__chamada">EXPLORAR GITHUB <span aria-hidden="true">›</span></span>
                </span>
              </a>
            </div>
          </div>
        </section>
      </main>
      {projetoAberto && (
        <Modal
          overlayClassName="guilda-detalhes"
          panelClassName="guilda-detalhes__janela"
          labelledBy="arquivo-modal-titulo"
          describedBy="arquivo-modal-descricao"
          bodyClassName="guilda-modal-aberto"
          onClose={() => setProjetoAberto(null)}
        >
          <button type="button" className="guilda-detalhes__fechar" aria-label="Fechar detalhes" onClick={() => setProjetoAberto(null)}>
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M5 5l14 14M19 5L5 19" fill="none" stroke="currentColor" strokeWidth="3" />
            </svg>
          </button>
          <p className="guilda-detalhes__rotulo">[ REGISTRO DA MISSÃO ]</p>
          <h2 id="arquivo-modal-titulo">{projetoAberto.nome}</h2>
          <p className="guilda-detalhes__tipo">{projetoAberto.tipo}</p>
          <p id="arquivo-modal-descricao" className="guilda-detalhes__descricao">{projetoAberto.descricao}</p>
          <figure className="projeto-detalhe__figura">
            <ProjetoMidia projeto={projetoAberto} />
            {projetoAberto.observacao && <figcaption>{projetoAberto.observacao}</figcaption>}
          </figure>
          <h3>DESAFIOS E SOLUÇÕES</h3>
          <ul className="projeto-detalhe__desafios">
            {projetoAberto.detalhes.map(item => <li key={item}>{item}</li>)}
          </ul>
          <h3>ARSENAL UTILIZADO</h3>
          <ul className="guilda-detalhes__tecnologias">
            {projetoAberto.tecnologias.map(tecnologia => <li key={tecnologia}>{tecnologia}</li>)}
          </ul>
          {(projetoAberto.repositorio || projetoAberto.demonstracao) && (
            <div className="guilda-detalhes__links">
              {projetoAberto.repositorio && <a href={projetoAberto.repositorio} target="_blank" rel="noopener noreferrer" className="guilda-detalhes__link">GITHUB ↗</a>}
              {projetoAberto.demonstracao && <a href={projetoAberto.demonstracao} target="_blank" rel="noopener noreferrer" className="guilda-detalhes__link">{projetoAberto.demonstracaoRotulo ?? 'DEMONSTRAÇÃO ↗'}</a>}
            </div>
          )}
        </Modal>
      )}
    </>
  );
}

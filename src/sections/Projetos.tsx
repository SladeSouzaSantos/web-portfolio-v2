import { useState } from 'react';
import { Link } from 'react-router';
import { Modal } from '../components/Modal';
import { CartazMissao } from '../components/CartazMissao';
import { ProjetoMidia } from '../components/ProjetoMidia';
import { projetos } from '../data/projetos';
import { useSceneBackground } from '../hooks/useSceneBackground';
import type { Projeto } from '../types/portfolio';

export function Projetos() {
  const [projetoAberto, setProjetoAberto] = useState<Projeto | null>(null);

  useSceneBackground({
    className: 'guilda-ativa',
    property: '--guilda-fundo-atual',
    desktop: 'guilda-bg.webp',
    mobile: 'guilda-bg-mobile.webp',
    animatedDesktop: 'guilda-bg.gif',
    animatedMobile: 'guilda-bg-mobile.gif',
  });

  return (
    <>
      <section className="guilda-secao" aria-labelledby="guilda-titulo">
        <h1 id="guilda-titulo" className="guilda-secao__titulo">QUADRO DE MISSÕES</h1>
        <div className="guilda-mural">
          <div className="guilda-mural__interior">
            <div className="guilda-projetos-grid">
              {projetos.map((projeto, index) => (
                <CartazMissao
                  key={projeto.id}
                  projeto={projeto}
                  indice={index}
                  onOpen={() => setProjetoAberto(projeto)}
                />
              ))}
            </div>
            <div className="guilda-arquivo" aria-label="Outros projetos">
              <Link
                className="guilda-arquivo__placa"
                to="/projetos"
              >
                <span className="guilda-arquivo__texto">
                  <span className="guilda-arquivo__titulo">ARQUIVO DE MISSÕES</span>
                  <span className="guilda-arquivo__chamada">EXPLORAR OUTROS PROJETOS <span aria-hidden="true">›</span></span>
                </span>
              </Link>
            </div>
          </div>
        </div>
      </section>
      {projetoAberto && (
        <Modal
          overlayClassName="guilda-detalhes"
          panelClassName="guilda-detalhes__janela"
          labelledBy="guilda-detalhes-titulo"
          describedBy="guilda-detalhes-descricao"
          bodyClassName="guilda-modal-aberto"
          onClose={() => setProjetoAberto(null)}
        >
          <button className="guilda-detalhes__fechar" type="button" aria-label="Fechar detalhes" onClick={() => setProjetoAberto(null)}>
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M5 5l14 14M19 5L5 19" fill="none" stroke="currentColor" strokeWidth="3" />
            </svg>
          </button>
          <p className="guilda-detalhes__rotulo">[ REGISTRO DA MISSÃO ]</p>
          <h2 id="guilda-detalhes-titulo">{projetoAberto.nome}</h2>
          <p className="guilda-detalhes__tipo">{projetoAberto.tipo}</p>
          <p id="guilda-detalhes-descricao" className="guilda-detalhes__descricao">{projetoAberto.descricao}</p>
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

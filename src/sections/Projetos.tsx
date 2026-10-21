import { useState } from 'react';
import { Link } from 'react-router';
import { Modal } from '../components/Modal';
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
                <button
                  key={projeto.id}
                  className="guilda-cartaz"
                  type="button"
                  data-guilda-projeto={projeto.id}
                  aria-label={`Abrir detalhes do projeto ${projeto.nome}`}
                  onClick={() => setProjetoAberto(projeto)}
                >
                  <span className="guilda-cartaz__conteudo">
                    <span className="guilda-cartaz__numero">MISSÃO {String(index + 1).padStart(2, '0')}</span>
                    <span className="guilda-cartaz__titulo">{projeto.nome}</span>
                    <span className="guilda-cartaz__linha" aria-hidden="true" />
                    <span className="guilda-cartaz__tipo">{projeto.tipo}</span>
                    <span className="guilda-cartaz__subtitulo">{projeto.subtitulo}</span>
                    <span className="guilda-cartaz__chamada">[ INSPECIONAR ]</span>
                  </span>
                </button>
              ))}
            </div>
            <div className="guilda-arquivo" aria-label="Outros projetos">
              <Link
                className="guilda-arquivo__placa"
                to="/projetos"
                aria-label="Explorar outros projetos no Arquivo de Missões"
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
          <button className="guilda-detalhes__fechar" type="button" aria-label="Fechar detalhes" onClick={() => setProjetoAberto(null)}>×</button>
          <p className="guilda-detalhes__rotulo">[ REGISTRO DA MISSÃO ]</p>
          <h2 id="guilda-detalhes-titulo">{projetoAberto.nome}</h2>
          <p className="guilda-detalhes__tipo">{projetoAberto.tipo}</p>
          <p id="guilda-detalhes-descricao" className="guilda-detalhes__descricao">{projetoAberto.descricao}</p>
          <h3>ARSENAL UTILIZADO</h3>
          <ul className="guilda-detalhes__tecnologias">
            {projetoAberto.tecnologias.map(tecnologia => <li key={tecnologia}>{tecnologia}</li>)}
          </ul>
          {(projetoAberto.repositorio || projetoAberto.demonstracao) && (
            <div className="guilda-detalhes__links">
              {projetoAberto.repositorio && <a href={projetoAberto.repositorio} target="_blank" rel="noopener noreferrer" className="guilda-detalhes__link">GITHUB ↗</a>}
              {projetoAberto.demonstracao && <a href={projetoAberto.demonstracao} target="_blank" rel="noopener noreferrer" className="guilda-detalhes__link">DEMONSTRAÇÃO ↗</a>}
            </div>
          )}
        </Modal>
      )}
    </>
  );
}

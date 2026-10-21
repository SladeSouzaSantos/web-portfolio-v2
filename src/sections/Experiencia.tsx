import { useState } from 'react';
import { Modal } from '../components/Modal';
import { experiencias } from '../data/experiencias';
import { useSceneBackground } from '../hooks/useSceneBackground';
import { assetUrl } from '../lib/assets';
import type { Experiencia as ExperienciaItem } from '../types/portfolio';

function EmpresaIcone({ experiencia, className }: { experiencia: ExperienciaItem; className: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <use href={`${assetUrl('icons.svg')}#icon-${experiencia.id}`} />
    </svg>
  );
}

export function Experiencia() {
  const [selecionada, setSelecionada] = useState<ExperienciaItem | null>(null);

  useSceneBackground({
    className: 'cronicas-ativa',
    property: '--cronicas-fundo-atual',
    desktop: 'tapecaria-bg.webp',
    mobile: 'tapecaria-bg-mobile.webp',
    animatedDesktop: 'tapecaria-bg.gif',
    animatedMobile: 'tapecaria-bg-mobile.gif',
  });

  return (
    <>
      <section className="cronicas-secao" aria-labelledby="cronicas-titulo">
        <div className="cronicas-tapecaria">
          <div className="cronicas-tapecaria__interior">
            <header className="cronicas-cabecalho">
              <h1 id="cronicas-titulo">CRÔNICAS DA JORNADA</h1>
              <p>UMA TRAJETÓRIA DE APRENDIZADO, DESAFIOS E CONQUISTAS NO MUNDO DA TECNOLOGIA.</p>
            </header>
            <ol className="cronicas-capitulos" aria-label="Experiências profissionais em ordem cronológica">
              {experiencias.map((experiencia, index) => (
                <li className="cronicas-capitulo" key={experiencia.id}>
                  <div className={`cronicas-capitulo__medalhao cronicas-capitulo__medalhao--${experiencia.id}`} aria-hidden="true">
                    <EmpresaIcone experiencia={experiencia} className="cronicas-capitulo__logo" />
                  </div>
                  <button className="cronicas-capitulo__cartao" type="button" aria-label={`Abrir crônica ${experiencia.empresa}`} onClick={() => setSelecionada(experiencia)}>
                    <span className="cronicas-capitulo__interior">
                      <span className="cronicas-capitulo__periodo">CAPÍTULO {String(index + 1).padStart(2, '0')} · {experiencia.periodo}</span>
                      <span className="cronicas-capitulo__empresa">{experiencia.empresa}</span>
                      <span className="cronicas-capitulo__cargo">{experiencia.cargo}</span>
                      <span className="cronicas-capitulo__resumo">{experiencia.resumo}</span>
                      <span className="cronicas-capitulo__acao">[ LER CRÔNICA ↗ ]</span>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
            <p className="cronicas-rodape" />
          </div>
        </div>
      </section>
      {selecionada && (
        <Modal overlayClassName="cronicas-detalhes" panelClassName="cronicas-detalhes__janela" bodyClassName="cronicas-modal-aberto" labelledBy="cronicas-detalhes-titulo" describedBy="cronicas-detalhes-descricao" onClose={() => setSelecionada(null)}>
          <button className="cronicas-detalhes__fechar" type="button" aria-label="Fechar crônica" onClick={() => setSelecionada(null)}>×</button>
          <div className="cronicas-detalhes__conteudo">
            <p className="cronicas-detalhes__rotulo">[ REGISTRO DA JORNADA ]</p>
            <h2 id="cronicas-detalhes-titulo">{selecionada.empresa}</h2>
            <p className="cronicas-detalhes__periodo">{selecionada.periodoCompleto}</p>
            <p className="cronicas-detalhes__cargo">{selecionada.cargo}</p>
            <div className="cronicas-detalhes__divisor" aria-hidden="true" />
            <h3>MISSÃO PROFISSIONAL</h3>
            <p id="cronicas-detalhes-descricao" className="cronicas-detalhes__descricao">{selecionada.descricao}</p>
            <h3>RESPONSABILIDADES</h3>
            <ul className="cronicas-detalhes__atividades">
              {selecionada.responsabilidades.map(item => <li key={item}>{item}</li>)}
            </ul>
            {selecionada.tecnologias.length > 0 && (
              <>
                <h3>FERRAMENTAS DA JORNADA</h3>
                <ul className="cronicas-detalhes__tecnologias">
                  {selecionada.tecnologias.map(item => <li key={item}>{item}</li>)}
                </ul>
              </>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}

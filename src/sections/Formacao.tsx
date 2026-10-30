import { useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Modal } from '../components/Modal';
import { formacoes, trilhas } from '../data/formacoes';
import { useReducedMotion } from '../hooks/useMediaQuery';
import { useSceneBackground } from '../hooks/useSceneBackground';
import { assetUrl } from '../lib/assets';
import type { Formacao as FormacaoItem, Trilha } from '../types/portfolio';

type Ficha = { tipo: 'formacao'; item: FormacaoItem } | { tipo: 'trilha'; item: Trilha };

function Simbolo({ id, className }: { id: string; className: string }) {
  return (
    <svg className={className} aria-hidden="true" focusable="false" viewBox="0 0 64 64">
      <use href={`${assetUrl('academia-simbolos.svg')}#${id}`} />
    </svg>
  );
}

function Medalhao({ formacao }: { formacao: FormacaoItem }) {
  const cor = /^#[0-9a-fA-F]{6}$/.test(formacao.cor) ? formacao.cor : '#1c6b96';

  return (
    <span className="academia-medalhao" style={{ '--cor-medalhao': cor } as CSSProperties} aria-hidden="true">
      <span className="academia-medalhao__fita" />
      <span className="academia-medalhao__centro" />
      <img className="academia-medalhao__aro" src={assetUrl('medalhao-curso-recortado.webp')} alt="" loading="lazy" decoding="async" />
      <span className="academia-medalhao__gemas">
        {[1, 2, 3, 4].map(numero => <i key={numero} className={`academia-medalhao__gema academia-medalhao__gema--${numero}`} />)}
      </span>
      <Simbolo id={formacao.icone} className="academia-medalhao__icone" />
    </span>
  );
}

function distanciaMesa() {
  const exposicao = Math.min(600, Math.max(240, Math.max(window.innerHeight * 0.32, window.innerWidth * 0.22)));
  return Math.ceil(exposicao + 48);
}

export function Formacao() {
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const reducedMotion = useReducedMotion();

  useSceneBackground({
    className: 'academia-ativa',
    property: '--academia-fundo-atual',
    desktop: 'academia-bg.webp',
    mobile: 'academia-bg-mobile.webp',
    animatedDesktop: 'academia-bg.gif',
    animatedMobile: 'academia-bg-mobile.gif',
  });

  useLayoutEffect(() => {
    if (reducedMotion) return;

    gsap.registerPlugin(ScrollTrigger);
    const media = gsap.matchMedia();
    const context = gsap.context(() => {
      media.add('(min-width: 769px)', () => {
        gsap.fromTo(document.body,
          { '--academia-mesa-y': () => `${distanciaMesa()}px` },
          {
            '--academia-mesa-y': '0px',
            ease: 'none',
            immediateRender: true,
            scrollTrigger: {
              id: 'academia-mesa-scroll',
              trigger: sectionRef.current,
              start: () => Math.max(0, ScrollTrigger.maxScroll(window) - Math.min(280, window.innerHeight * 0.35)),
              end: () => Math.max(1, ScrollTrigger.maxScroll(window)),
              scrub: true,
              invalidateOnRefresh: true,
            },
          },
        );
      });
    }, sectionRef);
    const refreshFrame = requestAnimationFrame(() => ScrollTrigger.refresh());

    return () => {
      cancelAnimationFrame(refreshFrame);
      media.revert();
      context.revert();
    };
  }, [reducedMotion]);

  return (
    <>
      <section ref={sectionRef} className="academia-secao" aria-labelledby="academia-titulo">
        <div className="academia-armario">
          <img src={assetUrl('moldura-armario.webp')} className="academia-armario__arte" alt="" aria-hidden="true" decoding="async" />
          <header className="academia-armario__cabecalho">
            <h1 id="academia-titulo">ACADEMIA ARCANA</h1>
            <p>FORMAÇÃO, ESPECIALIZAÇÕES E ESTUDOS CONTÍNUOS</p>
          </header>
          <div className="academia-armario__conteudo">
            <div className="academia-formacoes" aria-label="Formações acadêmicas e técnicas">
              <h2 className="academia-visualmente-oculto">Formações</h2>
              <div className="academia-formacoes__grade">
                {formacoes.map(formacao => (
                  <button type="button" className="academia-cartao" key={formacao.id} onClick={() => setFicha({ tipo: 'formacao', item: formacao })}>
                    <Medalhao formacao={formacao} />
                    <span className="academia-cartao__conteudo">
                      <span className="academia-cartao__tipo">{formacao.tipo}</span>
                      <strong className="academia-cartao__nome">{formacao.titulo}</strong>
                      <span className="academia-cartao__instituicao">{formacao.instituicao}</span>
                      <span className="academia-cartao__periodo">{formacao.periodo}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <aside className="academia-estudos" aria-labelledby="academia-estudos-titulo">
              <div className="academia-estudos__cabecalho">
                <h2 id="academia-estudos-titulo">ESTUDOS CONTÍNUOS</h2>
                <p className="academia-estudos__subtitulo">CURSOS & TRILHAS DE APRENDIZAGEM</p>
              </div>
              <div className="academia-estudos__lista">
                {trilhas.map(trilha => (
                  <button type="button" className="academia-trilha" key={trilha.id} onClick={() => setFicha({ tipo: 'trilha', item: trilha })}>
                    <Simbolo id={trilha.icone} className="academia-trilha__icone" />
                    <span><strong>{trilha.titulo}</strong><small>{trilha.descricao}</small></span>
                    <span className="academia-trilha__seta" aria-hidden="true">›</span>
                  </button>
                ))}
              </div>
            </aside>
          </div>
        </div>
        <p className="academia-secao__nota">Explore os medalhões e as trilhas para conhecer a formação e os cursos registrados.</p>
      </section>
      {ficha && (
        <Modal overlayClassName="academia-modal" panelClassName="academia-modal__painel" bodyClassName="academia-modal-aberto" labelledBy="academia-modal-titulo" onClose={() => setFicha(null)}>
          <button type="button" className="academia-modal__fechar" aria-label="Fechar ficha" onClick={() => setFicha(null)}>
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M5 5l14 14M19 5L5 19" fill="none" stroke="currentColor" strokeWidth="3" />
            </svg>
          </button>
          <h2 id="academia-modal-titulo">{ficha.item.titulo}</h2>
          {ficha.tipo === 'formacao' ? (
            <>
              <p className="academia-modal__categoria">{ficha.item.tipo}</p>
              <p><strong>Instituição:</strong> {ficha.item.instituicao}</p>
              <p><strong>Período:</strong> {ficha.item.periodo}</p>
              <p><strong>Situação:</strong> {ficha.item.situacao}</p>
              <p>{ficha.item.descricao}</p>
              {ficha.item.especializacoes && (
                <div className="academia-modal__especializacoes">
                  <h3>ESPECIALIZAÇÕES INCLUÍDAS</h3>
                  <ul>{ficha.item.especializacoes.map(nome => <li key={nome}>{nome}</li>)}</ul>
                </div>
              )}
              {ficha.item.observacao && <p className="academia-modal__aviso">{ficha.item.observacao}</p>}
              {ficha.item.comprovante && <a className="academia-modal__link" href={ficha.item.comprovante} target="_blank" rel="noopener noreferrer">VER COMPROVANTE ↗</a>}
            </>
          ) : (
            <>
              <p className="academia-modal__categoria">TRILHA DE APRENDIZAGEM · {ficha.item.cursos.length} CURSOS</p>
              <p>{ficha.item.descricao}</p>
              <p className="academia-modal__aviso">Cursos mencionados nos currículos. Conclusão e certificados individuais não foram verificados, salvo quando a situação está explicitamente indicada.</p>
              <ul className="academia-modal__cursos" aria-label={`Cursos da trilha ${ficha.item.titulo}`}>
                {ficha.item.cursos.map(curso => (
                  <li className="academia-modal__curso" key={`${curso.instituicao}-${curso.titulo}`}>
                    <strong className="academia-modal__curso-titulo">{curso.titulo}</strong>
                    <span className="academia-modal__curso-instituicao">{curso.instituicao}</span>
                    <span className={`academia-modal__curso-status academia-modal__curso-status--${curso.situacao === 'Concluído' ? 'concluido' : curso.situacao === 'Em andamento' ? 'andamento' : 'pendente'}`}>
                      {curso.situacao}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="academia-modal__aprofundamento"><strong>EM APROFUNDAMENTO:</strong> {ficha.item.aprofundamento}</p>
            </>
          )}
        </Modal>
      )}
    </>
  );
}

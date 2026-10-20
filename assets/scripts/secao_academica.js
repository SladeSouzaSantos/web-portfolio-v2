/* ============================================================================
   PHASSCODE · ACADEMIA ARCANA
   Seção modular para window.GBCSections.academico.

   DADOS: base inicial para revisão, especialmente situação e datas previstas.
   O conteúdo público de phasscode.com/#formacao estava sem registros renderizados
   durante esta implementação. Revise o catálogo antes de publicar.
   ============================================================================ */
(() => {
  'use strict';

  window.GBCSections = window.GBCSections || {};
  const IMG = 'assets/img/';
  const MOBILE = '(max-width: 768px)';
  const REDUCED = '(prefers-reduced-motion: reduce)';

  // Personalize este catálogo: as cores mudam centro, fita e gemas do medalhão.
  // Para links, informe uma URL real; strings vazias não exibem o link.
  const formacoes = [
    { id:'computacao', titulo:'Ciência da Computação', tipo:'Graduação', instituicao:'UNISUL',
      periodo:'Início: 07/2023 · Previsão: 12/2026', situacao:'Situação a confirmar',
      cor:'#164b91', icone:'capelo',
      descricao:'Formação em computação, fundamentos de software, algoritmos e desenvolvimento de sistemas.', comprovante:'' },
    { id:'gestao-ti', titulo:'Gestão da Tecnologia da Informação', tipo:'Tecnólogo', instituicao:'UNIBF',
      periodo:'Concluída: 07/2025', situacao:'Concluído',
      cor:'#17744f', icone:'engrenagem',
      descricao:'Gestão de tecnologia da informação, processos e soluções organizacionais.', comprovante:'' },
    { id:'petroleo', titulo:'Engenharia de Petróleo e Gás', tipo:'Graduação', instituicao:'UnP',
      periodo:'Concluída: 12/2014', situacao:'Concluído',
      cor:'#982e3a', icone:'torre',
      descricao:'Formação em engenharia com enfoque em sistemas e operações na indústria de petróleo e gás.', comprovante:'' },
    { id:'eletrica', titulo:'Engenharia Elétrica e Sistemas de Energia', tipo:'Pós-graduação', instituicao:'Unyleya',
      periodo:'Concluída: 09/2020', situacao:'Concluído',
      cor:'#7340a6', icone:'raio',
      descricao:'Especialização em sistemas elétricos e tecnologias de energia.', comprovante:'' },
    { id:'eletrotecnica', titulo:'Eletrotécnica', tipo:'Curso técnico', instituicao:'Escola Politécnica',
      periodo:'Concluída: 10/2022', situacao:'Concluído',
      cor:'#ab741c', icone:'circuito',
      descricao:'Formação técnica em instalações, circuitos e sistemas elétricos.', comprovante:'' },
    { id:'eolica', titulo:'Energia Eólica', tipo:'Especialização técnica', instituicao:'CTGAS-ER',
      periodo:'Concluída: 09/2017', situacao:'Concluído',
      cor:'#138a79', icone:'vento',
      descricao:'Especialização técnica em tecnologias e sistemas de geração eólica.', comprovante:'' },
    // LinkedIn /in/phasscode — duas especializações UNIPDS (2026–2027).
    { id:'java-applied', titulo:'Java Applied Engineering', tipo:'Pós-graduação', instituicao:'UNIPDS',
      periodo:'2026–2027', situacao:'Em andamento',
      cor:'#b77518', icone:'codigo',
      descricao:'Especialização em engenharia avançada no ecossistema Java, arquitetura e construção de software.', comprovante:'' },
    { id:'engenharia-ia', titulo:'Engenharia de IA Aplicada', tipo:'Pós-graduação', instituicao:'UNIPDS',
      periodo:'2026–2027', situacao:'Em andamento',
      cor:'#265fa4', icone:'cerebro',
      descricao:'Especialização em engenharia de software aplicada a sistemas inteligentes, integração de IA e soluções baseadas em modelos de linguagem.', comprovante:'' }
  ];

  // Áreas de estudo, não declarações de certificações concluídas.
  const trilhas = [
    { id:'java', titulo:'Java & Ecossistema', descricao:'Java · Spring · APIs · Boas práticas', icone:'codigo' },
    { id:'frontend', titulo:'React & Frontend', descricao:'React · JavaScript · Interfaces', icone:'janela' },
    { id:'ia', titulo:'Inteligência Artificial', descricao:'LLMs · Agentes · LangChain · RAG', icone:'cerebro' },
    { id:'arquitetura', titulo:'Arquitetura de Software', descricao:'SOLID · Design Patterns · Clean Architecture', icone:'blocos' },
    { id:'dados', titulo:'Dados & Bancos', descricao:'SQL · NoSQL · Pipelines · Big Data', icone:'dados' },
    { id:'qualidade', titulo:'Segurança & Qualidade', descricao:'Testes · TDD · Segurança da Informação', icone:'escudo' }
  ];

  const escapar = valor => String(valor ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  })[c]);
  function corSegura(cor) {
    return /^#[0-9a-fA-F]{6}$/.test(cor) ? cor : '#1c6b96';
  }
  const svg = (id, classe='') => `<svg class="${classe}" aria-hidden="true" focusable="false" viewBox="0 0 64 64"><use href="${IMG}academia-simbolos.svg#${escapar(id)}"></use></svg>`;

  function medalhao(formacao) {
    return `<span class="academia-medalhao" style="--cor-medalhao:${corSegura(formacao.cor)}" aria-hidden="true">
      <span class="academia-medalhao__fita"></span>
      <span class="academia-medalhao__centro"></span>
      <img class="academia-medalhao__aro" src="${IMG}medalhao-curso-recortado.webp" alt="" loading="lazy" decoding="async">
      <span class="academia-medalhao__gemas">${[1,2,3,4].map(n=>`<i class="academia-medalhao__gema academia-medalhao__gema--${n}"></i>`).join('')}</span>
      ${svg(formacao.icone,'academia-medalhao__icone')}
    </span>`;
  }

  function cartao(item) {
    return `<button type="button" class="academia-cartao" data-academia-formacao="${escapar(item.id)}"
               aria-label="Detalhes da formação: ${escapar(item.titulo)}">
      ${medalhao(item)}
      <span class="academia-cartao__conteudo">
        <span class="academia-cartao__tipo">${escapar(item.tipo)}</span>
        <strong class="academia-cartao__nome">${escapar(item.titulo)}</strong>
        <span class="academia-cartao__instituicao">${escapar(item.instituicao)}</span>
        <span class="academia-cartao__periodo">${escapar(item.periodo)}</span>
      </span>
    </button>`;
  }

  function trilha(item) {
    return `<button type="button" class="academia-trilha" data-academia-trilha="${escapar(item.id)}"
               aria-label="Explorar área de estudo: ${escapar(item.titulo)}">
      ${svg(item.icone,'academia-trilha__icone')}
      <span><strong>${escapar(item.titulo)}</strong><small>${escapar(item.descricao)}</small></span>
      <span class="academia-trilha__seta" aria-hidden="true">›</span>
    </button>`;
  }

  let containerAtivo = null;
  let controlador = null;
  let modalAtivo = null;
  let anteriorFoco = null;
  let ciclo = 0;
  let ultimaResolucao = '';
  const cacheGIF = new Map();

  function carregarGif(src) {
    if (!cacheGIF.has(src)) cacheGIF.set(src, new Promise((resolve,reject) => {
      const im = new Image(); im.onload=()=>resolve(src); im.onerror=reject; im.src=src;
    }));
    return cacheGIF.get(src);
  }
  function fundo() {
    const mobile = window.matchMedia(MOBILE).matches;
    return mobile ? 'academia-bg-mobile' : 'academia-bg';
  }
  function definirFundo(url) {
    document.body.style.setProperty('--academia-fundo-atual', `url("${new URL(url,document.baseURI).href}")`);
  }
  function atualizarFundo(token) {
    if (token!==ciclo || !document.body.classList.contains('academia-ativa')) return;
    const resolucao = fundo();
    if (resolucao===ultimaResolucao) return;
    ultimaResolucao=resolucao;
    definirFundo(`${IMG}${resolucao}.webp`);
    if (window.matchMedia(REDUCED).matches) return;
    const gif=`${IMG}${resolucao}.gif`;
    carregarGif(gif).then(()=>{
      if (token===ciclo && document.body.classList.contains('academia-ativa') && fundo()===resolucao)
        definirFundo(gif);
    }).catch(()=>{});
  }

  function fecharModal() {
    if (!modalAtivo) return;
    modalAtivo.remove(); modalAtivo=null;
    document.body.classList.remove('academia-modal-aberto');
    if (anteriorFoco?.isConnected) anteriorFoco.focus();
    anteriorFoco=null;
  }
  function abrirModal(item, tipo, origem) {
    fecharModal(); anteriorFoco=origem;
    const formacao = tipo==='formacao';
    const conteudo = formacao ? `
      <p class="academia-modal__categoria">${escapar(item.tipo)}</p>
      <p><strong>Instituição:</strong> ${escapar(item.instituicao)}</p>
      <p><strong>Período:</strong> ${escapar(item.periodo)}</p>
      <p><strong>Situação:</strong> ${escapar(item.situacao)}</p>
      <p>${escapar(item.descricao)}</p>
      ${item.comprovante ? `<a class="academia-modal__link" href="${escapar(item.comprovante)}" target="_blank" rel="noopener noreferrer">VER COMPROVANTE ↗</a>` : ''}
    ` : `<p class="academia-modal__categoria">TRILHA DE APRENDIZAGEM</p><p>${escapar(item.descricao)}</p><p>Os cursos e certificados individuais desta área poderão ser adicionados ao catálogo posteriormente.</p>`;
    modalAtivo = document.createElement('div');
    modalAtivo.className='academia-modal';
    modalAtivo.innerHTML=`<div class="academia-modal__painel" role="dialog" aria-modal="true" aria-labelledby="academia-modal-titulo" tabindex="-1">
      <button type="button" class="academia-modal__fechar" aria-label="Fechar ficha">×</button>
      <h2 id="academia-modal-titulo">${escapar(item.titulo)}</h2>${conteudo}
    </div>`;
    document.body.append(modalAtivo);
    document.body.classList.add('academia-modal-aberto');
    modalAtivo.querySelector('.academia-modal__fechar').addEventListener('click', fecharModal);
    modalAtivo.addEventListener('click',e=>{if(e.target===modalAtivo)fecharModal();});
    modalAtivo.querySelector('.academia-modal__fechar').focus();
  }

  window.GBCSections.academico = {
    render(container) {
      this.destroy();
      const token=++ciclo;
      containerAtivo=container;
      controlador=new AbortController();
      const {signal}=controlador;
      ultimaResolucao='';
      document.body.classList.add('academia-ativa');
      container.classList.add('moldura-academia');
      container.innerHTML=`<section class="academia-secao" aria-labelledby="academia-titulo">
        <div class="academia-armario">
          <img src="${IMG}moldura-armario.webp" class="academia-armario__arte" alt="" aria-hidden="true" decoding="async">
          <header class="academia-armario__cabecalho">
            <h1 id="academia-titulo">ACADEMIA ARCANA</h1>
            <p>FORMAÇÃO, ESPECIALIZAÇÕES E ESTUDOS CONTÍNUOS</p>
          </header>
          <div class="academia-armario__conteudo">
            <div class="academia-formacoes" aria-label="Formações acadêmicas e técnicas">
              <h2 class="academia-visualmente-oculto">Formações</h2>
              <div class="academia-formacoes__grade">${formacoes.map(cartao).join('')}</div>
            </div>
            <aside class="academia-estudos" aria-labelledby="academia-estudos-titulo">
              <div class="academia-estudos__cabecalho">
                <h2 id="academia-estudos-titulo">ESTUDOS CONTÍNUOS</h2>
                <p class="academia-estudos__subtitulo">CURSOS & CERTIFICAÇÕES</p>
              </div>
              <div class="academia-estudos__lista">${trilhas.map(trilha).join('')}</div>
            </aside>
          </div>
        </div>
        <p class="academia-secao__nota">Explore cada diploma para conhecer a formação.</p>
      </section>`;

      container.addEventListener('click',event=>{
        const botao=event.target.closest('[data-academia-formacao], [data-academia-trilha]');
        if (!botao || !container.contains(botao)) return;
        if (botao.hasAttribute('data-academia-formacao')) {
          const item=formacoes.find(e=>e.id===botao.dataset.academiaFormacao);
          if(item) abrirModal(item,'formacao',botao);
        } else {
          const item=trilhas.find(e=>e.id===botao.dataset.academiaTrilha);
          if(item) abrirModal(item,'trilha',botao);
        }
      },{signal});
      document.addEventListener('keydown',event=>{
        if (!modalAtivo) return;
        if (event.key==='Escape') {fecharModal();return;}
        if (event.key!=='Tab') return;
        const focaveis=[...modalAtivo.querySelectorAll('button,a[href]')];
        if (!focaveis.length) return;
        if(event.shiftKey && document.activeElement===focaveis[0]){event.preventDefault();focaveis.at(-1).focus();}
        else if(!event.shiftKey && document.activeElement===focaveis.at(-1)){event.preventDefault();focaveis[0].focus();}
      },{signal});
      window.addEventListener('resize', () => {
        if (token !== ciclo) return;
        atualizarFundo(token);
        window.GBCAcademiaGSAP?.atualizar();
      },{signal});
      window.requestAnimationFrame(() => {
        if (token === ciclo) window.GBCAcademiaGSAP?.iniciar();
      });
      atualizarFundo(token);
    },
    destroy() {
      ciclo++;
      window.GBCAcademiaGSAP?.destruir();
      fecharModal();
      if(controlador) controlador.abort();
      controlador=null;
      if(containerAtivo) containerAtivo.classList.remove('moldura-academia');
      containerAtivo=null;
      document.body.classList.remove('academia-ativa','academia-mesa-visivel','academia-modal-aberto');
      document.body.style.removeProperty('--academia-fundo-atual');
      ultimaResolucao='';
    }
  };
})();

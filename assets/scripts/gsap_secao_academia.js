/* ============================================================================
   PHASSCODE · ACADEMIA ARCANA — GSAP DA ESCRIVANINHA
   Arquivo independente. Carregar após GSAP + ScrollTrigger e secao_academica.js.
   ============================================================================ */
(() => {
  'use strict';

  const MOBILE = '(max-width: 768px)';
  const REDUCED = '(prefers-reduced-motion: reduce)';

   /* Escrivaninha da Academia: o tween pertence exclusivamente a esta seção.
      Evita destruir os ScrollTriggers da taverna ou de outros módulos. */
   let academiaMesaTween = null;
   function distanciaMesaAcademia() {
     const exposicao = Math.min(600, Math.max(240,
       Math.max(window.innerHeight * .32, window.innerWidth * .22)));
     return Math.ceil(exposicao + 48);
   }
   function destruirMesaAcademiaGsap() {
     if (academiaMesaTween) {
       academiaMesaTween.scrollTrigger?.kill();
       academiaMesaTween.kill();
       academiaMesaTween = null;
     }
     // Não usamos ScrollTrigger.getAll().kill(): os triggers das outras seções devem sobreviver.
   }
   function iniciarMesaAcademiaGsap() {
     destruirMesaAcademiaGsap();
     if (!document.body.classList.contains('academia-ativa')) return;
     const body = document.body;
     body.style.setProperty('--academia-mesa-y', `${distanciaMesaAcademia()}px`);
     if (window.matchMedia(MOBILE).matches || window.matchMedia(REDUCED).matches) return;
     if (!window.gsap || !window.ScrollTrigger) {
       console.warn('[PHASSCODE] GSAP/ScrollTrigger não encontrado; a escrivaninha permanecerá oculta até o carregamento.');
       return;
     }
     const { gsap, ScrollTrigger } = window;
     gsap.registerPlugin(ScrollTrigger);
     academiaMesaTween = gsap.fromTo(body,
       { '--academia-mesa-y': () => `${distanciaMesaAcademia()}px` },
       {
         '--academia-mesa-y': '0px', ease: 'none', immediateRender: true,
         scrollTrigger: {
           id: 'academia-mesa-scroll',
           trigger: '#contentDisplay.moldura-academia',
           // Em páginas curtas, "bottom bottom" pode ocorrer antes do primeiro scroll.
           // Esta faixa garante mesa escondida no topo e visível somente ao descer.
           start: () => Math.max(0, ScrollTrigger.maxScroll(window) - Math.min(280, window.innerHeight * .35)),
           end: () => Math.max(1, ScrollTrigger.maxScroll(window)),
           scrub: true,
           invalidateOnRefresh: true
         }
       });
   }

  // Mesma lógica do listener "resize" que antes estava em secao_academica.js.
  function atualizarMesaAcademiaGsap() {
    const mobile = window.matchMedia(MOBILE).matches;
    const reduce = window.matchMedia(REDUCED).matches;
    if (mobile || reduce) {
      destruirMesaAcademiaGsap();
    } else if (!academiaMesaTween) {
      iniciarMesaAcademiaGsap();
    } else {
      window.ScrollTrigger?.refresh();
    }
  }

  window.GBCAcademiaGSAP = {
    iniciar: iniciarMesaAcademiaGsap,
    atualizar: atualizarMesaAcademiaGsap,
    destruir() {
      destruirMesaAcademiaGsap();
      document.body.style.removeProperty('--academia-mesa-y');
    }
  };
})();

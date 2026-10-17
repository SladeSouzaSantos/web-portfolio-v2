// Registra o plugin ScrollTrigger
gsap.registerPlugin(ScrollTrigger);

let tavernaTween = null;

function initTavernaGsap() {
  const bodyTaverna = document.querySelector("body.taverna-ativa");
  const contentDisplay = document.querySelector("#contentDisplay");
  
  if (!bodyTaverna || !contentDisplay) return;

  // Se for mobile ou tablet (<= 768px), mata qualquer tween existente e aborta
  if (window.innerWidth <= 768) {
    if (tavernaTween) {
      tavernaTween.kill();
      tavernaTween = null;
    }
    return;
  }

  // Se já existir uma animação ativa no desktop, não recria à toa
  if (tavernaTween) return;

  // Aplica a largura logo na inicialização
  atualizarProporcaoMesa();

  // Cria a animação e guarda a referência
  tavernaTween = gsap.to("body.taverna-ativa", {
    "--mesa-y": "0px",         // Traz a mesa para a posição visível (encaixada)
    ease: "none",              // Movimento linear perfeito com o scroll
    scrollTrigger: {
      trigger: "#contentDisplay",     // Gatilho no menu
      start: "bottom-=50px bottom",  // Começa 50px acima do fim do menu
      endTrigger: "body.taverna-ativa", // Termina no fim da página da taverna
      end: "bottom bottom",           
      scrub: true,                    // Sincroniza com a rolagem
      invalidateOnRefresh: true,      // Recalcula no resize
    }
  });
}

// Executa ao carregar o DOM
document.addEventListener("DOMContentLoaded", () => {
  setTimeout(initTavernaGsap, 100);
});

// Atualiza a largura e gerencia a criação/destruição do GSAP no resize
window.addEventListener("resize", () => {
  atualizarProporcaoMesa();
  
  // Reavalia se deve ativar ou desativar o GSAP dependendo da largura atual da tela
  if (window.innerWidth <= 768) {
    if (tavernaTween) {
      tavernaTween.kill();
      tavernaTween = null;
    }
    ScrollTrigger.getAll().forEach(st => st.kill());
  } else {
    // Se aumentou para desktop e o tween não existe, cria-o novamente!
    if (!tavernaTween) {
      initTavernaGsap();
    } else {
      ScrollTrigger.refresh();
    }
  }
});
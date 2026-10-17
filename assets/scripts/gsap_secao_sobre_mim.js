// Registra o plugin ScrollTrigger
gsap.registerPlugin(ScrollTrigger);

function initTavernaGsap() {
  const bodyTaverna = document.querySelector("body.taverna-ativa");
  const contentDisplay = document.querySelector("#contentDisplay");
  
  if (!bodyTaverna || !contentDisplay) return;

  // Aplica a largura logo na inicialização
  atualizarProporcaoMesa();

  gsap.to("body.taverna-ativa", {
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

// Atualiza a largura e o ScrollTrigger sempre que a tela for redimensionada
window.addEventListener("resize", () => {
  atualizarProporcaoMesa();
  ScrollTrigger.refresh();
});
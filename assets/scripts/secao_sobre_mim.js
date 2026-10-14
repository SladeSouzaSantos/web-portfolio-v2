// --- Módulo da Seção: Sobre Mim (A Taverna) ---
window.GBCSections = window.GBCSections || {};

window.GBCSections.sobre = {
    render: function(container) {
        // Aplica a classe da moldura de taverna ao container principal
        container.classList.add('moldura-taverna');

        container.innerHTML = `
            <!-- Placa de Madeira de Taverna no Topo (No lugar de SEÇÃO ATIVA) -->
            <div class="placa-taverna-topo">
                TAVERNA
            </div>

            <!-- Título Principal da Seção -->
            <h1 id="activeTitle" style="font-size: clamp(0.9rem, 4vw, 1.25rem); color: #fef08a; margin-bottom: 1rem; margin-top: 8px; text-shadow: 2px 2px 0 #000;">
                [ SOBRE O HERÓI ]
            </h1>

            <!-- Descrição/Apresentação -->
            <p id="activeDesc" style="font-size: 11px; color: #cbd5e1; max-width: 32rem; margin: 0 auto; line-height: 1.7;">
                Cartão do Herói Pedro Santos. Status, habilidades e trajetória profissional.
            </p>
        `;
    }
};
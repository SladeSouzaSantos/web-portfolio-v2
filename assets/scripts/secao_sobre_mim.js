// --- Módulo da Seção: Sobre Mim (Menu da Taverna) ---
window.GBCSections = window.GBCSections || {};

window.GBCSections.sobre = {
    render: function(container) {
        // Ativa o plano de fundo da taverna na tela inteira
        document.body.classList.add('taverna-ativa');
        container.classList.add('moldura-taverna');

        container.innerHTML = `
            <!-- Placa de Madeira no Topo: MENU -->
            <div class="placa-taverna-topo">
                MENU
            </div>
        `;
    }
};
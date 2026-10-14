// --- Módulo da Seção: Sobre Mim (Menu da Taverna) ---
window.GBCSections = window.GBCSections || {};

window.GBCSections.sobre = {
    render: function(container) {
        document.body.classList.add('taverna-ativa');
        container.classList.add('moldura-taverna');

        container.innerHTML = `
            <!-- Placa de Madeira no Topo: MENU -->
            <div class="placa-taverna-topo">
                MENU
            </div>

            <!-- Grelha Interna de 3 Painéis do Menu RPG -->
            <div class="menu-rpg-grid">
                
                <!-- 1. Painel Superior Esquerdo: Perfil / Avatar -->
                <div class="painel-rpg painel-perfil">
                    <!-- Imagem do Avatar com Moldura RPG -->
                    <div class="avatar-perfil-wrapper">
                        <img src="assets/img/avatar_cavaleiro.webp" alt="Avatar Cavaleiro Pedro Santos" class="avatar-perfil-img">
                    </div>

                    <!-- Nome e Cargo -->
                    <h2 class="perfil-nome">PEDRO SANTOS</h2>
                    <span class="perfil-cargo">DESENVOLVEDOR JAVA & IA</span>

                    <!-- Área de Especializações (Preparada para GSAP futuramente) -->
                    <div class="perfil-especialidades-container">
                        <span class="especialidade-tag">JAVA & FLUTTER</span>
                    </div>

                    <!-- Ícones de Redes Sociais e Contato em Esfera Vermelha -->
                    <div class="perfil-social-links">
                        <a href="https://www.linkedin.com/in/phasscode/" target="_blank" rel="noopener noreferrer" class="social-btn" aria-label="LinkedIn">
                            <svg class="icon-social-svg" viewBox="0 0 64 64">
                                <use xlink:href="assets/img/icons.svg#icon-orb-linkedin" />
                            </svg>
                        </a>
                        <a href="https://github.com/SladeSouzaSantos" target="_blank" rel="noopener noreferrer" class="social-btn" aria-label="GitHub">
                            <svg class="icon-social-svg" viewBox="0 0 64 64">
                                <use xlink:href="assets/img/icons.svg#icon-orb-github" />
                            </svg>
                        </a>
                        <a href="https://www.instagram.com/phassantos" target="_blank" rel="noopener noreferrer" class="social-btn" aria-label="Instagram">
                            <svg class="icon-social-svg" viewBox="0 0 64 64">
                                <use xlink:href="assets/img/icons.svg#icon-orb-instagram" />
                            </svg>
                        </a>
                        <a href="mailto:phassantos.dev@gmail.com" class="social-btn" aria-label="E-mail">
                            <svg class="icon-social-svg" viewBox="0 0 64 64">
                                <use xlink:href="assets/img/icons.svg#icon-orb-email" />
                            </svg>
                        </a>
                    </div>
                </div>

                <!-- 2. Painel Superior Direito: Descrição -->
                <div class="painel-rpg painel-descricao">
                    <div class="conteudo-placeholder">[ DESCRIÇÃO DO HERÓI ]</div>
                </div>

                <!-- 3. Painel Inferior: Skills e Competências -->
                <div class="painel-rpg painel-skills">
                    <div class="conteudo-placeholder">[ PAINEL DE SKILLS & COMPETÊNCIAS ]</div>
                </div>

            </div>
        `;
    }
};
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

                    <!-- Área de Especializações -->
                    <div class="perfil-especialidades-container">
                        <span class="especialidade-tag">JAVA & FLUTTER</span>
                    </div>

                    <!-- Ícones de Redes Sociais e Contato em Esfera Vermelha 3D -->
                    <div class="perfil-social-links">
                        <a href="https://linkedin.com/in/phasscode" target="_blank" rel="noopener noreferrer" class="social-btn" aria-label="LinkedIn">
                            <svg class="icon-social-svg" viewBox="0 0 64 64">
                                <use xlink:href="assets/img/icons.svg#icon-orb-linkedin" />
                            </svg>
                        </a>
                        <a href="https://github.com/PHASS0" target="_blank" rel="noopener noreferrer" class="social-btn" aria-label="GitHub">
                            <svg class="icon-social-svg" viewBox="0 0 64 64">
                                <use xlink:href="assets/img/icons.svg#icon-orb-github" />
                            </svg>
                        </a>
                        <a href="https://instagram.com/seuusuario" target="_blank" rel="noopener noreferrer" class="social-btn" aria-label="Instagram">
                            <svg class="icon-social-svg" viewBox="0 0 64 64">
                                <use xlink:href="assets/img/icons.svg#icon-orb-instagram" />
                            </svg>
                        </a>
                        <a href="mailto:seuemail@exemplo.com" class="social-btn" aria-label="E-mail">
                            <svg class="icon-social-svg" viewBox="0 0 64 64">
                                <use xlink:href="assets/img/icons.svg#icon-orb-email" />
                            </svg>
                        </a>
                    </div>
                </div>

                <!-- 2. Painel Superior Direito: Súmario do Aventureiro (Centralizado) -->
                <div class="painel-rpg painel-descricao">
                    <h3 class="descricao-titulo">[ SÚMARIO DO HERÓI ]</h3>
                    <p class="descricao-texto">
                        Engenheiro de Software e Desenvolvedor com sólida base em sistemas e energias renováveis, atualmente focado no ecossistema <strong>Java</strong> e <strong>Inteligência Artificial</strong>. 
                        Combino rigor arquitetural e algoritmos inteligentes para criar soluções escaláveis, de alta performance e impacto real.
                    </p>
                    <div class="descricao-stats">
                        <div class="stat-box">
                            <span class="stat-label">FOCO PRINCIPAL:</span>
                            <span class="stat-value">JAVA & IA</span>
                        </div>
                        <div class="stat-box">
                            <span class="stat-label">MISSÃO:</span>
                            <span class="stat-value">CÓDIGO LIMPO & ESCALÁVEL</span>
                        </div>
                    </div>
                </div>

                <!-- 3. Painel Inferior: Skills e Competências -->
                <div class="painel-rpg painel-skills">
                    <h3 class="skills-titulo">[ SKILLS & COMPETÊNCIAS ]</h3>
                    <div class="skills-grid-categorias">
                        <!-- Categoria 1: Core Backend & Arquitetura -->
                        <div class="skill-categoria-box">
                            <span class="skill-cat-titulo">CORE BACKEND & ARQUITETURA</span>
                            <div class="skill-tags">
                                <span class="skill-tag">Java (Spring Boot, Quarkus)</span>
                                <span class="skill-tag">System Design & Clean Arch</span>
                                <span class="skill-tag">Microservices & REST APIs</span>
                            </div>
                        </div>
                        <!-- Categoria 2: Engenharia de IA & Agentes -->
                        <div class="skill-categoria-box">
                            <span class="skill-cat-titulo">ENGENHARIA DE IA & AGENTES</span>
                            <div class="skill-tags">
                                <span class="skill-tag">LLM Integration (Langchain4j, OpenAI, Gemini)</span>
                                <span class="skill-tag">RAG & Vector Databases</span>
                                <span class="skill-tag">Autonomous Agents (LangGraph, MCP)</span>
                            </div>
                        </div>
                        <!-- Categoria 3: Eventos & Persistência -->
                        <div class="skill-categoria-box">
                            <span class="skill-cat-titulo">EVENTOS & PERSISTÊNCIA</span>
                            <div class="skill-tags">
                                <span class="skill-tag">Apache Kafka & RabbitMQ</span>
                                <span class="skill-tag">PostgreSQL, Redis, MongoDB</span>
                                <span class="skill-tag">JPA / Hibernate / Flyway</span>
                            </div>
                        </div>
                        <!-- Categoria 4: DevOps & Qualidade -->
                        <div class="skill-categoria-box">
                            <span class="skill-cat-titulo">DEVOPS & QUALIDADE</span>
                            <div class="skill-tags">
                                <span class="skill-tag">Docker & Kubernetes</span>
                                <span class="skill-tag">TDD (JUnit, Testcontainers)</span>
                                <span class="skill-tag">CI/CD (GitHub Actions)</span>
                                <span class="skill-tag">AWS & Observabilidade</span>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        `;
    }
};
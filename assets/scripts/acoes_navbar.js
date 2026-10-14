document.addEventListener('DOMContentLoaded', () => {
    const botoesNavegacao = document.querySelectorAll('.botao-rpg[data-nav], .btn-rpg[data-nav], .botao-icone[data-nav], .btn-icon-only[data-nav]');
    const contentDisplay = document.getElementById('contentDisplay');

    // Marca o primeiro botão (Sobre) como selecionado por padrão ao carregar
    const botaoInicial = document.querySelector('.botao-rpg[data-nav="sobre"], .btn-rpg[data-nav="sobre"]');
    if (botaoInicial) {
        botaoInicial.classList.add('gbc-selected');
        atualizarConteudoSecao('sobre');
    }

    botoesNavegacao.forEach(botao => {
        botao.addEventListener('click', () => {
            botoesNavegacao.forEach(b => b.classList.remove('gbc-selected'));
            botao.classList.add('gbc-selected');

            const alvoNavegacao = botao.getAttribute('data-nav');
            atualizarConteudoSecao(alvoNavegacao);
        });
    });

    function atualizarConteudoSecao(alvo) {
        if (!contentDisplay) return;

        // Limpa classes da taverna ao navegar para outras abas
        contentDisplay.classList.remove('moldura-taverna');
        document.body.classList.remove('taverna-ativa');

        // Se existir um módulo específico para a secção
        if (window.GBCSections && window.GBCSections[alvo] && typeof window.GBCSections[alvo].render === 'function') {
            window.GBCSections[alvo].render(contentDisplay);
            return;
        }

        const mapaSecoes = {
            'projetos': { 
                titulo: '[ PROJETOS ]', 
                descricao: 'Arsenal de Código. Arquiteturas full-stack, aplicações Android e sistemas embarcados.' 
            },
            'experiencia': { 
                titulo: '[ EXPERIÊNCIA ]', 
                descricao: 'Escudo de Batalha. Anos de atuação no mercado, engenharia de software e deploy de soluções.' 
            },
            'academico': { 
                titulo: '[ ACADÊMICO ]', 
                descricao: 'Grimório do Conhecimento. Bacharelados, pós-graduações e especializações técnicas.' 
            },
            'login': { 
                titulo: '[ ÁREA RESTRITA ]', 
                descricao: 'Autenticação via cadeado mágico para acesso a métricas e painel administrativo.' 
            }
        };

        const dados = mapaSecoes[alvo];
        if (dados) {
            contentDisplay.innerHTML = `
                <div style="position: absolute; top: -12px; left: 50%; transform: translateX(-50%); background-color: #d97706; color: #020617; padding: 2px 12px; font-size: 10px; font-weight: bold;">
                    SEÇÃO ATIVA
                </div>
                <h1 id="activeTitle" style="font-size: 1.25rem; color: #67e8f9; margin-bottom: 1rem; margin-top: 8px;">${dados.titulo}</h1>
                <p id="activeDesc" style="font-size: 12px; color: #94a3b8; max-width: 32rem; margin: 0 auto; line-height: 1.6;">
                    ${dados.descricao}
                </p>
            `;
        }
    }
});
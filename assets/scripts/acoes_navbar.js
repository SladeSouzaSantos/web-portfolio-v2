/**
 * Navegação PHASSCODE — gerenciamento do ciclo de vida das seções.
 * Evita que classes e estilos da Guilda permaneçam em Sobre, EXP ou EDU.
 */
document.addEventListener('DOMContentLoaded', () => {
    const botoesNavegacao = document.querySelectorAll(
        '.botao-rpg[data-nav], .btn-rpg[data-nav], .botao-icone[data-nav], .btn-icon-only[data-nav]'
    );
    const contentDisplay = document.getElementById('contentDisplay');
    if (!contentDisplay) return;

    let secaoAtual = null;

    const mapaSecoes = {
        projetos: {
            titulo: '[ PROJETOS ]',
            descricao: 'Arsenal de Código. Arquiteturas full-stack, aplicações Android e sistemas embarcados.'
        },
        experiencia: {
            titulo: '[ EXPERIÊNCIA ]',
            descricao: 'Escudo de Batalha. Anos de atuação no mercado, engenharia de software e deploy de soluções.'
        },
        academico: {
            titulo: '[ ACADÊMICO ]',
            descricao: 'Grimório do Conhecimento. Bacharelados, pós-graduações e especializações técnicas.'
        },
        login: {
            titulo: '[ ÁREA RESTRITA ]',
            descricao: 'Autenticação via cadeado mágico para acesso a métricas e painel administrativo.'
        }
    };

    function limparSecaoAnterior() {
        // Somente a seção ativa precisa executar seu destroy().
        // Futuras seções (Experiência/Acadêmico) também poderão oferecer esse método.
        const moduloAnterior = secaoAtual && window.GBCSections?.[secaoAtual];

        try {
            if (typeof moduloAnterior?.destroy === 'function') {
                moduloAnterior.destroy();
            }
        } catch (erro) {
            // Um erro no destroy() não pode impedir a restauração visual.
            console.error(`[PHASSCODE] Erro ao encerrar a seção "${secaoAtual}":`, erro);
        } finally {
            // Remoção defensiva: mesmo que destroy() falhe, o DOM volta ao estado neutro.
            contentDisplay.classList.remove('moldura-taverna', 'moldura-guilda', 'moldura-cronicas');
            document.body.classList.remove('taverna-ativa', 'guilda-ativa', 'guilda-modal-aberto', 'cronicas-ativa', 'cronicas-modal-aberto');
            document.body.style.removeProperty('--guilda-fundo-atual');
            document.body.style.removeProperty('--cronicas-fundo-atual');
            secaoAtual = null;
        }
    }

    function atualizarConteudoSecao(alvo) {
        limparSecaoAnterior();

        const modulo = window.GBCSections?.[alvo];
        if (typeof modulo?.render === 'function') {
            modulo.render(contentDisplay);
            secaoAtual = alvo;
            return;
        }

        const dados = mapaSecoes[alvo];
        if (!dados) return;

        contentDisplay.innerHTML = `
            <div style="position: absolute; top: -12px; left: 50%; transform: translateX(-50%); background-color: #d97706; color: #020617; padding: 2px 12px; font-size: 10px; font-weight: bold;">
                SEÇÃO ATIVA
            </div>
            <h1 id="activeTitle" style="font-size: 1.25rem; color: #67e8f9; margin-bottom: 1rem; margin-top: 8px;">${dados.titulo}</h1>
            <p id="activeDesc" style="font-size: 12px; color: #94a3b8; max-width: 32rem; margin: 0 auto; line-height: 1.6;">
                ${dados.descricao}
            </p>
        `;
        secaoAtual = alvo;
    }

    botoesNavegacao.forEach(botao => {
        botao.addEventListener('click', () => {
            const alvo = botao.getAttribute('data-nav');
            botoesNavegacao.forEach(b => b.classList.remove('gbc-selected'));
            botao.classList.add('gbc-selected');
            atualizarConteudoSecao(alvo);
        });
    });

    const botaoInicial = document.querySelector(
        '.botao-rpg[data-nav="sobre"], .btn-rpg[data-nav="sobre"]'
    );
    if (botaoInicial) {
        botaoInicial.classList.add('gbc-selected');
        atualizarConteudoSecao('sobre');
    }
});

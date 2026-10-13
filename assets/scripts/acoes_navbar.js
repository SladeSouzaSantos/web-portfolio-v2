document.addEventListener('DOMContentLoaded', () => {
    const botoesNavegacao = document.querySelectorAll('.botao-rpg[data-nav], .btn-rpg[data-nav], .botao-icone[data-nav], .btn-icon-only[data-nav]');
    const tituloSecaoAtiva = document.getElementById('activeTitle');
    const descricaoSecaoAtiva = document.getElementById('activeDesc');

    // Marca o primeiro botão (Sobre) como selecionado por padrão ao carregar
    const botaoInicial = document.querySelector('.botao-rpg[data-nav="sobre"], .btn-rpg[data-nav="sobre"]');
    if (botaoInicial) {
        botaoInicial.classList.add('gbc-selected');
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
        const mapaSecoes = {
            'sobre': { 
                titulo: '[ SOBRE O HERÓI ]', 
                descricao: 'Cartão do Herói Pedro Santos. Status, habilidades e trajetória profissional.' 
            },
            'projetos': { 
                titulo: '[ SECÇÃO: PROJETOS ]', 
                descricao: 'Arsenal de Código. Arquiteturas full-stack, aplicações Android e sistemas embarcados.' 
            },
            'experiencia': { 
                titulo: '[ SECÇÃO: EXPERIÊNCIA ]', 
                descricao: 'Escudo de Batalha. Anos de atuação no mercado, engenharia de software e deploy de soluções.' 
            },
            'academico': { 
                titulo: '[ SECÇÃO: ACADÊMICO ]', 
                descricao: 'Grimório do Conhecimento. Bacharelados, pós-graduações e especializações técnicas.' 
            },
            'login': { 
                titulo: '[ SECÇÃO: ÁREA RESTRITA ]', 
                descricao: 'Autenticação via cadeado mágico para acesso a métricas e painel administrativo.' 
            }
        };

        if (mapaSecoes[alvo] && tituloSecaoAtiva && descricaoSecaoAtiva) {
            tituloSecaoAtiva.textContent = mapaSecoes[alvo].titulo;
            descricaoSecaoAtiva.textContent = mapaSecoes[alvo].descricao;
        }
    }
});
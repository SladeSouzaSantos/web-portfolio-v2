/* ==========================================================================
   PHASSCODE — EXPERIÊNCIA / CRÔNICAS DA JORNADA
   Integração com GBCSections, navegação modular e assets da tapeçaria.
   ========================================================================== */
(() => {
    'use strict';

    window.GBCSections = window.GBCSections || {};

    const IMG_DIR = 'assets/img/';
    const MEDIA_MOBILE = '(max-width: 768px)';
    const MEDIA_MOVIMENTO = '(prefers-reduced-motion: reduce)';

    // Registros baseados na linha do tempo do portfólio anterior.
    // Antes de publicar, confirme períodos e descrições profissionais.
    const experiencias = [
        {
            id: 'acrux',
            empresa: 'ACRUX',
            periodo: '2014 — 2015',
            periodoCompleto: 'Fevereiro de 2014 — Janeiro de 2015',
            cargo: 'Estagiário como Programador de Sistemas',
            resumo: 'Implementação e manutenção de funcionalidades em sistemas ligados à engenharia.',
            descricao: 'Atuação no desenvolvimento e manutenção de soluções de software voltadas a atividades técnicas, com colaboração em equipe multidisciplinar.',
            responsabilidades: [
                'Apoio ao desenvolvimento e à manutenção de sistemas.',
                'Participação em atividades técnicas junto a profissionais de diferentes áreas.'
            ],
            tecnologias: []
        },
        {
            id: 'sig',
            empresa: 'SIG Software e Consultoria em TI',
            periodo: '2016 — 2017',
            periodoCompleto: 'Junho de 2016 — Fevereiro de 2017',
            cargo: 'Desenvolvedor de Sistemas',
            resumo: 'Desenvolvimento e manutenção de sistemas de gestão acadêmica.',
            descricao: 'Desenvolvimento e customização de sistemas corporativos, com atuação no ecossistema Java e em funcionalidades do SIGAA utilizadas em instituições de ensino.',
            responsabilidades: [
                'Implementação e manutenção de funcionalidades em aplicações Java.',
                'Customizações e evolução de módulos do SIGAA.',
                'Integração com banco de dados e colaboração com a equipe de desenvolvimento.'
            ],
            tecnologias: ['Java', 'Hibernate', 'JBoss', 'PostgreSQL', 'Scrum']
        },
        {
            id: 'geowellex',
            empresa: 'Geowellex',
            periodo: '2017 — 2018',
            periodoCompleto: 'Março de 2017 — Outubro de 2018',
            cargo: 'Mud Logging / Desenvolvedor de Sistemas',
            resumo: 'Dados geológicos, operações de campo e ferramentas digitais de apoio.',
            descricao: 'Monitoramento e tratamento de dados técnicos de operações em campo, juntamente com desenvolvimento de ferramentas para apoiar processos operacionais.',
            responsabilidades: [
                'Acompanhamento e organização de dados de Mud Logging.',
                'Desenvolvimento de sistema web para controle de estoque.',
                'Geração e organização de informações técnicas e relatórios.'
            ],
            tecnologias: ['HTML', 'CSS', 'JavaScript', 'PHP', 'MySQL']
        },
        {
            id: 'greencity',
            empresa: 'Greencity Sustainable Energy',
            periodo: '2019 — ATUALMENTE',
            periodoCompleto: 'Fevereiro de 2019 — Atualmente',
            cargo: 'Engenheiro de Projetos Fotovoltaicos / Desenvolvedor Web e Mobile',
            resumo: 'Engenharia fotovoltaica e desenvolvimento de soluções digitais.',
            descricao: 'Atuação em projetos de energia renovável, aliando engenharia e desenvolvimento de soluções para dimensionamento de sistemas, propostas comerciais e automação de processos.',
            responsabilidades: [
                'Dimensionamento e desenvolvimento de projetos fotovoltaicos.',
                'Criação de ferramentas web e mobile para atividades técnicas e comerciais.',
                'Integração de processos, dados e geração de documentos.'
            ],
            tecnologias: ['Flutter', 'Dart', 'Firebase', 'Python', 'PHP']
        }
    ];

    const escapeHTML = valor => String(valor ?? '').replace(/[&<>"']/g, caractere => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[caractere]);

    let containerAtivo = null;
    let modalAtivo = null;
    let botaoAnterior = null;
    let escuta = null;
    let tokenRenderizacao = 0;
    const preloads = new Map();

    function carregarImagem(src) {
        if (!preloads.has(src)) {
            const promise = new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve(src);
                img.onerror = () => reject(new Error(`Falha ao carregar imagem: ${src}`));
                img.src = src;
            });
            preloads.set(src, promise);
        }
        return preloads.get(src);
    }

    function caminhosFundo() {
        const mobile = window.matchMedia(MEDIA_MOBILE).matches;
        const nome = mobile ? 'tapecaria-bg-mobile' : 'tapecaria-bg';
        return {
            webp: `${IMG_DIR}${nome}.webp`,
            gif: `${IMG_DIR}${nome}.gif`
        };
    }

    function definirFundo(src) {
        // A URL absoluta evita resolução relativa a assets/styles/ no CSS.
        const urlAbsoluta = new URL(src, document.baseURI).href;
        document.body.style.setProperty('--cronicas-fundo-atual', `url("${urlAbsoluta}")`);
    }

    function atualizarFundo(token) {
        if (token !== tokenRenderizacao || !document.body.classList.contains('cronicas-ativa')) return;

        const { webp, gif } = caminhosFundo();
        definirFundo(webp);

        if (window.matchMedia(MEDIA_MOVIMENTO).matches) return;
        carregarImagem(gif).then(() => {
            if (token !== tokenRenderizacao || !document.body.classList.contains('cronicas-ativa')) return;
            if (caminhosFundo().gif !== gif) return;
            definirFundo(gif);
        }).catch(() => {
            // O WebP continua visível mesmo se a animação falhar.
        });
    }

    function iconeEmpresa(empresa, classe = '') {
        return `<svg class="${classe}" viewBox="0 0 100 100" role="img" aria-label="Logo ${escapeHTML(empresa.empresa)}">
            <use href="${IMG_DIR}icons.svg#icon-${escapeHTML(empresa.id)}"></use>
        </svg>`;
    }

    function markupCapitulo(exp, index) {
        return `
            <li class="cronicas-capitulo">
                <div class="cronicas-capitulo__medalhao cronicas-capitulo__medalhao--${escapeHTML(exp.id)}" aria-hidden="true">
                    ${iconeEmpresa(exp, 'cronicas-capitulo__logo')}
                </div>
                <button class="cronicas-capitulo__cartao" type="button" data-cronica="${escapeHTML(exp.id)}"
                        aria-label="Abrir crônica ${escapeHTML(exp.empresa)}">
                    <span class="cronicas-capitulo__interior">
                        <span class="cronicas-capitulo__periodo">CAPÍTULO ${String(index + 1).padStart(2, '0')} · ${escapeHTML(exp.periodo)}</span>
                        <span class="cronicas-capitulo__empresa">${escapeHTML(exp.empresa)}</span>
                        <span class="cronicas-capitulo__cargo">${escapeHTML(exp.cargo)}</span>
                        <span class="cronicas-capitulo__resumo">${escapeHTML(exp.resumo)}</span>
                        <span class="cronicas-capitulo__acao">[ LER CRÔNICA ↗ ]</span>
                    </span>
                </button>
            </li>`;
    }

    function markupModal(exp) {
        return `
            <div class="cronicas-detalhes__janela" role="dialog" aria-modal="true"
                 aria-labelledby="cronicas-detalhes-titulo" aria-describedby="cronicas-detalhes-descricao" tabindex="-1">
                <button class="cronicas-detalhes__fechar" type="button" aria-label="Fechar crônica">×</button>
                <div class="cronicas-detalhes__conteudo">
                    <p class="cronicas-detalhes__rotulo">[ REGISTRO DA JORNADA ]</p>
                    <h2 id="cronicas-detalhes-titulo">${escapeHTML(exp.empresa)}</h2>
                    <p class="cronicas-detalhes__periodo">${escapeHTML(exp.periodoCompleto)}</p>
                    <p class="cronicas-detalhes__cargo">${escapeHTML(exp.cargo)}</p>
                    <div class="cronicas-detalhes__divisor" aria-hidden="true"></div>
                    <h3>MISSÃO PROFISSIONAL</h3>
                    <p id="cronicas-detalhes-descricao" class="cronicas-detalhes__descricao">${escapeHTML(exp.descricao)}</p>
                    <h3>RESPONSABILIDADES</h3>
                    <ul class="cronicas-detalhes__atividades">
                        ${exp.responsabilidades.map(item => `<li>${escapeHTML(item)}</li>`).join('')}
                    </ul>
                    ${exp.tecnologias.length ? `<h3>FERRAMENTAS DA JORNADA</h3><ul class="cronicas-detalhes__tecnologias">
                        ${exp.tecnologias.map(item => `<li>${escapeHTML(item)}</li>`).join('')}
                    </ul>` : ''}
                </div>
            </div>`;
    }

    function fecharModal({ restaurarFoco = true } = {}) {
        if (modalAtivo) modalAtivo.remove();
        modalAtivo = null;
        document.body.classList.remove('cronicas-modal-aberto');
        if (restaurarFoco && botaoAnterior?.isConnected) botaoAnterior.focus();
        botaoAnterior = null;
    }

    function abrirModal(exp, botao) {
        fecharModal({ restaurarFoco: false });
        botaoAnterior = botao;
        modalAtivo = document.createElement('div');
        modalAtivo.className = 'cronicas-detalhes';
        modalAtivo.innerHTML = markupModal(exp);
        document.body.appendChild(modalAtivo);
        document.body.classList.add('cronicas-modal-aberto');
        modalAtivo.querySelector('.cronicas-detalhes__fechar').addEventListener('click', () => fecharModal());
        modalAtivo.addEventListener('click', e => {
            if (e.target === modalAtivo) fecharModal();
        });
        modalAtivo.querySelector('.cronicas-detalhes__fechar').focus();
    }

    window.GBCSections.experiencia = {
        render(container) {
            this.destroy();
            tokenRenderizacao += 1;
            const token = tokenRenderizacao;
            escuta = new AbortController();
            containerAtivo = container;

            document.body.classList.add('cronicas-ativa');
            container.classList.add('moldura-cronicas');
            container.innerHTML = `
                <section class="cronicas-secao" aria-labelledby="cronicas-titulo">
                    <div class="cronicas-tapecaria">
                        <div class="cronicas-tapecaria__interior">
                            <header class="cronicas-cabecalho">
                                <h1 id="cronicas-titulo">CRÔNICAS DA JORNADA</h1>
                                <p>UMA TRAJETÓRIA DE APRENDIZADO, DESAFIOS E CONQUISTAS NO MUNDO DA TECNOLOGIA.</p>
                            </header>
                            <ol class="cronicas-capitulos" aria-label="Experiências profissionais em ordem cronológica">
                                ${experiencias.map(markupCapitulo).join('')}
                            </ol>
                            <p class="cronicas-rodape"></p>
                        </div>
                    </div>
                </section>`;

            container.addEventListener('click', event => {
                const botao = event.target.closest('[data-cronica]');
                if (!botao || !container.contains(botao)) return;
                const exp = experiencias.find(item => item.id === botao.dataset.cronica);
                if (exp) abrirModal(exp, botao);
            }, { signal: escuta.signal });

            document.addEventListener('keydown', event => {
                if (!modalAtivo) return;
                if (event.key === 'Escape') {
                    event.preventDefault();
                    fecharModal();
                    return;
                }
                if (event.key !== 'Tab') return;
                const focaveis = [...modalAtivo.querySelectorAll('button:not([disabled]), a[href]')];
                if (!focaveis.length) return;
                const primeiro = focaveis[0];
                const ultimo = focaveis[focaveis.length - 1];
                if (event.shiftKey && document.activeElement === primeiro) {
                    event.preventDefault(); ultimo.focus();
                } else if (!event.shiftKey && document.activeElement === ultimo) {
                    event.preventDefault(); primeiro.focus();
                }
            }, { signal: escuta.signal });

            // Atualiza o enquadramento se cruzar o breakpoint desktop/mobile.
            let ultimoMobile = window.matchMedia(MEDIA_MOBILE).matches;
            window.addEventListener('resize', () => {
                const mobileAgora = window.matchMedia(MEDIA_MOBILE).matches;
                if (mobileAgora !== ultimoMobile) {
                    ultimoMobile = mobileAgora;
                    atualizarFundo(token);
                }
            }, { signal: escuta.signal });

            atualizarFundo(token);
        },
        destroy() {
            tokenRenderizacao += 1; // invalida carregamentos assíncronos anteriores
            fecharModal({ restaurarFoco: false });
            if (escuta) escuta.abort();
            escuta = null;
            if (containerAtivo) containerAtivo.classList.remove('moldura-cronicas');
            containerAtivo = null;
            document.body.classList.remove('cronicas-ativa', 'cronicas-modal-aberto');
            document.body.style.removeProperty('--cronicas-fundo-atual');
        }
    };
})();

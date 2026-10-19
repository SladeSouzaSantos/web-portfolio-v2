/* ==========================================================================
   SEÇÃO PROJETOS — QUADRO DE MISSÕES DA GUILDA
   Compatível com window.GBCSections e acoes_navbar.js.
   ========================================================================== */
(() => {
    'use strict';

    window.GBCSections = window.GBCSections || {};

    const IMG_DIR = 'assets/img/';
    const MOBILE_QUERY = '(max-width: 768px)';
    const MODO_REDUZIDO_QUERY = '(prefers-reduced-motion: reduce)';

    // Edite aqui os projetos em destaque. URLs vazias não exibem botões.
    // Os nomes são uma seleção inicial; revise textos, tecnologias e links.
    const projetos = [
        {
            id: 'smart-model-router',
            nome: 'SMART MODEL ROUTER',
            subtitulo: 'Integração de LLMs',
            tipo: 'IA & BACKEND',
            descricao: 'Gateway experimental de integração e roteamento de modelos de linguagem.',
            tecnologias: ['Node.js', 'APIs REST', 'OpenRouter'],
            repositorio: '',
            demonstracao: ''
        },
        {
            id: 'greencity-sdgp',
            nome: 'GREENCITY SDGP',
            subtitulo: 'Soluções em energia',
            tipo: 'MOBILE',
            descricao: 'Aplicativo para apoiar o dimensionamento fotovoltaico e a preparação de propostas.',
            tecnologias: ['Flutter', 'Dart', 'Firebase'],
            repositorio: '',
            demonstracao: ''
        },
        {
            id: 'lithology',
            nome: 'LITHOLOGY',
            subtitulo: 'Dados e relatórios',
            tipo: 'FERRAMENTAS',
            descricao: 'Ferramenta de processamento e exportação de informações técnicas.',
            tecnologias: ['Dados', 'Excel', 'PDF'],
            repositorio: '',
            demonstracao: ''
        },
        {
            id: 'propriedades-gases',
            nome: 'PROPRIEDADES DOS GASES',
            subtitulo: 'Cálculo e engenharia',
            tipo: 'MOBILE',
            descricao: 'Aplicativo de engenharia para cálculos de propriedades de gases.',
            tecnologias: ['Flutter', 'Dart'],
            repositorio: '',
            demonstracao: ''
        },
        {
            id: 'langchain-intro',
            nome: 'LANGCHAIN INTRO',
            subtitulo: 'Laboratório de agentes',
            tipo: 'IA & ESTUDOS',
            descricao: 'Experimentos com fluxos de agentes, memória e orquestração de LLMs.',
            tecnologias: ['LangChain', 'LangGraph', 'LLMs'],
            repositorio: '',
            demonstracao: ''
        }
    ];

    // Impede markup acidental quando os dados forem substituídos por conteúdo externo.
    const escaparHTML = valor => String(valor ?? '').replace(/[&<>"']/g, caractere => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[caractere]);

    const imagensPrecarregadas = new Map();
    function carregarImagem(src) {
        if (!imagensPrecarregadas.has(src)) {
            imagensPrecarregadas.set(src, new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve(src);
                img.onerror = () => reject(new Error(`Não foi possível carregar ${src}`));
                img.src = src;
            }));
        }
        return imagensPrecarregadas.get(src);
    }

    let containerAtivo = null;
    let modalAtivo = null;
    let botaoAnterior = null;
    let controladorEventos = null;
    let versaoRenderizacao = 0;

    function fundoParaLargura() {
        const mobile = window.matchMedia(MOBILE_QUERY).matches;
        const nome = mobile ? 'guilda-bg-mobile' : 'guilda-bg';
        return {
            estatico: `${IMG_DIR}${nome}.webp`,
            animado: `${IMG_DIR}${nome}.gif`
        };
    }

    function definirFundo(src) {
        const urlAbsoluta = new URL(src, document.baseURI).href;

        document.body.style.setProperty(
            '--guilda-fundo-atual',
            `url("${urlAbsoluta}")`
        );
    }

    function atualizarFundo(token) {
        if (token !== versaoRenderizacao || !document.body.classList.contains('guilda-ativa')) return;
        const { estatico, animado } = fundoParaLargura();

        // First paint usa WebP; jamais fica esperando o GIF para mostrar o cenário.
        definirFundo(estatico);

        // Respeita preferência de acessibilidade por movimento reduzido.
        if (window.matchMedia(MODO_REDUZIDO_QUERY).matches) return;

        carregarImagem(animado).then(() => {
            if (token !== versaoRenderizacao || !document.body.classList.contains('guilda-ativa')) return;
            if (fundoParaLargura().animado !== animado) return; // houve resize
            definirFundo(animado);
        }).catch(() => {
            // WebP permanece visível caso o GIF falhe.
        });
    }

    function markupCartaz(projeto, index) {
        return `
            <button class="guilda-cartaz" type="button" data-guilda-projeto="${escaparHTML(projeto.id)}"
                aria-label="Abrir detalhes do projeto ${escaparHTML(projeto.nome)}">
                <span class="guilda-cartaz__conteudo">
                    <span class="guilda-cartaz__numero">MISSÃO ${String(index + 1).padStart(2, '0')}</span>
                    <span class="guilda-cartaz__titulo">${escaparHTML(projeto.nome)}</span>
                    <span class="guilda-cartaz__linha" aria-hidden="true"></span>
                    <span class="guilda-cartaz__tipo">${escaparHTML(projeto.tipo)}</span>
                    <span class="guilda-cartaz__subtitulo">${escaparHTML(projeto.subtitulo)}</span>
                    <span class="guilda-cartaz__chamada">[ INSPECIONAR ]</span>
                </span>
            </button>`;
    }

    function markupDetalhes(projeto) {
        const links = [
            projeto.repositorio && `<a href="${escaparHTML(projeto.repositorio)}" target="_blank" rel="noopener noreferrer" class="guilda-detalhes__link">GITHUB ↗</a>`,
            projeto.demonstracao && `<a href="${escaparHTML(projeto.demonstracao)}" target="_blank" rel="noopener noreferrer" class="guilda-detalhes__link">DEMONSTRAÇÃO ↗</a>`
        ].filter(Boolean).join('');
        return `
            <div class="guilda-detalhes__janela" role="dialog" aria-modal="true" aria-labelledby="guilda-detalhes-titulo" tabindex="-1">
                <button class="guilda-detalhes__fechar" type="button" aria-label="Fechar detalhes">×</button>
                <p class="guilda-detalhes__rotulo">[ REGISTRO DA MISSÃO ]</p>
                <h2 id="guilda-detalhes-titulo">${escaparHTML(projeto.nome)}</h2>
                <p class="guilda-detalhes__tipo">${escaparHTML(projeto.tipo)}</p>
                <p class="guilda-detalhes__descricao">${escaparHTML(projeto.descricao)}</p>
                <h3>ARSENAL UTILIZADO</h3>
                <ul class="guilda-detalhes__tecnologias">${projeto.tecnologias.map(t => `<li>${escaparHTML(t)}</li>`).join('')}</ul>
                ${links ? `<div class="guilda-detalhes__links">${links}</div>` : ''}
            </div>`;
    }

    function fecharDetalhes() {
        if (!modalAtivo) return;
        modalAtivo.remove();
        modalAtivo = null;
        document.body.classList.remove('guilda-modal-aberto');
        if (botaoAnterior && botaoAnterior.isConnected) botaoAnterior.focus();
        botaoAnterior = null;
    }

    function abrirDetalhes(projeto, botao) {
        fecharDetalhes();
        botaoAnterior = botao;
        modalAtivo = document.createElement('div');
        modalAtivo.className = 'guilda-detalhes';
        modalAtivo.innerHTML = markupDetalhes(projeto);
        document.body.appendChild(modalAtivo);
        document.body.classList.add('guilda-modal-aberto');
        modalAtivo.querySelector('.guilda-detalhes__fechar').addEventListener('click', fecharDetalhes);
        modalAtivo.addEventListener('click', event => {
            if (event.target === modalAtivo) fecharDetalhes();
        });
        modalAtivo.querySelector('.guilda-detalhes__fechar').focus();
    }

    window.GBCSections.projetos = {
        render(container) {
            this.destroy();
            versaoRenderizacao += 1;
            const token = versaoRenderizacao;
            containerAtivo = container;
            controladorEventos = new AbortController();

            document.body.classList.add('guilda-ativa');
            container.classList.add('moldura-guilda');
            container.innerHTML = `
                <section class="guilda-secao" aria-labelledby="guilda-titulo">
                    <h1 id="guilda-titulo" class="guilda-secao__titulo">QUADRO DE MISSÕES</h1>
                    <div class="guilda-mural">
                        <div class="guilda-mural__interior">
                            <div class="guilda-projetos-grid">
                                ${projetos.map(markupCartaz).join('')}
                            </div>
                            <div class="guilda-arquivo" aria-label="Outros projetos">
                                <a class="guilda-arquivo__placa" href="projetos.html" aria-label="Explorar outros projetos no Arquivo de Missões">
                                    <span class="guilda-arquivo__texto">
                                        <span class="guilda-arquivo__titulo">ARQUIVO DE MISSÕES</span>
                                        <span class="guilda-arquivo__chamada">EXPLORAR OUTROS PROJETOS <span aria-hidden="true">›</span></span>
                                    </span>
                                </a>
                            </div>
                        </div>
                    </div>
                </section>`;

            container.addEventListener('click', event => {
                const cartaz = event.target.closest('[data-guilda-projeto]');
                if (!cartaz || !container.contains(cartaz)) return;
                const projeto = projetos.find(item => item.id === cartaz.dataset.guildaProjeto);
                if (projeto) abrirDetalhes(projeto, cartaz);
            }, { signal: controladorEventos.signal });

            document.addEventListener('keydown', event => {
                if (!modalAtivo) return;
                if (event.key === 'Escape') fecharDetalhes();
                // O foco permanece dentro da ficha enquanto ela estiver aberta.
                if (event.key !== 'Tab') return;
                const focaveis = [...modalAtivo.querySelectorAll('button, a[href]')];
                if (!focaveis.length) return;
                const primeiro = focaveis[0];
                const ultimo = focaveis[focaveis.length - 1];
                if (event.shiftKey && document.activeElement === primeiro) {
                    event.preventDefault(); ultimo.focus();
                } else if (!event.shiftKey && document.activeElement === ultimo) {
                    event.preventDefault(); primeiro.focus();
                }
            }, { signal: controladorEventos.signal });

            window.addEventListener('resize', () => {
                atualizarFundo(token);
            }, { signal: controladorEventos.signal });

            atualizarFundo(token);
        },
        destroy() {
            versaoRenderizacao += 1; // cancela trocas assíncronas de GIF
            fecharDetalhes();
            if (controladorEventos) controladorEventos.abort();
            controladorEventos = null;
            if (containerAtivo) containerAtivo.classList.remove('moldura-guilda');
            containerAtivo = null;
            document.body.classList.remove('guilda-ativa');
            document.body.style.removeProperty('--guilda-fundo-atual');
        }
    };
})();

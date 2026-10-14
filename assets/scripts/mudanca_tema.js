document.addEventListener('DOMContentLoaded', () => {
    const botaoAlternarTema = document.getElementById('themeToggleBtn');
    const iconeTema = document.getElementById('themeIcon');
    const temaUseEl = iconeTema ? iconeTema.querySelector('use') : null;
    const mascaraTransicao = document.getElementById('themeTransitionMask');
    const elementoHtml = document.documentElement;

    function posicionarMascaraTransicao() {
        if (!botaoAlternarTema || !mascaraTransicao) return;
        const retanguloBotao = botaoAlternarTema.getBoundingClientRect();
        const centroX = retanguloBotao.left + retanguloBotao.width / 2;
        const centroY = retanguloBotao.top + retanguloBotao.height / 2;
        mascaraTransicao.style.setProperty('--click-x', `${centroX}px`);
        mascaraTransicao.style.setProperty('--click-y', `${centroY}px`);
    }

    window.addEventListener('load', posicionarMascaraTransicao);
    window.addEventListener('resize', posicionarMascaraTransicao);

    if (botaoAlternarTema) {
        botaoAlternarTema.addEventListener('click', () => {
            if (botaoAlternarTema.disabled) return;
            botaoAlternarTema.disabled = true;

            posicionarMascaraTransicao();

            const novoTemaEscuro = !elementoHtml.classList.contains('dark');
            mascaraTransicao.style.backgroundColor = novoTemaEscuro ? '#080d12' : '#e2e8f0';
            mascaraTransicao.style.clipPath = 'circle(150% at var(--click-x) var(--click-y))';

            setTimeout(() => {
                if (novoTemaEscuro) {
                    elementoHtml.classList.add('dark');
                    document.body.classList.add('modo-escuro');
                    document.body.classList.remove('modo-claro');

                    // Alterna para o ID do Sol no SVG centralizado
                    if (temaUseEl) {
                        temaUseEl.setAttribute('xlink:href', 'assets/img/icons.svg#icon-sol');
                    }
                } else {
                    elementoHtml.classList.remove('dark');
                    document.body.classList.add('modo-claro');
                    document.body.classList.remove('modo-escuro');

                    // Alterna para o ID da Lua no SVG centralizado
                    if (temaUseEl) {
                        temaUseEl.setAttribute('xlink:href', 'assets/img/icons.svg#icon-lua');
                    }
                }

                mascaraTransicao.style.clipPath = 'circle(0% at var(--click-x) var(--click-y))';

                setTimeout(() => {
                    botaoAlternarTema.disabled = false;
                }, 700);

            }, 600);
        });
    }
});
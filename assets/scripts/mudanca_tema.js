document.addEventListener('DOMContentLoaded', () => {
    const botaoAlternarTema = document.getElementById('themeToggleBtn');
    const iconeTema = document.getElementById('themeIcon');
    const mascaraTransicao = document.getElementById('themeTransitionMask');
    const elementoHtml = document.documentElement;

    let modoEscuroAtivo = true;

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
                modoEscuroAtivo = novoTemaEscuro;
                if (modoEscuroAtivo) {
                    elementoHtml.classList.add('dark');
                    document.body.className = "modo-escuro font-pixel relative flex flex-col justify-between selection:bg-cyan-500 selection:text-slate-950 transition-colors duration-300";
                    iconeTema.innerHTML = `
                        <circle cx="16" cy="16" r="6" fill="#f59e0b"/>
                        <circle cx="16" cy="16" r="4" fill="#fef08a"/>
                        <path d="M16 4v4M16 24v4M4 16h4M24 16h4M7.5 7.5l3 3M21.5 21.5l3 3M7.5 24.5l3-3M21.5 10.5l3-3" stroke="#f59e0b" stroke-width="2" stroke-linecap="square"/>
                    `;
                } else {
                    elementoHtml.classList.remove('dark');
                    document.body.className = "modo-claro font-pixel relative flex flex-col justify-between selection:bg-cyan-500 selection:text-slate-950 transition-colors duration-300";
                    iconeTema.innerHTML = `
                        <path d="M22 17.5A8.5 8.5 0 1 1 11.5 7 6.5 6.5 0 0 0 22 17.5z" fill="#38bdf8" stroke="#cbd5e1" stroke-width="1.5"/>
                        <rect x="22" y="8" width="2" height="2" fill="#fef08a"/>
                    `;
                }

                mascaraTransicao.style.clipPath = 'circle(0% at var(--click-x) var(--click-y))';

                setTimeout(() => {
                    botaoAlternarTema.disabled = false;
                }, 700);

            }, 600);
        });
    }
});
document.addEventListener('DOMContentLoaded', () => {
    const loginBtn = document.getElementById('nav-login');
    const loginModal = document.getElementById('loginModal');
    const closeLoginModal = document.getElementById('closeLoginModal');
    const loginForm = document.getElementById('loginForm');
    const loginFeedback = document.getElementById('loginFeedback');

    // Elementos do menu do baú aberto
    const chestMenuModal = document.getElementById('chestMenuModal');
    const closeChestMenu = document.getElementById('closeChestMenu');
    const btnGoToRestricted = document.getElementById('btnGoToRestricted');
    const btnLockChest = document.getElementById('btnLockChest');
    
    if (!loginBtn || !loginModal) return;

    const chestIconUse = document.getElementById('chestIconUse') || loginBtn.querySelector('use');
    let isLogado = false;

    // Clique no Baú da Navbar
    loginBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (isLogado) {
            // Se já estiver logado, abre o menu de escolha estilo jogo
            if (chestMenuModal) chestMenuModal.classList.add('ativo');
        } else {
            // Se não estiver logado, abre o modal de senha normal
            loginModal.classList.add('ativo');
        }
    });

    // Fechar modais
    if (closeLoginModal) {
        closeLoginModal.addEventListener('click', () => {
            loginModal.classList.remove('ativo');
            if (loginFeedback) loginFeedback.textContent = '';
        });
    }

    if (closeChestMenu) {
        closeChestMenu.addEventListener('click', () => {
            chestMenuModal.classList.remove('ativo');
        });
    }

    // Ações do Menu do Baú Aberto
    if (btnGoToRestricted) {
        btnGoToRestricted.addEventListener('click', () => {
            chestMenuModal.classList.remove('ativo');
            
            // Ativa a aba restrita programaticamente na navbar
            const botaoLoginNav = document.querySelector('.botao-rpg[data-nav="login"], [data-nav="login"].botao-rpg');
            if (botaoLoginNav) {
                botaoLoginNav.click();
            } else {
                const tituloSecaoAtiva = document.getElementById('activeTitle');
                const descricaoSecaoAtiva = document.getElementById('activeDesc');
                if (tituloSecaoAtiva && descricaoSecaoAtiva) {
                    tituloSecaoAtiva.textContent = '[ SECÇÃO: ÁREA RESTRITA ]';
                    descricaoSecaoAtiva.textContent = 'Painel administrativo e métricas do Mestre desbloqueadas.';
                }
            }
        });
    }

    if (btnLockChest) {
        btnLockChest.addEventListener('click', () => {
            // Trancamento direto e sem confirmação nativa
            isLogado = false;
            if (chestIconUse) chestIconUse.setAttribute('xlink:href', 'assets/img/icons.svg#icon-chest-closed');
            chestMenuModal.classList.remove('ativo');
        });
    }

    // Fechar modais ao clicar fora ou pressionar ESC
    window.addEventListener('click', (e) => {
        if (e.target === loginModal) loginModal.classList.remove('ativo');
        if (e.target === chestMenuModal) chestMenuModal.classList.remove('ativo');
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            loginModal.classList.remove('ativo');
            if (chestMenuModal) chestMenuModal.classList.remove('ativo');
        }
    });

    // Funcionalidade de Mostrar / Ocultar Senha
    const togglePasswordBtn = document.getElementById('togglePasswordBtn');
    const senhaInput = document.getElementById('senha');
    const eyeIconUse = document.getElementById('eyeIconUse');

    if (togglePasswordBtn && senhaInput && eyeIconUse) {
        togglePasswordBtn.addEventListener('click', () => {
            const isPassword = senhaInput.type === 'password';
            if (isPassword) {
                senhaInput.type = 'text';
                eyeIconUse.setAttribute('xlink:href', 'assets/img/icons.svg#icon-eye-off');
            } else {
                senhaInput.type = 'password';
                eyeIconUse.setAttribute('xlink:href', 'assets/img/icons.svg#icon-eye');
            }
        });
    }

    // Simulação de Autenticação Medieval (Login bem-sucedido)
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            if (loginFeedback) {
                loginFeedback.style.color = '#38bdf8';
                loginFeedback.textContent = 'Verificando runas ancestrais...';
            }

            setTimeout(() => {
                isLogado = true;
                if (loginFeedback) {
                    loginFeedback.style.color = '#22c55e';
                    loginFeedback.textContent = 'TESOURO DESTRAVADO! BEM-VINDO, MESTRE.';
                }

                if (chestIconUse) {
                    chestIconUse.setAttribute('xlink:href', 'assets/img/icons.svg#icon-chest-open');
                }

                setTimeout(() => {
                    loginModal.classList.remove('ativo');
                    loginForm.reset();
                    if (senhaInput) senhaInput.type = 'password';
                    if (eyeIconUse) eyeIconUse.setAttribute('xlink:href', 'assets/img/icons.svg#icon-eye');
                    if (loginFeedback) loginFeedback.textContent = '';
                }, 1200);
            }, 1000);
        });
    }
});
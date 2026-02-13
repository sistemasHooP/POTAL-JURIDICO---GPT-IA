/**
 * ============================================================================
 * ARQUIVO: js/login.js
 * DESCRIÇÃO: Lógica da página de Login (index.html).
 * ATUALIZAÇÃO: Sistema de "Warm-up" (Acordar servidor ao abrir a tela).
 * DEPENDÊNCIAS: js/api.js, js/auth.js, js/utils.js
 * AUTOR: Desenvolvedor Sênior (Sistema RPPS)
 * ============================================================================
 */

document.addEventListener('DOMContentLoaded', function() {

    // 1. Verificar se já está logado
    Auth.redirectIfAuthenticated();

    const preOverlay = document.getElementById('prelogin-overlay');
    const loginForm = document.getElementById('login-form');

    function setLoginReady() {
        if (preOverlay) preOverlay.classList.add('hidden');
        if (loginForm) {
            const controls = loginForm.querySelectorAll('input, button');
            controls.forEach(el => el.disabled = false);
        }
    }

    if (loginForm) {
        const controls = loginForm.querySelectorAll('input, button');
        controls.forEach(el => el.disabled = true);
    }

    // --- WARM-UP (ACORDAR SERVIDOR) ---
    // Dispara um 'ping' silencioso assim que a tela carrega.
    // Isso tira o Google Apps Script do modo de suspensão enquanto o usuário digita a senha.
    console.log("Iniciando aquecimento do servidor...");
    API.call('ping', {}, 'POST', true).then(() => {
        console.log("Servidor pronto e aquecido.");
        setLoginReady();
    }).catch(e => {
        console.log("Tentativa de aquecimento falhou (sem problemas, o login tentará novamente).");
        setLoginReady();
    });

    // Fail-safe: libera login mesmo se o warm-up demorar demais
    setTimeout(setLoginReady, 6000);

    // Referências aos elementos do DOM
    const emailInput = document.getElementById('email');
    const senhaInput = document.getElementById('senha');
    const togglePasswordBtn = document.getElementById('toggle-password');

    // 2. Manipulação do Botão "Ver Senha"
    if (togglePasswordBtn && senhaInput) {
        togglePasswordBtn.addEventListener('click', function() {
            const type = senhaInput.getAttribute('type') === 'password' ? 'text' : 'password';
            senhaInput.setAttribute('type', type);

            // Alterna o estilo do ícone
            this.classList.toggle('text-slate-600');
            this.classList.toggle('text-slate-400');
        });
    }

    // 3. Envio do Formulário de Login (com proteção contra double-submit)
    let loginEmAndamento = false;
    const btnSubmit = loginForm ? loginForm.querySelector('button[type="submit"]') : null;

    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            // Bloqueia múltiplos cliques
            if (loginEmAndamento) return;

            const email = emailInput.value.trim();
            const senha = senhaInput.value;

            if (!email || !senha) {
                Utils.showToast("Por favor, preencha todos os campos.", "warning");
                return;
            }

            // Trava o formulário imediatamente
            loginEmAndamento = true;
            if (btnSubmit) {
                btnSubmit.disabled = true;
                btnSubmit.classList.add('opacity-60', 'cursor-not-allowed');
            }
            emailInput.readOnly = true;
            senhaInput.readOnly = true;

            try {
                // 1. Autenticação (API controla loading pelo LOADING_PROFILE)
                const response = await API.call('login', { email, senha }, 'POST', false);

                // Se chegou aqui, login ok - salva sessão ANTES de redirecionar
                Auth.saveSession(response);
                Utils.showToast("Login realizado com sucesso!", "success");

                // Redireciona após breve delay para garantir persistência da sessão
                setTimeout(function() {
                    var token = sessionStorage.getItem(CONFIG.STORAGE_KEYS.TOKEN);
                    var userData = sessionStorage.getItem(CONFIG.STORAGE_KEYS.USER_DATA);
                    if (token && userData) {
                        Utils.navigateTo(CONFIG.PAGES.DASHBOARD);
                    } else {
                        loginEmAndamento = false;
                        if (btnSubmit) {
                            btnSubmit.disabled = false;
                            btnSubmit.classList.remove('opacity-60', 'cursor-not-allowed');
                        }
                        emailInput.readOnly = false;
                        senhaInput.readOnly = false;
                        Utils.showToast('Não foi possível abrir a sessão. Tente novamente.', 'error');
                    }
                }, 350);

            } catch (error) {
                console.error("Falha no login:", error);

                // Destrava o formulário para nova tentativa
                loginEmAndamento = false;
                if (btnSubmit) {
                    btnSubmit.disabled = false;
                    btnSubmit.classList.remove('opacity-60', 'cursor-not-allowed');
                }
                emailInput.readOnly = false;
                senhaInput.readOnly = false;

                emailInput.classList.add('border-red-500');
                senhaInput.classList.add('border-red-500');

                setTimeout(() => {
                    emailInput.classList.remove('border-red-500');
                    senhaInput.classList.remove('border-red-500');
                }, 2000);

                Utils.showToast(error.message || "Email ou senha incorretos.", "error");
                senhaInput.value = "";
                senhaInput.focus();
            }
        });
    }
});

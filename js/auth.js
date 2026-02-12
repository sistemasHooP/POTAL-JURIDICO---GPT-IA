/**
 * ============================================================================
 * ARQUIVO: js/auth.js
 * DESCRIÇÃO: Gerenciamento de sessão e controle de acesso no Front-End.
 * FUNÇÃO: Login, Logout, Proteção de Rotas e Verificação de Perfil.
 * DEPENDÊNCIAS: js/config.js, js/utils.js
 * AUTOR: Desenvolvedor Sênior (Sistema RPPS)
 * ============================================================================
 */

const Auth = {

    /**
     * Verifica se existe uma sessão válida.
     * Deve ser chamada no início de todos os arquivos JS de páginas internas.
     * Se não houver token, redireciona para o login.
     */
    protectRoute: function() {
        const token = sessionStorage.getItem(CONFIG.STORAGE_KEYS.TOKEN);
        const userData = sessionStorage.getItem(CONFIG.STORAGE_KEYS.USER_DATA);

        // Se não tem dados de sessão, limpa tudo e manda pro login
        if (!token || !userData) {
            console.warn("Acesso não autorizado. Redirecionando para login...");
            this.logout(); 
            return false;
        }
        return true;
    },

    /**
     * Verifica se o usuário JÁ está logado ao acessar a tela de login.
     * Se sim, manda direto pro Dashboard.
     */
    redirectIfAuthenticated: function() {
        const token = sessionStorage.getItem(CONFIG.STORAGE_KEYS.TOKEN);
        const userData = sessionStorage.getItem(CONFIG.STORAGE_KEYS.USER_DATA);

        // Evita redirecionar com sessão incompleta/corrompida
        if (!token || !userData) {
            if (token || userData) {
                sessionStorage.removeItem(CONFIG.STORAGE_KEYS.TOKEN);
                sessionStorage.removeItem(CONFIG.STORAGE_KEYS.USER_DATA);
            }
            return;
        }

        try {
            JSON.parse(userData);
        } catch (e) {
            sessionStorage.removeItem(CONFIG.STORAGE_KEYS.TOKEN);
            sessionStorage.removeItem(CONFIG.STORAGE_KEYS.USER_DATA);
            return;
        }

        Utils.navigateTo(CONFIG.PAGES.DASHBOARD);
    },

    /**
     * Salva a sessão no navegador após a API confirmar o login.
     * @param {Object} data - Objeto retornado pela API { token, user }
     */
    saveSession: function(data) {
        if (!data || !data.token || !data.user) {
            console.error("Tentativa de salvar sessão inválida", data);
            return;
        }
        sessionStorage.setItem(CONFIG.STORAGE_KEYS.TOKEN, data.token);
        sessionStorage.setItem(CONFIG.STORAGE_KEYS.USER_DATA, JSON.stringify(data.user));
    },

    /**
     * Encerra a sessão e volta para a tela inicial.
     */
    logout: function() {
        sessionStorage.removeItem(CONFIG.STORAGE_KEYS.TOKEN);
        sessionStorage.removeItem(CONFIG.STORAGE_KEYS.USER_DATA);
        Utils.navigateTo(CONFIG.PAGES.LOGIN);
    },

    /**
     * Retorna os dados do usuário logado (Nome, Email, Perfil).
     * @returns {Object|null}
     */
    getUser: function() {
        const data = sessionStorage.getItem(CONFIG.STORAGE_KEYS.USER_DATA);
        if (!data) return null;
        try {
            return JSON.parse(data);
        } catch (e) {
            console.error("Erro ao ler dados do usuário", e);
            return null;
        }
    },

    /**
     * Verifica se o usuário logado tem permissão de "ADMIN" ou "PRESIDENTE".
     * Útil para renderização condicional de elementos na tela.
     */
    isAdminOrPresident: function() {
        const user = this.getUser();
        if (!user) return false;
        const perfil = user.perfil.toUpperCase();
        return perfil === 'ADMIN' || perfil === 'PRESIDENTE';
    },

    /**
     * Atualiza a interface com o nome do usuário logado.
     * Procura por elementos com ID 'user-name-display' e 'user-profile-display'.
     */

    /**
     * Verifica se existem prazos pendentes e destaca atalhos para o Dashboard.
     */
    updateDashboardNotificationHint: function() {
        try {
            if (window.location.pathname.endsWith('dashboard.html')) return;
            if (!window.API || !API.processos || !API.processos.listarNotificacoesPrazos) return;

            API.processos.listarNotificacoesPrazos(function(data) {
                var total = Array.isArray(data) ? data.length : 0;
                var links = document.querySelectorAll('a[href="dashboard.html"]');

                links.forEach(function(link) {
                    var old = link.querySelector('.dashboard-notif-badge');
                    if (old) old.remove();

                    if (total > 0) {
                        var badge = document.createElement('span');
                        badge.className = 'dashboard-notif-badge ml-2 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold';
                        badge.textContent = total > 99 ? '99+' : String(total);
                        link.appendChild(badge);
                    }
                });

                if (total > 0 && !sessionStorage.getItem('rpps_dashboard_notif_seen')) {
                    Utils.showToast('Você tem ' + total + ' prazo(s). Veja no Dashboard.', 'warning');
                    sessionStorage.setItem('rpps_dashboard_notif_seen', '1');
                }
            }, true).catch(function() {});
        } catch (e) {
            console.warn('Falha ao atualizar indicador de notificações do dashboard', e);
        }
    },

    updateUserInfoUI: function() {
        const user = this.getUser();
        if (user) {
            const nameEl = document.getElementById('user-name-display');
            const profileEl = document.getElementById('user-profile-display');

            if (nameEl) nameEl.textContent = user.nome;
            if (profileEl) profileEl.textContent = user.perfil;

            // Exibe/oculta itens de menu exclusivos para admin
            const perfil = (user.perfil || '').toUpperCase();
            const isAdmin = perfil === 'ADMIN' || perfil === 'PRESIDENTE';
            document.querySelectorAll('[data-admin-only]').forEach(function(el) {
                if (isAdmin) {
                    el.classList.remove('hidden');
                    el.classList.add('flex');
                } else {
                    el.classList.add('hidden');
                    el.classList.remove('flex');
                }
            });

            this.updateDashboardNotificationHint();
        }
    }
};
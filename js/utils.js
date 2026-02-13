/**
 * ============================================================================
 * ARQUIVO: js/utils.js
 * DESCRIÇÃO: Biblioteca de funções utilitárias.
 * ATUALIZAÇÃO: Loader com suporte a ícones personalizados (Banco de Dados).
 * ============================================================================
 */

const Utils = {

    // --- CACHE INTELIGENTE ---
    Cache: {
        set: function(key, data, ttlInMinutes = 5) {
            const now = new Date();
            const item = { value: data, expiry: now.getTime() + (ttlInMinutes * 60 * 1000) };
            try { localStorage.setItem(key, JSON.stringify(item)); } catch (e) { console.warn("Cache cheio", e); }
        },
        get: function(key) {
            const itemStr = localStorage.getItem(key);
            if (!itemStr) return null;
            try {
                const item = JSON.parse(itemStr);
                if (new Date().getTime() > item.expiry) { localStorage.removeItem(key); return null; }
                return item.value;
            } catch (e) { return null; }
        },
        clear: function(keyPrefix) {
            if (!keyPrefix) { localStorage.clear(); return; }
            Object.keys(localStorage).forEach(key => { if (key.startsWith(keyPrefix)) localStorage.removeItem(key); });
        }
    },

    // --- COMPRESSOR ---
    Compressor: {
        compressImage: function(file) {
            return new Promise((resolve, reject) => {
                const maxWidth = 1600; const quality = 0.7;
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = function(event) {
                    const img = new Image();
                    img.src = event.target.result;
                    img.onload = function() {
                        let width = img.width; let height = img.height;
                        if (width > maxWidth) { height = Math.round((height * maxWidth) / width); width = maxWidth; }
                        const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
                        const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, width, height);
                        const dataUrl = canvas.toDataURL('image/jpeg', quality);
                        resolve({ base64: dataUrl.split(',')[1], mimeType: 'image/jpeg', nome: file.name.replace(/\.[^/.]+$/, "") + ".jpg" });
                    };
                    img.onerror = () => reject(new Error("Erro na imagem."));
                };
                reader.onerror = () => reject(new Error("Erro ao ler arquivo."));
            });
        }
    },

    // --- UI (User Interface) ---

    /**
     * Exibe a tela de carregamento contextual.
     * @param {string} message - Mensagem principal (ex.: "Abrindo Pasta Virtual...").
     * @param {string} type - 'spinner' (padrão) ou 'database' (ícone de banco).
     * @param {string} detail - Contexto complementar (ex.: "Autos de João da Silva").
     */
    showLoading: function(message = "Carregando...", type = 'spinner', detail = '') {
        let loader = document.getElementById('global-loader');

        const iconSpinner = `<div class="animate-spin rounded-full h-14 w-14 border-t-4 border-b-4 border-blue-600 mb-4"></div>`;

        const iconDatabase = `
            <div class="mb-4 relative">
                <svg class="w-16 h-16 text-blue-600 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"></path>
                </svg>
                <div class="absolute -bottom-1 -right-1 bg-green-500 rounded-full p-1 border-2 border-white animate-bounce">
                    <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>
                </div>
            </div>
        `;

        const selectedIcon = (type === 'database') ? iconDatabase : iconSpinner;
        const subtitle = detail ? String(detail) : 'Sincronizando dados com segurança...';

        if (!loader) {
            loader = document.createElement('div');
            loader.id = 'global-loader';
            loader.className = 'fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-900 bg-opacity-90 backdrop-blur-sm transition-opacity duration-300';

            const content = document.createElement('div');
            content.className = 'flex flex-col items-center p-8 max-w-lg';

            const iconEl = document.createElement('div');
            iconEl.id = 'loader-icon';
            iconEl.innerHTML = selectedIcon;

            const msgEl = document.createElement('p');
            msgEl.id = 'loader-message';
            msgEl.className = 'text-white font-semibold text-lg tracking-wide text-center';
            msgEl.textContent = String(message);

            const detailEl = document.createElement('p');
            detailEl.id = 'loader-detail';
            detailEl.className = 'text-slate-300 text-sm mt-1 text-center';
            detailEl.textContent = subtitle;

            const hintEl = document.createElement('p');
            hintEl.className = 'text-slate-400 text-xs mt-2 animate-pulse';
            hintEl.textContent = 'Aguarde um instante...';

            content.appendChild(iconEl);
            content.appendChild(msgEl);
            content.appendChild(detailEl);
            content.appendChild(hintEl);
            loader.appendChild(content);
            document.body.appendChild(loader);
        } else {
            const msgEl = document.getElementById('loader-message');
            const detailEl = document.getElementById('loader-detail');
            const iconEl = document.getElementById('loader-icon');
            if (msgEl) msgEl.textContent = String(message);
            if (detailEl) detailEl.textContent = subtitle;
            if (iconEl) iconEl.innerHTML = selectedIcon;
        }

        loader.classList.remove('hidden');
        loader.classList.add('flex');
    },

    hideLoading: function() {
        const loader = document.getElementById('global-loader');
        if (loader) {
            loader.classList.add('hidden');
            loader.classList.remove('flex');
        }
    },

    showSyncStatus: function(message = 'Sincronizando dados...') {
        let status = document.getElementById('global-sync-status');
        if (!status) {
            status = document.createElement('div');
            status.id = 'global-sync-status';
            status.className = 'fixed top-3 left-1/2 -translate-x-1/2 z-[105] hidden items-center gap-2 px-4 py-2 rounded-full bg-slate-900/90 text-white text-xs font-medium shadow-lg border border-white/15 backdrop-blur transition-opacity duration-200';
            status.innerHTML = `
                <span class="inline-block h-3 w-3 rounded-full border-2 border-white/35 border-t-white animate-spin"></span>
                <span id="global-sync-status-message"></span>
            `;
            document.body.appendChild(status);
        }

        status.dataset.visibleAt = String(Date.now());
        const msgEl = document.getElementById('global-sync-status-message');
        if (msgEl) msgEl.textContent = message;
        status.classList.remove('hidden');
        status.classList.add('flex');
        status.classList.remove('opacity-0');
    },

    hideSyncStatus: function() {
        const status = document.getElementById('global-sync-status');
        if (!status) return;

        const visibleAt = Number(status.dataset.visibleAt || Date.now());
        const elapsed = Date.now() - visibleAt;
        const minVisibleMs = 500;
        const hide = function() {
            status.classList.add('hidden');
            status.classList.remove('flex');
            status.classList.add('opacity-0');
        };

        if (elapsed >= minVisibleMs) {
            hide();
        } else {
            setTimeout(hide, minVisibleMs - elapsed);
        }
    },

    showToast: function(message, type = 'info', title = '') {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.className = 'fixed top-4 right-4 z-[110] flex flex-col gap-2 max-w-xs w-full px-4 sm:px-0 pointer-events-none';
            document.body.appendChild(container);
        }

        const variant = {
            success: {
                box: 'bg-emerald-600 text-white shadow-lg',
                icon: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M5 13l4 4L19 7"></path></svg>',
                title: 'Sucesso'
            },
            error: {
                box: 'bg-red-600 text-white shadow-lg',
                icon: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M6 18L18 6M6 6l12 12"></path></svg>',
                title: 'Erro'
            },
            warning: {
                box: 'bg-amber-500 text-white shadow-lg',
                icon: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M12 9v2m0 4h.01M10.29 3.86l-7.5 13A2 2 0 004.5 20h15a2 2 0 001.71-3.14l-7.5-13a2 2 0 00-3.42 0z"></path></svg>',
                title: 'Atenção'
            },
            info: {
                box: 'bg-slate-800 text-white shadow-lg',
                icon: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M13 16h-1v-4h-1m1-4h.01M12 22a10 10 0 100-20 10 10 0 000 20z"></path></svg>',
                title: 'Informação'
            }
        };

        const v = variant[type] || variant.info;
        const toastTitle = title || v.title;

        const toast = document.createElement('div');
        toast.className = `pointer-events-auto flex items-start gap-3 w-full p-4 rounded-lg shadow-xl transform transition-all duration-300 translate-x-full ${v.box}`;

        const iconWrap = document.createElement('div');
        iconWrap.className = 'shrink-0 mt-0.5';
        iconWrap.innerHTML = v.icon;

        const content = document.createElement('div');
        content.className = 'min-w-0';

        const titleEl = document.createElement('p');
        titleEl.className = 'text-xs font-semibold uppercase tracking-wide opacity-90';
        titleEl.textContent = String(toastTitle);

        const messageEl = document.createElement('p');
        messageEl.className = 'font-medium leading-snug';
        messageEl.textContent = String(message);

        content.appendChild(titleEl);
        content.appendChild(messageEl);
        toast.appendChild(iconWrap);
        toast.appendChild(content);

        container.appendChild(toast);
        requestAnimationFrame(() => toast.classList.remove('translate-x-full'));
        setTimeout(() => {
            toast.classList.add('opacity-0', 'translate-x-full');
            setTimeout(() => { if(toast.parentElement) toast.remove(); }, 300);
        }, 3000);
    },

    addSyncButton: function(onClickAction) {
        const oldBtn = document.getElementById('floating-sync-btn');
        if(oldBtn) oldBtn.remove();

        const btn = document.createElement('button');
        btn.id = 'floating-sync-btn';
        btn.className = 'fixed bottom-20 right-4 md:bottom-8 md:right-8 z-40 bg-slate-800 hover:bg-slate-700 text-white p-4 rounded-full shadow-xl hover:shadow-2xl transition-all active:scale-90 flex items-center justify-center';
        btn.innerHTML = `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>`;
        btn.title = "Sincronizar";
        
        btn.onclick = function() {
            btn.querySelector('svg').classList.add('animate-spin');
            onClickAction().finally(() => { setTimeout(() => btn.querySelector('svg').classList.remove('animate-spin'), 1000); });
        };
        document.body.appendChild(btn);
    },

    formatDate: function(dateInput) {
        if (!dateInput) return '-';
        const date = new Date(dateInput);
        if (isNaN(date.getTime())) return dateInput;
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        const hours = date.getHours();
        const minutes = date.getMinutes();
        const seconds = date.getSeconds();
        // Omite horário se for 00:00:00 (data sem hora)
        if (hours === 0 && minutes === 0 && seconds === 0) {
            return `${day}/${month}/${year}`;
        }
        return `${day}/${month}/${year} ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    },

    getStatusClass: function(status) {
        if (!status) return 'bg-slate-100 text-slate-800';
        switch (status.toUpperCase()) {
            case 'EM ANDAMENTO': return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'JULGADO': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
            case 'ARQUIVADO': return 'bg-slate-100 text-slate-600 border-slate-200';
            case 'SOBRESTADO': return 'bg-amber-100 text-amber-800 border-amber-200';
            case 'CANCELADO': return 'bg-red-100 text-red-800 border-red-200';
            default: return 'bg-slate-100 text-slate-800';
        }
    },

    getStatusLabel: function(status) {
        const map = {
            'EM ANDAMENTO': 'Processo fluindo normalmente.',
            'JULGADO': 'Decisão final proferida.',
            'SOBRESTADO': 'Pausado aguardando decisão externa.',
            'ARQUIVADO': 'Processo finalizado e arquivado.',
            'CANCELADO': 'Processo anulado.'
        };
        return map[status.toUpperCase()] || '';
    },

    navigateTo: function(page) { window.location.href = page; },
    escapeHtml: function(text) {
        if (!text) return '';
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    },


    /**
     * Mantém apenas dígitos do documento.
     */
    onlyDigits: function(value) {
        return String(value || '').replace(/\D/g, '');
    },

    /**
     * Detecta se o documento é CPF, CNPJ ou inválido.
     */
    getDocumentType: function(value) {
        const d = this.onlyDigits(value);
        if (d.length <= 11 && d.length > 0) return 'CPF';
        if (d.length > 11 && d.length <= 14) return 'CNPJ';
        return 'INVALIDO';
    },

    /**
     * Formata documento automaticamente (CPF/CNPJ).
     */
    formatDocument: function(value) {
        const d = this.onlyDigits(value);
        if (d.length === 11) {
            return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
        }
        if (d.length === 14) {
            return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
        }
        return String(value || '');
    },

    /**
     * Aplica máscara dinâmica em campo de documento (CPF/CNPJ).
     */
    maskDocumentInput: function(rawValue) {
        let v = this.onlyDigits(rawValue);
        if (v.length > 14) v = v.substring(0, 14);

        if (v.length <= 11) {
            if (v.length > 9) return v.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
            if (v.length > 6) return v.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
            if (v.length > 3) return v.replace(/(\d{3})(\d{1,3})/, '$1.$2');
            return v;
        }

        if (v.length > 12) return v.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{1,2})/, '$1.$2.$3/$4-$5');
        if (v.length > 8) return v.replace(/(\d{2})(\d{3})(\d{3})(\d{1,4})/, '$1.$2.$3/$4');
        if (v.length > 5) return v.replace(/(\d{2})(\d{3})(\d{1,3})/, '$1.$2.$3');
        if (v.length > 2) return v.replace(/(\d{2})(\d{1,3})/, '$1.$2');
        return v;
    },

    /**
     * Valida CPF usando algoritmo oficial brasileiro (dígitos verificadores).
     * @param {string} cpf - CPF (apenas dígitos ou com pontuação)
     * @returns {boolean}
     */
    validarCPF: function(cpf) {
        var d = String(cpf || '').replace(/\D/g, '');
        if (d.length !== 11) return false;
        if (/^(\d)\1{10}$/.test(d)) return false;
        var sum = 0, i;
        for (i = 0; i < 9; i++) sum += parseInt(d.charAt(i)) * (10 - i);
        var rem = sum % 11;
        var dig1 = rem < 2 ? 0 : 11 - rem;
        if (parseInt(d.charAt(9)) !== dig1) return false;
        sum = 0;
        for (i = 0; i < 10; i++) sum += parseInt(d.charAt(i)) * (11 - i);
        rem = sum % 11;
        var dig2 = rem < 2 ? 0 : 11 - rem;
        return parseInt(d.charAt(10)) === dig2;
    },

    validarCNPJ: function(cnpj) {
        var d = String(cnpj || '').replace(/\D/g, '');
        if (d.length !== 14) return false;
        if (/^(\d)\1{13}$/.test(d)) return false;
        var t = d.length - 2;
        var n = d.substring(0, t);
        var digitos = d.substring(t);
        var soma = 0, pos = t - 7, i;
        for (i = t; i >= 1; i--) {
            soma += parseInt(n.charAt(t - i)) * pos--;
            if (pos < 2) pos = 9;
        }
        var res = soma % 11 < 2 ? 0 : 11 - (soma % 11);
        if (res !== parseInt(digitos.charAt(0))) return false;
        t++;
        n = d.substring(0, t);
        soma = 0;
        pos = t - 7;
        for (i = t; i >= 1; i--) {
            soma += parseInt(n.charAt(t - i)) * pos--;
            if (pos < 2) pos = 9;
        }
        res = soma % 11 < 2 ? 0 : 11 - (soma % 11);
        return res === parseInt(digitos.charAt(1));
    }
};

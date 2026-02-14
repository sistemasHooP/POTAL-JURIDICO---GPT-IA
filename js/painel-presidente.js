/**
 * ==========================================================================
 * ARQUIVO: js/painel-presidente.js
 * DESCRIÇÃO: Lógica do Painel do Presidente (MVP)
 * ==========================================================================
 */

(function() {
  function setStatus(msg, type) {
    var el = document.getElementById('painel-status');
    if (!el) return;
    el.textContent = msg || '';
    el.className = 'text-sm ' + (type === 'error' ? 'text-red-600' : type === 'success' ? 'text-emerald-600' : 'text-slate-500');
  }

  function formatDate(value) {
    if (!value) return '-';
    try {
      return Utils.formatDate(value);
    } catch (e) {
      return String(value);
    }
  }

  function montarFiltroLogs() {
    return {
      texto: (document.getElementById('filtro-texto') || {}).value || '',
      status: (document.getElementById('filtro-status') || {}).value || '',
      atalho: (document.getElementById('filtro-atalho') || {}).value || '',
      limit: 100,
      offset: 0
    };
  }

  function renderLogs(items) {
    var tbody = document.getElementById('logs-lista');
    if (!tbody) return;

    if (!items || !items.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-slate-400">Nenhum log encontrado.</td></tr>';
      return;
    }

    var html = '';
    items.forEach(function(l) {
      html += '<tr class="border-t border-slate-100">';
      html += '<td class="p-2 whitespace-nowrap">' + Utils.escapeHtml(formatDate(l.data_hora)) + '</td>';
      html += '<td class="p-2">' + Utils.escapeHtml(l.usuario || '-') + '</td>';
      html += '<td class="p-2">' + Utils.escapeHtml(l.acao || '-') + '</td>';
      html += '<td class="p-2">' + Utils.escapeHtml(l.status || '-') + '</td>';
      html += '<td class="p-2">' + Utils.escapeHtml(l.detalhes || '-') + '</td>';
      html += '</tr>';
    });

    tbody.innerHTML = html;
  }

  function renderGestores(items) {
    var tbody = document.getElementById('gestores-lista');
    if (!tbody) return;

    if (!items || !items.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-slate-400">Nenhum usuário gestor encontrado.</td></tr>';
      return;
    }

    var html = '';
    items.forEach(function(u) {
      var ativo = (u.ativo === true || u.ativo === 'TRUE' || u.ativo === 'true' || u.ativo === 1);
      html += '<tr class="border-t border-slate-100">';
      html += '<td class="p-2">' + Utils.escapeHtml(u.nome || '-') + '<br><span class="text-[10px] text-slate-400">' + Utils.escapeHtml(u.email || '-') + '</span></td>';
      html += '<td class="p-2">' + Utils.escapeHtml(u.perfil || '-') + '</td>';
      html += '<td class="p-2">' + (ativo ? 'SIM' : 'NÃO') + '</td>';
      html += '<td class="p-2">' + Utils.escapeHtml(formatDate(u.ultimo_login)) + '</td>';
      html += '<td class="p-2">';
      html += '<button class="px-2 py-1 rounded bg-slate-800 text-white text-[10px] mr-1" data-action="toggle-status" data-id="' + Utils.escapeHtml(u.id || '') + '" data-next="' + (!ativo) + '">' + (ativo ? 'Desativar' : 'Ativar') + '</button>';
      html += '<button class="px-2 py-1 rounded bg-amber-600 text-white text-[10px]" data-action="reset-senha" data-id="' + Utils.escapeHtml(u.id || '') + '">Reset senha</button>';
      html += '</td></tr>';
    });

    tbody.innerHTML = html;
  }

  function carregarResumo() {
    return API.presidente.getResumo().then(function(data) {
      var c = (data && data.counts) || {};
      document.getElementById('resumo-processos').textContent = c.processos || 0;
      document.getElementById('resumo-usuarios').textContent = c.usuarios || 0;
      document.getElementById('resumo-clientes').textContent = c.clientes || 0;
      document.getElementById('resumo-logs').textContent = c.logs || 0;
    });
  }

  function carregarLogs() {
    var filtro = montarFiltroLogs();
    return API.presidente.listarLogs(filtro).then(function(resp) {
      renderLogs((resp && resp.items) || []);
    });
  }

  function carregarGestores() {
    return API.presidente.listarUsuariosGestores().then(renderGestores);
  }

  function carregarTudo() {
    setStatus('Atualizando painel...');
    return Promise.all([carregarResumo(), carregarLogs(), carregarGestores()])
      .then(function() { setStatus('Painel atualizado com sucesso.', 'success'); })
      .catch(function(e) {
        console.error(e);
        setStatus(e.message || 'Erro ao atualizar painel.', 'error');
      });
  }

  function exportarCsvLogs() {
    var filtro = montarFiltroLogs();
    setStatus('Gerando CSV...');
    API.presidente.exportarLogsCsv(filtro)
      .then(function(resp) {
        var bytes = atob(resp.base64 || '');
        var arr = new Uint8Array(bytes.length);
        for (var i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
        var blob = new Blob([arr], { type: resp.content_type || 'text/csv;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = resp.file_name || 'logs.csv';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        setStatus('CSV exportado com sucesso.', 'success');
      })
      .catch(function(e) {
        setStatus(e.message || 'Erro ao exportar CSV.', 'error');
      });
  }

  function init() {
    if (!Auth.protectRoute()) return;
    if (!Auth.isPresident()) {
      Utils.showToast('Acesso negado. Apenas PRESIDENTE pode abrir este painel.', 'error');
      setTimeout(function() { Utils.navigateTo('dashboard.html'); }, 1200);
      return;
    }

    Auth.updateUserInfoUI();

    var outDesktop = document.getElementById('desktop-logout-btn');
    if (outDesktop) outDesktop.addEventListener('click', function() { if (confirm('Sair?')) Auth.logout(); });
    var outMobile = document.getElementById('mobile-logout-btn');
    if (outMobile) outMobile.addEventListener('click', function() { if (confirm('Sair?')) Auth.logout(); });

    document.getElementById('btn-refresh-painel').addEventListener('click', carregarTudo);
    document.getElementById('btn-filtrar-logs').addEventListener('click', carregarLogs);
    document.getElementById('btn-exportar-csv').addEventListener('click', exportarCsvLogs);

    document.getElementById('btn-limpar-logs').addEventListener('click', function() {
      var dias = prompt('Manter logs de quantos dias? (padrão 90)', '90');
      if (dias === null) return;
      setStatus('Executando limpeza de logs...');
      API.presidente.limparLogs({ retention_days: Number(dias || 90) })
        .then(function(r) {
          Utils.showToast('Limpeza concluída. Removidos: ' + (r.removed || 0), 'success');
          return carregarTudo();
        })
        .catch(function(e) {
          setStatus(e.message || 'Erro ao limpar logs.', 'error');
        });
    });

    document.getElementById('btn-backup').addEventListener('click', function() {
      var keep = prompt('Manter quantos backups mais recentes?', '3');
      if (keep === null) return;
      setStatus('Gerando backup...');
      API.presidente.gerarBackupAgora({ keep_last: Number(keep || 3) })
        .then(function(r) {
          Utils.showToast('Backup gerado com sucesso!', 'success');
          setStatus('Backup criado: ' + (r.backup_nome || ''), 'success');
        })
        .catch(function(e) {
          setStatus(e.message || 'Erro ao gerar backup.', 'error');
        });
    });

    document.getElementById('btn-recarregar-usuarios').addEventListener('click', carregarGestores);
    document.getElementById('btn-manutencao').addEventListener('click', function() {
      var ativo = confirm('Ativar modo manutenção?\n(OK = ativar / Cancelar = desativar)');
      var msg = prompt('Mensagem para o login durante manutenção:', 'Sistema em manutenção. Tente novamente em instantes.');
      if (msg === null) return;
      API.presidente.atualizarManutencao({ enabled: ativo, message: msg })
        .then(function() {
          Utils.showToast('Modo manutenção atualizado.', 'success');
          return carregarResumo();
        })
        .catch(function(err) {
          Utils.showToast(err.message || 'Erro ao atualizar manutenção.', 'error');
        });
    });

    document.getElementById('gestores-lista').addEventListener('click', function(e) {
      var target = e.target;
      var action = target.getAttribute('data-action');
      var id = target.getAttribute('data-id');
      if (!action || !id) return;

      if (action === 'toggle-status') {
        var next = target.getAttribute('data-next') === 'true';
        API.presidente.atualizarStatusUsuario({ usuario_id: id, ativo: next })
          .then(function() {
            Utils.showToast('Status atualizado.', 'success');
            return carregarGestores();
          })
          .catch(function(err) { Utils.showToast(err.message || 'Erro ao atualizar status.', 'error'); });
      }

      if (action === 'reset-senha') {
        var nova = prompt('Digite a nova senha temporária (mín. 6 caracteres):');
        if (!nova) return;
        API.presidente.resetSenhaUsuario({ usuario_id: id, nova_senha: nova })
          .then(function() { Utils.showToast('Senha redefinida com sucesso.', 'success'); })
          .catch(function(err) { Utils.showToast(err.message || 'Erro ao redefinir senha.', 'error'); });
      }
    });

    carregarTudo();
  }

  document.addEventListener('DOMContentLoaded', init);
})();

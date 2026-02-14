/**
 * ============================================================================
 * ARQUIVO: PresidenteService.gs
 * DESCRIÇÃO: Regras do Painel do Presidente (governança, logs e operações).
 * ============================================================================
 */

var PresidenteService = {

  _assertPresidente: function(payload) {
    var auth = AuthService.verificarToken(payload || {});
    if (!auth.valido) {
      throw new Error('Sessão expirada. Faça login novamente.');
    }

    if (!AuthService.isPresidente(auth.user.perfil)) {
      throw new Error('Acesso negado. Apenas PRESIDENTE pode acessar este painel.');
    }

    return auth;
  },

  _toDate: function(value) {
    var d = new Date(value || '');
    return isNaN(d.getTime()) ? null : d;
  },

  _inferirStatusLog: function(log) {
    var acao = String(log.acao || '').toUpperCase();
    var detalhes = String(log.detalhes || '').toUpperCase();
    if (acao.indexOf('FALHA') !== -1 || acao.indexOf('BLOQUEADO') !== -1 || acao.indexOf('RATE_LIMIT') !== -1 || detalhes.indexOf('ERRO') !== -1) {
      return 'ERRO';
    }
    return 'OK';
  },

  _perfilPorEmail: function(email, usuariosMap) {
    var key = String(email || '').trim().toLowerCase();
    if (!key) return '-';
    return usuariosMap[key] || '-';
  },

  _lerLogsEnriquecidos: function() {
    var logs = Database.read(CONFIG.SHEET_NAMES.LOGS);
    var usuarios = Database.read(CONFIG.SHEET_NAMES.USUARIOS);
    var usuariosMap = {};

    usuarios.forEach(function(u) {
      var email = String(u.email || '').trim().toLowerCase();
      if (!email) return;
      usuariosMap[email] = String(u.perfil || '-').toUpperCase();
    });

    return logs.map(function(l) {
      var dt = l.data_hora || l.created_at || '';
      return {
        id: l.id || '',
        usuario: String(l.usuario || 'SISTEMA'),
        acao: String(l.acao || ''),
        data_hora: dt,
        detalhes: String(l.detalhes || ''),
        perfil: PresidenteService._perfilPorEmail(l.usuario, usuariosMap),
        status: PresidenteService._inferirStatusLog(l)
      };
    });
  },

  getResumo: function(payload) {
    var auth = this._assertPresidente(payload);

    var processos = Database.read(CONFIG.SHEET_NAMES.PROCESSOS).length;
    var usuarios = Database.read(CONFIG.SHEET_NAMES.USUARIOS).length;
    var clientes = Database.read(CONFIG.SHEET_NAMES.CLIENTES).length;
    var logs = Database.read(CONFIG.SHEET_NAMES.LOGS).length;

    var props = PropertiesService.getScriptProperties();

    return {
      counts: {
        processos: processos,
        usuarios: usuarios,
        clientes: clientes,
        logs: logs
      },
      maintenance: {
        enabled: props.getProperty('PRESIDENTE_MAINTENANCE_MODE') === 'true',
        message: props.getProperty('PRESIDENTE_MAINTENANCE_MESSAGE') || CONFIG.PRESIDENTE_PANEL.MAINTENANCE_MESSAGE
      },
      retention: {
        days: Number(props.getProperty('PRESIDENTE_LOG_RETENTION_DAYS') || CONFIG.PRESIDENTE_PANEL.LOG_RETENTION_DAYS),
        last_cleanup_at: props.getProperty('PRESIDENTE_LAST_LOG_CLEANUP_AT') || '',
        last_cleanup_removed: Number(props.getProperty('PRESIDENTE_LAST_LOG_CLEANUP_REMOVED') || 0)
      },
      backup: {
        keep_last: Number(props.getProperty('PRESIDENTE_BACKUP_KEEP_LAST') || CONFIG.PRESIDENTE_PANEL.BACKUP_KEEP_LAST),
        last_backup_at: props.getProperty('PRESIDENTE_LAST_BACKUP_AT') || ''
      },
      requested_by: auth.user.email
    };
  },

  listarLogs: function(payload) {
    this._assertPresidente(payload);

    var logs = this._lerLogsEnriquecidos();
    var inicio = this._toDate(payload.data_inicio);
    var fim = this._toDate(payload.data_fim);
    if (fim) fim.setHours(23, 59, 59, 999);

    var acao = String(payload.acao || '').trim().toUpperCase();
    var usuario = String(payload.usuario || '').trim().toLowerCase();
    var perfil = String(payload.perfil || '').trim().toUpperCase();
    var status = String(payload.status || '').trim().toUpperCase();
    var texto = Utils.normalizeText(payload.texto || '');
    var atalho = String(payload.atalho || '').trim().toUpperCase();

    if (atalho === 'ERROS_7_DIAS') {
      var d = new Date();
      d.setDate(d.getDate() - 7);
      inicio = d;
      status = 'ERRO';
    } else if (atalho === 'FALHAS_LOGIN') {
      acao = 'LOGIN';
      status = 'ERRO';
    } else if (atalho === 'ACOES_ADMIN') {
      acao = 'PRESIDENTE_';
    }

    var filtrados = logs.filter(function(log) {
      var dt = PresidenteService._toDate(log.data_hora);
      if (inicio && (!dt || dt < inicio)) return false;
      if (fim && (!dt || dt > fim)) return false;

      if (acao) {
        var acaoLog = String(log.acao || '').toUpperCase();
        if (acao === 'LOGIN') {
          if (acaoLog.indexOf('LOGIN') === -1) return false;
        } else if (acaoLog.indexOf(acao) === -1) {
          return false;
        }
      }
      if (usuario && String(log.usuario || '').toLowerCase().indexOf(usuario) === -1) return false;
      if (perfil && String(log.perfil || '').toUpperCase() !== perfil) return false;
      if (status && String(log.status || '').toUpperCase() !== status) return false;
      if (texto) {
        var base = Utils.normalizeText((log.acao || '') + ' ' + (log.usuario || '') + ' ' + (log.detalhes || ''));
        if (base.indexOf(texto) === -1) return false;
      }

      return true;
    });

    filtrados.sort(function(a, b) {
      return new Date(b.data_hora || 0) - new Date(a.data_hora || 0);
    });

    var limit = Number(payload.limit || 200);
    if (!limit || limit < 1) limit = 200;
    var offset = Number(payload.offset || 0);
    if (!offset || offset < 0) offset = 0;

    return {
      total: filtrados.length,
      items: filtrados.slice(offset, offset + limit)
    };
  },

  exportarLogsCsv: function(payload) {
    this._assertPresidente(payload);
    var data = this.listarLogs(payload);
    var rows = ['DATA_HORA,USUARIO,PERFIL,ACAO,STATUS,DETALHES'];

    (data.items || []).forEach(function(item) {
      var cols = [
        item.data_hora || '',
        item.usuario || '',
        item.perfil || '',
        item.acao || '',
        item.status || '',
        String(item.detalhes || '').replace(/\r?\n/g, ' ').replace(/"/g, '""')
      ];
      rows.push('"' + cols.join('","') + '"');
    });

    var csv = rows.join('\n');
    return {
      file_name: 'logs_filtrados_' + Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyyMMdd_HHmm') + '.csv',
      content_type: 'text/csv;charset=utf-8',
      base64: Utilities.base64Encode(csv)
    };
  },

  _limparLogsInterno: function(dias) {
    var limite = new Date();
    limite.setDate(limite.getDate() - dias);

    var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    var sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.LOGS);
    if (!sheet) throw new Error('Aba de LOGS não encontrada.');

    var values = sheet.getDataRange().getValues();
    if (values.length <= 1) {
      return { removed: 0, total_before: 0, total_after: 0, retention_days: dias };
    }

    var headers = values[0];
    var idxData = -1;
    headers.forEach(function(h, i) {
      var key = String(h || '').toLowerCase().trim().replace(/\s+/g, '_');
      if (key === 'data_hora' || key === 'created_at') idxData = i;
    });
    if (idxData === -1) throw new Error('Coluna data_hora não encontrada na aba LOGS.');

    var body = values.slice(1);
    var kept = [];
    var removed = 0;

    body.forEach(function(row) {
      var d = new Date(row[idxData] || '');
      var isValid = !isNaN(d.getTime());
      if (!isValid || d >= limite) {
        kept.push(row);
      } else {
        removed++;
      }
    });

    if (body.length > 0) {
      sheet.getRange(2, 1, body.length, headers.length).clearContent();
    }
    if (kept.length > 0) {
      sheet.getRange(2, 1, kept.length, headers.length).setValues(kept);
    }

    return {
      removed: removed,
      total_before: body.length,
      total_after: kept.length,
      retention_days: dias
    };
  },

  limparLogs: function(payload) {
    var auth = this._assertPresidente(payload);

    var props = PropertiesService.getScriptProperties();
    var dias = Number(payload.retention_days || props.getProperty('PRESIDENTE_LOG_RETENTION_DAYS') || CONFIG.PRESIDENTE_PANEL.LOG_RETENTION_DAYS);
    if (!dias || dias < 1) dias = CONFIG.PRESIDENTE_PANEL.LOG_RETENTION_DAYS;

    var resumo = this._limparLogsInterno(dias);

    props.setProperty('PRESIDENTE_LOG_RETENTION_DAYS', String(dias));
    props.setProperty('PRESIDENTE_LAST_LOG_CLEANUP_AT', new Date().toISOString());
    props.setProperty('PRESIDENTE_LAST_LOG_CLEANUP_REMOVED', String(resumo.removed));

    Utils.logAction(auth.user.email, 'PRESIDENTE_LIMPAR_LOGS', 'Limpeza de logs executada.', {
      retention_days: dias,
      removed: resumo.removed,
      total_before: resumo.total_before,
      total_after: resumo.total_after
    });

    return resumo;
  },

  getHealth: function(payload) {
    this._assertPresidente(payload);
    var health = {
      database: false,
      drive: false,
      email: false
    };

    try {
      health.database = !!SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    } catch (e) {}

    try {
      health.drive = !!DriveApp.getFolderById(CONFIG.DRIVE_ROOT_FOLDER_ID);
    } catch (e2) {}

    try {
      health.email = MailApp.getRemainingDailyQuota() > 0;
    } catch (e3) {}

    return {
      healthy: health.database && health.drive,
      checks: health,
      timestamp: new Date().toISOString()
    };
  },

  getUsuariosGestores: function(payload) {
    this._assertPresidente(payload);

    var usuarios = Database.read(CONFIG.SHEET_NAMES.USUARIOS).filter(function(u) {
      var p = String(u.perfil || '').toUpperCase();
      return p === ENUMS.PERFIL.ADMIN || p === ENUMS.PERFIL.ADVOGADO;
    });

    var logs = this._lerLogsEnriquecidos();
    var ultimoLoginByUser = {};
    logs.forEach(function(l) {
      var acao = String(l.acao || '').toUpperCase();
      if (acao !== ENUMS.ACOES_LOG.LOGIN) return;
      var email = String(l.usuario || '').trim().toLowerCase();
      if (!email) return;
      var ts = new Date(l.data_hora || '').getTime() || 0;
      if (!ultimoLoginByUser[email] || ts > ultimoLoginByUser[email]) {
        ultimoLoginByUser[email] = ts;
      }
    });

    return usuarios.map(function(u) {
      var email = String(u.email || '').trim().toLowerCase();
      return {
        id: u.id,
        nome: u.nome,
        email: u.email,
        perfil: u.perfil,
        ativo: u.ativo,
        ultimo_login: ultimoLoginByUser[email] ? new Date(ultimoLoginByUser[email]).toISOString() : ''
      };
    });
  },

  atualizarStatusUsuario: function(payload) {
    var auth = this._assertPresidente(payload);
    var usuarioId = String(payload.usuario_id || '').trim();
    if (!usuarioId) throw new Error('ID do usuário é obrigatório.');

    var usuario = Database.findById(CONFIG.SHEET_NAMES.USUARIOS, usuarioId);
    if (!usuario) throw new Error('Usuário não encontrado.');

    var perfil = String(usuario.perfil || '').toUpperCase();
    if (perfil !== ENUMS.PERFIL.ADMIN && perfil !== ENUMS.PERFIL.ADVOGADO) {
      throw new Error('Somente ADMIN e ADVOGADO podem ser alterados neste painel.');
    }

    var ativo = payload.ativo === true || payload.ativo === 'true' || payload.ativo === 'TRUE' || payload.ativo === 1;

    Database.update(CONFIG.SHEET_NAMES.USUARIOS, usuarioId, { ativo: ativo });

    Utils.logAction(auth.user.email, 'PRESIDENTE_ATUALIZAR_STATUS_USUARIO', 'Status atualizado para ' + usuario.email, {
      usuario_id: usuarioId,
      ativo: ativo
    });

    return { atualizado: true };
  },

  resetSenhaUsuario: function(payload) {
    var auth = this._assertPresidente(payload);
    var usuarioId = String(payload.usuario_id || '').trim();
    var novaSenha = String(payload.nova_senha || '').trim();
    if (!usuarioId) throw new Error('ID do usuário é obrigatório.');
    if (!novaSenha || novaSenha.length < 6) throw new Error('Nova senha deve ter ao menos 6 caracteres.');

    var usuario = Database.findById(CONFIG.SHEET_NAMES.USUARIOS, usuarioId);
    if (!usuario) throw new Error('Usuário não encontrado.');

    var perfil = String(usuario.perfil || '').toUpperCase();
    if (perfil !== ENUMS.PERFIL.ADMIN && perfil !== ENUMS.PERFIL.ADVOGADO) {
      throw new Error('Somente ADMIN e ADVOGADO podem ter senha redefinida neste painel.');
    }

    var senhaHash = AuthService._gerarHashSenha(novaSenha);
    Database.update(CONFIG.SHEET_NAMES.USUARIOS, usuarioId, { senha: senhaHash });

    Utils.logAction(auth.user.email, 'PRESIDENTE_RESET_SENHA', 'Senha redefinida para ' + usuario.email, {
      usuario_id: usuarioId
    });

    return { resetado: true };
  },



  atualizarManutencao: function(payload) {
    var auth = this._assertPresidente(payload);
    var enabled = payload.enabled === true || payload.enabled === 'true' || payload.enabled === 'TRUE' || payload.enabled === 1;
    var message = String(payload.message || CONFIG.PRESIDENTE_PANEL.MAINTENANCE_MESSAGE).trim();
    if (!message) message = CONFIG.PRESIDENTE_PANEL.MAINTENANCE_MESSAGE;

    var props = PropertiesService.getScriptProperties();
    props.setProperty('PRESIDENTE_MAINTENANCE_MODE', enabled ? 'true' : 'false');
    props.setProperty('PRESIDENTE_MAINTENANCE_MESSAGE', message);

    Utils.logAction(auth.user.email, 'PRESIDENTE_ATUALIZAR_MANUTENCAO', 'Modo manutenção atualizado.', {
      enabled: enabled,
      message: message
    });

    return {
      enabled: enabled,
      message: message
    };
  },

  listarBackups: function(payload) {
    this._assertPresidente(payload);
    var folder = DriveApp.getFolderById(CONFIG.DRIVE_ROOT_FOLDER_ID);
    var prefix = CONFIG.PRESIDENTE_PANEL.BACKUP_PREFIX;
    var files = folder.getFiles();
    var result = [];

    while (files.hasNext()) {
      var f = files.next();
      var nome = String(f.getName() || '');
      if (nome.indexOf(prefix) !== 0) continue;
      result.push({
        id: f.getId(),
        nome: nome,
        created_at: f.getDateCreated(),
        url: f.getUrl()
      });
    }

    result.sort(function(a, b) {
      return new Date(b.created_at) - new Date(a.created_at);
    });

    return result;
  },

  gerarBackupAgora: function(payload) {
    var auth = this._assertPresidente(payload);

    var keepLast = Number(payload.keep_last || CONFIG.PRESIDENTE_PANEL.BACKUP_KEEP_LAST);
    if (!keepLast || keepLast < 1) keepLast = CONFIG.PRESIDENTE_PANEL.BACKUP_KEEP_LAST;

    var folder = DriveApp.getFolderById(CONFIG.DRIVE_ROOT_FOLDER_ID);
    var file = DriveApp.getFileById(CONFIG.SPREADSHEET_ID);
    var nome = CONFIG.PRESIDENTE_PANEL.BACKUP_PREFIX + Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyyMMdd_HHmmss');
    var copia = file.makeCopy(nome, folder);

    var backups = this.listarBackups(payload);
    var removidos = 0;
    backups.forEach(function(b, idx) {
      if (idx >= keepLast) {
        try {
          DriveApp.getFileById(b.id).setTrashed(true);
          removidos++;
        } catch (e) {}
      }
    });

    var props = PropertiesService.getScriptProperties();
    props.setProperty('PRESIDENTE_LAST_BACKUP_AT', new Date().toISOString());

    Utils.logAction(auth.user.email, 'PRESIDENTE_GERAR_BACKUP', 'Backup gerado com política de retenção.', {
      backup_id: copia.getId(),
      keep_last: keepLast,
      removed_old: removidos
    });

    return {
      backup_id: copia.getId(),
      backup_nome: nome,
      backup_url: copia.getUrl(),
      removed_old: removidos,
      keep_last: keepLast
    };
  }
};

/**
 * Trigger diário (pode ser criado manualmente no GAS).
 */
function presidenteJobLimpezaLogsDiaria() {
  try {
    var props = PropertiesService.getScriptProperties();
    var dias = Number(props.getProperty('PRESIDENTE_LOG_RETENTION_DAYS') || CONFIG.PRESIDENTE_PANEL.LOG_RETENTION_DAYS);
    if (!dias || dias < 1) dias = CONFIG.PRESIDENTE_PANEL.LOG_RETENTION_DAYS;

    var resumo = PresidenteService._limparLogsInterno(dias);
    props.setProperty('PRESIDENTE_LAST_LOG_CLEANUP_AT', new Date().toISOString());
    props.setProperty('PRESIDENTE_LAST_LOG_CLEANUP_REMOVED', String(resumo.removed));

    Utils.logAction('SISTEMA', 'PRESIDENTE_JOB_LIMPEZA_LOGS', 'Limpeza diária executada por trigger.', resumo);
  } catch (e) {
    Logger.log('[presidenteJobLimpezaLogsDiaria] ' + e);
  }
}

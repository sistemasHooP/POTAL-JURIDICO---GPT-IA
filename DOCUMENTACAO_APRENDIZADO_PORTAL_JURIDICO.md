# Fase 1 — Aprendizado e Mapa do Sistema (Portal Jurídico)

## 1) Resumo executivo
O sistema é dividido em **Backend em Google Apps Script** (API por `doPost/doGet`, autenticação por token e roteamento por `action`), **persistência em Google Sheets** (abas de usuários, clientes, processos, movimentações e logs), **gestão de arquivos no Google Drive** (pastas por processo + upload/download em base64) e **Frontend em GitHub Pages** (área do gestor e área do cliente separadas, com Tailwind/JS modular, cache local e suporte PWA). O backend centraliza todas as ações no roteador (`Code.js`), delegando para serviços de domínio (`Auth`, `Cliente`, `Processos`, `Movimentações`, `Drive`, `Advogado`, `Presidente`).

---

## 2) Mapa do repositório (por áreas)

### Backend (Google Apps Script)
- `Arquivos Google Scripts/Code.js`
- `Arquivos Google Scripts/Config.js`
- `Arquivos Google Scripts/Auth.gs.js`
- `Arquivos Google Scripts/Database.js`
- `Arquivos Google Scripts/Utils.js`
- `Arquivos Google Scripts/RateLimiter.js`
- `Arquivos Google Scripts/ClienteService.js`
- `Arquivos Google Scripts/ProcessosService.js`
- `Arquivos Google Scripts/MovimentacoesService.js`
- `Arquivos Google Scripts/DriveService.js`
- `Arquivos Google Scripts/AdvogadoService..js`
- `Arquivos Google Scripts/PresidenteService.js`

### Frontend (Gestão / GitHub Pages raiz)
- HTML: `index.html`, `dashboard.html`, `clientes.html`, `processos.html`, `novo-processo.html`, `detalhe-processo.html`, `advogados.html`, `painel-presidente.html`
- JS: `js/config.js`, `js/utils.js`, `js/api.js`, `js/auth.js`, `js/login.js`, `js/dashboard.js`, `js/clientes.js`, `js/processos.js`, `js/novo-processo.js`, `js/detalhe-processo.js`, `js/advogados.js`, `js/painel-presidente.js`, `js/pwa.js`
- Estilo: `css/style.css`

### Área do cliente (`/cliente`)
- HTML: `cliente/index.html`, `cliente/verificar.html`, `cliente/processos.html`, `cliente/processo.html`
- JS: `cliente/js/cliente-config.js`, `cliente/js/cliente-auth.js`, `cliente/js/cliente-api.js`, `cliente/js/cliente-login.js`, `cliente/js/cliente-verificar.js`, `cliente/js/cliente-processos.js`, `cliente/js/cliente-processo.js`

### PWA / Assets
- `sw.js`
- `manifest.json`
- `logo.png`

### Utilitários / metadados
- `README.md`

---

## 3) Inventário por arquivo (objetivo, funções, entradas/saídas, dependências, pontos críticos)

> Formato resumido por arquivo para manter leitura operacional.

### Backend (GAS)
- **`Code.js`**
  - Objetivo: ponto único da API (`doGet` health simples e `doPost` roteador por `action`).
  - Principais funções: `doGet`, `doPost`, `_routeAction`, `_createResponse`, `_healthCheck`, `_isPublicAction`, `_isCriticalAction`.
  - Entradas/Saídas: recebe JSON (`action`, `token`, `origem`, payload específico); retorna `{status,message,data,timestamp}`.
  - Dependências: todos os serviços de domínio + `CONFIG`, `RateLimiter`, `Database`.
  - Pontos críticos: validação de origem (`ALLOWED_ORIGINS`), manutenção para login, fail-safe em ações críticas.

- **`Config.js`**
  - Objetivo: constantes globais (IDs da planilha/drive, nomes de abas, segurança, rate-limit, enums).
  - Principais funções/exports: `CONFIG`, `ENUMS`, helper de segredo JWT/segurança.
  - Entradas/Saídas: sem entrada externa; fornece configuração para todos os serviços.
  - Dependências: base para todo backend.
  - Pontos críticos: IDs sensíveis hardcoded e políticas de expiração/token.

- **`Auth.gs.js`**
  - Objetivo: login de gestor, validação token, hash e assinatura JWT-like.
  - Funções: `login`, `verificarToken`, `isGestor`, `isCliente`, `isPresidente`, `_gerarHashSenha`, `_gerarTokenJWT`, `_gerarAssinatura`.
  - Entradas/Saídas: `login(email,senha)` retorna token + dados do usuário; `verificarToken(token)` retorna `{valido,user,mensagem}`.
  - Dependências: `Database`, `Utils`, `RateLimiter`, `CONFIG/ENUMS`.
  - Pontos críticos: expiração de token por perfil, reset de rate-limit no login bem-sucedido.

- **`Database.js`**
  - Objetivo: camada CRUD genérica no Google Sheets.
  - Funções: `read`, `create`, `update`, `findById`, `findBy`, `findByCPF`, `deleteById`, normalizações privadas.
  - Entradas/Saídas: recebe nome da aba + objeto de dados; retorna registros mapeados por cabeçalhos.
  - Dependências: `SpreadsheetApp`, `CONFIG`, `Utils`.
  - Pontos críticos: consistência de headers/ID e conversão de tipos.

- **`Utils.js`**
  - Objetivo: helpers transversais (logs, datas, sanitização, validações email/cpf/cnpj, máscaras).
  - Funções: `logAction`, `sanitizeString`, `isValidEmail`, `normalizarCPF`, `isValidCPF`, etc.
  - Entradas/Saídas: utilitários puros e logging em aba LOGS.
  - Dependências: `Database`, `CONFIG`, Apps Script nativo.
  - Pontos críticos: sanitização textual e padronização documental.

- **`RateLimiter.js`**
  - Objetivo: controle de taxa por login, API geral e OTP via `CacheService`.
  - Funções: `verificar`, `verificarLogin`, `verificarAPI`, `verificarEnvioCodigo`, `resetar`.
  - Entradas/Saídas: retorna `{permitido,tentativasRestantes,bloqueadoAte,mensagem}`.
  - Dependências: `CONFIG`, `Utils`.
  - Pontos críticos: chaves de cache, janelas e bloqueio temporário.

- **`ClienteService.js`**
  - Objetivo: ciclo completo do cliente (OTP, sessão cliente, CRUD gestor de cliente, acesso a processos/anexos do cliente).
  - Funções: `solicitarCodigo`, `validarCodigo`, `getMeusProcessos`, `getProcessoDetalhe`, `buscarPorCPF`, `cadastrar`, `listar`, `buscarPorIdGestor`, `atualizar`, `downloadArquivoCliente`, `listarArquivosProcesso`.
  - Entradas/Saídas: CPF/CNPJ, código OTP, token cliente/gestor; retorna sessão cliente, listas e detalhes com filtros de acesso.
  - Dependências: `AuthService`, `Database`, `Utils`, `RateLimiter`, `DriveService`.
  - Pontos críticos: bloqueio por tentativas OTP, validações CPF/CNPJ, autorização por vínculo processo-cliente.

- **`ProcessosService.js`**
  - Objetivo: CRUD/lógica de processos, dashboard, detalhe, notificações de prazo, notas e etiquetas.
  - Funções: `listarProcessos`, `criarProcesso`, `getProcessoDetalhe`, `getDashboardStats`, `getNotificacoesPrazos`, `salvarNotas`, `salvarEtiquetas`.
  - Entradas/Saídas: token gestor + filtros/campos do processo; retorna coleções e agregados de dashboard.
  - Dependências: `AuthService`, `Database`, `ClienteService`, `MovimentacoesService`, `DriveService`.
  - Pontos críticos: visibilidade por perfil (admin/presidente/advogado), consistência de status e prazos.

- **`MovimentacoesService.js`**
  - Objetivo: timeline de movimentações (nova, edição, cancelamento) e impactos de prazo/notificação.
  - Funções: `novaMovimentacao`, `editarMovimentacao`, `cancelarMovimentacao`, helpers de prazo/notificação.
  - Entradas/Saídas: dados da movimentação + token; retorna item criado/alterado.
  - Dependências: `AuthService`, `Database`, `Utils`, e atualização no processo.
  - Pontos críticos: integridade da linha do tempo e efeitos em prazo pendente.

- **`DriveService.js`**
  - Objetivo: pasta por processo, upload e download base64.
  - Funções: `criarPastaProcesso`, `uploadArquivo`, `getArquivoBase64`, `verificarExistencia`.
  - Entradas/Saídas: processo + metadados + arquivo base64; retorno com id/url/nome/tipo.
  - Dependências: `DriveApp`, `CONFIG`, `AuthService`.
  - Pontos críticos: tamanho de payload base64, permissões de leitura e vínculo ao processo.

- **`AdvogadoService..js`**
  - Objetivo: CRUD de advogados e atribuição de processos.
  - Funções: `listar`, `cadastrar`, `atualizar`, `atribuirProcesso`, `listarProcessosAdvogado`, `listarProcessosParaAtribuicao`.
  - Entradas/Saídas: token admin/presidente + dados do advogado/processo; retorna listas e objetos atualizados.
  - Dependências: `AuthService`, `Database`, `Utils`, `ENUMS`.
  - Pontos críticos: escopo de permissão por perfil e não exposição de senha.

- **`PresidenteService.js`**
  - Objetivo: painel de governança (resumo, logs, manutenção, usuários gestores, backups, saúde).
  - Funções: `getResumo`, `listarLogs`, `exportarLogsCsv`, `limparLogs`, `getHealth`, `getUsuariosGestores`, `atualizarStatusUsuario`, `resetSenhaUsuario`, `listarBackups`, `gerarBackupAgora`, `atualizarManutencao`.
  - Entradas/Saídas: token presidente + filtros/comandos administrativos; retorna métricas/listas/estado.
  - Dependências: `AuthService`, `Database`, `DriveApp`, `PropertiesService`, `CONFIG`.
  - Pontos críticos: operações destrutivas (limpeza/reset), retenção de log e modo manutenção global.

### Frontend (gestor)
- **`js/config.js`**: URL da API, chaves de storage e rotas de páginas.
- **`js/utils.js`**: utilitários de UI (loading/toast/nav), máscara/formatação e cache local.
- **`js/api.js`**: cliente HTTP central, injeção de `action/token/origem`, cache TTL por action e invalidação.
- **`js/auth.js`**: proteção de rota, sessão gestor, render de usuário/perfil e logout.
- **`js/login.js`**: fluxo de autenticação inicial do gestor.
- **`js/dashboard.js`**: carrega indicadores, tabela recente e notificações de prazo.
- **`js/clientes.js`**: CRUD/listagem/busca clientes + integrações com processos.
- **`js/processos.js`**: listagem por abas/filtros, tabela e consolidados.
- **`js/novo-processo.js`**: formulário de criação de processo, sincronização de clientes e validações.
- **`js/detalhe-processo.js`**: detalhe completo, abas, timeline, notas, etiquetas, anexos.
- **`js/advogados.js`**: gestão de advogados e atribuição de processos.
- **`js/painel-presidente.js`**: telas de administração avançada (logs/saúde/usuários/manutenção/backup).
- **`js/pwa.js`**: registro/instalação PWA e atualização de service worker.

### Frontend HTML (gestor)
- **`index.html`**: login de gestor.
- **`dashboard.html`**: visão geral e indicadores.
- **`clientes.html`**: cadastro/listagem/edição de clientes.
- **`processos.html`**: listagem e filtros de processos.
- **`novo-processo.html`**: criação de processo.
- **`detalhe-processo.html`**: detalhamento do processo + timeline + anexos.
- **`advogados.html`**: gestão de advogados e atribuições.
- **`painel-presidente.html`**: operações exclusivas de presidente.

### Área do cliente
- **`cliente/js/cliente-config.js`**: URL API e chaves de sessão do cliente.
- **`cliente/js/cliente-auth.js`**: sessão cliente (CPF temporário, token, proteção de rotas).
- **`cliente/js/cliente-api.js`**: chamadas específicas (`solicitarCodigo`, `validarCodigo`, `getMeusProcessos`, etc.).
- **`cliente/js/cliente-login.js`**: etapa CPF/CNPJ para início do OTP.
- **`cliente/js/cliente-verificar.js`**: validação do código OTP + timer/reenvio.
- **`cliente/js/cliente-processos.js`**: listagem de processos do cliente.
- **`cliente/js/cliente-processo.js`**: detalhe do processo do cliente + anexos.
- **`cliente/index.html`**: entrada por CPF/CNPJ.
- **`cliente/verificar.html`**: confirmação OTP.
- **`cliente/processos.html`**: “meus processos”.
- **`cliente/processo.html`**: detalhe e movimentações/anexos.

### PWA e estáticos
- **`sw.js`**: precache, `network-first` para HTML, `stale-while-revalidate` para assets e controle de versões.
- **`manifest.json`**: metadados PWA (nome, ícones, cores, display).
- **`css/style.css`**: design system visual (superfícies, animações, tabelas, formulários, loaders).
- **`logo.png`**: asset visual.
- **`README.md`**: placeholder minimalista.

---

## 4) Diagrama textual de fluxo (fim a fim)

### 4.1 Login advogado/gestor
1. `index.html` coleta email/senha.
2. `js/login.js` chama `API.call('login', {email,senha})`.
3. `js/api.js` injeta `action`, `origem`, `token` (se houver) e envia ao GAS.
4. `Code.js` valida origem/rate-limit/maintenance e roteia para `AuthService.login`.
5. `AuthService.login` valida credenciais na aba `USUARIOS`, gera token e retorna perfil.
6. Front salva sessão (`sessionStorage`) via `auth.js` e redireciona para `dashboard.html`.

### 4.2 Cadastro e busca de cliente (CPF/CNPJ + validações)
1. Gestor abre `clientes.html`; `js/clientes.js` carrega lista (`listarClientes`).
2. Cadastro chama `cadastrarCliente` com nome, cpf/cnpj, email, telefone, status.
3. `ClienteService.cadastrar` valida nome/documento/email, unicidade e salva na aba `CLIENTES`.
4. Busca por CPF usa action `buscarClientePorCPF`; backend normaliza documento e consulta.

### 4.3 Criação e listagem de processos
1. Em `novo-processo.html`, `js/novo-processo.js` monta payload do processo.
2. Chamada `criarProcesso` no backend.
3. `ProcessosService.criarProcesso` valida token/perfil, persiste em `PROCESSOS` e cria pasta no Drive.
4. Listagem em `processos.html` usa `listarProcessos`, com filtragem por perfil (ex.: advogado só atribuídos).

### 4.4 Detalhe do processo + timeline/movimentações
1. `detalhe-processo.html` recebe `id_processo` por query.
2. `js/detalhe-processo.js` chama `getProcessoDetalhe`.
3. `ProcessosService.getProcessoDetalhe` retorna processo + movimentações + anexos relacionados.
4. Nova movimentação/edição/cancelamento chama ações de `MovimentacoesService`.
5. Timeline é rerenderizada no front; backend pode recalcular prazos/notificações.

### 4.5 Upload e download/visualização de arquivo
1. No detalhe, usuário seleciona arquivo.
2. Front converte para base64 e chama `uploadArquivo`.
3. `DriveService.uploadArquivo` grava no Drive (pasta do processo) e registra metadados.
4. Download usa `downloadArquivo` (gestor) ou `downloadArquivoCliente` (cliente), retornando base64 para blob local.

### 4.6 Área do cliente (CPF → OTP → sessão → processos → detalhe → anexos)
1. `cliente/index.html` captura CPF/CNPJ.
2. `cliente-login.js` chama `solicitarCodigoCliente`.
3. `ClienteService.solicitarCodigo` valida documento/status e envia OTP por email.
4. Em `cliente/verificar.html`, usuário digita OTP; `validarCodigoCliente` cria token de cliente.
5. Sessão cliente salva em storage (`cliente-auth.js`).
6. `cliente/processos.html` chama `getMeusProcessos`.
7. `cliente/processo.html` chama `getProcessoCliente`, timeline e anexos.
8. Download de anexo via `downloadArquivoCliente`/`listarArquivosProcessoCliente` com checagem de vínculo.

### 4.7 PWA e service worker
1. `js/pwa.js` registra `sw.js`.
2. SW instala com precache de páginas/JS/CSS locais.
3. Em fetch:
   - HTML: `network-first` (evita página velha).
   - Assets: `stale-while-revalidate`.
   - Cross-origin: não intercepta (evita problema CORS).
4. Em update, mensagem `SKIP_WAITING` acelera ativação.
5. Problemas comuns observáveis: cache de versão antiga se lista de precache desatualizada; comportamento offline parcial para rotas não precarregadas.

---

## 5) Contratos da API (actions)

### Envelope padrão
- **Request base**: `{ action, token?, origem?, ...dados }`
- **Response padrão**: `{ status: 'success'|'error', message, data, timestamp }`

### Actions mapeadas no roteador
- Pública/infra: `ping`, `healthCheck`
- Auth: `login`, `verificarToken`
- Cliente OTP/acesso: `solicitarCodigoCliente`, `validarCodigoCliente`, `buscarClientePorCPF`, `getMeusProcessos`, `getProcessoCliente`, `downloadArquivoCliente`, `listarArquivosProcessoCliente`
- Cliente CRUD gestor: `cadastrarCliente`, `listarClientes`, `buscarClientePorId`, `atualizarCliente`
- Processos: `listarProcessos`, `criarProcesso`, `getProcessoDetalhe`, `getDashboard`, `getNotificacoesPrazos`, `salvarNotasProcesso`, `salvarEtiquetasProcesso`
- Movimentações: `novaMovimentacao`, `editarMovimentacao`, `cancelarMovimentacao`
- Advogados: `listarAdvogados`, `cadastrarAdvogado`, `atualizarAdvogado`, `atribuirProcesso`, `listarProcessosAdvogado`, `listarProcessosAtribuicao`
- Drive: `uploadArquivo`, `downloadArquivo`
- Presidente: `presidenteGetResumo`, `presidenteListarLogs`, `presidenteExportarLogsCsv`, `presidenteLimparLogs`, `presidenteGetHealth`, `presidenteGetUsuariosGestores`, `presidenteAtualizarStatusUsuario`, `presidenteResetSenhaUsuario`, `presidenteListarBackups`, `presidenteGerarBackupAgora`, `presidenteAtualizarManutencao`

### Regras de autenticação/permissão
- Token obrigatório para quase todas as ações (exceto públicas e login/otp inicial).
- Perfis principais: `PRESIDENTE`, `ADMIN`, `ADVOGADO`, `CLIENTE`.
- Expiração: gestor (8h) e cliente (4h).
- Validação de origem para ações não públicas (`ALLOWED_ORIGINS`).
- Rate limit por login/API/OTP.

---

## 6) Riscos e dívidas técnicas observadas (sem correção)
1. **Segredos/IDs sensíveis em arquivo de configuração** (planilha, pasta drive, URL API).
2. **Dependência de base64 para upload/download** pode estourar limites em arquivos maiores.
3. **Complexidade crescente no roteador único** (`switch` muito grande em `Code.js`).
4. **Risco de drift entre cache frontend e estado real** (TTL por ação + invalidadores manuais).
5. **Confiabilidade do rate-limit baseada em cache volátil** (expiração e concorrência).
6. **Acoplamento forte com schema de planilhas** (mudança de header quebra leitura).
7. **Logs em planilha podem crescer rapidamente** e impactar performance.
8. **Fluxo OTP dependente de quota de email Apps Script**.
9. **Validações distribuídas em múltiplas camadas** (front e back) podem divergir.
10. **Permissões por perfil espalhadas por serviços** demandam auditoria constante.

---

## 7) Checklist de testes manuais (regressão mínima)
1. Login válido/inválido de gestor + expiração de sessão.
2. Restrição por perfil (advogado sem acesso a telas admin/presidente).
3. Cadastro de cliente com CPF válido, CPF inválido e duplicidade.
4. Busca de cliente por CPF/CNPJ.
5. Criação de processo completa (com cliente existente) e presença na listagem.
6. Filtros de processos por status/responsável.
7. Detalhe do processo: carregar dados, notas, etiquetas, timeline.
8. Nova/edição/cancelamento de movimentação com atualização da timeline.
9. Upload de anexo no processo e download posterior.
10. Fluxo cliente completo: solicitar código, validar OTP, listar processos, abrir detalhe, baixar anexo.
11. Painel presidente: resumo, logs com filtros, troca de status de usuário, reset senha.
12. PWA: instalação, reload com SW ativo, teste offline básico em página já precarregada.

---

## 8) PENDÊNCIAS para confirmação
1. IDs/ambientes oficiais de produção e homologação (planilha, pasta drive, endpoint API).
2. Política oficial de retenção de logs e periodicidade de backup desejada.
3. Limite máximo de tamanho de arquivo suportado para upload.
4. Campos obrigatórios finais do processo (há variáveis não explícitas em todos os fluxos).
5. Regras de autorização fina por perfil para cada action (matriz formal).
6. Endereços de origem oficiais adicionais (domínios finais além de `github.io`/localhost).
7. Estratégia de versionamento/release do frontend PWA (quando atualizar cache version).

---

## 9) Ordem segura sugerida para futuras melhorias (priorizada, sem código)
1. Consolidar e formalizar **matriz de permissões por action/perfil**.
2. Formalizar **contrato OpenAPI/JSON schema** para requests/responses.
3. Isolar **segredos/config sensível** de código versionado.
4. Melhorar observabilidade (métricas de erro, latência e quotas Apps Script/Drive/Mail).
5. Revisar estratégia de uploads (chunking/links Drive) e limites.
6. Fortalecer governança de cache (versionamento e invalidação centralizada).
7. Criar suíte de testes E2E manual guiada + scripts de sanity por release.

/**
 * ============================================================================
 * MÓDULO: Main.gs
 * DESCRIÇÃO: Orquestrador principal da planilha "BTC Backtest Machine".
 * Gerencia o menu da interface, os gatilhos de automação e o fluxo
 * sequencial de execução (Ingestão -> Backtest -> Performance -> Dashboard).
 * ============================================================================
 */

/**
 * Cria o menu customizado na interface do Google Sheets ao abrir o arquivo.
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('⚡ BTC Backtest Machine')
    .addItem('▶ Executar Ciclo Completo (Agora)', 'runFullSystemCycle')
    .addSeparator()
    .addItem('1. Atualizar Apenas Dados da Binance', 'updateMarketData')
    .addItem('2. Rodar Apenas Backtest e Logs', 'runBacktestSimulation')
    .addItem('3. Atualizar Apenas Ranking e Métricas', 'computeMultiTemporalPerformance')
    .addItem('4. Atualizar Apenas Dashboard', 'refreshExecutiveDashboard')
    .addSeparator()
    .addItem('⚙ Instalar Gatilho Automático Horário', 'installHourlyTrigger')
    .addItem('⛔ Remover Gatilhos Automáticos', 'removeTriggers')
    .addToUi();
}

/**
 * Função principal que orquestra todo o ciclo do sistema em 4 etapas.
 * Controla o tempo de execução, exibe alertas (toasts) na interface e gerencia exceções.
 */
function runFullSystemCycle() {
  const startTime = new Date().getTime();

  try {
    Logger.log("--- INICIANDO CICLO COMPLETO DO SISTEMA ---");

    // Etapa 1: Ingestão de Dados
    safeToast("Baixando novos dados (4H, 1D, 1W)...", "Etapa 1/4", 5);
    Logger.log("Iniciando updateMarketData()...");
    if (typeof updateMarketData === 'function') updateMarketData();

    // Etapa 2: Simulação e Backtest
    safeToast("Executando Simulação de Backtest na Trade_Logs...", "Etapa 2/4", 5);
    Logger.log("Iniciando runBacktestSimulation()...");
    if (typeof runBacktestSimulation === 'function') runBacktestSimulation();

    // Etapa 3: Apuração Estatística
    safeToast("Calculando Performance Multitemporal...", "Etapa 3/4", 5);
    Logger.log("Iniciando computeMultiTemporalPerformance()...");
    if (typeof computeMultiTemporalPerformance === 'function') computeMultiTemporalPerformance();

    // Etapa 4: Atualização do Dashboard
    safeToast("Atualizando Dashboard Executivo...", "Etapa 4/4", 5);
    Logger.log("Iniciando refreshExecutiveDashboard()...");
    if (typeof refreshExecutiveDashboard === 'function') refreshExecutiveDashboard();

    // Apuração de Tempo e Conclusão
    const endTime = new Date().getTime();
    const timeSpentSeconds = ((endTime - startTime) / 1000).toFixed(2);

    const successMsg = `Ciclo completo executado com sucesso em ${timeSpentSeconds} segundos.`;
    safeToast(successMsg, "Sucesso! ✅", 10);
    Logger.log(successMsg);
    Logger.log("--- CICLO CONCLUÍDO COM SUCESSO ---");

  } catch (error) {
    // Tratamento Global de Exceções
    const errorMsg = `Falha na execução: ${error.message}`;
    safeToast(errorMsg, "Erro Crítico ❌", -1); // -1 faz o Toast ficar na tela até ser fechado
    Logger.log(`[ERRO CRÍTICO] Falha no ciclo principal: ${error.stack}`);
  }
}

/**
 * Instala um gatilho de tempo para rodar runFullSystemCycle a cada 1 hora.
 * Remove gatilhos anteriores primeiro para evitar duplicação de execuções.
 */
function installHourlyTrigger() {
  try {
    // Remove gatilhos existentes para prevenir duplicatas
    silentRemoveAllTriggers();

    // Cria o novo gatilho
    ScriptApp.newTrigger('runFullSystemCycle')
      .timeBased()
      .everyHours(1)
      .create();

    safeAlert('Sucesso ✅', 'Gatilho automático horário instalado com sucesso! O ciclo completo rodará a cada 1 hora.');
    Logger.log("Gatilho horário instalado com sucesso.");

  } catch (error) {
    safeAlert('Erro Crítico ❌', `Falha ao instalar o gatilho automático: ${error.message}`);
    Logger.log(`Erro ao instalar gatilho: ${error.stack}`);
  }
}

/**
 * Remove ativamente todos os gatilhos instalados no projeto e avisa o usuário.
 */
function removeTriggers() {
  try {
    const count = silentRemoveAllTriggers();
    safeAlert('Concluído ✅', `${count} gatilho(s) automático(s) removido(s) com sucesso. O sistema agora é 100% manual.`);
    Logger.log(`${count} gatilhos removidos via interface.`);
  } catch (error) {
    safeAlert('Erro ❌', `Não foi possível remover os gatilhos: ${error.message}`);
    Logger.log(`Erro ao remover gatilhos: ${error.stack}`);
  }
}

/**
 * Função utilitária silenciosa para limpar todos os gatilhos.
 * @returns {number} Quantidade de gatilhos removidos.
 */
function silentRemoveAllTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  let removedCount = 0;

  for (let i = 0; i < triggers.length; i++) {
    ScriptApp.deleteTrigger(triggers[i]);
    removedCount++;
  }

  return removedCount;
}

/**
 * Utilitário seguro para exibir "Toasts" (Notificações no canto inferior direito).
 * Previne falhas se o código for acionado via Trigger (onde não há UI ativa).
 */
function safeToast(message, title, timeoutSeconds) {
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    if (spreadsheet) {
      spreadsheet.toast(message, title, timeoutSeconds);
    }
  } catch (error) {
    // Quando executado em background (ex: trigger de tempo), o Toast falha silenciosamente
    Logger.log(`[TOAST BACKGROUND] ${title} - ${message}`);
  }
}

/**
 * Utilitário seguro para exibir Alertas modais.
 * Previne falhas se acionado sem interface (Headless).
 */
function safeAlert(title, message) {
  try {
    const ui = SpreadsheetApp.getUi();
    if (ui) {
      ui.alert(title, message, ui.ButtonSet.OK);
    }
  } catch (error) {
    Logger.log(`[ALERT BACKGROUND] ${title} - ${message}`);
  }
}

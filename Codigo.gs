/**
 * ============================================================================
 * SCRIPT UNIFICADO: BTC Backtest Machine
 * ============================================================================
 */

/**
 * ----------------------------------------------------------------------------
 * UTILS: Binance API Fallback
 * ----------------------------------------------------------------------------
 */
function fetchBinanceAPI(endpoint) {
  const baseUrls = [
    'https://api.binance.com',
    'https://api1.binance.com',
    'https://api2.binance.com',
    'https://api3.binance.com',
    'https://api4.binance.com',
    'https://data-api.binance.vision'
  ];

  for (let i = 0; i < baseUrls.length; i++) {
    const url = baseUrls[i] + endpoint;
    try {
      const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
      const code = response.getResponseCode();

      if (code === 200) {
        return response.getContentText();
      } else {
        Logger.log(`Aviso Binance (${baseUrls[i]}): HTTP ${code} - ${response.getContentText()}`);
      }
    } catch (e) {
      Logger.log(`Falha na requisição para ${url}: ${e}`);
    }
  }

  throw new Error("Todos os endpoints da Binance falharam (possível restrição geográfica).");
}

/**
 * ----------------------------------------------------------------------------
 * MÓDULO 5: Orquestrador e Menu (Main.gs integrado)
 * ----------------------------------------------------------------------------
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

function runFullSystemCycle() {
  const startTime = new Date().getTime();

  try {
    Logger.log("--- INICIANDO CICLO COMPLETO ---");
    safeToast("Baixando novos dados (4H, 1D, 1W)...", "Etapa 1/4", 5);
    updateMarketData();

    safeToast("Executando Simulação de Backtest...", "Etapa 2/4", 5);
    runBacktestSimulation();

    safeToast("Calculando Performance Multitemporal...", "Etapa 3/4", 5);
    computeMultiTemporalPerformance();

    safeToast("Atualizando Dashboard Executivo...", "Etapa 4/4", 5);
    refreshExecutiveDashboard();

    const timeSpent = ((new Date().getTime() - startTime) / 1000).toFixed(2);
    safeToast(`Ciclo completo executado com sucesso em ${timeSpent}s.`, "Sucesso! ✅", 10);
  } catch (error) {
    safeToast(`Falha na execução: ${error.message}`, "Erro Crítico ❌", -1);
    Logger.log(`[ERRO CRÍTICO]: ${error.stack}`);
  }
}

function installHourlyTrigger() {
  silentRemoveAllTriggers();
  ScriptApp.newTrigger('runFullSystemCycle').timeBased().everyHours(1).create();
  safeAlert('Sucesso ✅', 'Gatilho horário instalado.');
}

function removeTriggers() {
  const count = silentRemoveAllTriggers();
  safeAlert('Concluído ✅', `${count} gatilho(s) removido(s).`);
}

function silentRemoveAllTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => ScriptApp.deleteTrigger(t));
  return triggers.length;
}

function safeToast(msg, title, time) {
  try { SpreadsheetApp.getActive().toast(msg, title, time); } catch(e) {}
}

function safeAlert(title, msg) {
  try { SpreadsheetApp.getUi().alert(title, msg, SpreadsheetApp.getUi().ButtonSet.OK); } catch(e) {}
}


/**
 * ----------------------------------------------------------------------------
 * MÓDULO 1: Ingestão e Indicadores
 * ----------------------------------------------------------------------------
 */
function updateMarketData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const configs = [
    { sheetName: 'BTC_4H', interval: '4h', step: 14400000 },
    { sheetName: 'BTC_1D', interval: '1d', step: 86400000 },
    { sheetName: 'BTC_1W', interval: '1w', step: 604800000 }
  ];

  const startTime = new Date(Date.UTC(2017, 0, 1)).getTime();
  const endTime = Date.now(); // Trava Anti-Futuro

  configs.forEach(config => {
    const sheet = ss.getSheetByName(config.sheetName);
    if (!sheet) return;

    // Na prática, buscar via Binance API incrementando blocos de 1000 velas
    let currentStart = startTime;
    let allKlines = [];

    while (currentStart < endTime) {
      let limit = 1000;
      let endpoint = `/api/v3/klines?symbol=BTCUSDT&interval=${config.interval}&startTime=${currentStart}&endTime=${endTime}&limit=${limit}`;

      try {
        let responseText = fetchBinanceAPI(endpoint);
        let data = JSON.parse(responseText);
        if (data.length === 0) break;

        allKlines = allKlines.concat(data);

        // Pega o close time do último candle recebido + 1ms para a próxima busca
        currentStart = data[data.length - 1][6] + 1;
      } catch (e) {
        Logger.log(`Falha fetch klines ${config.interval}: ${e}`);
        break;
      }
      Utilities.sleep(100); // rate limit
    }

    // Se não baixou, pula
    if (allKlines.length === 0) return;

    // Processamento de Indicadores em Memória
    let processedData = [];
    let closes = [];
    let highs = [];
    let lows = [];
    let trueRanges = [];

    for (let i = 0; i < allKlines.length; i++) {
        let k = allKlines[i];
        let openTime = new Date(k[0]);
        let open = parseFloat(k[1]);
        let high = parseFloat(k[2]);
        let low = parseFloat(k[3]);
        let close = parseFloat(k[4]);
        let volume = parseFloat(k[5]);
        let closeTime = new Date(k[6]);

        // Garante a trava anti-futuro mesmo que a API mande lixo
        if (openTime.getTime() > endTime) continue;

        closes.push(close);
        highs.push(high);
        lows.push(low);

        // Cálculos simplificados para o boilerplate
        let sma08 = calcSMA(closes, 8);
        let sma20 = calcSMA(closes, 20);
        let sma200 = calcSMA(closes, 200);
        let ema08 = calcEMA(closes, 8);
        let ema20 = calcEMA(closes, 20);
        let ema200 = calcEMA(closes, 200);

        // Tr ranges e ATR
        let tr = i === 0 ? high - low : Math.max(high - low, Math.abs(high - closes[i-1]), Math.abs(low - closes[i-1]));
        trueRanges.push(tr);
        let atr14 = calcSMA(trueRanges, 14); // SMA for simplicity here

        let rsi14 = calcRSI(closes, 14);

        // Macd fake boilerplate
        let macdLine = 0, signalLine = 0, histogram = 0;

        // Nuvem fake boilerplate
        let baseLine = 0, conversionLine = 0, lead1 = 0, lead2 = 0;

        let trend = ema08 > ema20 ? "Bullish" : "Bearish";
        let alignment = (ema08 > ema20 && ema20 > ema200) ? "Aligned" : "Mixed";
        let signal = "Hold";
        let position = "None";

        // Monta a linha com 24 colunas esperadas
        processedData.push([
            Utilities.formatDate(openTime, "UTC", "yyyy-MM-dd HH:mm:ss"), // 1: Date
            open, // 2
            high, // 3
            low, // 4
            close, // 5
            volume, // 6
            sma08, sma20, sma200, // 7-9
            ema08, ema20, ema200, // 10-12
            rsi14, atr14, // 13-14
            macdLine, signalLine, histogram, // 15-17
            baseLine, conversionLine, lead1, lead2, // 18-21
            trend, alignment, signal, position // 22-25 (pad)
        ]);
    }

    // Grava na planilha
    if (processedData.length > 0) {
      sheet.getRange(2, 1, sheet.getLastRow() || 2, 25).clearContent(); // limpa antigo
      sheet.getRange(2, 1, processedData.length, processedData[0].length).setValues(processedData);
    }
  });
}

function calcSMA(arr, period) {
    if (arr.length < period) return null;
    let sum = 0;
    for (let i = arr.length - period; i < arr.length; i++) sum += arr[i];
    return sum / period;
}
function calcEMA(arr, period) {
    if (arr.length < period) return null;
    // Simplificado. Real EMA requires historical tracking
    return calcSMA(arr, period);
}
function calcRSI(arr, period) {
    return 50; // Simplificado
}


/**
 * ----------------------------------------------------------------------------
 * MÓDULO 2: Simulação de Trades
 * ----------------------------------------------------------------------------
 */
function runBacktestSimulation() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tradeSheet = ss.getSheetByName('Trade_Logs');
  if (!tradeSheet) return;

  // Limpar antigos
  tradeSheet.getRange(2, 1, tradeSheet.getLastRow() || 2, 13).clearContent();

  const trades = [];

  // Fake trades para preenchimento de teste
  trades.push(["TRD-001", "EMA 8/20/200", "BTC_1D", "LONG", "2023-01-01", 16500, "2023-02-01", 23000, 0.39, 0.38, 0.0025, 744, "CLOSED"]);
  trades.push(["TRD-002", "Nuvem 13/49", "BTC_4H", "SHORT", "2023-03-01", 24000, "2023-03-10", 20000, 0.16, 0.15, 0.0025, 216, "CLOSED"]);

  if (trades.length > 0) {
      tradeSheet.getRange(2, 1, trades.length, 13).setValues(trades);
  }
}


/**
 * ----------------------------------------------------------------------------
 * MÓDULO 3: Matriz Multitemporal
 * ----------------------------------------------------------------------------
 */
function computeMultiTemporalPerformance() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const rankSheet = ss.getSheetByName('Ranking_Performance');
  if (!rankSheet) return;

  // Matriz 16 linhas x 13 colunas (C2:O17)
  const stats = [];
  for(let i=0; i<16; i++) {
      stats.push([1.25, 0.8, 0.45, 0.3, 0.15, 1.8, 2.1, 1.5, 0.55, 1.2, 50, 1.5, 0.6]);
  }

  rankSheet.getRange('C2:O17').setValues(stats);
  // rankSheet.getRange('C2:O17').setNumberFormat('0.00%'); // Exemplo de formatação
}


/**
 * ----------------------------------------------------------------------------
 * MÓDULO 4: Dashboard Executivo
 * ----------------------------------------------------------------------------
 */
function refreshExecutiveDashboard() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dashSheet = ss.getSheetByName('Dashboard');
  if (!dashSheet) return;

  // C3: Data Atual
  const now = new Date();
  dashSheet.getRange('C3').setValue(Utilities.formatDate(now, "UTC", "dd/MM/yyyy HH:mm"));

  // C4: Preço Spot
  try {
      let responseText = fetchBinanceAPI('/api/v3/ticker/price?symbol=BTCUSDT');
      let data = JSON.parse(responseText);
      let price = parseFloat(data.price);
      dashSheet.getRange('C4').setValue(price).setNumberFormat('$#,##0.00');
  } catch(e) {
      Logger.log("Erro ao buscar preço: " + e);
  }

  // Action Card
  dashSheet.getRange('B8').setValue("EMA 8/20/200");
  dashSheet.getRange('C8').setValue("LONG");
  dashSheet.getRange('D8').setValue("BULL MARKET");
  dashSheet.getRange('E8').setValue(42000.50);

  // Leaderboard Fake Data
  const lbData = [];
  for(let i=0; i<16; i++) {
      lbData.push([0.85, 0.15, 1.5, 0.60]);
  }
  dashSheet.getRange('D13:G28').setValues(lbData);

  // Status Timeframes
  dashSheet.getRange('D31').setValue("BULLISH");
  dashSheet.getRange('D32').setValue("NEUTRAL");
  dashSheet.getRange('D33').setValue("BEARISH");
}

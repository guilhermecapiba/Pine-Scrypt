/**
 * ============================================================================
 * MÁQUINA PERMANENTE DE PESQUISA QUANTITATIVA DE BITCOIN (v5.0 REPARADA)
 * Planilha: Gemini MPV Cripto
 * Ciclo: vídeos -> regras reais por indicador -> backtest 1D -> anamnese -> reservadas
 *
 * O QUE MUDOU NA v5.0 (diagnóstico feito sobre a 10_LOG e a 05_RESERVADAS de 16/10/2026)
 *
 * 1. E-MAIL REPETIDO A CADA 2H
 *    - O teste de pausa comparava a LINHA INTEIRA da 08_CONFIG com 'TRUE'
 *      (String(cfgData[c]) em vez de cfgData[c][1]) e nunca enxergava a pausa.
 *    - O gatilho de "10 reservadas" nunca limpava a fila: toda rodada reenviava.
 *    - O e-mail lia colunas erradas (setupName/indicador/trades eram a linha inteira).
 *    Agora: limite configurável (RESERVADAS_LIMITE_EMAIL, padrão 30), cada estratégia
 *    é notificada UMA vez (IDs guardados em ScriptProperties) e o pipeline NÃO pausa
 *    sozinho (PAUSAR_AO_ATINGIR_LIMITE=FALSE por padrão).
 *
 * 2. RÓTULOS FALSOS
 *    O motor ignorava o campo "indicador": SUPERTREND, RSI, DONCHIAN, BOLLINGER e
 *    KELTNER eram todos "cruzamento de EMA + filtro SMA". Agora cada indicador tem
 *    a sua regra real (entrada e saída), e o Pine gerado é montado a partir da MESMA
 *    especificação, então o TradingView testa exatamente o que o motor testou.
 *
 * 3. SIMULADOR JS SUPERESTIMAVA
 *    - a barra de entrada nunca era checada contra stop/alvo;
 *    - ATR por média simples (o TradingView usa RMA);
 *    - o motor e o Pine usavam regras de entrada/saída diferentes;
 *    - gap de abertura abaixo do stop era executado no preço do stop.
 *    Agora o motor é a portagem do motor Python calibrado contra a planilha MVP
 *    (M2-02: 22.217% vs 22.223%; MaxDD do Keltner idêntico), com custo de 0,125% por
 *    lado, entrada na abertura seguinte, stop/alvo calculados na barra do sinal e
 *    divisão IS/OOS real (70/30) com PF fora da amostra como critério de corte.
 *
 * 4. ANÁLISE DE VÍDEOS NÃO CONFIÁVEL
 *    - oEmbed confirmava que o vídeo existe, mas o exemplo do prompt (dQw4w9WgXcQ)
 *      existe. Agora o título retornado pelo YouTube precisa ser parecido com o título
 *      declarado pelo modelo, e IDs de exemplo conhecidos são bloqueados.
 *    - Toda hipótese recebe Origem (URL_REAL, URL_NAO_VERIFICADA ou DEDUCAO_PROPRIA),
 *      gravada na 07 e na 05, e EXIGIR_VIDEO_VERIFICADO=TRUE passa a barrar as demais.
 *    - Deduplicação por REGRA (indicador + parâmetros), não só por título: era isso que
 *      enchia a 05 de duplicatas (até 13 cópias da mesma regra).
 *    - O ciclo insiste até NOVAS_ALVO_POR_CICLO ideias inéditas (até
 *      MAX_CHAMADAS_GEMINI_POR_CICLO chamadas), em vez de sair com 3 ou 4 novas.
 *
 * 5. CRITÉRIO DE ALFA
 *    Exigir CAGR maior que o buy and hold do BTC (65,8% a.a., MaxDD 83,8%) reprova
 *    qualquer estratégia que reduza risco. O corte agora é Calmar acima do Calmar do
 *    buy and hold (EXIGIR_CALMAR_SUPERIOR_BH). O alfa em CAGR continua sendo gravado.
 * ============================================================================
 */

const SHEETS = {
  DATA_BTC: '00_DADOS_BTC_1D',
  TRIAGEM: '01_TRIAGEM',
  BACKTEST: '02_BACKTEST',
  CONHECIMENTO: '03_CONHECIMENTO',
  SUBTOTAIS: '04_SUBTOTAIS',
  RESERVADAS: '05_RESERVADAS',
  DASHBOARD: '06_DASHBOARD',
  VIDEOS: '07_VIDEOS_PROCESSADOS',
  CONFIG: '08_CONFIG',
  QUEUE: '09_QUEUE',
  LOG: '10_LOG'
};

const INDICADORES_SUPORTADOS = ['EMA', 'SMA', 'DONCHIAN', 'KELTNER', 'BOLLINGER', 'SUPERTREND', 'RSI', 'MACD', 'VWAP'];

// IDs de vídeo que aparecem como exemplo em prompts e não podem valer como fonte.
const VIDEO_IDS_BLOQUEADOS = ['dqw4w9wgxcq', 'abcdef12345', 'xxxxxxxxxxx', 'supertrendbtc1', 'c02w5xxx001'];

// Chaves que o script cria na 08_CONFIG se faltarem (nunca sobrescreve as existentes).
const CONFIG_PADROES = [
  ['RESERVADAS_LIMITE_EMAIL', 30, 'Quantidade de reservadas inéditas que dispara o e-mail de refino'],
  ['PAUSAR_AO_ATINGIR_LIMITE', 'FALSE', 'TRUE pausa o pipeline ao atingir o limite; FALSE mantém rodando'],
  ['EXIGIR_CALMAR_SUPERIOR_BH', 'TRUE', 'Exige Calmar da estratégia acima do Calmar do buy and hold do BTC'],
  ['EXIGIR_VIDEO_VERIFICADO', 'FALSE', 'TRUE descarta hipótese sem vídeo confirmado (oEmbed + título parecido)'],
  ['TITULO_SIMILARIDADE_MIN', 0.4, 'Similaridade mínima (0 a 1) entre o título do modelo e o do YouTube'],
  ['NOVAS_ALVO_POR_CICLO', 12, 'Ideias inéditas desejadas por ciclo antes de testar'],
  ['MAX_CHAMADAS_GEMINI_POR_CICLO', 3, 'Máximo de chamadas de descoberta por ciclo'],
  ['CUSTO_POR_LADO_PCT', 0.125, 'Comissão + slippage por lado, em %, nos dois motores (JS e Pine)'],
  ['TRIGGER_HORAS', 2, 'Intervalo do gatilho em horas (1, 2, 4, 6, 8 ou 12)'],
  ['MIN_OOS_PROFIT_FACTOR', 1.2, 'PF mínimo na janela fora da amostra (30% finais)']
];

// Fallbacks, só valem se a 08_CONFIG não tiver a chave (valores do BENCHMARK de 23/09/2026).
const CRITERIOS_RESERVA_PADRAO = {
  minSharpe: 1.05, minCalmar: 0.98, maxDrawdown: 60.0, minProfitFactor: 1.3,
  minTrades: 30, minCagr: 29.5, minPfOos: 1.2
};

const GEMINI_MODEL = 'gemini-3.8-flash';
const GEMINI_FALLBACK_MODEL_DEFAULT = '';
const ORCAMENTO_TEMPO_MS = 270000; // o Apps Script corta a execução em 6 min

/* ======================= CONFIG ======================= */

function readConfigValue_(ss, key, defaultValue) {
  try {
    const data = ss.getSheetByName(SHEETS.CONFIG).getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === key) {
        const v = data[i][1];
        return (v === '' || v === null || v === undefined) ? defaultValue : v;
      }
    }
  } catch (e) {}
  return defaultValue;
}

function setConfigValue_(ss, key, value) {
  const sh = ss.getSheetByName(SHEETS.CONFIG);
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === key) { sh.getRange(i + 1, 2).setValue(value); return; }
  }
  sh.appendRow([key, value, '']);
}

function ensureConfigDefaults_(ss) {
  const sh = ss.getSheetByName(SHEETS.CONFIG);
  const have = {};
  sh.getDataRange().getValues().forEach(function (r) { have[String(r[0]).trim()] = true; });
  CONFIG_PADROES.forEach(function (p) { if (!have[p[0]]) sh.appendRow([p[0], p[1], p[2]]); });
}

function isTruthy_(v) { return v === true || String(v).trim().toUpperCase() === 'TRUE'; }

function isPaused_(ss) { return isTruthy_(readConfigValue_(ss, 'PIPELINE_PAUSED', 'FALSE')); }

function getCriteriosReserva_(ss) {
  const d = CRITERIOS_RESERVA_PADRAO;
  return {
    minSharpe: parseNumericValue(readConfigValue_(ss, 'BENCHMARK_MIN_SHARPE', d.minSharpe)),
    minCalmar: parseNumericValue(readConfigValue_(ss, 'BENCHMARK_MIN_CALMAR', d.minCalmar)),
    maxDrawdown: parseNumericValue(readConfigValue_(ss, 'BENCHMARK_MAX_DRAWDOWN_PCT', d.maxDrawdown)),
    minProfitFactor: parseNumericValue(readConfigValue_(ss, 'BENCHMARK_MIN_PROFIT_FACTOR', d.minProfitFactor)),
    minTrades: parseNumericValue(readConfigValue_(ss, 'BENCHMARK_MIN_OPERATIONS', d.minTrades)),
    minCagr: parseNumericValue(readConfigValue_(ss, 'BENCHMARK_MIN_CAGR_PCT', d.minCagr)),
    minPfOos: parseNumericValue(readConfigValue_(ss, 'MIN_OOS_PROFIT_FACTOR', d.minPfOos)),
    exigirCalmarBH: isTruthy_(readConfigValue_(ss, 'EXIGIR_CALMAR_SUPERIOR_BH', 'TRUE'))
  };
}

function getCustoPorLadoPct_(ss) {
  const v = parseNumericValue(readConfigValue_(ss, 'CUSTO_POR_LADO_PCT', 0.125));
  return v > 0 ? v : 0.125;
}

function parseNumericValue(val) {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val && val !== 0) return 0;
  const num = parseFloat(String(val).trim().replace(/\s/g, '').replace(',', '.'));
  return isNaN(num) ? 0 : num;
}

/* ======================= MENU ======================= */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🚀 ENGINE QUANT (AUTÔNOMO)')
    .addItem('1. Executar 1 Ciclo Agora', 'runSingleCycleBatch20')
    .addItem('2. Ativar Automação em Segundo Plano', 'installScheduledTrigger')
    .addItem('3. Pausar Automação em Segundo Plano', 'pauseScheduledTrigger')
    .addItem('4. Retomar Automação (PIPELINE_PAUSED=FALSE)', 'resumePipeline')
    .addSeparator()
    .addItem('5. Disparar E-mail com as Reservadas Atuais', 'manualDispatchReservedEmail')
    .addItem('6. Sincronizar Série Histórica BTC', 'syncBtcHistoricalData')
    .addItem('7. Diagnóstico de Vídeos (origem das hipóteses)', 'diagnosticoDeduplicacao')
    .addItem('8. Listar Modelos Disponíveis', 'listarModelosDisponiveis')
    .addItem('9. Reprocessar e Classificar Reservadas (motor v5)', 'reprocessarReservadasComMotorCorrigido')
    .addItem('10. Reparar Formato Numérico das Abas', 'repararFormatoNumerico')
    .addItem('11. Aplicar Classificação (aba STATUS_PROPOSTO)', 'aplicarStatusProposto')
    .addItem('Configurar Gemini API Key', 'promptGeminiApiKey')
    .addToUi();
}

function promptGeminiApiKey() {
  const ui = SpreadsheetApp.getUi();
  const p = ui.prompt('Configuração Gemini API', 'Insira sua Gemini API Key:', ui.ButtonSet.OK_CANCEL);
  if (p.getSelectedButton() === ui.Button.OK && p.getResponseText().trim()) {
    PropertiesService.getScriptProperties().setProperty('GEMINI_API_KEY', p.getResponseText().trim());
    ui.alert('Chave gravada com sucesso!');
  }
}

/* ======================= DADOS BTC ======================= */

function syncBtcHistoricalData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dSheet = ss.getSheetByName(SHEETS.DATA_BTC);
  let rows = [];
  const SOURCE_SPREADSHEET_ID = '13RyXbvMGYppWPmWAPpFxUJ1bz17_oz6G-dAUAWZxhzQ';

  try {
    const src = SpreadsheetApp.openById(SOURCE_SPREADSHEET_ID).getSheetByName('Dados_1D');
    if (src && src.getLastRow() > 1) {
      src.getRange(2, 1, src.getLastRow() - 1, 6).getValues().forEach(function (r) {
        const d = r[0] instanceof Date ? Utilities.formatDate(r[0], 'UTC', 'yyyy-MM-dd') : String(r[0]).substring(0, 10);
        rows.push([d, parseNumericValue(r[1]), parseNumericValue(r[2]), parseNumericValue(r[3]), parseNumericValue(r[4]), parseNumericValue(r[5])]);
      });
    }
  } catch (e) { console.warn('Fallback ativado: ' + e.message); }

  if (rows.length === 0) {
    try {
      const res = UrlFetchApp.fetch('https://api.kraken.com/0/public/OHLC?pair=XXBTZUSD&interval=1440', { muteHttpExceptions: true });
      if (res.getResponseCode() === 200) {
        const data = JSON.parse(res.getContentText());
        (data.result.XXBTZUSD || data.result.XBTUSD).forEach(function (k) {
          rows.push([Utilities.formatDate(new Date(k[0] * 1000), 'UTC', 'yyyy-MM-dd'),
            parseNumericValue(k[1]), parseNumericValue(k[2]), parseNumericValue(k[3]), parseNumericValue(k[4]), parseNumericValue(k[6])]);
        });
      }
    } catch (e) {}
  }

  if (rows.length === 0) throw new Error('Falha ao obter histórico de BTC.');
  if (dSheet.getLastRow() > 1) dSheet.getRange(2, 1, dSheet.getLastRow() - 1, 6).clearContent();
  dSheet.getRange(2, 1, rows.length, 6).setValues(rows);
  ss.toast('Série de BTC pronta: ' + rows.length + ' velas.', 'Sucesso');
  return rows.length;
}

function loadBtcDataFromSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dSheet = ss.getSheetByName(SHEETS.DATA_BTC);
  if (dSheet.getLastRow() <= 1) syncBtcHistoricalData();
  return dSheet.getRange(2, 1, dSheet.getLastRow() - 1, 6).getValues().map(function (r) {
    return { date: r[0], open: parseNumericValue(r[1]), high: parseNumericValue(r[2]),
             low: parseNumericValue(r[3]), close: parseNumericValue(r[4]), volume: parseNumericValue(r[5]) };
  });
}

/* ======================= ORQUESTRADOR ======================= */

function scheduledAutomationTrigger() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) { writeLog('scheduledAutomationTrigger', 'LOCK_BUSY', 'ENGINE', 'Ciclo anterior ainda em execução.'); return; }
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    // Correção do bug central: antes comparava a linha inteira (cfgData[c]) com 'TRUE'.
    if (isPaused_(ss)) {
      writeLog('scheduledAutomationTrigger', 'PAUSED', 'ENGINE', 'PIPELINE_PAUSED=TRUE: ciclo ignorado (nenhum lote, nenhum e-mail).');
      return;
    }
    executeBatchOf20Videos();
  } catch (e) {
    writeLog('scheduledAutomationTrigger', 'ERROR', 'ENGINE', e.message);
  } finally {
    lock.releaseLock();
  }
}

function runSingleCycleBatch20() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) { SpreadsheetApp.getUi().alert('Já existe um ciclo em execução. Aguarde terminar.'); return; }
  try { executeBatchOf20Videos(); } finally { lock.releaseLock(); }
}

function executeBatchOf20Videos() {
  const t0 = Date.now();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureConfigDefaults_(ss);
  ensureReservadasHeaders_(ss);
  const candles = loadBtcDataFromSheet();
  const apiKeyGem = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');

  writeLog('executeBatchOf20Videos', 'START', 'BATCH', 'Iniciando ciclo de mineração.');

  const vSheet = ss.getSheetByName(SHEETS.VIDEOS);
  const tSheet = ss.getSheetByName(SHEETS.TRIAGEM);
  const bSheet = ss.getSheetByName(SHEETS.BACKTEST);
  const kSheet = ss.getSheetByName(SHEETS.CONHECIMENTO);
  const resSheet = ss.getSheetByName(SHEETS.RESERVADAS);

  const dedup = buildExistingDedupSets_(ss);
  const testedKeys = buildTestedRuleKeys_(ss);
  const batchStrategies = getBatchOf20Strategies(apiKeyGem, dedup.urls, dedup.fingerprints, testedKeys, t0);

  if (!batchStrategies || batchStrategies.length === 0) {
    writeLog('executeBatchOf20Videos', 'EMPTY', 'BATCH', 'Nenhuma ideia inédita após deduplicação por regra ou falha da API.');
    checkAndTriggerRefinementThreshold();
    return;
  }

  const criterios = getCriteriosReserva_(ss);
  const custo = getCustoPorLadoPct_(ss);
  const exigirVideo = isTruthy_(readConfigValue_(ss, 'EXIGIR_VIDEO_VERIFICADO', 'FALSE'));
  const resultsOfBatch = [];
  const processedVideoIds = [];
  const stratNums = nextStratNumber_(resSheet);
  let seq = 0;

  for (let i = 0; i < batchStrategies.length; i++) {
    if (Date.now() - t0 > ORCAMENTO_TEMPO_MS + 30000) {
      writeLog('executeBatchOf20Videos', 'TIME_BUDGET', 'BATCH', 'Orçamento de tempo esgotado; restante fica para o próximo ciclo.');
      break;
    }
    const s = batchStrategies[i];
    if (exigirVideo && s.origem !== 'URL_REAL') continue;

    const rule = normalizeRule_(s);
    const vidId = s.video_id;
    const hypId = 'HYP-' + Utilities.getUuid().substring(0, 6).toUpperCase();
    const testId = 'TEST-' + Utilities.getUuid().substring(0, 6).toUpperCase();
    const setupName = buildSetupName_(rule);
    const key = ruleKey_(rule);

    processedVideoIds.push(vidId);
    testedKeys.add(key);
    if (s.origem === 'URL_REAL') dedup.urls.add(String(s.video_url).trim());
    dedup.fingerprints.add(s.fingerprint || buildStrategyFingerprint_(s));

    vSheet.appendRow([vidId, s.video_url || '(dedução própria)', s.video_titulo, s.canal, new Date(), new Date(),
      'Quantitative Mining Dinâmica', 'PROCESSED', s.origem, '', hypId, true]);

    const m = executeMathematicalBacktest(candles, rule, custo);
    const av = avaliarCriterios_(m, criterios);
    const isPromising = av.ok;
    const statusValidacao = isPromising ? 'RESERVADA_PARA_REFINO' : 'REPROVADA_MATEMATICAMENTE';
    const motivo = isPromising
      ? 'Aprovada nos cortes da 08_CONFIG (incl. PF fora da amostra ' + m.pfOos + ')'
      : 'Reprovada: ' + av.motivos.join('; ') + ' | CAGR ' + m.cagr + '% (BTC B&H ' + m.cagrBuyHold + '%) | Trades ' + m.trades;

    tSheet.appendRow([hypId, new Date(), vidId, s.video_url || '', s.video_titulo, s.canal, '00:00', s.autor || 'Autor',
      s.alegacao_original, s.alegacao_original, rule.indicador, rule.curto, 'BTC', '1D',
      s.tipo_sinal || rule.indicador, 'H1: ' + setupName + ' no BTC 1D', 'Mecânico',
      'Close, High, Low, Volume', describeEntry_(rule), describeEntry_(rule), describeExit_(rule),
      rule.longo >= 10 ? 'Close > SMA' + rule.longo : 'Sem filtro', 'Tendência', 'OHLCV', isPromising, motivo, statusValidacao]);

    bSheet.appendRow([testId, hypId, 'V02', 'BTC', '1D', candles[0].date, candles[candles.length - 1].date, m.dataCorte,
      '70% IS', '30% OOS', 'Geral', setupName, describeEntry_(rule), describeExit_(rule),
      rule.stop > 0 ? rule.stop + ' ATR' : 'Sem stop', rule.rr > 0 ? rule.rr + ' R' : 'Sem alvo', 'Não', '100% Equity',
      'Custo ' + custo + '% por lado', rule.longo >= 10 ? 'Close > SMA' + rule.longo : 'Sem filtro', 'Entrada na abertura seguinte',
      JSON.stringify(Object.assign({}, s, { regra_normalizada: rule })),
      m.trades, m.winRate, m.profitFactor, m.expectancy, m.netProfit, m.maxDrawdown, m.sharpe, m.sortino,
      m.cagr, m.trades, 0, m.pfIs, m.pfOos, m.degradacaoPf, statusValidacao, motivo, new Date(),
      'HASH-' + Utilities.getUuid().substring(0, 8)]);

    kSheet.appendRow(['KNOW-' + Utilities.getUuid().substring(0, 6).toUpperCase(),
      isPromising ? 'O_QUE_FUNCIONA' : 'O_QUE_NAO_FUNCIONA', hypId, testId,
      setupName + ': Sharpe=' + m.sharpe + ', Calmar=' + m.calmar + ', MaxDD=' + m.maxDrawdown + '%, Trades=' + m.trades,
      'BTC-1D', 'Sharpe: ' + m.sharpe + ' | Calmar: ' + m.calmar, isPromising ? 'ALTO' : 'REJEITADO', motivo, new Date()]);

    if (isPromising) {
      const stratId = 'STRAT-' + String(stratNums.next++).padStart(3, '0');
      const r = resSheet.getLastRow() + 1;
      resSheet.appendRow([stratId, testId, setupName, rule.indicador, describeParams_(rule),
        describeEntry_(rule), describeExit_(rule), m.trades, m.winRate, m.profitFactor, m.sharpe, m.calmar,
        m.maxDrawdown, m.cagr, 'AGUARDANDO_REFINO', generateExactPineScript(setupName, rule, custo), new Date(),
        m.cagrBuyHold, m.alphaCagr, '', s.origem]);
      formatReservadasRow_(resSheet, r);
    }
    seq++;
    resultsOfBatch.push({ setup: setupName, indicador: rule.indicador, trades: m.trades, pf: m.profitFactor,
      pfOos: m.pfOos, sharpe: m.sharpe, calmar: m.calmar, maxDD: m.maxDrawdown, cagr: m.cagr, promising: isPromising });
  }

  runAnamneseBatch20(resultsOfBatch, processedVideoIds, apiKeyGem);
  writeLog('executeBatchOf20Videos', 'END', 'BATCH', seq + ' hipóteses testadas, ' +
    resultsOfBatch.filter(function (r) { return r.promising; }).length + ' reservadas, ' +
    Math.round((Date.now() - t0) / 1000) + 's.');
  checkAndTriggerRefinementThreshold();
}

function nextStratNumber_(resSheet) {
  let max = 0;
  if (resSheet.getLastRow() > 1) {
    resSheet.getRange(2, 1, resSheet.getLastRow() - 1, 1).getValues().forEach(function (r) {
      const m = String(r[0]).match(/^STRAT-(\d+)$/);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    });
  }
  return { next: max + 1 };
}

function ensureReservadasHeaders_(ss) {
  const sh = ss.getSheetByName(SHEETS.RESERVADAS);
  const heads = { 18: 'CAGR_BuyHold_BTC_%', 19: 'Alfa_vs_BTC_%', 20: 'Reprocessado_Em', 21: 'Origem_Video' };
  Object.keys(heads).forEach(function (c) { if (!sh.getRange(1, Number(c)).getValue()) sh.getRange(1, Number(c)).setValue(heads[c]); });
}

function formatReservadasRow_(sh, row) {
  // Valores como 4,03 estavam sendo lidos como data (04/03) em células sem formato numérico.
  sh.getRange(row, 8, 1, 7).setNumberFormat('0.00');
  sh.getRange(row, 18, 1, 2).setNumberFormat('0.00');
}

/* ======================= CRITÉRIOS ======================= */

function avaliarCriterios_(m, c) {
  const f = [];
  if (m.trades < c.minTrades) f.push('trades ' + m.trades + '<' + c.minTrades);
  if (m.profitFactor < c.minProfitFactor) f.push('PF ' + m.profitFactor + '<' + c.minProfitFactor);
  if (m.sharpe < c.minSharpe) f.push('Sharpe ' + m.sharpe + '<' + c.minSharpe);
  if (m.calmar < c.minCalmar) f.push('Calmar ' + m.calmar + '<' + c.minCalmar);
  if (m.maxDrawdown > c.maxDrawdown) f.push('MaxDD ' + m.maxDrawdown + '>' + c.maxDrawdown);
  if (m.cagr < c.minCagr) f.push('CAGR ' + m.cagr + '<' + c.minCagr);
  if (m.nOos < 3) f.push('OOS com ' + m.nOos + ' trades (insuficiente)');
  else if (m.pfOos < c.minPfOos) f.push('PF OOS ' + m.pfOos + '<' + c.minPfOos);
  if (c.exigirCalmarBH && m.calmar <= m.calmarBuyHold) f.push('Calmar ' + m.calmar + ' não supera o do buy and hold ' + m.calmarBuyHold);
  return { ok: f.length === 0, motivos: f };
}

/* ======================= DEDUPLICAÇÃO ======================= */

function normalizeTitleForFingerprint_(t) {
  return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

function buildStrategyFingerprint_(item) {
  return [normalizeTitleForFingerprint_(item.video_titulo), String(item.indicador || '').toUpperCase().trim(),
    String(item.parametro_curto || '').trim(), String(item.tipo_sinal || '').toUpperCase().trim()].join('|');
}

function extractVideoId_(url) {
  const m = String(url || '').match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{6,})/i);
  return m ? m[1] : '';
}

function isRealYoutubeVideoUrl_(url) {
  const id = extractVideoId_(url);
  return !!id && VIDEO_IDS_BLOQUEADOS.indexOf(id.toLowerCase()) === -1;
}

function similarityTokens_(a, b) {
  const toSet = function (t) {
    const o = {}; normalizeTitleForFingerprint_(t).split(' ').forEach(function (x) { if (x.length > 2) o[x] = true; });
    return Object.keys(o);
  };
  const ta = toSet(a), tb = toSet(b);
  if (!ta.length || !tb.length) return 0;
  const inter = ta.filter(function (x) { return tb.indexOf(x) !== -1; }).length;
  return inter / (ta.length + tb.length - inter);
}

/**
 * Confirma que o vídeo existe E que o título real do YouTube combina com o título que o
 * modelo declarou. Só existir não basta: o vídeo de exemplo do prompt existe.
 */
function verifyYoutubeVideo_(url, claimedTitle, minSim) {
  try {
    const res = UrlFetchApp.fetch('https://www.youtube.com/oembed?url=' + encodeURIComponent(url) + '&format=json', { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) return { ok: false, motivo: 'oEmbed HTTP ' + res.getResponseCode() };
    const realTitle = JSON.parse(res.getContentText()).title || '';
    const sim = similarityTokens_(claimedTitle, realTitle);
    return sim >= minSim ? { ok: true, titulo: realTitle, sim: sim } : { ok: false, motivo: 'título diverge (sim ' + sim.toFixed(2) + ') "' + realTitle + '"' };
  } catch (e) { return { ok: false, motivo: 'erro oEmbed' }; }
}

function extractJsonArrayFromText_(text) {
  let clean = String(text || '').replace(/```json/gi, '').replace(/```/g, '').trim();
  const a = clean.indexOf('['), b = clean.lastIndexOf(']');
  if (a === -1 || b === -1 || b < a) return null;
  try { return JSON.parse(clean.substring(a, b + 1)); } catch (e) { return null; }
}

function buildExistingDedupSets_(ss) {
  const urls = new Set(), fps = new Set();
  const vSheet = ss.getSheetByName(SHEETS.VIDEOS);
  if (vSheet.getLastRow() > 1) {
    vSheet.getRange(2, 2, vSheet.getLastRow() - 1, 1).getValues().forEach(function (r) {
      const u = String(r[0] || '').trim(); if (u && isRealYoutubeVideoUrl_(u)) urls.add(u);
    });
  }
  const tSheet = ss.getSheetByName(SHEETS.TRIAGEM);
  if (tSheet.getLastRow() > 1) {
    tSheet.getRange(2, 5, tSheet.getLastRow() - 1, 11).getValues().forEach(function (row) {
      fps.add(buildStrategyFingerprint_({ video_titulo: row[0], indicador: row[6], parametro_curto: row[7], tipo_sinal: row[10] }));
    });
  }
  return { urls: urls, fingerprints: fps };
}

/** Chaves de REGRA já testadas (indicador + parâmetros), lidas do JSON da 02_BACKTEST (coluna V). */
function buildTestedRuleKeys_(ss) {
  const keys = new Set();
  const b = ss.getSheetByName(SHEETS.BACKTEST);
  if (b.getLastRow() > 1) {
    b.getRange(2, 22, b.getLastRow() - 1, 1).getValues().forEach(function (r) {
      try {
        const j = JSON.parse(r[0]);
        if (j && (j.regra_normalizada || j.indicador)) keys.add(ruleKey_(normalizeRule_(j.regra_normalizada ? j.regra_normalizada : j)));
      } catch (e) {}
    });
  }
  return keys;
}

/* ======================= ESPECIFICAÇÃO DA REGRA ======================= */

function normalizeRule_(r) {
  r = r || {};
  let ind = String(r.indicador || r.ind || 'EMA').toUpperCase().trim();
  if (ind.indexOf('+') !== -1) ind = ind.split('+')[0];
  if (INDICADORES_SUPORTADOS.indexOf(ind) === -1) ind = 'EMA';
  const curto = Number(r.parametro_curto !== undefined ? r.parametro_curto : r.curto) || 21;
  let longo = r.parametro_longo !== undefined ? r.parametro_longo : r.longo;
  longo = (longo === undefined || longo === null || longo === '') ? 200 : Number(longo);
  if (!isFinite(longo) || longo < 10) longo = 0;     // filtros SMA de 2 a 9 barras não são filtro
  const defMult = { KELTNER: 1.5, BOLLINGER: 2.0, SUPERTREND: 3, RSI: 55 }[ind] || 0;
  let mult = Number(r.param_mult !== undefined ? r.param_mult : r.mult);
  if (!isFinite(mult) || mult <= 0) mult = ind === 'DONCHIAN' ? Math.max(5, Math.round(curto / 2)) : (ind === 'MACD' ? Math.round(curto * 26 / 12) : defMult);
  const stopRaw = r.stop_atr_mult !== undefined ? r.stop_atr_mult : r.stop;
  const rrRaw = r.alvo_rr !== undefined ? r.alvo_rr : r.rr;
  const stop = (stopRaw === undefined || stopRaw === '' || !isFinite(Number(stopRaw))) ? 0 : Number(stopRaw);
  const rr = (rrRaw === undefined || rrRaw === '' || !isFinite(Number(rrRaw))) ? 0 : Number(rrRaw);
  return { indicador: ind, curto: curto, longo: longo, mult: mult, stop: stop, rr: stop > 0 ? rr : 0 };
}

function ruleKey_(R) { return [R.indicador, R.curto, R.longo, R.mult, R.stop, R.rr].join('|'); }
function buildSetupName_(R) { return R.indicador + '_' + R.curto + (R.longo ? '_SMA' + R.longo : '') + '_1D'; }
function describeParams_(R) {
  return 'Curto=' + R.curto + ', Longo=' + R.longo + ', Mult=' + R.mult + ', Stop=' + R.stop + 'ATR, TP=' + R.rr + 'R';
}
function describeEntry_(R) {
  const f = R.longo ? ' e Close > SMA' + R.longo : '';
  switch (R.indicador) {
    case 'EMA': return 'Close cruza acima da EMA' + R.curto + f;
    case 'SMA': return 'Close cruza acima da SMA' + R.curto + f;
    case 'DONCHIAN': return 'Close rompe a máxima de ' + R.curto + ' barras' + f;
    case 'KELTNER': return 'Close acima de EMA' + R.curto + ' + ' + R.mult + 'xATR14' + f;
    case 'BOLLINGER': return 'Close acima da banda superior (' + R.curto + ', ' + R.mult + ') com BandWidth acima da média de 50' + f;
    case 'SUPERTREND': return 'Supertrend (' + R.curto + ', ' + R.mult + ') vira de baixa para alta' + f;
    case 'RSI': return 'RSI' + R.curto + ' cruza acima de ' + R.mult + f;
    case 'MACD': return 'MACD(' + R.curto + ',' + R.mult + ',9) cruza acima da linha de sinal' + f;
    default: return 'Close cruza acima da VWAP de ' + R.curto + ' barras' + f;
  }
}
function describeExit_(R) {
  const stop = R.stop > 0 ? ' / Stop ' + R.stop + 'ATR' + (R.rr > 0 ? ' / Alvo ' + R.rr + 'R' : '') : '';
  switch (R.indicador) {
    case 'EMA': return 'Close cruza abaixo da EMA' + R.curto + stop;
    case 'SMA': return 'Close cruza abaixo da SMA' + R.curto + stop;
    case 'DONCHIAN': return 'Close abaixo da mínima de ' + R.mult + ' barras' + stop;
    case 'KELTNER': return 'Close abaixo da EMA' + R.curto + stop;
    case 'BOLLINGER': return 'Close abaixo da média das bandas' + stop;
    case 'SUPERTREND': return 'Supertrend vira para baixa' + stop;
    case 'RSI': return 'RSI cruza abaixo de ' + (R.mult - 10) + stop;
    case 'MACD': return 'MACD cruza abaixo da linha de sinal' + stop;
    default: return 'Close cruza abaixo da VWAP' + stop;
  }
}

/* ======================= INDICADORES (convenção TradingView) ======================= */

function nanArr_(n) { const a = new Array(n); for (let i = 0; i < n; i++) a[i] = NaN; return a; }

function sma_(x, n) {
  const out = nanArr_(x.length);
  for (let i = n - 1; i < x.length; i++) {
    let s = 0, ok = true;
    for (let j = 0; j < n; j++) { const v = x[i - j]; if (!(v === v)) { ok = false; break; } s += v; }
    if (ok) out[i] = s / n;
  }
  return out;
}

function expSmooth_(x, n, alpha) {
  const out = nanArr_(x.length);
  let start = -1;
  for (let i = 0; i + n <= x.length; i++) {
    let ok = true; for (let j = 0; j < n; j++) if (!(x[i + j] === x[i + j])) { ok = false; break; }
    if (ok) { start = i; break; }
  }
  if (start < 0) return out;
  let s = 0; for (let j = 0; j < n; j++) s += x[start + j];
  let prev = s / n; out[start + n - 1] = prev;
  for (let i = start + n; i < x.length; i++) {
    const v = x[i];
    prev = (v === v) ? v * alpha + prev * (1 - alpha) : prev;
    out[i] = prev;
  }
  return out;
}
function ema_(x, n) { return expSmooth_(x, n, 2 / (n + 1)); }
function rma_(x, n) { return expSmooth_(x, n, 1 / n); }

function atr_(candles, n) {
  const tr = [candles[0].high - candles[0].low];
  for (let i = 1; i < candles.length; i++) {
    const h = candles[i].high, l = candles[i].low, pc = candles[i - 1].close;
    tr.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  return rma_(tr, n);
}

function stdev_(x, n) {
  const out = nanArr_(x.length);
  for (let i = n - 1; i < x.length; i++) {
    let s = 0; for (let j = 0; j < n; j++) s += x[i - j];
    const m = s / n; let q = 0; for (let j = 0; j < n; j++) q += Math.pow(x[i - j] - m, 2);
    out[i] = Math.sqrt(q / n);
  }
  return out;
}

function highest_(x, n) { const o = nanArr_(x.length); for (let i = n - 1; i < x.length; i++) { let m = -Infinity; for (let j = 0; j < n; j++) m = Math.max(m, x[i - j]); o[i] = m; } return o; }
function lowest_(x, n) { const o = nanArr_(x.length); for (let i = n - 1; i < x.length; i++) { let m = Infinity; for (let j = 0; j < n; j++) m = Math.min(m, x[i - j]); o[i] = m; } return o; }
function shift_(x, k) { const o = nanArr_(x.length); for (let i = k; i < x.length; i++) o[i] = x[i - k]; return o; }

function rsi_(c, n) {
  const up = [NaN], dn = [NaN];
  for (let i = 1; i < c.length; i++) { const d = c[i] - c[i - 1]; up.push(Math.max(d, 0)); dn.push(Math.max(-d, 0)); }
  const u = rma_(up, n), d = rma_(dn, n), out = nanArr_(c.length);
  for (let i = 0; i < c.length; i++) if (u[i] === u[i] && d[i] === d[i]) out[i] = d[i] === 0 ? 100 : 100 - 100 / (1 + u[i] / d[i]);
  return out;
}

function macd_(c, fast, slow, sig) {
  const f = ema_(c, fast), s = ema_(c, slow), m = nanArr_(c.length);
  for (let i = 0; i < c.length; i++) if (f[i] === f[i] && s[i] === s[i]) m[i] = f[i] - s[i];
  return { macd: m, signal: ema_(m, sig) };
}

function supertrend_(candles, period, mult) {
  const n = candles.length, a = atr_(candles, period), dir = nanArr_(n);
  const fu = nanArr_(n), fl = nanArr_(n);
  for (let i = 0; i < n; i++) {
    if (!(a[i] === a[i])) continue;
    const hl2 = (candles[i].high + candles[i].low) / 2, ub = hl2 + mult * a[i], lb = hl2 - mult * a[i];
    if (!(fu[i - 1] === fu[i - 1])) { fu[i] = ub; fl[i] = lb; dir[i] = 1; continue; }
    fu[i] = (ub < fu[i - 1] || candles[i - 1].close > fu[i - 1]) ? ub : fu[i - 1];
    fl[i] = (lb > fl[i - 1] || candles[i - 1].close < fl[i - 1]) ? lb : fl[i - 1];
    if (dir[i - 1] === -1 && candles[i].close > fu[i - 1]) dir[i] = 1;
    else if (dir[i - 1] === 1 && candles[i].close < fl[i - 1]) dir[i] = -1;
    else dir[i] = dir[i - 1];
  }
  return dir;
}

function vwap_(candles, n) {
  const out = nanArr_(candles.length);
  for (let i = n - 1; i < candles.length; i++) {
    let pv = 0, v = 0;
    for (let j = 0; j < n; j++) { const k = candles[i - j]; pv += (k.high + k.low + k.close) / 3 * k.volume; v += k.volume; }
    if (v > 0) out[i] = pv / v;
  }
  return out;
}

function crossUp_(a, b) { const o = new Array(a.length).fill(false); for (let i = 1; i < a.length; i++) o[i] = a[i] > b[i] && a[i - 1] <= b[i - 1]; return o; }
function crossDn_(a, b) { const o = new Array(a.length).fill(false); for (let i = 1; i < a.length; i++) o[i] = a[i] < b[i] && a[i - 1] >= b[i - 1]; return o; }
function constArr_(v, n) { const a = new Array(n); for (let i = 0; i < n; i++) a[i] = v; return a; }

/** Sinais de entrada e saída avaliados no FECHAMENTO da barra i (execução na abertura de i+1). */
function buildSignals_(candles, R) {
  const n = candles.length;
  const c = candles.map(function (k) { return k.close; }), h = candles.map(function (k) { return k.high; }), l = candles.map(function (k) { return k.low; });
  let entry = new Array(n).fill(false), exit = new Array(n).fill(false);

  if (R.indicador === 'EMA' || R.indicador === 'SMA') {
    const ref = R.indicador === 'EMA' ? ema_(c, R.curto) : sma_(c, R.curto);
    entry = crossUp_(c, ref); exit = crossDn_(c, ref);
  } else if (R.indicador === 'DONCHIAN') {
    const up = shift_(highest_(h, R.curto), 1), lo = shift_(lowest_(l, R.mult), 1);
    for (let i = 0; i < n; i++) { entry[i] = c[i] > up[i]; exit[i] = c[i] < lo[i]; }
  } else if (R.indicador === 'KELTNER') {
    const b = ema_(c, R.curto), a = atr_(candles, 14);
    for (let i = 0; i < n; i++) { entry[i] = c[i] > b[i] + R.mult * a[i]; exit[i] = c[i] < b[i]; }
  } else if (R.indicador === 'BOLLINGER') {
    const b = sma_(c, R.curto), sd = stdev_(c, R.curto), bw = nanArr_(n);
    for (let i = 0; i < n; i++) bw[i] = (2 * R.mult * sd[i]) / b[i];
    const bwMa = sma_(bw, 50);
    for (let i = 0; i < n; i++) { entry[i] = c[i] > b[i] + R.mult * sd[i] && bw[i] > bwMa[i]; exit[i] = c[i] < b[i]; }
  } else if (R.indicador === 'SUPERTREND') {
    const d = supertrend_(candles, R.curto, R.mult);
    for (let i = 1; i < n; i++) { entry[i] = d[i] === 1 && d[i - 1] === -1; exit[i] = d[i] === -1; }
  } else if (R.indicador === 'RSI') {
    const r = rsi_(c, R.curto);
    entry = crossUp_(r, constArr_(R.mult, n)); exit = crossDn_(r, constArr_(R.mult - 10, n));
  } else if (R.indicador === 'MACD') {
    const mm = macd_(c, R.curto, R.mult, 9);
    entry = crossUp_(mm.macd, mm.signal); exit = crossDn_(mm.macd, mm.signal);
  } else if (R.indicador === 'VWAP') {
    const v = vwap_(candles, R.curto);
    entry = crossUp_(c, v); exit = crossDn_(c, v);
  }
  if (R.longo >= 10) {
    const f = sma_(c, R.longo);
    for (let i = 0; i < n; i++) entry[i] = entry[i] && c[i] > f[i];
  }
  return { entry: entry, exit: exit };
}

/* ======================= MOTOR DE BACKTEST ======================= */

/**
 * Long only, 100% do capital, sinal no fechamento e execução na abertura seguinte,
 * custo por lado em cada execução, stop/alvo ATR fixados na barra do sinal e checados
 * a partir da própria barra de entrada (stop primeiro se os dois forem tocados),
 * gap de abertura executa no pior preço. Equivalente ao motor Python validado
 * contra a planilha MVP.
 */
function simulate_(candles, sig, R, fee) {
  const n = candles.length, o = [], h = [], l = [], c = [];
  candles.forEach(function (k) { o.push(k.open); h.push(k.high); l.push(k.low); c.push(k.close); });
  const a = atr_(candles, 14), eq = new Array(n), trades = [];
  let cash = 1, qty = 0, pos = false, epi = 0, cost = 1, sl = NaN, tp = NaN, slSig = NaN, tpSig = NaN, pendE = false, pendX = false;

  for (let i = 0; i < n; i++) {
    if (pendX && pos) { cash = qty * o[i] * (1 - fee); trades.push({ i0: epi, i1: i, ret: cash / cost - 1 }); qty = 0; pos = false; }
    if (pendE && !pos) { cost = cash; qty = cash * (1 - fee) / o[i]; epi = i; pos = true; cash = 0; sl = slSig; tp = tpSig; }
    pendE = pendX = false;
    if (pos && sl === sl) {
      let hit = null;
      if (l[i] <= sl) hit = Math.min(sl, o[i]);
      else if (tp === tp && h[i] >= tp) hit = Math.max(tp, o[i]);
      if (hit !== null) { cash = qty * hit * (1 - fee); trades.push({ i0: epi, i1: i, ret: cash / cost - 1 }); qty = 0; pos = false; }
    }
    eq[i] = cash + qty * c[i];
    if (pos && sig.exit[i]) pendX = true;
    if (!pos && sig.entry[i]) {
      pendE = true;
      if (R.stop > 0 && a[i] === a[i]) { slSig = c[i] - R.stop * a[i]; tpSig = R.rr > 0 ? c[i] + (c[i] - slSig) * R.rr : NaN; }
      else { slSig = NaN; tpSig = NaN; }
    }
  }
  if (pos) trades.push({ i0: epi, i1: n - 1, ret: qty * c[n - 1] * (1 - fee) / cost - 1 });
  return { eq: eq, trades: trades };
}

function computeMetrics_(eq, trades, from, to, closes) {
  const E = [], e0 = eq[from];
  for (let i = from; i < to; i++) E.push(eq[i] / e0);
  const T = trades.filter(function (t) { return t.i0 >= from && t.i0 < to; });
  const years = (E.length - 1) / 365.25;
  const final = E[E.length - 1];
  const cagr = final > 0 && years > 0 ? (Math.pow(final, 1 / years) - 1) * 100 : -100;
  let peak = E[0], dd = 0; E.forEach(function (v) { if (v > peak) peak = v; dd = Math.max(dd, (peak - v) / peak * 100); });
  const r = []; for (let i = 1; i < E.length; i++) r.push(E[i] / E[i - 1] - 1);
  const mean = r.length ? r.reduce(function (s, v) { return s + v; }, 0) / r.length : 0;
  const sd = r.length > 1 ? Math.sqrt(r.reduce(function (s, v) { return s + Math.pow(v - mean, 2); }, 0) / (r.length - 1)) : 0;
  const neg = r.filter(function (v) { return v < 0; });
  const nm = neg.length ? neg.reduce(function (s, v) { return s + v; }, 0) / neg.length : 0;
  const nsd = neg.length > 1 ? Math.sqrt(neg.reduce(function (s, v) { return s + Math.pow(v - nm, 2); }, 0) / (neg.length - 1)) : 0;
  const wins = T.filter(function (t) { return t.ret > 0; }), loss = T.filter(function (t) { return t.ret <= 0; });
  const gp = wins.reduce(function (s, t) { return s + t.ret; }, 0), gl = -loss.reduce(function (s, t) { return s + t.ret; }, 0);
  // buy and hold na mesma janela
  const c0 = closes[from], bhFinal = closes[to - 1] / c0;
  const bhCagr = years > 0 ? (Math.pow(bhFinal, 1 / years) - 1) * 100 : 0;
  let bp = closes[from], bdd = 0; for (let i = from; i < to; i++) { if (closes[i] > bp) bp = closes[i]; bdd = Math.max(bdd, (bp - closes[i]) / bp * 100); }
  const round2 = function (v) { return Number(v.toFixed(2)); };
  return {
    trades: T.length, winRate: T.length ? round2(wins.length / T.length * 100) : 0,
    profitFactor: gl > 0 ? round2(gp / gl) : round2(gp), maxDrawdown: round2(dd), cagr: round2(cagr),
    sharpe: sd > 0 ? round2(mean / sd * Math.sqrt(365)) : 0, sortino: nsd > 0 ? round2(mean / nsd * Math.sqrt(365)) : 0,
    calmar: dd > 0 ? round2(cagr / dd) : 0, netProfit: round2((final - 1) * 100),
    expectancy: T.length ? round2(T.reduce(function (s, t) { return s + t.ret; }, 0) / T.length * 100) : 0,
    cagrBuyHold: round2(bhCagr), maxDdBuyHold: round2(bdd), calmarBuyHold: bdd > 0 ? round2(bhCagr / bdd) : 0
  };
}

function executeMathematicalBacktest(candles, rule, custoPorLadoPct) {
  const R = rule && rule.indicador && rule.curto !== undefined && rule.mult !== undefined ? rule : normalizeRule_(rule);
  const fee = (Number(custoPorLadoPct) || 0.125) / 100;
  const n = candles.length, closes = candles.map(function (k) { return k.close; });
  const sim = simulate_(candles, buildSignals_(candles, R), R, fee);
  const cut = Math.floor(n * 0.7);
  const full = computeMetrics_(sim.eq, sim.trades, 0, n, closes);
  const oos = computeMetrics_(sim.eq, sim.trades, cut, n, closes);
  const ins = computeMetrics_(sim.eq.slice(0, cut), sim.trades, 0, cut, closes);
  full.alphaCagr = Number((full.cagr - full.cagrBuyHold).toFixed(2));
  full.pfIs = ins.profitFactor; full.pfOos = oos.profitFactor; full.nOos = oos.trades;
  full.cagrOos = oos.cagr; full.sharpeOos = oos.sharpe; full.maxDdOos = oos.maxDrawdown;
  full.degradacaoPf = ins.profitFactor > 0 ? Number(((oos.profitFactor / ins.profitFactor - 1) * 100).toFixed(1)) : 0;
  const d = candles[cut] ? candles[cut].date : '';
  full.dataCorte = d instanceof Date ? Utilities.formatDate(d, 'UTC', 'yyyy-MM-dd') : String(d).substring(0, 10);
  if (full.trades < 5) {
    full.sharpe = 0; full.calmar = 0; full.profitFactor = 0; full.cagr = 0; full.maxDrawdown = 100; full.alphaCagr = -999;
  }
  return full;
}

/* ======================= PINE SCRIPT (mesma especificação do motor) ======================= */

function generateExactPineScript(setupName, rule, custoPorLadoPct) {
  const R = rule && rule.indicador && rule.curto !== undefined && rule.mult !== undefined ? rule : normalizeRule_(rule);
  const custo = Number(custoPorLadoPct) || 0.125;
  const extra = { DONCHIAN: 'pSaida = input.int(' + R.mult + ', "Saida: minima de M barras", minval=2)',
    MACD: 'pSlow = input.int(' + R.mult + ', "EMA lenta do MACD", minval=2)' }[R.indicador] || 'pMult = input.float(' + R.mult + ', "Multiplicador / nivel", step=0.25)';
  const sig = {
    EMA: 'ref = ta.ema(close, pCurto)\nlongSig = ta.crossover(close, ref)\nexitSig = ta.crossunder(close, ref)\nplot(ref, "EMA", color=color.yellow)',
    SMA: 'ref = ta.sma(close, pCurto)\nlongSig = ta.crossover(close, ref)\nexitSig = ta.crossunder(close, ref)\nplot(ref, "SMA", color=color.yellow)',
    DONCHIAN: 'upper = ta.highest(high, pCurto)[1]\nlower = ta.lowest(low, pSaida)[1]\nlongSig = close > upper\nexitSig = close < lower\nplot(upper, "Maxima N", color=color.green)\nplot(lower, "Minima M", color=color.red)',
    KELTNER: 'basis = ta.ema(close, pCurto)\nupper = basis + pMult * ta.atr(14)\nlongSig = close > upper\nexitSig = close < basis\nplot(basis, "Media", color=color.yellow)\nplot(upper, "Banda superior", color=color.aqua)',
    BOLLINGER: 'basis = ta.sma(close, pCurto)\ndev = pMult * ta.stdev(close, pCurto)\nupper = basis + dev\nbw = (2 * dev) / basis\nbwMa = ta.sma(bw, 50)\nlongSig = close > upper and bw > bwMa\nexitSig = close < basis\nplot(basis, "Media", color=color.yellow)\nplot(upper, "Banda superior", color=color.aqua)',
    SUPERTREND: '[st, dir] = ta.supertrend(pMult, pCurto)\nlongSig = dir < 0 and dir[1] > 0\nexitSig = dir > 0\nplot(st, "Supertrend", color=dir < 0 ? color.green : color.red)',
    RSI: 'r = ta.rsi(close, pCurto)\nlongSig = ta.crossover(r, pMult)\nexitSig = ta.crossunder(r, pMult - 10)',
    MACD: '[mm, ss, hh] = ta.macd(close, pCurto, pSlow, 9)\nlongSig = ta.crossover(mm, ss)\nexitSig = ta.crossunder(mm, ss)',
    VWAP: 'vw = math.sum(hlc3 * volume, pCurto) / math.sum(volume, pCurto)\nlongSig = ta.crossover(close, vw)\nexitSig = ta.crossunder(close, vw)\nplot(vw, "VWAP rolante", color=color.yellow)'
  }[R.indicador];

  return '//@version=5\n' +
    '// ' + setupName + ' | BTC 1D | ' + describeEntry_(R) + ' | saida: ' + describeExit_(R) + '\n' +
    '// Gerado pela MPV v5.0 a partir da MESMA especificacao usada no backtest em JS:\n' +
    '// sinal no fechamento, execucao na abertura da barra seguinte, long only, 100% do capital.\n' +
    '// Custo: ' + custo + '% por lado (' + (custo * 2).toFixed(3) + '% ida e volta) via commission_value, slippage 0.\n' +
    'strategy("' + setupName + '", overlay=true, initial_capital=10000, default_qty_type=strategy.percent_of_equity, default_qty_value=100, commission_type=strategy.commission.percent, commission_value=' + custo + ', slippage=0, pyramiding=0)\n' +
    'pCurto = input.int(' + R.curto + ', "Periodo curto", minval=1)\n' +
    'pLongo = input.int(' + R.longo + ', "SMA de filtro (0 desliga)", minval=0)\n' +
    extra + '\n' +
    'stopMult = input.float(' + R.stop + ', "Multiplicador ATR do stop (0 desliga)", step=0.5)\n' +
    'alvoRR = input.float(' + R.rr + ', "Alvo em multiplos de R (0 desliga)", step=0.5)\n' +
    'start = input.time(timestamp("2015-07-20 00:00 +0000"), "Inicio do backtest")\n' +
    'inRange = time >= start\n' +
    'smaF = ta.sma(close, math.max(pLongo, 1))\n' +
    'filtro = pLongo == 0 or close > smaF\n' +
    'atrV = ta.atr(14)\n' +
    sig + '\n' +
    'var float sl = na\n' +
    'var float tp = na\n' +
    'if inRange and longSig and filtro and strategy.position_size == 0\n' +
    '    sl := stopMult > 0 ? close - atrV * stopMult : na\n' +
    '    tp := (stopMult > 0 and alvoRR > 0) ? close + (close - sl) * alvoRR : na\n' +
    '    strategy.entry("Long", strategy.long)\n' +
    '    if not na(sl)\n' +
    '        strategy.exit("Exit", "Long", stop=sl, limit=tp)\n' +
    'if exitSig and strategy.position_size > 0\n' +
    '    strategy.close("Long", comment="Sinal de saida")\n';
}

/* ======================= DESCOBERTA (GEMINI) ======================= */

function runGeminiDiscoveryCall_(apiKey, promptText, useGrounding, modelName) {
  const model = modelName || GEMINI_MODEL;
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + apiKey;
  const payload = { contents: [{ parts: [{ text: promptText }] }], generationConfig: { temperature: 0.9 } };
  if (useGrounding) payload.tools = [{ google_search: {} }]; else payload.generationConfig.responseMimeType = 'application/json';

  const backoffs = [0, 4000, 9000];
  let lastError = null, attempts = 0;
  for (let a = 0; a < backoffs.length; a++) {
    if (backoffs[a] > 0) Utilities.sleep(backoffs[a]);
    attempts++;
    const res = UrlFetchApp.fetch(url, { method: 'post', contentType: 'application/json', headers: { 'x-goog-api-key': apiKey }, payload: JSON.stringify(payload), muteHttpExceptions: true });
    const code = res.getResponseCode();
    if (code === 200) {
      let body; try { body = JSON.parse(res.getContentText()); } catch (e) { return { ok: false, error: '[' + model + '] HTTP 200 com corpo inválido.' }; }
      const cand = body.candidates && body.candidates[0];
      if (!cand || !cand.content || !cand.content.parts) return { ok: false, error: '[' + model + '] sem candidates (safety ou corte por tokens).' };
      const text = cand.content.parts.map(function (p) { return p.text || ''; }).join('\n');
      const list = extractJsonArrayFromText_(text);
      if (!Array.isArray(list)) return { ok: false, error: '[' + model + '] sem array JSON (finishReason=' + (cand.finishReason || '?') + ').' };
      const gc = cand.groundingMetadata && cand.groundingMetadata.groundingChunks;
      return { ok: true, list: list, groundingSourcesCount: gc ? gc.length : 0, modelUsed: model, attempts: attempts };
    }
    lastError = 'HTTP ' + code + ': ' + res.getContentText().substring(0, 200);
    if (code !== 503) break;
  }
  return { ok: false, error: '[' + model + '] ' + lastError + ' (' + attempts + ' tentativa(s))' };
}

function buildDiscoveryPrompt_(queriesContext, jaTestadas) {
  return 'Você é um pesquisador quantitativo sênior focado exclusivamente no Bitcoin (BTC) no timeframe diário (1D).\n\n' +
    'Use a busca do Google (google_search) para ENCONTRAR vídeos REAIS do YouTube sobre estratégias aplicáveis a BTC, de canais como TradingView, DataTraders, Stormer, Oliver Velez, Rayner Teo, Benjamin Cowen, The Trading Channel, TRADING RUSH, TradingLab etc. Termos: ' + queriesContext + '.\n\n' +
    'Devolva 20 estratégias DIVERSIFICADAS. Cada uma deve ser uma das regras que o motor sabe testar, e o campo "indicador" DEVE ser exatamente um de:\n' +
    '- EMA ou SMA: preço cruza a média de parametro_curto períodos.\n' +
    '- DONCHIAN: rompe a máxima de parametro_curto barras; param_mult = barras da mínima de saída.\n' +
    '- KELTNER: EMA(parametro_curto) + param_mult x ATR14 (típico 1.5 a 2.5).\n' +
    '- BOLLINGER: rompimento da banda superior (parametro_curto, param_mult desvios) com largura acima da média.\n' +
    '- SUPERTREND: período parametro_curto, fator param_mult (típico 2 a 4).\n' +
    '- RSI: RSI(parametro_curto) cruza acima de param_mult (nível, típico 50 a 70).\n' +
    '- MACD: parametro_curto = EMA rápida, param_mult = EMA lenta, sinal 9.\n' +
    '- VWAP: preço cruza a VWAP rolante de parametro_curto barras.\n' +
    'parametro_longo = período da SMA de filtro de tendência (0 para sem filtro, senão 50 a 300). stop_atr_mult = 0 para sem stop (senão 1.5 a 4). alvo_rr = 0 para sem alvo.\n' +
    'Só use o indicador que o vídeo realmente descreve. Não rotule como SUPERTREND algo que é cruzamento de média.\n\n' +
    'REGRAS SOBRE O VÍDEO:\n' +
    '- "video_url" é o link completo e específico (https://www.youtube.com/watch?v=ID) de um vídeo que você ENCONTROU na busca. "video_titulo" é o título EXATO que aparece no YouTube.\n' +
    '- Nunca use link de busca nem IDs de exemplo. Se não confirmou o vídeo, deixe "video_url": "" e use "video_titulo": "Dedução própria".\n' +
    '- Não repita combinações de indicador + parâmetros do lote, nem as já testadas abaixo.\n\n' +
    'JÁ TESTADAS (não repita, varie indicador e parâmetros): ' + (jaTestadas.length ? jaTestadas.join('; ') : 'nenhuma') + '\n\n' +
    'Retorne ESTRITAMENTE um array JSON:\n' +
    '[{"video_titulo":"...","canal":"...","video_url":"https://www.youtube.com/watch?v=...","autor":"...","alegacao_original":"regra de entrada e saída descrita no vídeo","indicador":"DONCHIAN","parametro_curto":20,"param_mult":10,"parametro_longo":0,"tipo_sinal":"BREAKOUT","stop_atr_mult":0,"alvo_rr":0}]';
}

function getBatchOf20Strategies(apiKey, existingUrls, existingFingerprints, testedKeys, t0) {
  if (!apiKey) { writeLog('getBatchOf20Strategies', 'NO_API_KEY', 'CONFIG', 'Chave GEMINI_API_KEY não configurada.'); return []; }
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const useGrounding = isTruthy_(readConfigValue_(ss, 'GEMINI_USE_GROUNDING', 'TRUE'));
  const fallbackModel = String(readConfigValue_(ss, 'GEMINI_FALLBACK_MODEL', GEMINI_FALLBACK_MODEL_DEFAULT)).trim();
  const activeModel = String(readConfigValue_(ss, 'GEMINI_MODEL', GEMINI_MODEL)).trim() || GEMINI_MODEL;
  const queries = readConfigValue_(ss, 'SEARCH_QUERIES', 'bitcoin trading strategy backtest, btc trend following, donchian channel strategy, supertrend bitcoin, keltner channel bitcoin');
  const alvo = parseNumericValue(readConfigValue_(ss, 'NOVAS_ALVO_POR_CICLO', 12));
  const maxCalls = Math.max(1, parseNumericValue(readConfigValue_(ss, 'MAX_CHAMADAS_GEMINI_POR_CICLO', 3)));
  const minSim = parseNumericValue(readConfigValue_(ss, 'TITULO_SIMILARIDADE_MIN', 0.4));

  const fresh = [], seenInBatch = new Set();
  let descartadasIndicador = 0, descartadasRegra = 0, descartadasConteudo = 0, verificados = 0, naoVerificados = 0;

  for (let call = 0; call < maxCalls && fresh.length < alvo; call++) {
    if (Date.now() - t0 > ORCAMENTO_TEMPO_MS - 60000) break;
    const jaTestadas = Array.from(testedKeys).slice(-60).concat(Array.from(seenInBatch).slice(-30));
    const prompt = buildDiscoveryPrompt_(queries, jaTestadas);
    let result = { ok: false, error: 'grounding desativado' };
    if (useGrounding) {
      result = runGeminiDiscoveryCall_(apiKey, prompt, true, activeModel);
      if (!result.ok) writeLog('getBatchOf20Strategies', 'GROUNDING_FALLBACK', 'GEMINI', 'Busca falhou (' + result.error + '). Se HTTP 429, confira o billing do projeto da chave. Repetindo sem grounding.');
      else writeLog('getBatchOf20Strategies', 'GROUNDING_OK', 'GEMINI', result.groundingSourcesCount + ' fontes (' + result.attempts + ' tentativa(s)).');
    } else if (call === 0) {
      writeLog('getBatchOf20Strategies', 'GROUNDING_DISABLED', 'CONFIG', 'GEMINI_USE_GROUNDING=FALSE: hipóteses sem vídeo verificável serão marcadas DEDUCAO_PROPRIA.');
    }
    if (!result.ok) result = runGeminiDiscoveryCall_(apiKey, prompt, false, activeModel);
    if (!result.ok && fallbackModel) result = runGeminiDiscoveryCall_(apiKey, prompt, false, fallbackModel);
    if (!result.ok) { writeLog('getBatchOf20Strategies', 'API_ERROR', 'GEMINI', result.error); break; }
    if (!result.list.length) break;

    result.list.forEach(function (item) {
      if (!item || !item.indicador) return;
      const ind = String(item.indicador).toUpperCase().split('+')[0].trim();
      if (INDICADORES_SUPORTADOS.indexOf(ind) === -1) { descartadasIndicador++; return; }
      item.indicador = ind;
      const rule = normalizeRule_(item), key = ruleKey_(rule);
      if (testedKeys.has(key) || seenInBatch.has(key)) { descartadasRegra++; return; }

      const url = String(item.video_url || '').trim();
      let origem = 'DEDUCAO_PROPRIA';
      if (isRealYoutubeVideoUrl_(url)) {
        const v = verifyYoutubeVideo_(url, item.video_titulo, minSim);
        if (v.ok) { origem = 'URL_REAL'; item.video_titulo = v.titulo; verificados++; }
        else { origem = 'URL_NAO_VERIFICADA'; naoVerificados++; item.video_url = ''; }
      } else { item.video_url = ''; }
      item.origem = origem;
      item.video_id = origem === 'URL_REAL' ? extractVideoId_(url) : 'DED_' + Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, key).map(function (b) { return ('0' + (b & 0xFF).toString(16)).slice(-2); }).join('').substring(0, 8);
      if (origem !== 'URL_REAL' && !/dedu/i.test(String(item.video_titulo))) item.video_titulo = 'Dedução própria (' + (item.video_titulo || ind) + ')';
      const fp = buildStrategyFingerprint_(item);
      item.fingerprint = fp;
      if (origem === 'URL_REAL' && existingUrls.has(url) && existingFingerprints.has(fp)) { descartadasConteudo++; return; }
      seenInBatch.add(key); fresh.push(item);
    });
  }

  writeLog('getBatchOf20Strategies', 'SUCCESS', 'GEMINI_DISCOVERY',
    fresh.length + ' ideias inéditas (regra nova). Descartadas: ' + descartadasRegra + ' regra repetida, ' + descartadasIndicador +
    ' indicador não suportado. Vídeos: ' + verificados + ' verificados, ' + naoVerificados + ' com URL que não confere, resto dedução própria.');
  return fresh;
}

/* ======================= ANAMNESE ======================= */

function runAnamneseBatch20(results, videoIds, apiKey) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const anamneseId = 'ANAM-' + Utilities.getUuid().substring(0, 6).toUpperCase();
  const prom = results.filter(function (r) { return r.promising; });
  const porInd = {};
  results.forEach(function (r) { (porInd[r.indicador] = porInd[r.indicador] || []).push(r); });
  const resumoInd = Object.keys(porInd).map(function (k) {
    const a = porInd[k]; const med = a.reduce(function (s, r) { return s + r.calmar; }, 0) / a.length;
    return k + ': ' + a.length + ' testadas, Calmar médio ' + med.toFixed(2) + ', ' + a.filter(function (r) { return r.promising; }).length + ' aprovadas';
  }).join(' | ');

  let padroes = resumoInd || 'Lote vazio.';
  let contradicoes = 'Sem análise de IA neste lote.';
  let variaveis = 'Ver métricas por indicador.';
  let resumo = 'Analisadas ' + results.length + ' hipóteses; ' + prom.length + ' aprovadas nos cortes da 08_CONFIG (incluindo PF fora da amostra).';

  if (apiKey && results.length) {
    try {
      const model = String(readConfigValue_(ss, 'GEMINI_MODEL', GEMINI_MODEL)).trim() || GEMINI_MODEL;
      const prompt = 'Você é um pesquisador quantitativo sênior. Faça uma anamnese objetiva deste lote de ' + results.length + ' estratégias testadas no Bitcoin 1D. Aponte padrões, contradições entre indicadores e variáveis que mais explicam Calmar e PF fora da amostra. Não invente números além dos fornecidos.\nDADOS: ' + JSON.stringify(results) +
        '\nRetorne estritamente JSON: {"padroes_identificados":"","contradicoes_detectadas":"","variaveis_chave":"","resumo_executivo":""}';
      const res = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + apiKey, {
        method: 'post', contentType: 'application/json', headers: { 'x-goog-api-key': apiKey },
        payload: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json' } }), muteHttpExceptions: true });
      if (res.getResponseCode() === 200) {
        const p = JSON.parse(JSON.parse(res.getContentText()).candidates[0].content.parts[0].text.replace(/```json|```/g, '').trim());
        padroes = p.padroes_identificados || padroes; contradicoes = p.contradicoes_detectadas || contradicoes;
        variaveis = p.variaveis_chave || variaveis; resumo = p.resumo_executivo || resumo;
      }
    } catch (e) { console.warn('Anamnese IA indisponível: ' + e.message); }
  }
  ss.getSheetByName(SHEETS.SUBTOTAIS).appendRow([anamneseId, new Date(), results.length, videoIds.join(', '), padroes, contradicoes, variaveis,
    prom.map(function (r) { return r.setup; }).join('; ') || 'Nenhuma reservada neste lote', resumo]);
  writeLog('runAnamneseBatch20', 'SAVED', anamneseId, 'Anamnese gravada em 04_SUBTOTAIS.');
}

/* ======================= RESERVADAS: LIMITE, PAUSA E E-MAIL ======================= */

function readPendingReservadas_(ss) {
  const sh = ss.getSheetByName(SHEETS.RESERVADAS);
  if (sh.getLastRow() <= 1) return [];
  const out = [];
  sh.getDataRange().getValues().forEach(function (r, i) {
    if (i === 0 || String(r[14]).trim() !== 'AGUARDANDO_REFINO') return;
    out.push({ row: i + 1, stratId: r[0], setupName: r[2], indicador: r[3], parametros: r[4], trades: r[7], winRate: r[8],
      profitFactor: r[9], sharpe: r[10], calmar: r[11], maxDD: r[12], cagr: r[13], pineCode: r[15], origem: r[20] || '' });
  });
  return out;
}

function getNotified_() {
  try { return JSON.parse(PropertiesService.getScriptProperties().getProperty('NOTIFIED_STRAT_IDS') || '[]'); } catch (e) { return []; }
}
function addNotified_(ids) {
  const set = {}; getNotified_().concat(ids).forEach(function (i) { set[i] = true; });
  PropertiesService.getScriptProperties().setProperty('NOTIFIED_STRAT_IDS', JSON.stringify(Object.keys(set)));
}

function checkAndTriggerRefinementThreshold() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const limite = Math.max(1, parseNumericValue(readConfigValue_(ss, 'RESERVADAS_LIMITE_EMAIL', 30)));
  const notified = {}; getNotified_().forEach(function (i) { notified[i] = true; });
  const inedit = readPendingReservadas_(ss).filter(function (p) { return !notified[p.stratId]; });

  if (inedit.length < limite) {
    writeLog('checkAndTriggerRefinementThreshold', 'ACUMULANDO', 'POOL_REFINO', inedit.length + '/' + limite + ' reservadas inéditas. Pipeline segue rodando.');
    return;
  }
  inedit.sort(function (a, b) { return b.calmar - a.calmar; });
  const lote = inedit.slice(0, limite);
  const ok = dispatchPortfolioRefinementEmail(lote, ss);
  if (!ok) { writeLog('checkAndTriggerRefinementThreshold', 'EMAIL_FALHOU', 'POOL_REFINO', 'Envio falhou; as estratégias continuam como não notificadas e serão reenviadas no próximo ciclo.'); return; }
  addNotified_(lote.map(function (s) { return s.stratId; }));
  writeLog('checkAndTriggerRefinementThreshold', 'EMAIL_ENVIADO', 'POOL_REFINO', lote.length + ' estratégias enviadas (IDs: ' + lote.map(function (s) { return s.stratId; }).join(', ') + ').');
  if (isTruthy_(readConfigValue_(ss, 'PAUSAR_AO_ATINGIR_LIMITE', 'FALSE'))) {
    setConfigValue_(ss, 'PIPELINE_PAUSED', 'TRUE');
    writeLog('checkAndTriggerRefinementThreshold', 'PAUSADO', 'POOL_REFINO', 'PAUSAR_AO_ATINGIR_LIMITE=TRUE.');
  }
}

function dispatchPortfolioRefinementEmail(strategies, ss) {
  ss = ss || SpreadsheetApp.getActiveSpreadsheet();
  const recipient = String(readConfigValue_(ss, 'ALERT_EMAIL', 'guilhermecapiba@gmail.com')).trim();
  if (MailApp.getRemainingDailyQuota() < 1) { writeLog('dispatchPortfolioRefinementEmail', 'SEM_COTA', 'EMAIL', 'Cota diária de e-mail esgotada.'); return false; }
  const bhInfo = 'Referência buy and hold BTC: ver coluna CAGR_BuyHold_BTC_% da 05_RESERVADAS (Calmar do B&H é o piso exigido).';
  const rows = strategies.map(function (s) {
    return '<tr><td style="padding:6px;border:1px solid #e5e7eb;font-weight:bold">' + escapeHtmlCode(s.stratId) + '</td>' +
      '<td style="padding:6px;border:1px solid #e5e7eb">' + escapeHtmlCode(s.setupName) + '<br><span style="color:#6b7280;font-size:11px">' + escapeHtmlCode(s.parametros) + '</span></td>' +
      '<td style="padding:6px;border:1px solid #e5e7eb;text-align:center">' + s.trades + '</td>' +
      '<td style="padding:6px;border:1px solid #e5e7eb;text-align:center">' + s.winRate + '%</td>' +
      '<td style="padding:6px;border:1px solid #e5e7eb;text-align:center;font-weight:bold">' + s.profitFactor + '</td>' +
      '<td style="padding:6px;border:1px solid #e5e7eb;text-align:center">' + s.sharpe + '</td>' +
      '<td style="padding:6px;border:1px solid #e5e7eb;text-align:center">' + s.calmar + '</td>' +
      '<td style="padding:6px;border:1px solid #e5e7eb;text-align:center;color:#b91c1c">-' + s.maxDD + '%</td>' +
      '<td style="padding:6px;border:1px solid #e5e7eb;text-align:center;font-weight:bold">' + s.cagr + '%</td>' +
      '<td style="padding:6px;border:1px solid #e5e7eb;text-align:center;font-size:11px">' + escapeHtmlCode(s.origem) + '</td></tr>';
  }).join('');
  const html = '<div style="font-family:Arial,sans-serif;color:#111827;max-width:900px;margin:auto;padding:20px;border:2px solid #2563eb;border-radius:8px">' +
    '<h2 style="color:#1d4ed8;margin-top:0">' + strategies.length + ' estratégias reservadas para refino (BTC 1D)</h2>' +
    '<p>Cada estratégia abaixo foi notificada uma única vez. O pipeline <strong>continua rodando</strong> (a menos que PAUSAR_AO_ATINGIR_LIMITE esteja TRUE).</p>' +
    '<p style="background:#eff6ff;padding:10px;border-left:4px solid #3b82f6;font-size:13px">Os scripts Pine v5 estão no anexo <code>reservadas_pine.txt</code>. Eles seguem a mesma regra do motor de backtest (entrada na abertura seguinte, custo ' + getCustoPorLadoPct_(ss) + '% por lado), então os números do TradingView devem ficar próximos dos da tabela. ' + bhInfo + '</p>' +
    '<table style="width:100%;border-collapse:collapse;font-size:12px"><tr style="background:#f3f4f6">' +
    ['ID', 'Setup', 'Trades', 'Win', 'PF', 'Sharpe', 'Calmar', 'Max DD', 'CAGR', 'Origem'].map(function (h) { return '<th style="padding:6px;border:1px solid #d1d5db">' + h + '</th>'; }).join('') +
    '</tr>' + rows + '</table>' +
    '<p style="font-size:12px;color:#6b7280;margin-top:20px">Origem DEDUCAO_PROPRIA significa que a ideia não tem vídeo confirmado: trate como hipótese do modelo, não como estratégia de um autor.</p></div>';
  const pine = strategies.map(function (s) { return '// ===== ' + s.stratId + ' | ' + s.setupName + ' | ' + s.parametros + ' =====\n' + s.pineCode; }).join('\n\n');
  try {
    MailApp.sendEmail({ to: recipient, subject: '[REFINO] ' + strategies.length + ' estratégias reservadas de Bitcoin (1D)',
      htmlBody: html, attachments: [Utilities.newBlob(pine, 'text/plain', 'reservadas_pine.txt')] });
    return true;
  } catch (e) { writeLog('dispatchPortfolioRefinementEmail', 'ERRO', 'EMAIL', e.message); return false; }
}

function manualDispatchReservedEmail() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const list = readPendingReservadas_(ss).sort(function (a, b) { return b.calmar - a.calmar; }).slice(0, 30);
  if (!list.length) { SpreadsheetApp.getUi().alert('Nenhuma estratégia AGUARDANDO_REFINO na 05_RESERVADAS.'); return; }
  const ok = dispatchPortfolioRefinementEmail(list, ss);
  SpreadsheetApp.getUi().alert(ok ? 'E-mail enviado com ' + list.length + ' estratégias (as 30 de maior Calmar).' : 'Falha no envio, veja a 10_LOG.');
}

function resumePipeline() {
  setConfigValue_(SpreadsheetApp.getActiveSpreadsheet(), 'PIPELINE_PAUSED', 'FALSE');
  SpreadsheetApp.getActiveSpreadsheet().toast('PIPELINE_PAUSED=FALSE. A máquina continuará minerando.', 'Retomado');
}

function installScheduledTrigger() {
  pauseScheduledTrigger();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const h = [1, 2, 4, 6, 8, 12].indexOf(parseNumericValue(readConfigValue_(ss, 'TRIGGER_HORAS', 2))) !== -1 ? parseNumericValue(readConfigValue_(ss, 'TRIGGER_HORAS', 2)) : 2;
  ScriptApp.newTrigger('scheduledAutomationTrigger').timeBased().everyHours(h).create();
  ss.toast('Gatilho de ' + h + ' hora(s) instalado.', 'Piloto Automático');
}

function pauseScheduledTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    const f = t.getHandlerFunction();
    if (f === 'scheduledAutomationTrigger' || f === 'executeBatchOf20Videos') ScriptApp.deleteTrigger(t);
  });
  SpreadsheetApp.getActiveSpreadsheet().toast('Gatilhos temporizados removidos.', 'Pausado');
}

/* ======================= REPROCESSAMENTO E CLASSIFICAÇÃO ======================= */

/**
 * Reavalia a 05_RESERVADAS com o motor v5 e classifica cada linha:
 *  - DUPLICATA_DE_<id>: mesma regra (indicador + parâmetros) já vista;
 *  - PENDENTE_REGRA_FORMAL: não há JSON de regra na 02_BACKTEST para reavaliar (use o item 11 do menu
 *    para aplicar a classificação feita fora da planilha, ver results/status_reservadas_proposto.csv);
 *  - REPROVADA_NO_REPROCESSAMENTO: não passa mais na régua (motivos na 10_LOG);
 *  - AGUARDANDO_REFINO: passa. Fica aguardando a validação no TradingView.
 * Só toca linhas em AGUARDANDO_REFINO ou APROVADA. Nunca apaga linhas e não mexe em
 * EM_PRODUCAO, CAMPEA, PRODUCAO_*, nem em qualquer status que você tenha definido à mão.
 * Os rótulos antigos eram falsos (todo setup era EMA + SMA); aqui as regras são
 * reinterpretadas pelo indicador real, então os números mudam de propósito.
 */
function reprocessarReservadasComMotorCorrigido() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  const resSheet = ss.getSheetByName(SHEETS.RESERVADAS);
  const bSheet = ss.getSheetByName(SHEETS.BACKTEST);
  ensureConfigDefaults_(ss); ensureReservadasHeaders_(ss);
  if (resSheet.getLastRow() <= 1) { ui.alert('Nada em 05_RESERVADAS.'); return; }

  const ruleByTest = {};
  bSheet.getDataRange().getValues().forEach(function (r, i) {
    if (i === 0) return;
    try { const j = JSON.parse(r[21]); if (j && (j.regra_normalizada || (j.parametro_curto !== undefined && j.indicador))) ruleByTest[r[0]] = j.regra_normalizada || j; } catch (e) {}
  });

  const candles = loadBtcDataFromSheet(), custo = getCustoPorLadoPct_(ss), crit = getCriteriosReserva_(ss);
  const data = resSheet.getDataRange().getValues();
  const vistos = {}, cont = { mantidas: 0, reprovadas: 0, duplicatas: 0, semRegra: 0, ignoradas: 0 };
  for (let q = 1; q < data.length; q++) {   // regras que já estão em produção ou com status manual também contam como "já vistas"
    const st0 = String(data[q][14] || '').trim();
    if (st0 !== 'AGUARDANDO_REFINO' && st0 !== 'APROVADA' && ruleByTest[data[q][1]]) vistos[ruleKey_(normalizeRule_(ruleByTest[data[q][1]]))] = data[q][0];
  }

  for (let r = 1; r < data.length; r++) {
    const stratId = data[r][0], testId = data[r][1], status = String(data[r][14] || '').trim();
    if (status !== 'AGUARDANDO_REFINO' && status !== 'APROVADA') { cont.ignoradas++; continue; }
    const raw = ruleByTest[testId];
    if (!raw) { resSheet.getRange(r + 1, 15).setValue('PENDENTE_REGRA_FORMAL'); resSheet.getRange(r + 1, 20).setValue(new Date()); cont.semRegra++; continue; }
    const rule = normalizeRule_(raw), key = ruleKey_(rule);
    if (vistos[key]) { resSheet.getRange(r + 1, 15).setValue('DUPLICATA_DE_' + vistos[key]); resSheet.getRange(r + 1, 20).setValue(new Date()); cont.duplicatas++; continue; }
    vistos[key] = stratId;

    const m = executeMathematicalBacktest(candles, rule, custo), av = avaliarCriterios_(m, crit), nome = buildSetupName_(rule);
    resSheet.getRange(r + 1, 3, 1, 3).setValues([[nome, rule.indicador, describeParams_(rule)]]);
    resSheet.getRange(r + 1, 6, 1, 2).setValues([[describeEntry_(rule), describeExit_(rule)]]);
    resSheet.getRange(r + 1, 8, 1, 7).setValues([[m.trades, m.winRate, m.profitFactor, m.sharpe, m.calmar, m.maxDrawdown, m.cagr]]);
    resSheet.getRange(r + 1, 15).setValue(av.ok ? 'AGUARDANDO_REFINO' : 'REPROVADA_NO_REPROCESSAMENTO');
    resSheet.getRange(r + 1, 16).setValue(generateExactPineScript(nome, rule, custo));
    resSheet.getRange(r + 1, 18, 1, 3).setValues([[m.cagrBuyHold, m.alphaCagr, new Date()]]);
    formatReservadasRow_(resSheet, r + 1);
    writeLog('reprocessarReservadasComMotorCorrigido', av.ok ? 'MANTIDA' : 'REPROVADA', stratId, nome + ': ' + (av.ok ? 'passa nos cortes' : av.motivos.join('; ')));
    if (av.ok) cont.mantidas++; else cont.reprovadas++;
    if (r % 25 === 0) SpreadsheetApp.flush();
  }
  const resumo = 'Mantidas: ' + cont.mantidas + ' | Reprovadas: ' + cont.reprovadas + ' | Duplicatas: ' + cont.duplicatas +
    ' | Sem regra formal: ' + cont.semRegra + ' | Ignoradas (status manual): ' + cont.ignoradas;
  writeLog('reprocessarReservadasComMotorCorrigido', 'RESUMO', 'REPROCESSAMENTO', resumo);
  ui.alert('Reprocessamento concluído', resumo, ui.ButtonSet.OK);
}

/**
 * Aplica na 05_RESERVADAS a classificação feita fora da planilha (aba STATUS_PROPOSTO, criada ao
 * importar results/status_reservadas_proposto.csv). Casa por Linha_Planilha E por Strategy_ID: se
 * o ID da linha não bater, a linha é pulada (a planilha mudou desde a análise). Só toca linhas em
 * AGUARDANDO_REFINO, APROVADA ou PENDENTE_REGRA_FORMAL. Grava Status_Refino (O), CAGR_BuyHold (R),
 * Alfa (S) e Reprocessado_Em (T). Não apaga nada.
 */
function aplicarStatusProposto() {
  const ss = SpreadsheetApp.getActiveSpreadsheet(), ui = SpreadsheetApp.getUi();
  const src = ss.getSheetByName('STATUS_PROPOSTO'), res = ss.getSheetByName(SHEETS.RESERVADAS);
  if (!src) { ui.alert('Importe results/status_reservadas_proposto.csv em uma aba chamada STATUS_PROPOSTO (Arquivo > Importar > Inserir nova planilha).'); return; }
  ensureReservadasHeaders_(ss);
  const rows = src.getDataRange().getValues(), head = rows[0].map(String);
  const col = function (n) { return head.indexOf(n); };
  const cL = col('Linha_Planilha'), cI = col('Strategy_ID'), cS = col('Status_Proposto'), cB = col('CAGR_BuyHold_BTC_%'), cA = col('Alfa_vs_BTC_%');
  if ([cL, cI, cS].some(function (c) { return c < 0; })) { ui.alert('A aba STATUS_PROPOSTO precisa das colunas Linha_Planilha, Strategy_ID e Status_Proposto.'); return; }
  const cur = res.getDataRange().getValues(), editaveis = { AGUARDANDO_REFINO: 1, APROVADA: 1, PENDENTE_REGRA_FORMAL: 1 };
  let ok = 0, pulou = 0, idErrado = 0;
  for (let i = 1; i < rows.length; i++) {
    const L = Number(rows[i][cL]), id = String(rows[i][cI]).trim(), novo = String(rows[i][cS]).trim();
    if (!L || !novo || !cur[L - 1]) { pulou++; continue; }
    if (String(cur[L - 1][0]).trim() !== id) { idErrado++; continue; }
    if (!editaveis[String(cur[L - 1][14]).trim()]) { pulou++; continue; }
    res.getRange(L, 15).setValue(novo);
    if (cB >= 0 && rows[i][cB] !== '') res.getRange(L, 18, 1, 2).setValues([[rows[i][cB], rows[i][cA]]]);
    res.getRange(L, 20).setValue(new Date());
    ok++;
  }
  formatReservadasRow_(res, 2);
  res.getRange(2, 18, Math.max(1, res.getLastRow() - 1), 2).setNumberFormat('0.00');
  const msg = 'Aplicadas: ' + ok + ' | Puladas (status manual ou vazio): ' + pulou + ' | ID não bate com a linha: ' + idErrado;
  writeLog('aplicarStatusProposto', 'RESUMO', 'LIBERACAO', msg); ui.alert('Classificação aplicada', msg, ui.ButtonSet.OK);
}

/** Força formato numérico nas colunas de métricas (evita 4,03 virar data). Não altera valores. */
function repararFormatoNumerico() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const fix = function (name, ranges) {
    const sh = ss.getSheetByName(name); if (!sh || sh.getLastRow() < 2) return;
    ranges.forEach(function (c) { sh.getRange(2, c[0], sh.getLastRow() - 1, c[1]).setNumberFormat('0.00'); });
  };
  fix(SHEETS.RESERVADAS, [[8, 7], [18, 2]]);
  fix(SHEETS.BACKTEST, [[24, 2], [26, 6], [31, 1], [34, 3]]);
  fix(SHEETS.DASHBOARD, [[7, 17]]);
  ss.toast('Formato numérico aplicado. Células que já viraram data precisam ser regravadas: rode o item 9 do menu.', 'Concluído');
}

/* ======================= UTILITÁRIOS ======================= */

function escapeHtmlCode(text) { return String(text === undefined || text === null ? '' : text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function writeLog(fn, status, refId, message) {
  try {
    const l = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.LOG);
    if (l) l.appendRow([new Date(), fn, status, refId, '', 0, '', 0, 0, 0, message]);
  } catch (e) {}
}

function diagnosticoDeduplicacao() {
  const ss = SpreadsheetApp.getActiveSpreadsheet(), ui = SpreadsheetApp.getUi();
  const v = ss.getSheetByName(SHEETS.VIDEOS);
  if (v.getLastRow() <= 1) { ui.alert('Nenhum vídeo processado ainda.'); return; }
  const n = Math.min(100, v.getLastRow() - 1), vals = v.getRange(v.getLastRow() - n + 1, 9, n, 1).getValues();
  const c = {}; vals.forEach(function (r) { const k = String(r[0] || 'SEM_MARCACAO').trim() || 'SEM_MARCACAO'; c[k] = (c[k] || 0) + 1; });
  ui.alert('Origem das últimas ' + n + ' hipóteses', Object.keys(c).map(function (k) { return k + ': ' + c[k]; }).join('\n') +
    '\n\nURL_REAL = vídeo existe e o título confere. DEDUCAO_PROPRIA = ideia do modelo sem vídeo. Se URL_REAL for 0, confira o grounding (GROUNDING_FALLBACK na 10_LOG).', ui.ButtonSet.OK);
}

function listarModelosDisponiveis() {
  const ui = SpreadsheetApp.getUi(), apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) { ui.alert('Configure a Gemini API Key primeiro.'); return; }
  const res = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models?key=' + apiKey, { headers: { 'x-goog-api-key': apiKey }, muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) { ui.alert('Erro ao listar modelos', 'HTTP ' + res.getResponseCode() + ': ' + res.getContentText().substring(0, 300), ui.ButtonSet.OK); return; }
  const models = (JSON.parse(res.getContentText()).models || []).filter(function (m) { return m.supportedGenerationMethods && m.supportedGenerationMethods.indexOf('generateContent') !== -1; })
    .map(function (m) { return m.name.replace('models/', ''); }).sort();
  writeLog('listarModelosDisponiveis', 'INFO', 'GEMINI_MODELS', models.length + ' modelos: ' + models.join(', '));
  ui.alert('Modelos disponíveis', models.slice(0, 40).join('\n') + (models.length > 40 ? '\n(lista completa na 10_LOG)' : ''), ui.ButtonSet.OK);
}

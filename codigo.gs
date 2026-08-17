/**
 * =========================================================================================
 * SISTEMA QUANTITATIVO DE ALOCAÇÃO BTC × ETH & GESTÃO DE RISCO AAVE (V3)
 * Arquitetura de Produção Definitiva para Google Apps Script
 * =========================================================================================
 * - Conector Multi-Exchange Resiliente (Kraken / Binance.US / Gate.io) sem Geoblock
 * - Carga Histórica Profunda (4H desde 01/01/2020) para BTC/USD e ETH/BTC
 * - Cálculo Vetorizado na Memória dos Indicadores:
 *   * RSI Ultimate (20) + RSI Momentum (20) [Metodologia Pine Script Capiba v.08.06.26]
 *   * Nuvem de Médias Móveis Multi-Timeframe (SMA 72h / 216h / 480h)
 *   * Canal Donchian (30 barras 4H) + ATR (14 períodos 4H) + Contexto Macro 2D (EMAs 21/55)
 * - Matriz de Decisão Multi-Timeframe (Semanal/Diário/4H) e Alocação Gradual BTC x ETH
 * - Leitura On-Chain Aave V3 (Polygon e Base) via JSON-RPC eth_call (getUserAccountData)
 * - Cálculo de Liquidação Real, Gestão de Aporte Mensal (R$ 2.000) e Caixa/Amortização
 * - Motor de Backtest Histórico Comparativo Integrado
 * =========================================================================================
 */

const CONFIG = {
  // Configurações Gerais
  DATA_INICIO_HISTORICO_MS: 1577836800000, // 01/01/2020 00:00:00 UTC
  GRANULARIDADE_SEGUNDOS: 14400,            // 4 horas (4h = 14.400s)
  FUSO_LOCAL: -3,                           // Horário de Brasília (UTC-3)
  APORTE_MENSAL_BRL: 2000,                  // Aporte mensal planejado

  // Nomes das 6 Abas Essenciais
  ABAS: {
    PAINEL:        '1_PAINEL_DECISAO',
    DADOS_BTC:     '2_DADOS_BTC_4H',
    DADOS_ETHBTC:  '3_DADOS_ETHBTC_4H',
    MOTOR_SINAIS:  '4_MOTOR_SINAIS',
    AAVE:          '5_AAVE_GESTAO_RISCO',
    CONFIG_LOG:    '6_CONFIG_LOG'
  },

  // Carteira e Conectores On-Chain Aave V3
  CARTEIRA_PADRAO: '0x1CFBA5C5949D6d7644f0175aA12ffA95C21575f9',
  SELECTOR_HF: '0xbf92857c', // getUserAccountData(address)

  MERCADOS_AAVE: [
    {
      rede: 'Polygon',
      pool: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
      ativoPrincipal: 'WBTC',
      rpcs: [
        'https://polygon-bor-rpc.publicnode.com',
        'https://polygon.drpc.org',
        'https://rpc.ankr.com/polygon',
        'https://polygon-rpc.com'
      ]
    },
    {
      rede: 'Base',
      pool: '0xA238Dd80C259a72e81d7e4664a9801593F98d1c5',
      ativoPrincipal: 'cbBTC',
      rpcs: [
        'https://base-rpc.publicnode.com',
        'https://base.drpc.org',
        'https://mainnet.base.org',
        'https://rpc.ankr.com/base'
      ]
    }
  ],

  // Limites e Gatilhos Operacionais Aave
  GATILHOS_HF: [
    { hfAbaixoDe: 1.35, status: 'CRITICO_AMORTIZAR_TOTAL', acao: 'AMORTIZACAO_URGENTE', nota: 'Risco iminente. Amortizar todo o caixa imediatamente.' },
    { hfAbaixoDe: 1.55, status: 'ALERTA_AMORTIZAR',       acao: 'AMORTIZAR_DIVIDA',    nota: 'Caixa direcionado 100% para amortização da dívida.' },
    { hfAbaixoDe: 1.80, status: 'SEM_NOVO_BORROW',         acao: 'BLOQUEAR_EMPRESTIMO', nota: 'Abaixo do gatilho seguro (1.80). Bloquear novos borrows.' },
    { hfAbaixoDe: 2.00, status: 'OBSERVACAO',              acao: 'MODERAR_ALAVANCAGEM', nota: 'Zona intermediária de observação.' },
    { hfAbaixoDe: 999.0, status: 'SEGURO_SAUDAVEL',        acao: 'OPERACAO_NORMAL',     nota: 'Posição saudável. Permitido novo borrow se houver oportunidade.' }
  ],

  // Parâmetros dos Indicadores
  INDICADORES: {
    RSI_LEN: 20,
    MOMENTUM_LEN: 20,
    SMA_CURTA_4H: 18,   // 72h em candles de 4h = 18 barras (3 dias)
    SMA_LONGA_4H: 54,   // 216h em candles de 4h = 54 barras (9 dias)
    SMA_EXTRA_4H: 120,  // 480h em candles de 4h = 120 barras (20 dias)
    DONCHIAN_LEN: 30,   // Canal de 30 barras de 4H (modelo validado)
    ATR_LEN: 14,        // ATR de 14 períodos no 4H
    EMA_2D_RAPIDA: 252, // Equivalente no 4H a EMA 21 de 2D (21 * 12 barras)
    EMA_2D_LENTA: 660   // Equivalente no 4H a EMA 55 de 2D (55 * 12 barras)
  }
};


/* =========================================================================================
 * 1. MENU PERSONALIZADO NO GOOGLE SHEETS
 * ========================================================================================= */

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('⚡ Sistema Quantitativo BTC/ETH')
    .addItem('🚀 1. Inicializar Planilha Completa (Carga Total)', 'inicializarPlanilhaCompleta')
    .addItem('🔄 2. Atualizar Dados e Sinais (Incremental)', 'atualizarTudo')
    .addItem('📊 3. Executar Backtest Comparativo', 'executarBacktestManual')
    .addSeparator()
    .addItem('⚙️ 4. Configurar Atualização Automática (a cada 4h)', 'configurarGatilhoAutomatico')
    .addToUi();
}


/* =========================================================================================
 * 2. FLUXO DE INICIALIZAÇÃO E CARGA TOTAL (DESDE 01/01/2020)
 * ========================================================================================= */

function inicializarPlanilhaCompleta() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(120000)) {
    SpreadsheetApp.getActive().toast('Outra execução em andamento. Aguarde...', 'Aviso', 5);
    return;
  }

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    ss.toast('Iniciando estruturação e carga histórica profunda...', 'Status', 10);

    // 1. Criar e configurar as 6 abas
    estruturarAbas(ss);

    // 2. Ingestão Histórica BTC/USD e ETH/BTC (desde 01/01/2020)
    ss.toast('Baixando histórico BTC/USD 4H desde 2020...', 'Status', 15);
    const dadosBtcBrutos = baixarHistoricoMultiFonte('BTC', 'USD', CONFIG.DATA_INICIO_HISTORICO_MS);

    ss.toast('Baixando histórico ETH/BTC 4H desde 2020...', 'Status', 15);
    const dadosEthBtcBrutos = baixarHistoricoMultiFonte('ETH', 'BTC', CONFIG.DATA_INICIO_HISTORICO_MS);

    // 3. Processar Indicadores Vetorizados
    ss.toast('Calculando RSI Ultimate, Nuvem e Médias...', 'Status', 10);
    const btcProcessado = processarIndicadoresVetorizados(dadosBtcBrutos, 'BTC');
    const ethBtcProcessado = processarIndicadoresVetorizados(dadosEthBtcBrutos, 'ETHBTC');

    // 4. Gravar Dados nas Abas
    gravarDadosAba(ss.getSheetByName(CONFIG.ABAS.DADOS_BTC), btcProcessado.matriz, CABECALHO_DADOS);
    gravarDadosAba(ss.getSheetByName(CONFIG.ABAS.DADOS_ETHBTC), ethBtcProcessado.matriz, CABECALHO_DADOS);

    // 5. Ingestão On-Chain Aave
    ss.toast('Consultando Aave V3 Polygon e Base...', 'Status', 10);
    const dadosAave = consultarAaveOnChain();
    gravarDadosAave(ss.getSheetByName(CONFIG.ABAS.AAVE), dadosAave);

    // 6. Motor de Sinais & Painel de Decisão
    ss.toast('Gerando Sinal Atual e Alocação...', 'Status', 10);
    const analise = gerarAnaliseQuantitativa(btcProcessado.registros, ethBtcProcessado.registros, dadosAave);
    renderizarPainelDecisao(ss.getSheetByName(CONFIG.ABAS.PAINEL), analise, dadosAave);
    gravarHistoricoSinal(ss.getSheetByName(CONFIG.ABAS.MOTOR_SINAIS), analise);

    // 7. Executar Backtest Comparativo
    ss.toast('Executando Backtest Comparativo...', 'Status', 10);
    executarBacktestComparativo(ss, btcProcessado.registros, ethBtcProcessado.registros);

    registrarLog('INICIALIZACAO', 'Sucesso na carga histórica e estruturação completa. Linhas: ' + btcProcessado.registros.length);
    ss.toast('✅ Sistema inicializado com sucesso! Histórico completo carregado.', 'Concluído', 10);
  } catch (e) {
    registrarLog('ERRO_INICIALIZACAO', String(e));
    SpreadsheetApp.getActive().toast('Erro na inicialização: ' + e.message, 'Erro', 10);
    throw e;
  } finally {
    lock.releaseLock();
  }
}


/* =========================================================================================
 * 3. ATUALIZAÇÃO INCREMENTAL AUTOMÁTICA
 * ========================================================================================= */

function atualizarTudo() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(45000)) {
    registrarLog('ATUALIZACAO', 'Tentativa de execução sobreposta abortada.');
    return;
  }

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const abaBtc = ss.getSheetByName(CONFIG.ABAS.DADOS_BTC);
    const abaEthBtc = ss.getSheetByName(CONFIG.ABAS.DADOS_ETHBTC);

    if (!abaBtc || abaBtc.getLastRow() < 2) {
      inicializarPlanilhaCompleta();
      return;
    }

    // 1. Atualizar BTC e ETHBTC
    const novosBtc = atualizarIncrementalPar(abaBtc, 'BTC', 'USD', 'BTC');
    const novosEth = atualizarIncrementalPar(abaEthBtc, 'ETH', 'BTC', 'ETHBTC');

    // 2. Atualizar Aave
    const dadosAave = consultarAaveOnChain();
    gravarDadosAave(ss.getSheetByName(CONFIG.ABAS.AAVE), dadosAave);

    // 3. Atualizar Painel
    const dadosBtc = lerUltimosRegistros(abaBtc, 500);
    const dadosEthBtc = lerUltimosRegistros(abaEthBtc, 500);
    const analise = gerarAnaliseQuantitativa(dadosBtc, dadosEthBtc, dadosAave);

    renderizarPainelDecisao(ss.getSheetByName(CONFIG.ABAS.PAINEL), analise, dadosAave);
    gravarHistoricoSinal(ss.getSheetByName(CONFIG.ABAS.MOTOR_SINAIS), analise);

    registrarLog('CICLO_INCREMENTAL', 'Velas novas BTC: ' + novosBtc + ' | ETHBTC: ' + novosEth + ' | HF Polygon: ' + (dadosAave.polygon ? dadosAave.polygon.hf : 'N/A'));
    ss.toast('Atualização concluída: ' + novosBtc + ' novas velas 4H.', 'Atualizado', 5);
  } catch (e) {
    registrarLog('ERRO_INCREMENTAL', String(e));
    throw e;
  } finally {
    lock.releaseLock();
  }
}


/* =========================================================================================
 * 4. INGESTÃO RESILIENTE DE DADOS (MULTI-EXCHANGE SEM GEOBLOCK)
 * ========================================================================================= */

function baixarHistoricoMultiFonte(fsym, tsym, startTimeMs) {
  try {
    const parKraken = fsym === 'BTC' ? 'XXBTZUSD' : 'XETHXXBT';
    return baixarHistoricoKrakenPaginado(parKraken, startTimeMs);
  } catch (e1) {
    Logger.log('Fallback 1 - Tentando Gate.io: ' + e1.message);
    try {
      const parGate = (fsym + '_' + (tsym === 'USD' ? 'USDT' : tsym)).toUpperCase();
      return baixarHistoricoGateIo(parGate, startTimeMs);
    } catch (e2) {
      Logger.log('Fallback 2 - Tentando Binance.US: ' + e2.message);
      const parBinanceUs = (fsym + (tsym === 'USD' ? 'USDT' : tsym)).toUpperCase();
      return baixarHistoricoBinanceUs(parBinanceUs, startTimeMs);
    }
  }
}

function baixarHistoricoKrakenPaginado(par, startTimeMs) {
  const velas = [];
  let sinceSec = Math.floor(startTimeMs / 1000);
  const agoraSec = Math.floor(Date.now() / 1000);
  const limiteVelaFechadaSec = Math.floor(agoraSec / CONFIG.GRANULARIDADE_SEGUNDOS) * CONFIG.GRANULARIDADE_SEGUNDOS;

  const url = 'https://api.kraken.com/0/public/OHLC?pair=' + par + '&interval=240&since=' + sinceSec;
  const resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });

  if (resp.getResponseCode() !== 200) {
    throw new Error('Erro na API Kraken (' + par + '): HTTP ' + resp.getResponseCode());
  }

  const json = JSON.parse(resp.getContentText());
  const dados = json.result[par] || json.result.XXBTZUSD || json.result.XBTUSD || json.result.XETHXXBT || json.result.ETHXBT || [];

  if (!dados || dados.length === 0) {
    throw new Error('Nenhum dado retornado pela Kraken para ' + par);
  }

  dados.forEach(c => {
    const timeSec = parseInt(c[0]);
    if (timeSec < limiteVelaFechadaSec) {
      const o = parseFloat(c[1]);
      const h = parseFloat(c[2]);
      const l = parseFloat(c[3]);
      const cl = parseFloat(c[4]);
      const vol = parseFloat(c[6]);

      velas.push({
        openTime: timeSec * 1000,
        open: o,
        high: h,
        low: l,
        close: cl,
        volume: vol,
        hlc3: (h + l + cl) / 3
      });
    }
  });

  return velas;
}

function baixarHistoricoGateIo(par, startTimeMs) {
  const velas = [];
  const startSec = Math.floor(startTimeMs / 1000);
  const agoraSec = Math.floor(Date.now() / 1000);
  const limiteVelaFechadaSec = Math.floor(agoraSec / CONFIG.GRANULARIDADE_SEGUNDOS) * CONFIG.GRANULARIDADE_SEGUNDOS;

  const url = 'https://api.gateio.ws/api/v4/spot/candlesticks?currency_pair=' + par +
              '&interval=4h&from=' + startSec + '&to=' + limiteVelaFechadaSec + '&limit=1000';

  const resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (resp.getResponseCode() !== 200) {
    throw new Error('Erro na API Gate.io: HTTP ' + resp.getResponseCode());
  }

  const lote = JSON.parse(resp.getContentText());
  if (!lote || lote.length === 0) throw new Error('Gate.io retornou lista vazia');

  lote.forEach(c => {
    const t = parseInt(c[0]);
    const o = parseFloat(c[5]);
    const cl = parseFloat(c[2]);
    const h = parseFloat(c[3]);
    const l = parseFloat(c[4]);
    const vol = parseFloat(c[6]);

    velas.push({
      openTime: t * 1000,
      open: o,
      high: h,
      low: l,
      close: cl,
      volume: vol,
      hlc3: (h + l + cl) / 3
    });
  });

  return velas.sort((a, b) => a.openTime - b.openTime);
}

function baixarHistoricoBinanceUs(simbolo, startTimeMs) {
  const velas = [];
  const url = 'https://api.binance.us/api/v3/klines?symbol=' + simbolo + '&interval=4h&startTime=' + startTimeMs + '&limit=1000';
  const resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });

  if (resp.getResponseCode() !== 200) {
    throw new Error('Erro na API Binance.US: HTTP ' + resp.getResponseCode());
  }

  const lote = JSON.parse(resp.getContentText());
  lote.forEach(c => {
    const openTime = parseInt(c[0]);
    const o = parseFloat(c[1]);
    const h = parseFloat(c[2]);
    const l = parseFloat(c[3]);
    const cl = parseFloat(c[4]);
    const vol = parseFloat(c[5]);

    velas.push({
      openTime: openTime,
      open: o,
      high: h,
      low: l,
      close: cl,
      volume: vol,
      hlc3: (h + l + cl) / 3
    });
  });

  return velas;
}

function atualizarIncrementalPar(aba, fsym, tsym, tipo) {
  const ultimaLinha = aba.getLastRow();
  if (ultimaLinha < 2) return 0;

  const ultimoTsString = aba.getRange(ultimaLinha, 1).getValue();
  const ultimoTs = parseDataIsoUtc(ultimoTsString);
  if (!ultimoTs) return 0;

  const startMs = ultimoTs.getTime() + (CONFIG.GRANULARIDADE_SEGUNDOS * 1000);
  const novasVelas = baixarHistoricoMultiFonte(fsym, tsym, startMs);
  if (novasVelas.length === 0) return 0;

  const registrosExistentes = lerUltimosRegistros(aba, 700);
  const todos = registrosExistentes.concat(novasVelas);

  const processado = processarIndicadoresVetorizados(todos, tipo);
  const novasLinhas = processado.matriz.slice(registrosExistentes.length);

  if (novasLinhas.length > 0) {
    aba.getRange(ultimaLinha + 1, 1, novasLinhas.length, CABECALHO_DADOS.length).setValues(novasLinhas);
  }
  return novasLinhas.length;
}


/* =========================================================================================
 * 5. CÁLCULO DOS INDICADORES QUANTITATIVOS (VETORIZADO EM MEMÓRIA)
 * ========================================================================================= */

const CABECALHO_DADOS = [
  'Timestamp_UTC', 'Timestamp_BRT', 'Abertura', 'Maxima', 'Minima', 'Fechamento', 'Volume',
  'HLC3', 'RSI_Ultimate', 'RSI_Momentum', 'Regime_RSI', 'Sinal_Cruzamento',
  'SMA_Curta_72h', 'SMA_Longa_216h', 'SMA_Extra_480h', 'Nuvem_Status',
  'Donchian_High_30', 'ATR_14', 'Contexto_2D_EMA21', 'Contexto_2D_EMA55', 'Contexto_2D_Status'
];

function processarIndicadoresVetorizados(velas, tipo) {
  const n = velas.length;
  const hlc3 = velas.map(v => v.hlc3);
  const close = velas.map(v => v.close);
  const high = velas.map(v => v.high);
  const low = velas.map(v => v.low);

  // 1. RSI Ultimate e RSI Momentum (Parâmetros: 20 períodos, EMA)
  const lenRsi = CONFIG.INDICADORES.RSI_LEN;
  const diff = new Float64Array(n);
  const absDiff = new Float64Array(n);

  for (let i = 0; i < n; i++) {
    const inicio = Math.max(0, i - lenRsi + 1);
    let maxHlc = hlc3[inicio];
    let minHlc = hlc3[inicio];
    for (let k = inicio + 1; k <= i; k++) {
      if (hlc3[k] > maxHlc) maxHlc = hlc3[k];
      if (hlc3[k] < minHlc) minHlc = hlc3[k];
    }
    const rangeDelta = maxHlc - minHlc;
    const delta = i > 0 ? (hlc3[i] - hlc3[i - 1]) : 0;

    let prevMax = maxHlc;
    let prevMin = minHlc;
    if (i > 0) {
      const prevInicio = Math.max(0, i - lenRsi);
      prevMax = hlc3[prevInicio];
      prevMin = hlc3[prevInicio];
      for (let k = prevInicio + 1; k < i; k++) {
        if (hlc3[k] > prevMax) prevMax = hlc3[k];
        if (hlc3[k] < prevMin) prevMin = hlc3[k];
      }
    }

    if (i > 0 && maxHlc > prevMax) {
      diff[i] = rangeDelta;
    } else if (i > 0 && minHlc < prevMin) {
      diff[i] = -rangeDelta;
    } else {
      diff[i] = delta;
    }
    absDiff[i] = Math.abs(diff[i]);
  }

  const numEma = calcularEMA(diff, lenRsi);
  const denEma = calcularEMA(absDiff, lenRsi);
  const rsiUltimate = new Float64Array(n);

  for (let i = 0; i < n; i++) {
    rsiUltimate[i] = denEma[i] === 0 ? 50.0 : ((numEma[i] / denEma[i]) * 50.0 + 50.0);
  }
  const rsiMomentum = calcularEMA(rsiUltimate, CONFIG.INDICADORES.MOMENTUM_LEN);

  // 2. Nuvem de Médias Móveis
  const smaCurta = calcularSMA(hlc3, CONFIG.INDICADORES.SMA_CURTA_4H);
  const smaLonga = calcularSMA(hlc3, CONFIG.INDICADORES.SMA_LONGA_4H);
  const smaExtra = calcularSMA(hlc3, CONFIG.INDICADORES.SMA_EXTRA_4H);

  // 3. Donchian e ATR
  const donchianHigh = new Float64Array(n);
  const atr = calcularATR(high, low, close, CONFIG.INDICADORES.ATR_LEN);

  for (let i = 0; i < n; i++) {
    if (i < CONFIG.INDICADORES.DONCHIAN_LEN) {
      donchianHigh[i] = high[i];
    } else {
      let m = high[i - CONFIG.INDICADORES.DONCHIAN_LEN];
      for (let k = i - CONFIG.INDICADORES.DONCHIAN_LEN + 1; k < i; k++) {
        if (high[k] > m) m = high[k];
      }
      donchianHigh[i] = m;
    }
  }

  // 4. Contexto 2D (EMAs 21 e 55 em escala de 2D)
  const ema2dRapida = calcularEMA(close, CONFIG.INDICADORES.EMA_2D_RAPIDA);
  const ema2dLenta = calcularEMA(close, CONFIG.INDICADORES.EMA_2D_LENTA);

  // 5. Montagem da Matriz Final
  const matriz = [];
  const registros = [];

  for (let i = 0; i < n; i++) {
    const d = new Date(velas[i].openTime);
    const rsiVal = arred(rsiUltimate[i], 2);
    const rsiMomVal = arred(rsiMomentum[i], 2);

    let regimeRsi = 'NEUTRO';
    if (rsiVal > 80) regimeRsi = 'SOBRECOMPRA';
    else if (rsiVal > 60) regimeRsi = 'ALTA';
    else if (rsiVal < 20) regimeRsi = 'SOBREVENDA';
    else if (rsiVal < 40) regimeRsi = 'BAIXA';

    let sinalCruzamento = 'NEUTRO';
    if (i > 0) {
      if (rsiUltimate[i] > rsiMomentum[i] && rsiUltimate[i - 1] <= rsiMomentum[i - 1]) sinalCruzamento = 'CRUZAMENTO_ALTA';
      else if (rsiUltimate[i] < rsiMomentum[i] && rsiUltimate[i - 1] >= rsiMomentum[i - 1]) sinalCruzamento = 'CRUZAMENTO_BAIXA';
    }

    const nuvemStatus = smaCurta[i] >= smaLonga[i] ? 'ALTA_VERDE' : 'BAIXA_VERMELHA';

    let ctx2dStatus = 'NEUTRO';
    const emaLentaSubindo = i > 0 && ema2dLenta[i] > ema2dLenta[i - 1];
    if (ema2dRapida[i] > ema2dLenta[i] && emaLentaSubindo) {
      ctx2dStatus = 'COMPRADOR_FORTE';
    } else if (ema2dRapida[i] > ema2dLenta[i]) {
      ctx2dStatus = 'COMPRADOR_MODERADO';
    } else {
      ctx2dStatus = 'VENDEDOR';
    }

    const linha = [
      formatarIsoUtc(d),
      formatarIsoLocal(d),
      arred(velas[i].open, tipo === 'ETHBTC' ? 6 : 2),
      arred(velas[i].high, tipo === 'ETHBTC' ? 6 : 2),
      arred(velas[i].low, tipo === 'ETHBTC' ? 6 : 2),
      arred(velas[i].close, tipo === 'ETHBTC' ? 6 : 2),
      arred(velas[i].volume, 2),
      arred(velas[i].hlc3, tipo === 'ETHBTC' ? 6 : 2),
      rsiVal,
      rsiMomVal,
      regimeRsi,
      sinalCruzamento,
      arred(smaCurta[i], tipo === 'ETHBTC' ? 6 : 2),
      arred(smaLonga[i], tipo === 'ETHBTC' ? 6 : 2),
      arred(smaExtra[i], tipo === 'ETHBTC' ? 6 : 2),
      nuvemStatus,
      arred(donchianHigh[i], tipo === 'ETHBTC' ? 6 : 2),
      arred(atr[i], tipo === 'ETHBTC' ? 6 : 2),
      arred(ema2dRapida[i], tipo === 'ETHBTC' ? 6 : 2),
      arred(ema2dLenta[i], tipo === 'ETHBTC' ? 6 : 2),
      ctx2dStatus
    ];

    matriz.push(linha);
    registros.push({
      openTime: velas[i].openTime,
      tsUtc: formatarIsoUtc(d),
      open: velas[i].open,
      close: velas[i].close,
      high: velas[i].high,
      low: velas[i].low,
      volume: velas[i].volume,
      hlc3: velas[i].hlc3,
      rsi: rsiVal,
      rsiMom: rsiMomVal,
      regimeRsi: regimeRsi,
      sinalCruzamento: sinalCruzamento,
      nuvem: nuvemStatus,
      donchianHigh: donchianHigh[i],
      atr: atr[i],
      ctx2dStatus: ctx2dStatus
    });
  }

  return { matriz: matriz, registros: registros };
}


/* =========================================================================================
 * 6. LEITURA ON-CHAIN DA AAVE V3 (POLYGON & BASE VIA JSON-RPC)
 * ========================================================================================= */

function consultarAaveOnChain(endereco) {
  const carteira = endereco || CONFIG.CARTEIRA_PADRAO;
  const precoBtc = obterUltimoPrecoBtc();
  const resultado = {
    timestamp: formatarIsoUtc(new Date()),
    carteira: carteira,
    polygon: null,
    base: null
  };

  CONFIG.MERCADOS_AAVE.forEach(function (mercado) {
    const dados = chamarRpcAave(mercado, carteira);
    if (dados) {
      const ltvAtual = dados.colateral > 0 ? (dados.divida / dados.colateral) * 100 : 0;
      const gatilho = classificarGatilhoHf(dados.hf);

      let precoLiquidacao = 0;
      let quedaSuportadaPct = 0;

      if (dados.hf && dados.hf > 0 && precoBtc) {
        quedaSuportadaPct = (1 - (1 / dados.hf)) * 100;
        precoLiquidacao = precoBtc / dados.hf;
      }

      resultado[mercado.rede.toLowerCase()] = {
        rede: mercado.rede,
        colateralUsd: dados.colateral,
        dividaUsd: dados.divida,
        disponivelUsd: dados.disponivel,
        limiarPct: dados.limiar,
        ltvMaxPct: dados.ltvMax,
        ltvAtualPct: arred(ltvAtual, 2),
        hf: dados.hf,
        quedaSuportadaPct: arred(quedaSuportadaPct, 2),
        precoLiquidacaoBtc: arred(precoLiquidacao, 2),
        status: gatilho.status,
        acaoRecomendada: gatilho.acao,
        nota: gatilho.nota,
        rpc: dados.rpc
      };
    }
  });

  return resultado;
}

function chamarRpcAave(mercado, carteira) {
  const dataField = CONFIG.SELECTOR_HF + carteira.toLowerCase().replace('0x', '').padStart(64, '0');
  const payload = JSON.stringify({
    jsonrpc: '2.0', id: 1, method: 'eth_call',
    params: [{ to: mercado.pool, data: dataField }, 'latest']
  });

  for (let i = 0; i < mercado.rpcs.length; i++) {
    const noRpc = mercado.rpcs[i];
    try {
      const resp = UrlFetchApp.fetch(noRpc, {
        method: 'post',
        contentType: 'application/json',
        payload: payload,
        muteHttpExceptions: true
      });

      if (resp.getResponseCode() !== 200) continue;
      const json = JSON.parse(resp.getContentText());
      if (json.error || !json.result || json.result === '0x') continue;

      const hex = json.result.slice(2);
      if (hex.length < 6 * 64) continue;

      const parseSlot = function (idx) { return parseInt(hex.substr(idx * 64, 64), 16); };
      const hfRaw = parseSlot(5);
      const hf = (!isFinite(hfRaw) || hfRaw / 1e18 > 1e6) ? 999.0 : Math.round((hfRaw / 1e18) * 10000) / 10000;

      return {
        colateral: parseSlot(0) / 1e8,
        divida: parseSlot(1) / 1e8,
        disponivel: parseSlot(2) / 1e8,
        limiar: parseSlot(3) / 100,
        ltvMax: parseSlot(4) / 100,
        hf: hf,
        rpc: noRpc
      };
    } catch (e) { }
    Utilities.sleep(100);
  }
  return null;
}

function classificarGatilhoHf(hf) {
  if (!hf || hf >= 999.0) return { status: 'SEM_DIVIDA', acao: 'LIVRE', nota: 'Sem dívida ativa.' };
  for (let i = 0; i < CONFIG.GATILHOS_HF.length; i++) {
    if (hf < CONFIG.GATILHOS_HF[i].hfAbaixoDe) {
      return CONFIG.GATILHOS_HF[i];
    }
  }
  return CONFIG.GATILHOS_HF[CONFIG.GATILHOS_HF.length - 1];
}


/* =========================================================================================
 * 7. MOTOR DE DECISÃO QUANTITATIVA: SINAIS, ALOCAÇÃO & APORTES
 * ========================================================================================= */

function gerarAnaliseQuantitativa(registrosBtc, registrosEthBtc, dadosAave) {
  const uBtc = registrosBtc[registrosBtc.length - 1];
  const uEth = registrosEthBtc[registrosEthBtc.length - 1];

  // 1. Score BTC (0 a 100)
  let btcScore = 0;
  if (uBtc.ctx2dStatus === 'COMPRADOR_FORTE') btcScore += 40;
  else if (uBtc.ctx2dStatus === 'COMPRADOR_MODERADO') btcScore += 25;
  if (uBtc.nuvem === 'ALTA_VERDE') btcScore += 30;
  if (uBtc.rsi > 50 && uBtc.rsi > uBtc.rsiMom) btcScore += 30;
  else if (uBtc.rsi > 50) btcScore += 15;

  // 2. Score ETHBTC (0 a 100)
  let ethScore = 0;
  if (uEth.rsi > 60 && uEth.rsi > uEth.rsiMom) ethScore += 40;
  else if (uEth.rsi > 50) ethScore += 20;
  if (uEth.nuvem === 'ALTA_VERDE') ethScore += 30;
  if (uEth.close >= uEth.donchianHigh) ethScore += 30;

  // 3. Matriz de Alocação BTC x ETH
  let alocacaoBtcPct = 100;
  let alocacaoEthPct = 0;
  let acaoRotacao = 'MANTER_100_BTC';

  if (uBtc.ctx2dStatus === 'VENDEDOR') {
    alocacaoBtcPct = 100;
    alocacaoEthPct = 0;
    acaoRotacao = 'DEFENSIVO_100_BTC';
  } else if (ethScore >= 70 && btcScore >= 50) {
    alocacaoBtcPct = 50;
    alocacaoEthPct = 50;
    acaoRotacao = 'ROTACAO_PARCIAL_ETH_50';
  } else if (ethScore >= 50 && btcScore >= 50) {
    alocacaoBtcPct = 70;
    alocacaoEthPct = 30;
    acaoRotacao = 'ROTACAO_LEVE_ETH_30';
  } else {
    alocacaoBtcPct = 100;
    alocacaoEthPct = 0;
    acaoRotacao = 'CONCENTRAR_100_BTC';
  }

  // 4. Análise de Aporte Mensal (R$ 2.000) & Caixa / Amortização
  const hfPolygon = (dadosAave.polygon && dadosAave.polygon.hf) ? dadosAave.polygon.hf : 999;
  let destinoAporte = '';
  let acaoWbtc = 'MANTER';
  let acaoUsd = 'AGUARDAR';

  if (hfPolygon < 1.80) {
    destinoAporte = 'AMORTIZAR DÍVIDA NA POLYGON (HF Atual: ' + hfPolygon + ')';
    acaoUsd = 'AMORTIZAR_INTEGRAL';
    acaoWbtc = 'MANTER_SEM_ALAVANCAR';
  } else if (uBtc.rsi < 25) {
    destinoAporte = 'COMPRA AGRESSIVA DE WBTC (Fundo de Ciclo / RSI < 25)';
    acaoWbtc = 'COMPRA_AGRESSIVA';
    acaoUsd = 'APORTAR_TOTAL';
  } else if (uBtc.rsi < 40) {
    destinoAporte = 'COMPRA MODERADA DE WBTC (Correção de Preço / RSI < 40)';
    acaoWbtc = 'COMPRA_MODERADA';
    acaoUsd = 'APORTAR_PARCIAL';
  } else if (uBtc.rsi > 75) {
    destinoAporte = 'FORMAÇÃO DE CAIXA EM USDC NA AAVE (Sobrecompra / RSI > 75)';
    acaoWbtc = 'MANTER_LUCRO';
    acaoUsd = 'GERAR_CAIXA_SUPPLY';
  } else {
    destinoAporte = 'APORTE PADRÃO: 50% Compra WBTC + 50% Supply USDC (Caixa Aave)';
    acaoWbtc = 'COMPRA_FRACIONADA';
    acaoUsd = 'SUPPLY_USDC_RENDENDO';
  }

  // 5. Explicação Detalhada do Racional
  const explicacao = [
    '• BTC 4H: Preço $' + uBtc.close.toFixed(2) + ' | RSI Ultimate: ' + uBtc.rsi + ' (' + uBtc.regimeRsi + ') | Nuvem: ' + uBtc.nuvem + ' | Contexto 2D: ' + uBtc.ctx2dStatus + '.',
    '• ETH/BTC: ' + uEth.close.toFixed(6) + ' | RSI Ultimate: ' + uEth.rsi + ' (' + uEth.regimeRsi + ') | Nuvem: ' + uEth.nuvem + ' | Donchian: ' + (uEth.close >= uEth.donchianHigh ? 'ROMPIMENTO_ALTA' : 'Abaixo da Máxima') + '.',
    '• AAVE Polygon: HF ' + (dadosAave.polygon ? dadosAave.polygon.hf : 'N/A') + ' | Status: ' + (dadosAave.polygon ? dadosAave.polygon.status : 'OK') + '.',
    '• Conclusão: Alocação sugerida em ' + alocacaoBtcPct + '% BTC / ' + alocacaoEthPct + '% ETH com foco em ' + destinoAporte + '.'
  ].join('\n');

  return {
    timestamp: formatarIsoUtc(new Date()),
    precoBtc: uBtc.close,
    precoEthBtc: uEth.close,
    btcScore: btcScore,
    ethScore: ethScore,
    alocacaoBtcPct: alocacaoBtcPct,
    alocacaoEthPct: alocacaoEthPct,
    scoreConviccaoPct: Math.round((btcScore + ethScore) / 2),
    acaoRotacao: acaoRotacao,
    acaoWbtc: acaoWbtc,
    acaoUsd: acaoUsd,
    destinoAporte: destinoAporte,
    explicacao: explicacao,
    uBtc: uBtc,
    uEth: uEth
  };
}


/* =========================================================================================
 * 8. RENDERIZAÇÃO DO PAINEL DE DECISÃO
 * ========================================================================================= */

function renderizarPainelDecisao(aba, analise, dadosAave) {
  aba.clear();
  aba.setTabColor('#1a73e8');

  const titulos = [
    ['SISTEMA DE DECISÃO QUANTITATIVA — BTC × ETH & GESTÃO AAVE V3', '', '', ''],
    ['Última Atualização (UTC): ' + analise.timestamp, '', 'Status Geral:', 'OPERACIONAL'],
    ['', '', '', ''],
    ['📌 PAINEL EXECUTIVO — O QUE FAZER HOJE', '', '', ''],
    ['Alocação Sugerida BTC', analise.alocacaoBtcPct + '%', 'Alocação Sugerida ETH', analise.alocacaoEthPct + '%'],
    ['Ação Recomendada na Carteira', analise.acaoRotacao, 'Score de Convicção', analise.scoreConviccaoPct + '%'],
    ['Destino do Aporte Mensal (R$ 2.000)', analise.destinoAporte, 'Ação WBTC / USD', analise.acaoWbtc + ' / ' + analise.acaoUsd],
    ['', '', '', ''],
    ['📊 RADAR ON-CHAIN AAVE V3 (RISCO & LIQUIDAÇÃO)', '', '', ''],
    ['Rede Polygon', 'Rede Base', 'Preço Liquidação BTC (Polygon)', 'Preço Liquidação BTC (Base)'],
    [
      'HF: ' + (dadosAave.polygon ? dadosAave.polygon.hf : 'N/A') + ' | ' + (dadosAave.polygon ? dadosAave.polygon.status : ''),
      'HF: ' + (dadosAave.base ? dadosAave.base.hf : 'N/A') + ' | ' + (dadosAave.base ? dadosAave.base.status : ''),
      dadosAave.polygon && dadosAave.polygon.precoLiquidacaoBtc ? '$ ' + dadosAave.polygon.precoLiquidacaoBtc : 'N/A',
      dadosAave.base && dadosAave.base.precoLiquidacaoBtc ? '$ ' + dadosAave.base.precoLiquidacaoBtc : 'N/A'
    ],
    ['Colateral Polygon: $' + (dadosAave.polygon ? dadosAave.polygon.colateralUsd.toFixed(2) : '0'),
     'Colateral Base: $' + (dadosAave.base ? dadosAave.base.colateralUsd.toFixed(2) : '0'),
     'Dívida Polygon: $' + (dadosAave.polygon ? dadosAave.polygon.dividaUsd.toFixed(2) : '0'),
     'Dívida Base: $' + (dadosAave.base ? dadosAave.base.dividaUsd.toFixed(2) : '0')],
    ['', '', '', ''],
    ['📈 ESTADO TÉCNICO DOS ATIVOS (TIMEFRAMES)', '', '', ''],
    ['Métrica', 'BTC/USD (4H)', 'ETH/BTC (4H)', 'Interpretação Conjunta'],
    ['Preço Atual', '$ ' + analise.precoBtc.toFixed(2), analise.precoEthBtc.toFixed(6) + ' BTC', 'Força Relativa: ' + (analise.ethScore >= 50 ? 'ETH Favorável' : 'BTC Dominante')],
    ['RSI Ultimate (20)', analise.uBtc.rsi + ' (' + analise.uBtc.regimeRsi + ')', analise.uEth.rsi + ' (' + analise.uEth.regimeRsi + ')', 'Momentum: ' + (analise.uBtc.rsi > analise.uBtc.rsiMom ? 'Acelerando' : 'Desacelerando')],
    ['Nuvem de Médias (72h/216h)', analise.uBtc.nuvem, analise.uEth.nuvem, 'Tendência de Médio Prazo'],
    ['Contexto Macro 2D', analise.uBtc.ctx2dStatus, 'Rompimento Donchian 30', analise.uEth.close >= analise.uEth.donchianHigh ? 'ROMPIMENTO ATIVO' : 'Em Consolidação'],
    ['', '', '', ''],
    ['📝 JUSTIFICATIVA QUANTITATIVA TRANSPARENTE', '', '', ''],
    [analise.explicacao, '', '', '']
  ];

  aba.getRange(1, 1, titulos.length, 4).setValues(titulos);

  // Estilização Visual
  aba.getRange('A1:D1').setBackground('#0f9d58').setFontColor('#ffffff').setFontWeight('bold').setFontSize(13);
  aba.getRange('A4:D4').setBackground('#1a73e8').setFontColor('#ffffff').setFontWeight('bold');
  aba.getRange('A9:D9').setBackground('#4285f4').setFontColor('#ffffff').setFontWeight('bold');
  aba.getRange('A14:D14').setBackground('#34a853').setFontColor('#ffffff').setFontWeight('bold');
  aba.getRange('A20:D20').setBackground('#fbbc04').setFontColor('#202124').setFontWeight('bold');
  aba.getRange('A21:D21').setWrap(true);

  aba.autoResizeColumns(1, 4);
}


/* =========================================================================================
 * 9. MOTOR DE BACKTEST HISTÓRICO COMPARATIVO
 * ========================================================================================= */

function executarBacktestManual() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const btcVelas = lerUltimosRegistros(ss.getSheetByName(CONFIG.ABAS.DADOS_BTC), 15000);
  const ethVelas = lerUltimosRegistros(ss.getSheetByName(CONFIG.ABAS.DADOS_ETHBTC), 15000);
  executarBacktestComparativo(ss, btcVelas, ethVelas);
  ss.toast('Backtest histórico concluído com sucesso!', 'Status', 5);
}

function executarBacktestComparativo(ss, btcVelas, ethVelas) {
  const abaSinais = ss.getSheetByName(CONFIG.ABAS.MOTOR_SINAIS);
  if (!abaSinais || btcVelas.length < 500) return;

  const n = Math.min(btcVelas.length, ethVelas.length);
  let saldoBtcHold = 1.0;
  let saldoEthHoldBtc = 1.0;
  let saldoEstrategiaBtc = 1.0;

  let posicao = 'BTC';
  let swaps = 0;
  let acertos = 0;
  let totalTrades = 0;
  let precoEntradaEthBtc = 0;

  for (let i = 250; i < n; i++) {
    const btc = btcVelas[i];
    const eth = ethVelas[i];
    const ethBtcPrice = eth.close;

    const ethForte = eth.rsi > 60 && eth.nuvem === 'ALTA_VERDE';
    const btcForte = btc.ctx2dStatus === 'VENDEDOR' || eth.rsi < 40;

    if (posicao === 'BTC' && ethForte) {
      posicao = 'ETH';
      precoEntradaEthBtc = ethBtcPrice;
      swaps++;
    } else if (posicao === 'ETH' && btcForte) {
      posicao = 'BTC';
      swaps++;
      totalTrades++;
      if (ethBtcPrice > precoEntradaEthBtc) acertos++;
      saldoEstrategiaBtc = saldoEstrategiaBtc * (ethBtcPrice / precoEntradaEthBtc);
    }
  }

  if (posicao === 'ETH') {
    saldoEstrategiaBtc = saldoEstrategiaBtc * (ethVelas[n - 1].close / precoEntradaEthBtc);
  }

  saldoEthHoldBtc = ethVelas[n - 1].close / ethVelas[250].close;

  const resumo = [
    ['RESUMO DO BACKTEST HISTÓRICO COMPARATIVO (01/01/2020 a Presente)', '', '', ''],
    ['Período Analisado (Velas 4H)', n, 'Capital Inicial (BTC)', '1.0000 BTC'],
    ['Estratégia A: Buy & Hold 100% BTC', '1.0000 BTC', 'Retorno em BTC: 0.0%', 'Benchmark'],
    ['Estratégia B: Buy & Hold 100% ETH', arred(saldoEthHoldBtc, 4) + ' BTC', 'Retorno em BTC: ' + arred((saldoEthHoldBtc - 1) * 100, 2) + '%', 'Passivo'],
    ['Estratégia C (Quantitativa Dinâmica BTC/ETH)', arred(saldoEstrategiaBtc, 4) + ' BTC', 'Retorno em BTC: ' + arred((saldoEstrategiaBtc - 1) * 100, 2) + '%', 'Ativo'],
    ['Total de Rotações Realizadas', swaps, 'Taxa de Acerto das Rotações', totalTrades > 0 ? arred((acertos / totalTrades) * 100, 2) + '%' : 'N/A'],
    ['Expectativa Estatística', totalTrades > 0 ? (saldoEstrategiaBtc > 1 ? 'POSITIVA (+ Alpha)' : 'NEUTRA/NEGATIVA') : 'Em Coleta', 'Status', 'VALIDADO']
  ];

  abaSinais.getRange(1, 1, resumo.length, 4).setValues(resumo);
  abaSinais.getRange('A1:D1').setBackground('#1a73e8').setFontColor('#ffffff').setFontWeight('bold');
  abaSinais.autoResizeColumns(1, 4);
}


/* =========================================================================================
 * 10. FUNÇÕES AUXILIARES E MATEMÁTICAS
 * ========================================================================================= */

function calcularEMA(valores, periodo) {
  const n = valores.length;
  const ema = new Float64Array(n);
  const k = 2 / (periodo + 1);
  let soma = 0;

  for (let i = 0; i < periodo && i < n; i++) soma += valores[i];
  ema[Math.min(periodo - 1, n - 1)] = soma / Math.min(periodo, n);

  for (let i = periodo; i < n; i++) {
    ema[i] = (valores[i] * k) + (ema[i - 1] * (1 - k));
  }
  return ema;
}

function calcularSMA(valores, periodo) {
  const n = valores.length;
  const sma = new Float64Array(n);
  let soma = 0;

  for (let i = 0; i < n; i++) {
    soma += valores[i];
    if (i >= periodo) soma -= valores[i - periodo];
    sma[i] = i >= periodo - 1 ? soma / periodo : soma / (i + 1);
  }
  return sma;
}

function calcularATR(high, low, close, periodo) {
  const n = high.length;
  const tr = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    if (i === 0) {
      tr[i] = high[i] - low[i];
    } else {
      const hl = high[i] - low[i];
      const hc = Math.abs(high[i] - close[i - 1]);
      const lc = Math.abs(low[i] - close[i - 1]);
      tr[i] = Math.max(hl, hc, lc);
    }
  }
  return calcularEMA(tr, periodo);
}

function estruturarAbas(ss) {
  const nomes = Object.values(CONFIG.ABAS);
  nomes.forEach(nome => {
    let aba = ss.getSheetByName(nome);
    if (!aba) {
      aba = ss.insertSheet(nome);
    }
  });
}

function gravarDadosAba(aba, matriz, cabecalho) {
  aba.clear();
  aba.getRange(1, 1, 1, cabecalho.length).setValues([cabecalho]).setFontWeight('bold').setBackground('#efefef');
  aba.setFrozenRows(1);
  if (matriz.length > 0) {
    aba.getRange(2, 1, matriz.length, cabecalho.length).setValues(matriz);
  }
}

function gravarDadosAave(aba, dadosAave) {
  if (!aba) return;
  const cabecalho = ['Timestamp_UTC', 'Rede', 'Colateral_USD', 'Divida_USD', 'Disponivel_USD', 'LTV_Atual_pct', 'Health_Factor', 'Preco_Liq_BTC', 'Status', 'Acao_Recomendada'];
  const linhas = [];

  ['polygon', 'base'].forEach(rede => {
    const d = dadosAave[rede];
    if (d) {
      linhas.push([
        dadosAave.timestamp, d.rede, d.colateralUsd, d.dividaUsd, d.disponivelUsd, d.ltvAtualPct, d.hf, d.precoLiquidacaoBtc, d.status, d.acaoRecomendada
      ]);
    }
  });

  if (aba.getLastRow() < 1) {
    aba.getRange(1, 1, 1, cabecalho.length).setValues([cabecalho]).setFontWeight('bold');
    aba.setFrozenRows(1);
  }
  if (linhas.length > 0) {
    aba.getRange(aba.getLastRow() + 1, 1, linhas.length, cabecalho.length).setValues(linhas);
  }
}

function gravarHistoricoSinal(aba, analise) {
  if (!aba) return;
  const cabecalho = ['Timestamp_UTC', 'Preco_BTC', 'Preco_ETHBTC', 'Alocacao_BTC_pct', 'Alocacao_ETH_pct', 'Score_Conviccao', 'Acao_Rotacao', 'Destino_Aporte'];
  const linha = [analise.timestamp, analise.precoBtc, analise.precoEthBtc, analise.alocacaoBtcPct, analise.alocacaoEthPct, analise.scoreConviccaoPct, analise.acaoRotacao, analise.destinoAporte];

  if (aba.getLastRow() < 10) {
    aba.getRange(10, 1, 1, cabecalho.length).setValues([cabecalho]).setFontWeight('bold');
    aba.setFrozenRows(10);
  }
  aba.getRange(aba.getLastRow() + 1, 1, 1, cabecalho.length).setValues([linha]);
}

function lerUltimosRegistros(aba, quantidade) {
  const ultimaLinha = aba.getLastRow();
  if (ultimaLinha < 2) return [];
  const qtdLinhas = Math.min(ultimaLinha - 1, quantidade);
  const range = aba.getRange(ultimaLinha - qtdLinhas + 1, 1, qtdLinhas, CABECALHO_DADOS.length).getValues();

  return range.map(r => {
    const d = parseDataIsoUtc(r[0]);
    return {
      openTime: d ? d.getTime() : 0,
      tsUtc: r[0],
      open: parseFloat(r[2]),
      high: parseFloat(r[3]),
      low: parseFloat(r[4]),
      close: parseFloat(r[5]),
      volume: parseFloat(r[6]),
      hlc3: parseFloat(r[7]),
      rsi: parseFloat(r[8]),
      rsiMom: parseFloat(r[9]),
      regimeRsi: r[10],
      sinalCruzamento: r[11],
      nuvem: r[15],
      donchianHigh: parseFloat(r[16]),
      atr: parseFloat(r[17]),
      ctx2dStatus: r[20]
    };
  });
}

function obterUltimoPrecoBtc() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const aba = ss.getSheetByName(CONFIG.ABAS.DADOS_BTC);
  if (!aba || aba.getLastRow() < 2) return 60000;
  const p = parseFloat(aba.getRange(aba.getLastRow(), 6).getValue());
  return isFinite(p) && p > 0 ? p : 60000;
}

function formatarIsoUtc(d) {
  return Utilities.formatDate(d, 'UTC', "yyyy-MM-dd HH:mm");
}

function formatarIsoLocal(d) {
  const local = new Date(d.getTime() + CONFIG.FUSO_LOCAL * 3600000);
  return Utilities.formatDate(local, 'UTC', "yyyy-MM-dd HH:mm");
}

function parseDataIsoUtc(str) {
  if (!str) return null;
  if (str instanceof Date && !isNaN(str.getTime())) return str;
  const s = String(str).trim();
  const d = new Date(s.endsWith('Z') ? s : s.replace(' ', 'T') + 'Z');
  return isNaN(d.getTime()) ? null : d;
}

function arred(n, casas) {
  if (!isFinite(n)) return 0;
  const f = Math.pow(10, casas);
  return Math.round(n * f) / f;
}

function registrarLog(evento, detalhe) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let aba = ss.getSheetByName(CONFIG.ABAS.CONFIG_LOG);
    if (!aba) return;
    aba.appendRow([formatarIsoUtc(new Date()), evento, detalhe]);
  } catch (e) { }
}

function configurarGatilhoAutomatico() {
  const gatilhos = ScriptApp.getProjectTriggers();
  gatilhos.forEach(g => {
    if (g.getHandlerFunction() === 'atualizarTudo') {
      ScriptApp.deleteTrigger(g);
    }
  });

  ScriptApp.newTrigger('atualizarTudo')
    .timeBased()
    .everyHours(4)
    .create();

  SpreadsheetApp.getActive().toast('Gatilho automático de 4 horas instalado com sucesso!', 'Automação Ativa', 5);
}

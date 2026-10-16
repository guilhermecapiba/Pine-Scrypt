/**
 * =============================================================================
 * MVP PROJETO CRIPTO (PROJETO 02) — MOTOR QUANTITATIVO UNIFICADO v2.5
 *
 * v2.5 (16/10/2026): painel padronizado nas 10 melhores estratégias para BTC/USD (Machines #1 e #2).
 *       - SAEM da lista ESTRATEGIAS todos os gatilhos G-01 a G-11. Pelo backtest, as 10 sozinhas têm Calmar de 1,80
 *                 (2015+), 1,42 (2018+) e 2,09 (3 anos) contra 1,31, 1,21 e 1,87 do painel com os gatilhos. G-04
 *                 (cruzamento SMA140 x EMA147) e G-08 (inflexão MACD) eram os piores (CAGR de 6% e 17%).
 *       - Os ALERTAS de cruzamento de médias, BMSB, inflexão de MACD, Bollinger e Z-score continuam ativos em
 *                 detectarEventos_ (leem INDICADORES_TECNICOS, não a lista de estratégias). Só deixam de existir
 *                 os votos dos gatilhos no consenso e as linhas G-xx na ESTRATEGIAS_1D.
 *       - Nenhuma estratégia nova entra: a melhor candidata da pesquisa de vídeos não supera nenhuma das 10.
 *       - As linhas dos gatilhos ficam comentadas dentro de ESTRATEGIAS, para reativação por copiar e colar.
 *       Nada mais foi alterado: motor, CONFIG, zonas, termômetro, alertas, e-mails e dashboard idênticos à v2.4.
 *
 * v2.4 (06/10/2026): ajustes de painel e de linguagem, sem alterar nenhum cálculo:
 *       - "Termômetro Quantitativo de Risco" virou "Esticamento do Mercado (0 a 100)", com a faixa
 *         em português claro, a postura de referência e uma linha "Como interpretar" no painel;
 *         o mesmo texto vai para os e-mails (alerta e relatório semanal).
 *       - Data do último alerta formatada (antes aparecia o objeto Date cru).
 *       - Título do mapa de zonas passou a dizer quantas zonas estão validadas por backtest.
 *       - Zonas além de ZONA_DIST_MAX_PCT (padrão 25%) do preço não são mais exibidas.
 *       - Colunas do painel com quebra de linha; linha em branco antes de "Estrutura de Tendência";
 *         destaque de cor localizado pelo rótulo (não mais por número de linha fixo).
 *
 * v2.3 (06/10/2026): cinco adequações da auditoria da v2.2 (itens 2, 3, 4, 6 e 9):
 *       (2) Consenso sem salto de metodologia: mistura contínua entre voto simples e
 *           ponderado, conforme a soma dos pesos (CONSENSO_PESO_REF); o modo aparece no painel.
 *       (3) Termômetro por FAMÍLIAS (preço, momentum, volatilidade, sentimento, derivativos):
 *           as 3 medidas de esticamento de preço deixam de pesar 3x; mostra cobertura.
 *       (4) Zonas: toques independentes (sem contagem sobreposta no horizonte) e teste de
 *           significância contra o acaso (z mínimo, padrão 2,69 = Bonferroni p/ 14 testes).
 *       (6) Carteira Aave fora do código: fica em Propriedades do Script (menu A). Segue
 *           desligado por padrão e continua só na aba ONCHAIN_DERIVATIVOS, nunca em e-mail.
 *       (9) Todo e-mail traz a convenção de execução: sinal no fechamento, entrada de
 *           referência na ABERTURA do próximo candle diário (D+1).
 *
 * v2.2 (06/10/2026): biblioteca enxugada para o que está ativo nas Machines #1 (v3.5b)
 *       e #2 (v4.0) + os 11 gatilhos do prompt. Foram REMOVIDAS (código e linhas):
 *       Ultimate RSI 26/6, Supertrend (10, 3.5)+EMA200, Donchian55+Bollinger,
 *       Ichimoku Kumo 9/32/60, OBV Trend 30/50/200, Supertrend (2, 4)+SMA90 e as
 *       três complementares da v2.1 (Nuvem 13/49, Nuvem Direcional, Keltner 12/2.5),
 *       mais os indicadores auxiliares que só elas usavam. Resultado: 10 estratégias
 *       das Machines + 11 gatilhos = 21 componentes, todos ativos no Consenso.
 *       As 10 foram conferidas contra o código final das Machines: sinais de entrada
 *       e saída idênticos em todos os 4.096 candles do histórico.
 *
 * v2.1 (06/10/2026): substituição de 3 estratégias da biblioteca, espelhando as
 *       Machines #1 (v3.5b) e #2 (v4.0). Nada mais foi alterado (motor, CONFIG,
 *       zonas, termômetro, consenso, alertas, e-mails e dashboard idênticos à v2.0).
 *       M1-01  Nuvem 13/49            -> ROC Momentum 30/15% + SMA200      (rocMomentum)
 *       M2-02  Nuvem Direcional       -> EMA10 Cross + SMA76               (emaCrossSma76)
 *       M2-03  Keltner (12, 2.5)+SMA90 -> Bollinger Squeeze (20, 2.25)+SMA200 (bollingerSqueeze)
 *       (Na v2.2 as três antigas foram removidas da biblioteca.)
 *
 * v2.0: (1) Aave/HF removido de toda comunicação e do DASHBOARD (monitor opcional
 *       só no log interno); (2) Termômetro por percentil condicionado ao regime;
 *       (3)+(6) TODAS as estratégias das bibliotecas Machine #1 e #2 + gatilhos do
 *       prompt como estratégias backtestadas — nenhuma outra; (4) correção do spot;
 *       (5) Consenso ponderado por Sharpe 36M; (7) Zonas de liquidez validadas por
 *       backtest (liquidações de alavancados, volume profile, pivôs, RSI, etc.).
 * =============================================================================
 * Planilha: https://docs.google.com/spreadsheets/d/1Vw8I-uePFdjEYYUbfKuk2A9WKb6UzyubUp92Njb8_HM
 *
 * Unifica: BTC Backtest Machine #1 (v3.4), BTC Backtest Machine #2,
 *          Sistema de Decisão Quantitativa (derivativos + Aave V3) e Gestão de Trades.
 *
 * INSTALAÇÃO
 *  1. Planilha -> Extensões -> Apps Script -> apagar tudo -> colar este arquivo.
 *  2. (Opcional) Configurações do projeto -> marcar "Mostrar appsscript.json" e
 *     colar o manifesto fornecido (fuso America/Sao_Paulo).
 *  3. Executar  setupPlanilha()            -> cria/formatar as 7 abas + CONFIG.
 *  4. Executar  cicloCompleto()            -> baixa histórico 2015+, calcula tudo.
 *  5. Executar  instalarGatilhosAutomaticos() -> segunda 08:00 BRT + a cada 1h.
 *  6. (Teste)   testarEmailInterno()       -> envia prévia SOMENTE ao 1º e-mail.
 *
 * REGRAS INVIOLÁVEIS
 *  - Execução sem look-ahead: sinais calculados no FECHAMENTO da vela D,
 *    execução simulada na ABERTURA de D+1; vela do dia corrente é descartada.
 *  - Comunicação ao cliente: NUNCA nomes/quantidade de estratégias, nem o
 *    indicador que disparou o alerta. Somente números + termos institucionais.
 * =============================================================================
 */

/* =============================================================================
 * 1. CONFIGURAÇÃO (defaults — sobrescritos pela aba CONFIG_SISTEMA)
 * ===========================================================================*/
const P2 = {
  PLANILHA_ID: '1Vw8I-uePFdjEYYUbfKuk2A9WKb6UzyubUp92Njb8_HM',
  TZ_BRT: 'America/Sao_Paulo',
  ABAS: {
    dash: 'DASHBOARD',
    base: 'BASE_DADOS_BTC_1D',
    ind: 'INDICADORES_TECNICOS',
    estr: 'ESTRATEGIAS_1D',
    onchain: 'ONCHAIN_DERIVATIVOS',
    log: 'LOG_DISPAROS',
    cfg: 'CONFIG_SISTEMA',
  },
  CAPITAL_BASE: 10000,
  FEE_PCT: 0.075,
  SLIPPAGE_PCT: 0.050,
  HIST_INICIO_MS: Date.UTC(2015, 0, 1),
  MIN_CANDLES: 200,
  MAX_LINHAS_ONCHAIN: 5000,
  SELECTOR_HF: '0xbf92857c',
  MERCADOS_AAVE: [
    { rede: 'Polygon', pool: '0x794a61358D6845594F94dc1DB02A252b5b4814aD', ativo: 'WBTC',
      rpcs: ['https://polygon-bor-rpc.publicnode.com', 'https://polygon.drpc.org', 'https://rpc.ankr.com/polygon', 'https://polygon-rpc.com'] },
    { rede: 'Base', pool: '0xA238Dd80C259a72e81d7e4664a9801593F98d1c5', ativo: 'cbBTC',
      rpcs: ['https://base-rpc.publicnode.com', 'https://base.drpc.org', 'https://mainnet.base.org', 'https://rpc.ankr.com/base'] },
  ],
};

/** Parâmetros editáveis (chave, valor padrão, descrição). Gravados em CONFIG_SISTEMA. */
const CFG_PADRAO = [
  ['EMAILS_CLIENTES', 'guilhermecapiba@gmail.com, capibatrader@gmail.com', 'Destinatários (separados por vírgula)'],
  ['ALERTAS_ATIVOS', 'SIM', 'SIM/NAO — liga/desliga motor intraday de e-mails'],
  ['RELATORIO_SEMANAL_ATIVO', 'SIM', 'SIM/NAO — liga/desliga relatório de segunda 08:00 BRT'],
  ['JANELA_DEDUP_HORAS', 24, 'Janela anti-reenvio do mesmo Hash_Evento'],
  ['ZSCORE_LIMIAR', 2.0, '|Z-score| do retorno diário para spike de volatilidade'],
  ['ZSCORE_JANELAS', '9,21,30,90', 'Janelas (dias) avaliadas para o Z-score'],
  ['BB_DESVIOS_ALERTA', 2.5, 'Desvios das Bandas de Bollinger para alerta de fechamento externo'],
  ['FUNDING_ALTO', 0.0005, 'Funding 8h >= (fração) => risco de long squeeze (0,05%)'],
  ['FUNDING_BAIXO', -0.0002, 'Funding 8h <= (fração) => pressão vendida (-0,02%)'],
  ['FG_MEDO_EXTREMO', 20, 'Fear & Greed <= => medo extremo'],
  ['FG_GANANCIA_EXTREMA', 80, 'Fear & Greed >= => ganância extrema'],
  ['OI_VARIACAO_24H_PCT', 15, 'Variação absoluta de Open Interest em 24h (%)'],
  ['MACD_DIVERGENCIA_MIN_BARRAS', 20, 'Barras mínimas do regime anterior para inflexão MACD relevante'],
  ['ALERTA_INTRADAY_VELA_ABERTA', 'SIM', 'SIM/NAO — avalia Z-score da vela em formação (spot vs fechamento anterior)'],
  ['AAVE_MONITORAR', 'NAO', 'SIM/NAO — grava HF da carteira pessoal SOMENTE na aba ONCHAIN_DERIVATIVOS (nunca em e-mail/dashboard)'],
  ['ZONA_HORIZONTE_DIAS', 20, 'Backtest de zonas: horizonte (dias) para medir a reação após o toque'],
  ['ZONA_JANELA_TOQUE_DIAS', 10, 'Backtest de zonas: dias máximos para o preço tocar a zona após a medição'],
  ['ZONA_MIN_AMOSTRAS', 20, 'Backtest de zonas: toques mínimos para o critério ser considerado validado'],
  ['ZONA_MIN_ACERTO_COMPRA', 55, 'Backtest de zonas: % mínimo de reações positivas para validar zona de COMPRA'],
  ['ZONA_MIN_ACERTO_VENDA', 50, 'Backtest de zonas: % mínimo de reações negativas para validar zona de VENDA'],
  ['CONSENSO_PESO_REF', 5, 'Soma de pesos (Sharpe 3 anos, cada um entre 0 e 3) a partir da qual o Consenso é 100% ponderado; abaixo disso mistura com o voto simples de forma contínua'],
  ['ZONA_DIST_MAX_PCT', 25, 'Painel: zonas de liquidez além desta distância (%) do preço atual não são exibidas'],
  ['ZONA_Z_MIN', 2.69, 'Backtest de zonas: z mínimo do acerto contra o acaso (2,69 ≈ 5% com correção de Bonferroni para 14 testes; 2,0 = mais permissivo)'],
  ['CONSENSO_JANELA_SHARPE_DIAS', 1095, 'Janela (dias) do Sharpe que pondera cada componente do consenso'],
];

let _CFG_CACHE_ = null;
function cfg_(chave) {
  if (!_CFG_CACHE_) {
    _CFG_CACHE_ = {};
    CFG_PADRAO.forEach(function (r) { _CFG_CACHE_[r[0]] = r[1]; });
    try {
      const sh = ss_().getSheetByName(P2.ABAS.cfg);
      if (sh && sh.getLastRow() > 1) {
        sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues().forEach(function (r) {
          if (r[0] !== '' && r[1] !== '') _CFG_CACHE_[String(r[0]).trim()] = r[1];
        });
      }
    } catch (e) {}
  }
  return _CFG_CACHE_[chave];
}
function cfgNum_(k) { return parseFloat(String(cfg_(k)).replace(',', '.')); }
function cfgSim_(k) { return String(cfg_(k)).trim().toUpperCase() === 'SIM'; }
function emails_() {
  return String(cfg_('EMAILS_CLIENTES')).split(/[,;\s]+/).map(function (s) { return s.trim(); }).filter(function (s) { return /@/.test(s); });
}

let _SS_ = null;
function ss_() {
  if (_SS_) return _SS_;
  try {
    const a = SpreadsheetApp.getActiveSpreadsheet();
    if (a && a.getId() === P2.PLANILHA_ID) return (_SS_ = a);
  } catch (e) {}
  return (_SS_ = SpreadsheetApp.openById(P2.PLANILHA_ID));
}

/* =============================================================================
 * 2. BIBLIOTECA DE ESTRATÉGIAS (idênticas às Machines #1 e #2)
 *    ativa = entra no Consenso Algorítmico (altere aqui). Os IDs M1-xx/M2-xx seguem a numeração
 *    original das Machines (lacunas = estratégias removidas nas v2.2 e v2.5; não renumerar, o LOG_DISPAROS os referencia).
 * ===========================================================================*/
const ESTRATEGIAS = [
  // ---- Biblioteca Machine #1 ----
  { id: 'M1-01', grupo: 'Machine #1', key: 'rocMomentum', nome: 'ROC Momentum 30/15% + SMA200', fn: sinalRocMomentum, ativa: true },
  { id: 'M1-02', grupo: 'Machine #1', key: 'macd205012', nome: 'MACD 20/50/12', fn: sinalMacd205012, ativa: true },
  { id: 'M1-04', grupo: 'Machine #1', key: 'adxTrendBreakout', nome: 'ADX(7) Trend Breakout + SMA50', fn: sinalAdxTrendBreakout, ativa: true },
  { id: 'M1-05', grupo: 'Machine #1', key: 'sma200ema1030', nome: 'SMA200 + EMA10xEMA30', fn: sinalSma200Ema1030, ativa: true },
  { id: 'M1-06', grupo: 'Machine #1', key: 'confluenciaSmcIct', nome: 'Confluência SMC + ICT + Trendline', fn: sinalConfluencia, ativa: true },
  { id: 'M1-11', grupo: 'Machine #1/#2', key: 'hibridoSthRp', nome: 'Híbrido STH-RP (SMA155) & Confluência', fn: sinalHibridoSthRp, ativa: true },
  // ---- Biblioteca Machine #2 (exclusivas) ----
  { id: 'M2-02', grupo: 'Machine #2', key: 'emaCrossSma76', nome: 'EMA10 Cross + SMA76', fn: sinalEmaCrossSma76, ativa: true },
  { id: 'M2-03', grupo: 'Machine #2', key: 'bollingerSqueeze', nome: 'Bollinger Squeeze (20, 2.25) + SMA200', fn: sinalBollingerSqueeze, ativa: true },
  { id: 'M2-04', grupo: 'Machine #2', key: 'nuvemEma655Sma100', nome: 'Nuvem EMA 6/55 + SMA100', fn: sinalNuvemEma655, ativa: true },
  { id: 'M2-05', grupo: 'Machine #2', key: 'larryWilliams9394', nome: 'Larry Williams 9.3/9.4 (EMA12 + SMA50)', fn: sinalLarryWilliams9394, ativa: true },
  // ---- Gatilhos G-xx: FORA da lista desde a v2.5 (painel padronizado nas 10 estratégias). ----
  // Para reativar algum, copie a linha correspondente de volta para dentro do array ESTRATEGIAS:
  // { id: 'G-01', grupo: 'Gatilho', key: 'gSma90', nome: 'Preço x SMA90', fn: function (o) { return gatilhoPrecoMedia_(o, sma(o.closes, 90)); }, ativa: true },
  // { id: 'G-02', grupo: 'Gatilho', key: 'gSma155', nome: 'Preço x SMA155 (STH-RP)', fn: function (o) { return gatilhoPrecoMedia_(o, sma(o.closes, 155)); }, ativa: true },
  // { id: 'G-03', grupo: 'Gatilho', key: 'gBmsb', nome: 'Preço x Bull Market Support Band (SMA140/EMA147)', fn: gatilhoBmsb_, ativa: true },
  // { id: 'G-05', grupo: 'Gatilho', key: 'gEma655', nome: 'Cruzamento EMA6 x EMA55 (puro)', fn: gatilhoEma655_, ativa: true },
  // { id: 'G-06', grupo: 'Gatilho', key: 'gEma200', nome: 'Preço x EMA200', fn: function (o) { return gatilhoPrecoMedia_(o, ema(o.closes, 200)); }, ativa: true },
  // { id: 'G-07', grupo: 'Gatilho', key: 'gEma365', nome: 'Preço x EMA365', fn: function (o) { return gatilhoPrecoMedia_(o, ema(o.closes, 365)); }, ativa: true },
  // { id: 'G-09', grupo: 'Gatilho', key: 'gBb25', nome: 'Reversão Bollinger 2,5σ (compra abaixo, sai na média)', fn: gatilhoBb25_, ativa: true },
  // { id: 'G-10', grupo: 'Gatilho', key: 'gZscore', nome: 'Capitulação Z-score ≤ -2σ (30d)', fn: gatilhoZscore_, ativa: true },
  // { id: 'G-11', grupo: 'Gatilho', key: 'gFearGreed', nome: 'Fear & Greed contrário (≤20 compra / ≥80 sai)', fn: gatilhoFearGreed_, ativa: true },
  // Funding Rate e Open Interest: sem histórico público longo suficiente p/ backtest -> só monitoramento (aba 5 + alertas).
];

/* ---- Machine #1: Confluência SMC/ICT/Trendline (cópia fiel) ---- */
function sinalConfluencia(o) {
  const pos = calcConfluenciaPosition(o.highs, o.lows, o.closes), n = pos.length;
  const en = new Array(n).fill(false), ex = new Array(n).fill(false);
  for (let i = 0; i < n; i++) { en[i] = pos[i] === 1; ex[i] = pos[i] === 0; }
  return { entrySignal: en, exitSignal: ex, invalidationSeries: calcSMA(o.closes, 200).map(nz_) };
}
function calcSMCRegime(highs, lows, closes, size) {
  const n = closes.length; let leg = 0, swingHighLvl = null, swingLowLvl = null, highCrossed = true, lowCrossed = true, trend = 0;
  const regime = new Array(n).fill(0);
  for (let i = size; i < n; i++) {
    let wH = -Infinity, wL = Infinity;
    for (let k = i - size + 1; k <= i; k++) { if (highs[k] > wH) wH = highs[k]; if (lows[k] < wL) wL = lows[k]; }
    const prevLeg = leg;
    if (highs[i - size] > wH) leg = 0; else if (lows[i - size] < wL) leg = 1;
    if (leg !== prevLeg) {
      if (leg === 1) { swingLowLvl = lows[i - size]; lowCrossed = false; } else { swingHighLvl = highs[i - size]; highCrossed = false; }
    }
    if (swingHighLvl !== null && !highCrossed && closes[i - 1] <= swingHighLvl && swingHighLvl < closes[i]) { trend = 1; highCrossed = true; }
    if (swingLowLvl !== null && !lowCrossed && closes[i - 1] >= swingLowLvl && swingLowLvl > closes[i]) { trend = -1; lowCrossed = true; }
    regime[i] = trend;
  }
  return regime;
}
function calcICTRegime(highs, lows, closes, left) {
  const n = closes.length, phConf = {}, plConf = {};
  for (let j = left; j < n - 1; j++) {
    const loB = Math.max(0, j - left), hiB = Math.min(n, j + 2); let maxH = -Infinity, minL = Infinity;
    for (let k = loB; k < hiB; k++) { if (highs[k] > maxH) maxH = highs[k]; if (lows[k] < minL) minL = lows[k]; }
    if (highs[j] === maxH && !phConf[j + 1]) phConf[j + 1] = [j, highs[j]];
    if (lows[j] === minL && !plConf[j + 1]) plConf[j + 1] = [j, lows[j]];
  }
  let zz = [], mssDir = 0; const regime = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    if (phConf[i]) { const j = phConf[i][0], v = phConf[i][1]; if (zz.length === 0 || zz[0][0] < 1) zz.unshift([1, j, v]); else if (v > zz[0][2]) { zz[0][1] = j; zz[0][2] = v; } }
    if (plConf[i]) { const j = plConf[i][0], v = plConf[i][1]; if (zz.length === 0 || zz[0][0] > -1) zz.unshift([-1, j, v]); else if (v < zz[0][2]) { zz[0][1] = j; zz[0][2] = v; } }
    if (zz.length > 5) zz = zz.slice(0, 5);
    if (zz.length >= 3) {
      const iH = zz[2][0] === 1 ? 2 : 1, iL = zz[2][0] === -1 ? 2 : 1;
      if (iH < zz.length && iL < zz.length) {
        const c = closes[i];
        if (c > zz[iH][2] && zz[iH][0] === 1 && mssDir < 1) mssDir = 1;
        else if (c < zz[iL][2] && zz[iL][0] === -1 && mssDir > -1) mssDir = -1;
      }
    }
    regime[i] = mssDir;
  }
  return regime;
}
function calcTrendlineRegime(highs, lows, closes, length, mult) {
  const n = closes.length, isPh = new Array(n).fill(false), isPl = new Array(n).fill(false);
  for (let j = length; j < n - length; j++) {
    let maxH = -Infinity, minL = Infinity;
    for (let k = j - length; k <= j + length; k++) { if (highs[k] > maxH) maxH = highs[k]; if (lows[k] < minL) minL = lows[k]; }
    if (highs[j] === maxH) isPh[j] = true; if (lows[j] === minL) isPl[j] = true;
  }
  const sd = new Array(n).fill(null);
  for (let i = length - 1; i < n; i++) {
    let s = 0; for (let k = i - length + 1; k <= i; k++) s += closes[k];
    const m = s / length; let q = 0; for (let k = i - length + 1; k <= i; k++) q += (closes[k] - m) * (closes[k] - m);
    sd[i] = Math.sqrt(q / length);
  }
  let upper = 0, lower = 0, slopePh = 0, slopePl = 0, upos = 0, dnos = 0, cur = 0; const regime = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    const j = i - length, phC = j >= 0 ? isPh[j] : false, plC = j >= 0 ? isPl[j] : false;
    const s = (sd[i] !== null ? sd[i] : 0) / length * mult;
    slopePh = phC ? s : slopePh; slopePl = plC ? s : slopePl;
    upper = phC ? highs[j] : upper - slopePh; lower = plC ? lows[j] : lower + slopePl;
    const pu = upos, pd = dnos;
    if (phC) upos = 0; else if (closes[i] > upper - slopePh * length) upos = 1;
    if (plC) dnos = 0; else if (closes[i] < lower + slopePl * length) dnos = 1;
    if (upos > pu) cur = 1; else if (dnos > pd) cur = -1;
    regime[i] = cur;
  }
  return regime;
}
function calcConfluenciaPosition(highs, lows, closes) {
  const n = closes.length, smc = calcSMCRegime(highs, lows, closes, 5), ict = calcICTRegime(highs, lows, closes, 5);
  const tl = calcTrendlineRegime(highs, lows, closes, 30, 2.0), s200 = calcSMA(closes, 200), pos = new Array(n).fill(0); let st = 0;
  for (let i = 0; i < n; i++) {
    const votes = (smc[i] === 1 ? 1 : 0) + (ict[i] === 1 ? 1 : 0) + (tl[i] === 1 ? 1 : 0);
    const macro = s200[i] !== null && closes[i] > s200[i];
    if (!st && votes >= 2 && macro) st = 1; else if (st && (votes <= 0 || !macro)) st = 0;
    pos[i] = st;
  }
  return pos;
}

/* ---- Gatilhos do prompt como estratégias ---- */
function gatilhoPrecoMedia_(o, m) {
  const n = o.closes.length, en = new Array(n).fill(false), ex = new Array(n).fill(false);
  for (let i = 0; i < n; i++) { if (isNaN(m[i])) continue; en[i] = o.closes[i] > m[i]; ex[i] = o.closes[i] < m[i]; }
  return { entrySignal: en, exitSignal: ex, invalidationSeries: m };
}
function gatilhoBmsb_(o) {
  const a = sma(o.closes, 140), b = ema(o.closes, 147), n = o.closes.length;
  const en = new Array(n).fill(false), ex = new Array(n).fill(false), inv = new Array(n).fill(NaN);
  for (let i = 0; i < n; i++) {
    if (isNaN(a[i]) || isNaN(b[i])) continue;
    en[i] = o.closes[i] > Math.max(a[i], b[i]); ex[i] = o.closes[i] < Math.min(a[i], b[i]); inv[i] = Math.min(a[i], b[i]);
  }
  return { entrySignal: en, exitSignal: ex, invalidationSeries: inv };
}
function gatilhoEma655_(o) {
  const f = ema(o.closes, 6), s = ema(o.closes, 55), n = o.closes.length;
  const en = new Array(n).fill(false), ex = new Array(n).fill(false);
  for (let i = 0; i < n; i++) { if (isNaN(f[i]) || isNaN(s[i])) continue; en[i] = f[i] > s[i]; ex[i] = f[i] < s[i]; }
  return { entrySignal: en, exitSignal: ex, invalidationSeries: s };
}
function gatilhoBb25_(o) {
  const m = sma(o.closes, 20), sd = stdevPop_(o.closes, 20), n = o.closes.length;
  const en = new Array(n).fill(false), ex = new Array(n).fill(false), inv = new Array(n).fill(NaN);
  for (let i = 0; i < n; i++) {
    if (isNaN(m[i]) || isNaN(sd[i])) continue;
    en[i] = o.closes[i] < m[i] - 2.5 * sd[i]; ex[i] = o.closes[i] > m[i]; inv[i] = m[i] - 3.5 * sd[i];
  }
  return { entrySignal: en, exitSignal: ex, invalidationSeries: inv, stopIfEnteredSeries: inv };
}
function gatilhoZscore_(o) {
  const C = o.closes, n = C.length, r = new Array(n).fill(NaN);
  for (let i = 1; i < n; i++) r[i] = (C[i] / C[i - 1] - 1) * 100;
  const mu = sma(r, 30), sd = stdevPop_(r, 30), m20 = sma(C, 20);
  const en = new Array(n).fill(false), ex = new Array(n).fill(false);
  for (let i = 31; i < n; i++) {
    if (!(sd[i - 1] > 0) || isNaN(m20[i])) continue;
    en[i] = (r[i] - mu[i - 1]) / sd[i - 1] <= -2; ex[i] = C[i] > m20[i];
  }
  return { entrySignal: en, exitSignal: ex, invalidationSeries: m20 };
}
function gatilhoFearGreed_(o) {
  const fg = historicoFearGreed_(), n = o.closes.length;
  const en = new Array(n).fill(false), ex = new Array(n).fill(false);
  for (let i = 0; i < n; i++) {
    const v = fg[Utilities.formatDate(o.dates[i], 'UTC', 'yyyy-MM-dd')];
    if (v === undefined) continue;
    en[i] = v <= cfgNum_('FG_MEDO_EXTREMO'); ex[i] = v >= cfgNum_('FG_GANANCIA_EXTREMA');
  }
  return { entrySignal: en, exitSignal: ex };
}
function historicoFearGreed_() {
  const cache = CacheService.getScriptCache(), c = cache.get('FG_HIST');
  if (c) return JSON.parse(c);
  const map = {};
  try {
    fetchJson_('https://api.alternative.me/fng/?limit=0&format=json').data.forEach(function (d) {
      map[Utilities.formatDate(new Date(parseInt(d.timestamp, 10) * 1000), 'UTC', 'yyyy-MM-dd')] = parseInt(d.value, 10);
    });
    const s = JSON.stringify(map);
    if (s.length < 95000) cache.put('FG_HIST', s, 21600);
  } catch (e) {}
  return map;
}

function sinalMacd205012(o) {
  const n = o.closes.length, m = calcMACD(o.closes, 20, 50, 12);
  const en = new Array(n).fill(false), ex = new Array(n).fill(false);
  for (let i = 0; i < n; i++) {
    if (m.macdLine[i] === null || m.signalLine[i] === null) continue;
    en[i] = m.macdLine[i] > m.signalLine[i];
    ex[i] = m.macdLine[i] < m.signalLine[i];
  }
  return { entrySignal: en, exitSignal: ex };
}
function sinalAdxTrendBreakout(o) {
  const n = o.closes.length, H = o.highs, L = o.lows, C = o.closes;
  const pDM = new Array(n).fill(0), mDM = new Array(n).fill(0), tr = new Array(n).fill(0);
  for (let i = 1; i < n; i++) {
    const up = H[i] - H[i - 1], dn = L[i - 1] - L[i];
    pDM[i] = (up > dn && up > 0) ? up : 0;
    mDM[i] = (dn > up && dn > 0) ? dn : 0;
    tr[i] = Math.max(H[i] - L[i], Math.abs(H[i] - C[i - 1]), Math.abs(L[i] - C[i - 1]));
  }
  const atr = calcRMA(tr, 7), sp = calcRMA(pDM, 7), sm = calcRMA(mDM, 7);
  const diP = new Array(n).fill(null), diM = new Array(n).fill(null), dx = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    if (atr[i] === null || sp[i] === null || sm[i] === null || atr[i] === 0) continue;
    diP[i] = 100 * sp[i] / atr[i]; diM[i] = 100 * sm[i] / atr[i];
    const s = diP[i] + diM[i];
    dx[i] = s === 0 ? 0 : 100 * Math.abs(diP[i] - diM[i]) / s;
  }
  const adx = calcRMA(dx, 10), s50 = calcSMA(C, 50);
  const en = new Array(n).fill(false), ex = new Array(n).fill(false);
  for (let i = 0; i < n; i++) {
    if (adx[i] === null || diP[i] === null || diM[i] === null || s50[i] === null) continue;
    en[i] = adx[i] > 18 && diP[i] > diM[i] && C[i] > s50[i];
    ex[i] = diM[i] > diP[i] || C[i] < s50[i];
  }
  return { entrySignal: en, exitSignal: ex, invalidationSeries: s50.map(nz_) };
}
function sinalSma200Ema1030(o) {
  const n = o.closes.length, s200 = calcSMA(o.closes, 200), e10 = calcEMA(o.closes, 10), e30 = calcEMA(o.closes, 30);
  const en = new Array(n).fill(false), ex = new Array(n).fill(false);
  for (let i = 0; i < n; i++) {
    if (s200[i] === null || e10[i] === null || e30[i] === null) continue;
    const ok = o.closes[i] > s200[i] && e10[i] > e30[i];
    en[i] = ok; ex[i] = !ok;
  }
  return { entrySignal: en, exitSignal: ex, invalidationSeries: s200.map(nz_) };
}
function sinalHibridoSthRp(o) {
  const n = o.closes.length, C = o.closes;
  const sth = sma(C, 155), w21 = weeklyEma21FromDaily_(o, 21);
  const ef = ema(C, 20), es = ema(C, 50), macd = new Array(n).fill(NaN);
  for (let i = 0; i < n; i++) if (!isNaN(ef[i]) && !isNaN(es[i])) macd[i] = ef[i] - es[i];
  const sig = ema(macd, 12), e14 = ema(C, 14), e49 = ema(C, 49), r = rsi(C, 14), atr = atrWilder(o.highs, o.lows, C, 14);
  const en = new Array(n).fill(false), ex = new Array(n).fill(false), inv = new Array(n).fill(NaN), stp = new Array(n).fill(NaN);
  for (let i = 0; i < n; i++) {
    const c1 = !isNaN(sth[i]) && C[i] > sth[i];
    const c2 = !isNaN(w21[i]) && C[i] > w21[i];
    const c3 = !isNaN(macd[i]) && !isNaN(sig[i]) && macd[i] > sig[i];
    const c4 = !isNaN(e14[i]) && !isNaN(e49[i]) && C[i] > e14[i] && C[i] > e49[i] && !isNaN(r[i]) && r[i] >= 45 && r[i] <= 75;
    const score = (c1 ? 1 : 0) + (c2 ? 1 : 0) + (c3 ? 1 : 0) + (c4 ? 1 : 0);
    en[i] = score >= 3 && !isNaN(sth[i]);
    ex[i] = score <= 1 || (!isNaN(sth[i]) && C[i] < sth[i]);
    if (!isNaN(atr[i])) { inv[i] = C[i] - 2.0 * atr[i]; stp[i] = inv[i]; }
  }
  return { entrySignal: en, exitSignal: ex, invalidationSeries: inv, stopIfEnteredSeries: stp };
}
function sinalNuvemEma655(o) {
  const n = o.closes.length, F = ema(o.closes, 6), S = ema(o.closes, 55), M = sma(o.closes, 100);
  const en = new Array(n).fill(false), ex = new Array(n).fill(false), inv = new Array(n).fill(NaN);
  for (let i = 1; i < n; i++) {
    if (isNaN(F[i]) || isNaN(S[i]) || isNaN(F[i - 1]) || isNaN(S[i - 1])) continue;
    en[i] = F[i - 1] <= S[i - 1] && F[i] > S[i] && !isNaN(M[i]) && o.closes[i] > M[i];
    ex[i] = F[i - 1] >= S[i - 1] && F[i] < S[i];
    inv[i] = S[i];
  }
  return { entrySignal: en, exitSignal: ex, invalidationSeries: inv };
}
function sinalLarryWilliams9394(o) {
  const n = o.closes.length, e9 = ema(o.closes, 12), M = sma(o.closes, 50);
  const en = new Array(n).fill(false), ex = new Array(n).fill(false), inv = new Array(n).fill(NaN);
  for (let i = 2; i < n; i++) {
    if (isNaN(e9[i]) || isNaN(e9[i - 1]) || isNaN(e9[i - 2])) continue;
    const sobe = e9[i] > e9[i - 1], cai = e9[i] < e9[i - 1], ontemCaia = e9[i - 1] < e9[i - 2];
    const macro = !isNaN(M[i]) && o.closes[i] > M[i];
    const c93 = o.lows[i] <= e9[i] && o.closes[i] > e9[i] && sobe;
    const c94 = sobe && ontemCaia;
    en[i] = macro && (c93 || c94);
    ex[i] = cai;
    inv[i] = e9[i];
  }
  return { entrySignal: en, exitSignal: ex, invalidationSeries: inv };
}

/* ---- v2.1: estratégias que entram (cópias fiéis das Machines #1 v3.5b e #2 v4.0) ---- */
function sinalRocMomentum(o) {
  const n = o.closes.length, C = o.closes, ROC_LEN = 30, ROC_ENTRADA = 15, ROC_SAIDA = 0, M = sma(C, 200);
  const en = new Array(n).fill(false), ex = new Array(n).fill(false), inv = new Array(n).fill(NaN);
  for (let i = ROC_LEN; i < n; i++) {
    if (isNaN(M[i]) || isNaN(C[i]) || isNaN(C[i - ROC_LEN]) || C[i - ROC_LEN] === 0) continue;
    const roc = (C[i] / C[i - ROC_LEN] - 1) * 100;
    en[i] = roc > ROC_ENTRADA && C[i] > M[i];
    ex[i] = roc < ROC_SAIDA || C[i] < M[i];
    inv[i] = M[i];
  }
  return { entrySignal: en, exitSignal: ex, invalidationSeries: inv };
}
function sinalEmaCrossSma76(o) {
  const n = o.closes.length, C = o.closes, E = ema(C, 10), M = sma(C, 76);
  const en = new Array(n).fill(false), ex = new Array(n).fill(false), inv = new Array(n).fill(NaN);
  for (let i = 1; i < n; i++) {
    if (isNaN(E[i]) || isNaN(E[i - 1])) continue;
    const cruzaAlta = C[i] > E[i] && C[i - 1] <= E[i - 1];
    const cruzaBaixa = C[i] < E[i] && C[i - 1] >= E[i - 1];
    en[i] = cruzaAlta && !isNaN(M[i]) && C[i] > M[i];
    ex[i] = cruzaBaixa;
    inv[i] = E[i];
  }
  return { entrySignal: en, exitSignal: ex, invalidationSeries: inv };
}
function sinalBollingerSqueeze(o) {
  const n = o.closes.length, C = o.closes, BB_LEN = 20, BB_MULT = 2.25, BW_LEN = 50;
  const basis = sma(C, BB_LEN), dev = stdevPop_(C, BB_LEN), M = sma(C, 200);
  const upper = new Array(n).fill(NaN), bw = new Array(n).fill(NaN);
  for (let i = 0; i < n; i++) {
    if (!isNaN(basis[i]) && !isNaN(dev[i]) && basis[i] !== 0) {
      upper[i] = basis[i] + BB_MULT * dev[i];
      bw[i] = (2 * BB_MULT * dev[i]) / basis[i];
    }
  }
  const bwMa = sma(bw, BW_LEN);
  const en = new Array(n).fill(false), ex = new Array(n).fill(false), inv = new Array(n).fill(NaN);
  for (let i = 0; i < n; i++) {
    if (isNaN(upper[i]) || isNaN(bwMa[i]) || isNaN(M[i])) continue;
    en[i] = C[i] > upper[i] && bw[i] > bwMa[i] && C[i] > M[i];
    ex[i] = C[i] < basis[i];
    inv[i] = basis[i];
  }
  return { entrySignal: en, exitSignal: ex, invalidationSeries: inv };
}

function nz_(v) { return v === null || v === undefined ? NaN : v; }

/* =============================================================================
 * 3. MOTOR DE BACKTEST (idêntico ao v3.4: open D+1, custos 0,125%/lado, stop congelado)
 *    + estado operacional da última vela fechada.
 * * ===========================================================================*/
function runBacktest_(o, s) {
  const cost = (P2.FEE_PCT + P2.SLIPPAGE_PCT) / 100, n = o.closes.length, cap0 = P2.CAPITAL_BASE;
  const stopS = s.stopIfEnteredSeries;
  let pos = 0, entryPrice = null, entryIdx = null, frozen = NaN, capital = cap0;
  const trades = [], eq = new Array(n).fill(cap0);
  for (let i = 1; i < n; i++) {
    eq[i - 1] = pos === 1 ? capital * (o.closes[i - 1] / entryPrice) : capital;
    if (pos === 0) {
      if (s.entrySignal[i - 1]) {
        entryPrice = o.opens[i] * (1 + cost); pos = 1; entryIdx = i;
        frozen = (stopS && !isNaN(stopS[i - 1])) ? stopS[i - 1] : NaN;
      }
    } else {
      const stopHit = stopS && !isNaN(frozen) && o.lows[i - 1] <= frozen;
      if (s.exitSignal[i - 1] || stopHit) {
        const ret = (o.opens[i] * (1 - cost)) / entryPrice - 1;
        capital *= (1 + ret);
        trades.push({ entryDate: o.dates[entryIdx], exitDate: o.dates[i], ret: ret * 100, motivo: (stopHit && !s.exitSignal[i - 1]) ? 'STOP' : 'SINAL' });
        pos = 0; entryPrice = null; frozen = NaN;
      }
    }
  }
  eq[n - 1] = pos === 1 ? capital * (o.closes[n - 1] / entryPrice) : capital;
  // Sharpe anualizado (raiz 365) na janela recente — peso do componente no consenso
  const jan = Math.min(n - 1, cfgNum_('CONSENSO_JANELA_SHARPE_DIAS') || 1095), rets = [];
  for (let i = n - jan; i < n; i++) rets.push(eq[i] / eq[i - 1] - 1);
  const mu = rets.reduce(function (a, b) { return a + b; }, 0) / rets.length;
  const sdv = Math.sqrt(rets.reduce(function (a, b) { return a + (b - mu) * (b - mu); }, 0) / rets.length);
  const sharpe = sdv > 0 ? mu / sdv * Math.sqrt(365) : 0;
  const tradesJan = trades.filter(function (t) { return t.exitDate >= o.dates[n - jan]; }).length + (pos === 1 ? 1 : 0);
  // Estado após processar os sinais da ÚLTIMA vela fechada (executa na próxima abertura)
  const L = n - 1, lastClose = o.closes[L];
  const inv = s.invalidationSeries ? s.invalidationSeries[L] : NaN;
  let posAtual = pos, evento = '', precoEntrada = entryPrice, stopAtual = NaN;
  if (pos === 0 && s.entrySignal[L]) {
    posAtual = 1; evento = 'ENTRADA'; precoEntrada = lastClose;
    stopAtual = (stopS && !isNaN(stopS[L])) ? stopS[L] : inv;
  } else if (pos === 1) {
    const stopHit = stopS && !isNaN(frozen) && o.lows[L] <= frozen;
    if (s.exitSignal[L] || stopHit) { posAtual = 0; evento = stopHit && !s.exitSignal[L] ? 'STOP' : 'SAIDA'; }
    stopAtual = !isNaN(frozen) ? frozen : inv;
  }
  const aberto = pos === 1 && entryPrice ? (lastClose / entryPrice - 1) : 0;
  const acumulado = capital * (1 + aberto) / cap0 - 1;
  const ganhos = trades.filter(function (t) { return t.ret > 0; }).length;
  return {
    posAtual: posAtual, evento: evento,
    precoEntrada: posAtual === 1 ? precoEntrada : null,
    stopAtual: posAtual === 1 && isFinite(stopAtual) ? stopAtual : null,
    lucroAbertoPct: posAtual === 1 && pos === 1 ? aberto * 100 : 0,
    lucroAcumPct: acumulado * 100,
    nTrades: trades.length,
    winRate: trades.length >= 5 ? ganhos / trades.length * 100 : null,
    ultimoTrade: trades.length ? trades[trades.length - 1] : null,
    sharpe: sharpe,
    // Peso: Sharpe positivo (teto 3) x confiabilidade amostral (>= 5 trades na janela)
    peso: Math.max(0, Math.min(3, sharpe)) * Math.min(1, tradesJan / 5),
  };
}

/* =============================================================================
 * 4. INDICADORES BASE (cópias fiéis das Machines)
 * ===========================================================================*/
function calcSMA(arr, p) {
  const res = []; let sum = 0;
  for (let i = 0; i < arr.length; i++) {
    sum += arr[i];
    if (i >= p) { sum -= arr[i - p]; res.push(sum / p); }
    else if (i === p - 1) res.push(sum / p);
    else res.push(null);
  }
  return res;
}
function calcEMA(arr, p) {
  const res = [], k = 2 / (p + 1); let e = null, sum = 0;
  for (let i = 0; i < arr.length; i++) {
    if (i < p - 1) { sum += arr[i]; res.push(null); }
    else if (i === p - 1) { sum += arr[i]; e = sum / p; res.push(e); }
    else { e = (arr[i] - e) * k + e; res.push(e); }
  }
  return res;
}
function calcRMA(arr, p) {
  const res = [], a = 1 / p; let r = null, sum = 0;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] === null || arr[i] === undefined) { res.push(null); continue; }
    if (i < p - 1) { sum += arr[i]; res.push(null); }
    else if (i === p - 1 || r === null) { sum += arr[i]; r = sum / p; res.push(r); }
    else { r = a * arr[i] + (1 - a) * r; res.push(r); }
  }
  return res;
}
function calcMACD(arr, fast, slow, sig) {
  const f = calcEMA(arr, fast), s = calcEMA(arr, slow), line = [];
  for (let i = 0; i < arr.length; i++) line.push(f[i] !== null && s[i] !== null ? f[i] - s[i] : null);
  const sigValid = calcEMA(line.filter(function (x) { return x !== null; }), sig);
  const signalLine = [], histogram = []; let v = 0;
  for (let i = 0; i < arr.length; i++) {
    if (line[i] !== null) { const sv = sigValid[v++]; signalLine.push(sv); histogram.push(sv !== null ? line[i] - sv : null); }
    else { signalLine.push(null); histogram.push(null); }
  }
  return { macdLine: line, signalLine: signalLine, histogram: histogram };
}
function ema(v, len) {
  const out = new Array(v.length).fill(NaN), k = 2 / (len + 1); let prev = null;
  for (let i = 0; i < v.length; i++) {
    if (isNaN(v[i])) continue;
    if (prev === null) {
      if (i >= len - 1) {
        let s = 0, ok = true;
        for (let j = i - len + 1; j <= i; j++) { if (isNaN(v[j])) { ok = false; break; } s += v[j]; }
        if (ok) { prev = s / len; out[i] = prev; }
      }
    } else { prev = v[i] * k + prev * (1 - k); out[i] = prev; }
  }
  return out;
}
function sma(v, len) {
  const out = new Array(v.length).fill(NaN); let s = 0, bad = 0;
  for (let i = 0; i < v.length; i++) {
    if (isNaN(v[i])) bad++; else s += v[i];
    if (i >= len) { if (isNaN(v[i - len])) bad--; else s -= v[i - len]; }
    if (i >= len - 1 && bad === 0) out[i] = s / len;
  }
  return out;
}
function stdevPop_(v, len) {
  const out = new Array(v.length).fill(NaN);
  for (let i = len - 1; i < v.length; i++) {
    let s = 0, ok = true;
    for (let j = i - len + 1; j <= i; j++) { if (isNaN(v[j])) { ok = false; break; } s += v[j]; }
    if (!ok) continue;
    const m = s / len; let q = 0;
    for (let j = i - len + 1; j <= i; j++) q += (v[j] - m) * (v[j] - m);
    out[i] = Math.sqrt(q / len);
  }
  return out;
}
function atrWilder(H, L, C, len) {
  const n = H.length, tr = new Array(n), out = new Array(n).fill(NaN);
  for (let i = 0; i < n; i++) tr[i] = i === 0 ? H[i] - L[i] : Math.max(H[i] - L[i], Math.abs(H[i] - C[i - 1]), Math.abs(L[i] - C[i - 1]));
  let prev = null;
  for (let i = 0; i < n; i++) {
    if (prev === null) { if (i >= len - 1) { let s = 0; for (let j = i - len + 1; j <= i; j++) s += tr[j]; prev = s / len; out[i] = prev; } }
    else { prev = (prev * (len - 1) + tr[i]) / len; out[i] = prev; }
  }
  return out;
}
function rsi(v, len) { return rsiFull_(v, len).rsi; }
function rsiFull_(v, len) {
  const n = v.length, out = new Array(n).fill(NaN), G = new Array(n).fill(NaN), Lo = new Array(n).fill(NaN); let g = null, l = null;
  for (let i = 1; i < n; i++) {
    const ch = v[i] - v[i - 1], gain = ch > 0 ? ch : 0, loss = ch < 0 ? -ch : 0;
    if (g === null) {
      if (i >= len) {
        let sg = 0, sl = 0;
        for (let j = i - len + 1; j <= i; j++) { const c = v[j] - v[j - 1]; if (c > 0) sg += c; else sl -= c; }
        g = sg / len; l = sl / len; out[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l);
      }
    } else {
      g = (g * (len - 1) + gain) / len; l = (l * (len - 1) + loss) / len;
      out[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l);
    }
    if (g !== null) { G[i] = g; Lo[i] = l; }
  }
  return { rsi: out, avgGain: G, avgLoss: Lo };
}
/** Preço de fechamento (próxima vela) que levaria o RSI(len) Wilder ao valor alvo R. */
function precoParaRsi_(close, g, l, R, len) {
  const k = len - 1, alvo = R / (100 - R);
  const desce = k * g / alvo - k * l;   // queda x: (g*k)/(l*k + x) = alvo
  const sobe = alvo * k * l - k * g;    // alta x: (g*k + x)/(l*k) = alvo
  if (desce > 0) return close - desce;
  if (sobe > 0) return close + sobe;
  return close;
}
function weeklyEma21FromDaily_(o, len) {
  const n = o.dates.length;
  const wk = o.dates.map(function (d) {
    const day = (d.getUTCDay() + 6) % 7;
    return Utilities.formatDate(new Date(d.getTime() - day * 86400000), 'UTC', 'yyyy-MM-dd');
  });
  const uniq = [], closeBy = {};
  for (let i = 0; i < n; i++) { if (!(wk[i] in closeBy)) uniq.push(wk[i]); closeBy[wk[i]] = o.closes[i]; }
  const we = ema(uniq.map(function (k) { return closeBy[k]; }), len), idx = {};
  uniq.forEach(function (k, j) { idx[k] = j; });
  return wk.map(function (k) { const p = idx[k] - 1; return p >= 0 ? we[p] : NaN; });
}

/* =============================================================================
 * 5. INGESTÃO — BASE_DADOS_BTC_1D (cascata Coinbase -> OKX -> KuCoin -> Kraken)
 * ===========================================================================*/
function fetchJson_(url, headers, tentativas) {
  const opt = { muteHttpExceptions: true, headers: headers || { 'User-Agent': 'MVP-Projeto02/1.0' } };
  let ult = '';
  for (let a = 1; a <= (tentativas || 3); a++) {
    try {
      const r = UrlFetchApp.fetch(url, opt), c = r.getResponseCode();
      if (c === 200) return JSON.parse(r.getContentText());
      ult = 'HTTP ' + c;
      if (c !== 429 && c < 500) break;
    } catch (e) { ult = e.message; }
    Utilities.sleep(800 * a);
  }
  throw new Error(ult + ' @ ' + url.split('?')[0]);
}
function coinbaseJanela_(startSec, endSec) {
  const url = 'https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=86400&start='
    + new Date(startSec * 1000).toISOString() + '&end=' + new Date(endSec * 1000).toISOString();
  const rows = fetchJson_(url);
  return (Array.isArray(rows) ? rows : []).map(function (r) {
    return { date: new Date(r[0] * 1000), open: r[3], high: r[2], low: r[1], close: r[4], volume: r[5] };
  });
}
function fetchCoinbase_(desdeSec) {
  const now = Math.floor(Date.now() / 1000), passo = 300 * 86400, by = {};
  let end = now, guard = 0;
  while (end > desdeSec && guard++ < 60) {
    const start = Math.max(desdeSec, end - passo);
    coinbaseJanela_(start, end).forEach(function (c) { by[c.date.getTime()] = c; });
    end = start;
  }
  return Object.keys(by).map(function (k) { return by[k]; });
}
function fetchOkx_() {
  const by = {}; let after = null, guard = 0;
  while (guard++ < 60) {
    let url = 'https://www.okx.com/api/v5/market/history-candles?instId=BTC-USDT&bar=1Dutc&limit=100';
    if (after) url += '&after=' + after;
    const p = fetchJson_(url);
    if (String(p.code) !== '0' || !p.data || !p.data.length) break;
    let min = Infinity;
    p.data.forEach(function (r) {
      const ts = parseInt(r[0], 10);
      by[ts] = { date: new Date(ts), open: +r[1], high: +r[2], low: +r[3], close: +r[4], volume: +r[5] };
      if (ts < min) min = ts;
    });
    if (p.data.length < 100) break;
    after = min;
  }
  return Object.keys(by).map(function (k) { return by[k]; });
}
function fetchKucoin_() {
  const by = {}, gen = Math.floor(Date.UTC(2017, 8, 1) / 1000); let end = Math.floor(Date.now() / 1000), g = 0;
  while (end > gen && g++ < 10) {
    const start = Math.max(gen, end - 1500 * 86400);
    const p = fetchJson_('https://api.kucoin.com/api/v1/market/candles?type=1day&symbol=BTC-USDT&startAt=' + start + '&endAt=' + end);
    (p.data || []).forEach(function (r) {
      const t = parseInt(r[0], 10);
      by[t] = { date: new Date(t * 1000), open: +r[1], high: +r[3], low: +r[4], close: +r[2], volume: +r[5] };
    });
    end = start;
  }
  return Object.keys(by).map(function (k) { return by[k]; });
}
function fetchKraken_() {
  const p = fetchJson_('https://api.kraken.com/0/public/OHLC?pair=XBTUSD&interval=1440');
  const k = Object.keys(p.result || {}).filter(function (x) { return x !== 'last'; })[0];
  return (k ? p.result[k] : []).map(function (r) {
    return { date: new Date(r[0] * 1000), open: +r[1], high: +r[2], low: +r[3], close: +r[4], volume: +r[6] };
  });
}

/** Ordena, remove vela do dia corrente (anti look-ahead) e preenche lacunas (flat, vol 0). */
function sanearSerie_(data) {
  data.sort(function (a, b) { return a.date - b.date; });
  const hojeUtc = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate());
  data = data.filter(function (c) { return c.date.getTime() < hojeUtc && c.close > 0; });
  const out = []; let lacunas = 0;
  for (let i = 0; i < data.length; i++) {
    if (out.length) {
      let prev = out[out.length - 1];
      while (data[i].date.getTime() - prev.date.getTime() > 86400000 * 1.5) {
        prev = { date: new Date(prev.date.getTime() + 86400000), open: prev.close, high: prev.close, low: prev.close, close: prev.close, volume: 0, preenchido: true };
        out.push(prev); lacunas++;
      }
      if (data[i].date.getTime() - prev.date.getTime() < 86400000 * 0.5) continue; // duplicata
    }
    out.push(data[i]);
  }
  out.lacunasPreenchidas = lacunas;
  return out;
}

function baixarHistoricoCompleto_() {
  const fontes = [
    ['Coinbase', function () { return fetchCoinbase_(Math.floor(P2.HIST_INICIO_MS / 1000)); }],
    ['OKX', fetchOkx_], ['KuCoin', fetchKucoin_], ['Kraken', fetchKraken_],
  ];
  const falhas = [];
  for (let i = 0; i < fontes.length; i++) {
    try {
      const d = sanearSerie_(fontes[i][1]());
      if (d.length >= P2.MIN_CANDLES) { d.fonte = fontes[i][0]; return d; }
      falhas.push(fontes[i][0] + ': ' + d.length + ' velas');
    } catch (e) { falhas.push(fontes[i][0] + ': ' + e.message); }
  }
  throw new Error('Todas as fontes falharam: ' + falhas.join(' | '));
}

/** Atualiza a base. Incremental (últimos 300d Coinbase) quando já existe histórico. Retorna OHLCV. */
function atualizarBaseDados_() {
  const sh = ss_().getSheetByName(P2.ABAS.base);
  let atual = lerBase_();
  let serie;
  if (atual.dates.length < P2.MIN_CANDLES) {
    serie = baixarHistoricoCompleto_();
  } else {
    const ultimo = atual.dates[atual.dates.length - 1].getTime();
    const ontemUtc = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()) - 86400000;
    if (ultimo >= ontemUtc) return { ohlcv: atual, novaVela: false };
    let novos = [];
    try { novos = coinbaseJanela_(Math.floor(ultimo / 1000) - 5 * 86400, Math.floor(Date.now() / 1000)); }
    catch (e) { try { novos = fetchKraken_(); } catch (e2) { throw new Error('Incremental falhou: ' + e.message + ' / ' + e2.message); } }
    const by = {};
    for (let i = 0; i < atual.dates.length; i++) {
      by[atual.dates[i].getTime()] = { date: atual.dates[i], open: atual.opens[i], high: atual.highs[i], low: atual.lows[i], close: atual.closes[i], volume: atual.volumes[i] };
    }
    novos.forEach(function (c) { if (c.date.getTime() > ultimo) by[c.date.getTime()] = c; });
    serie = sanearSerie_(Object.keys(by).map(function (k) { return by[k]; }));
    if (serie[serie.length - 1].date.getTime() <= ultimo) return { ohlcv: atual, novaVela: false };
  }
  const linhas = [];
  for (let i = 0; i < serie.length; i++) {
    const c = serie[i], p = i ? serie[i - 1].close : null;
    linhas.push([
      Utilities.formatDate(c.date, 'UTC', 'yyyy-MM-dd'), c.open, c.high, c.low, c.close, r_(c.volume, 4),
      p ? r_((c.close / p - 1) * 100, 4) : '', p ? r_(Math.log(c.close / p), 6) : '',
    ]);
  }
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 8).clearContent();
  sh.getRange(2, 1, linhas.length, 1).setNumberFormat('@');
  sh.getRange(2, 1, linhas.length, 8).setValues(linhas);
  PropertiesService.getScriptProperties().setProperty('BASE_META', JSON.stringify({
    fonte: serie.fonte || 'Coinbase (incremental)', lacunas: serie.lacunasPreenchidas || 0, atualizado: new Date().toISOString(),
  }));
  return { ohlcv: lerBase_(), novaVela: true };
}

function lerBase_() {
  const sh = ss_().getSheetByName(P2.ABAS.base);
  const o = { dates: [], opens: [], highs: [], lows: [], closes: [], volumes: [] };
  if (!sh || sh.getLastRow() < 2) return o;
  sh.getRange(2, 1, sh.getLastRow() - 1, 6).getValues().forEach(function (r) {
    if (r[0] === '' || !(r[4] > 0)) return;
    const d = r[0] instanceof Date ? new Date(Date.UTC(r[0].getFullYear(), r[0].getMonth(), r[0].getDate())) : new Date(String(r[0]) + 'T00:00:00Z');
    o.dates.push(d); o.opens.push(+r[1]); o.highs.push(+r[2]); o.lows.push(+r[3]); o.closes.push(+r[4]); o.volumes.push(+r[5] || 0);
  });
  return o;
}

/* =============================================================================
 * 6. INDICADORES_TECNICOS (cálculo vetorial em JS, gravado como valores)
 * ===========================================================================*/
const COLS_IND = ['Data', 'Close',
  'EMA6', 'EMA9', 'EMA21', 'EMA50', 'EMA55', 'EMA80', 'EMA147', 'EMA200', 'EMA365',
  'SMA90', 'SMA140', 'SMA155_STHRP', 'SMA200', 'SMA350',
  'BMSB_Topo', 'BMSB_Base', 'BMSB_Spread_pct', 'Preco_vs_BMSB',
  'MACD', 'MACD_Sinal', 'MACD_Hist', 'RSI14', 'ATR14',
  'BB_Meio20', 'BB_Sup2', 'BB_Inf2', 'BB_Sup2_5', 'BB_Inf2_5',
  'Vol30_anual_pct', 'Vol90_anual_pct', 'Z9', 'Z21', 'Z30', 'Z90'];

function calcularIndicadores_(o) {
  const C = o.closes, n = C.length, I = {};
  [6, 9, 21, 50, 55, 80, 147, 200, 365].forEach(function (p) { I['EMA' + p] = ema(C, p); });
  [90, 140, 155, 200, 350].forEach(function (p) { I['SMA' + p] = sma(C, p); });
  const m = calcMACD(C, 12, 26, 9);
  I.MACD = m.macdLine.map(nz_); I.MACD_Sinal = m.signalLine.map(nz_); I.MACD_Hist = m.histogram.map(nz_);
  I.RSI14 = rsi(C, 14); I.ATR14 = atrWilder(o.highs, o.lows, C, 14);
  I.BB_Meio = sma(C, 20); const sd = stdevPop_(C, 20);
  I.BB_Sup2 = []; I.BB_Inf2 = []; I.BB_Sup25 = []; I.BB_Inf25 = [];
  for (let i = 0; i < n; i++) {
    I.BB_Sup2.push(I.BB_Meio[i] + 2 * sd[i]); I.BB_Inf2.push(I.BB_Meio[i] - 2 * sd[i]);
    I.BB_Sup25.push(I.BB_Meio[i] + 2.5 * sd[i]); I.BB_Inf25.push(I.BB_Meio[i] - 2.5 * sd[i]);
  }
  I.BMSB_Topo = []; I.BMSB_Base = []; I.BMSB_Spread = []; I.Preco_vs_BMSB = [];
  for (let i = 0; i < n; i++) {
    const a = I.SMA140[i], b = I.EMA147[i];
    if (isNaN(a) || isNaN(b)) { I.BMSB_Topo.push(NaN); I.BMSB_Base.push(NaN); I.BMSB_Spread.push(NaN); I.Preco_vs_BMSB.push(''); continue; }
    const t = Math.max(a, b), bs = Math.min(a, b);
    I.BMSB_Topo.push(t); I.BMSB_Base.push(bs); I.BMSB_Spread.push((a / b - 1) * 100);
    I.Preco_vs_BMSB.push(C[i] > t ? 'ACIMA' : (C[i] < bs ? 'ABAIXO' : 'DENTRO'));
  }
  const ret = new Array(n).fill(NaN), lr = new Array(n).fill(NaN);
  for (let i = 1; i < n; i++) { ret[i] = (C[i] / C[i - 1] - 1) * 100; lr[i] = Math.log(C[i] / C[i - 1]); }
  I.RET = ret;
  const sdl30 = stdevPop_(lr, 30), sdl90 = stdevPop_(lr, 90);
  I.Vol30 = sdl30.map(function (v) { return v * Math.sqrt(365) * 100; });
  I.Vol90 = sdl90.map(function (v) { return v * Math.sqrt(365) * 100; });
  [9, 21, 30, 90].forEach(function (N) {
    // Z-score do retorno de D contra média/desvio das N barras ANTERIORES (sem contaminação)
    const mu = sma(ret, N), sd2 = stdevPop_(ret, N), z = new Array(n).fill(NaN);
    for (let i = N + 1; i < n; i++) if (sd2[i - 1] > 0) z[i] = (ret[i] - mu[i - 1]) / sd2[i - 1];
    I['Z' + N] = z; I['SD' + N] = sd2; I['MU' + N] = mu;
  });
  return I;
}

function gravarIndicadores_(o, I) {
  const sh = ss_().getSheetByName(P2.ABAS.ind), n = o.closes.length, rows = [];
  for (let i = 0; i < n; i++) {
    rows.push([
      Utilities.formatDate(o.dates[i], 'UTC', 'yyyy-MM-dd'), o.closes[i],
      r_(I.EMA6[i]), r_(I.EMA9[i]), r_(I.EMA21[i]), r_(I.EMA50[i]), r_(I.EMA55[i]), r_(I.EMA80[i]), r_(I.EMA147[i]), r_(I.EMA200[i]), r_(I.EMA365[i]),
      r_(I.SMA90[i]), r_(I.SMA140[i]), r_(I.SMA155[i]), r_(I.SMA200[i]), r_(I.SMA350[i]),
      r_(I.BMSB_Topo[i]), r_(I.BMSB_Base[i]), r_(I.BMSB_Spread[i], 3), I.Preco_vs_BMSB[i],
      r_(I.MACD[i]), r_(I.MACD_Sinal[i]), r_(I.MACD_Hist[i]), r_(I.RSI14[i]), r_(I.ATR14[i]),
      r_(I.BB_Meio[i]), r_(I.BB_Sup2[i]), r_(I.BB_Inf2[i]), r_(I.BB_Sup25[i]), r_(I.BB_Inf25[i]),
      r_(I.Vol30[i]), r_(I.Vol90[i]), r_(I.Z9[i], 3), r_(I.Z21[i], 3), r_(I.Z30[i], 3), r_(I.Z90[i], 3),
    ]);
  }
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, COLS_IND.length).clearContent();
  sh.getRange(2, 1, rows.length, 1).setNumberFormat('@');
  sh.getRange(2, 1, rows.length, COLS_IND.length).setValues(rows);
}

/* =============================================================================
 * 7. ESTRATEGIAS_1D + CONSENSO ALGORÍTMICO
 * ===========================================================================*/
function rodarEstrategias_(o) {
  return ESTRATEGIAS.map(function (e) {
    let r;
    try { r = runBacktest_(o, e.fn(o)); } catch (err) { r = { erro: err.message, posAtual: 0 }; }
    r.id = e.id; r.key = e.key; r.nome = e.nome; r.ativa = e.ativa; r.grupo = e.grupo;
    return r;
  });
}
const COLS_ESTR = ['ID', 'Grupo', 'Estrategia', 'Ativa_Consenso', 'Posicao_Atual (1/0)', 'Status', 'Evento_Ultima_Vela', 'Preco_Entrada',
  'Stop_Loss_Atual', 'Lucro_Trade_Aberto_pct', 'Lucro_Acumulado_pct', 'N_Trades', 'Win_Rate_pct', 'Sharpe_Janela', 'Peso_Consenso_pct', 'Data_Ultima_Vela'];
function gravarEstrategias_(o, res, zstats) {
  const sh = ss_().getSheetByName(P2.ABAS.estr), data = Utilities.formatDate(o.dates[o.dates.length - 1], 'UTC', 'yyyy-MM-dd');
  const somaPeso = res.reduce(function (a, r) { return a + (r.ativa && !r.erro ? r.peso || 0 : 0); }, 0);
  const rows = res.map(function (r) {
    return [r.id, r.grupo, r.nome, r.ativa ? 'SIM' : 'NÃO', r.posAtual, r.posAtual === 1 ? 'COMPRADO' : 'CAIXA', r.evento || (r.erro ? 'ERRO: ' + r.erro : '—'),
      r.precoEntrada ? r_(r.precoEntrada) : '—', r.stopAtual ? r_(r.stopAtual) : '—',
      r_(r.lucroAbertoPct || 0), r_(r.lucroAcumPct || 0), r.nTrades || 0,
      r.winRate === null || r.winRate === undefined ? 'N/D (N=' + (r.nTrades || 0) + ')' : r_(r.winRate),
      r_(r.sharpe || 0), somaPeso > 0 && r.ativa ? r_((r.peso || 0) / somaPeso * 100, 1) : 0, data];
  });
  sh.clear();
  sh.getRange(1, 1, 1, COLS_ESTR.length).setValues([COLS_ESTR]).setFontWeight('bold').setBackground('#0b1f3a').setFontColor('#ffffff').setWrap(true);
  sh.getRange(2, 1, rows.length, COLS_ESTR.length).setValues(rows);
  rows.forEach(function (r, i) { sh.getRange(i + 2, 5, 1, 2).setBackground(r[4] === 1 ? '#d9ead3' : '#f4cccc'); });
  sh.setFrozenRows(1); sh.setColumnWidth(3, 330);
  if (zstats) gravarTabelaZonas_(sh, rows.length + 4, zstats);
}

/**
 * CONSENSO ALGORÍTMICO PROPRIETÁRIO (v2)
 *  - Cada componente vota 1 (exposto) ou 0 (caixa).
 *  - Peso = Sharpe da janela recente (teto 3, negativos = 0) x confiabilidade amostral.
 *    Componentes sem desempenho recente não "votam" com o mesmo peso dos robustos.
 *  - Índice de Exposição Tática = soma(peso x voto) / soma(peso).
 *  - Faixas simétricas: >=75 Favorável | 60-75 Moderadamente Favorável | 40-60 Neutro |
 *    25-40 Moderadamente Defensivo | <25 Defensivo.
 */
function consenso_(res) {
  const at = res.filter(function (r) { return r.ativa && !r.erro; });
  const sp = at.reduce(function (a, r) { return a + r.peso; }, 0);
  const pond = sp > 0 ? at.reduce(function (a, r) { return a + r.peso * r.posAtual; }, 0) / sp * 100 : 0;
  const bruto = at.length ? at.filter(function (r) { return r.posAtual === 1; }).length / at.length * 100 : 0;
  // Mistura CONTÍNUA: lambda = soma dos pesos / referência (limitada a 1). Com pouco peso total o
  // resultado tende ao voto simples; com peso suficiente é 100% ponderado. Sem salto de metodologia.
  const ref = cfgNum_('CONSENSO_PESO_REF');
  const lambda = sp > 0 ? (ref > 0 ? Math.min(1, sp / ref) : 1) : 0;
  const pct = lambda * pond + (1 - lambda) * bruto;
  const modo = lambda >= 1 ? 'PONDERADO' : lambda <= 0 ? 'VOTO SIMPLES' : 'MISTO (' + Math.round(lambda * 100) + '% ponderado)';
  const leitura = pct >= 75 ? 'FAVORÁVEL' : pct >= 60 ? 'MODERADAMENTE FAVORÁVEL' : pct >= 40 ? 'NEUTRO'
    : pct >= 25 ? 'MODERADAMENTE DEFENSIVO' : 'DEFENSIVO';
  return { pct: pct, defensivo: 100 - pct, bruto: bruto, leitura: leitura, n: at.length, modo: modo, lambda: lambda, somaPesos: sp,
    comprados: at.filter(function (r) { return r.posAtual === 1; }).length,
    comPeso: at.filter(function (r) { return r.peso > 0; }).length };
}

/**
 * TERMÔMETRO QUANTITATIVO DE RISCO (v2) — mede ESTICAMENTO / risco de correção, não direção.
 * Cada componente vira percentil (0-100) comparado SOMENTE com dias do MESMO regime
 * (preço acima/abaixo da SMA200) nos últimos 4 anos. Assim, estar 19% acima da SMA155
 * numa alta é "normal" (percentil ~50), e só pontua alto o que é extremo PARA AQUELE regime.
 */
function termometro_(o, I, der) {
  const C = o.closes, L = C.length - 1, ini = Math.max(400, L - 1460);
  const regime = function (k) { return C[k] > I.SMA200[k]; };
  // Cada medida pertence a uma FAMÍLIA; a nota final é a média das famílias disponíveis, assim
  // as três medidas de esticamento de preço (dist155, mayer, %B) pesam como UMA só dimensão.
  const serie = {
    dist155: { f: 'preco', fn: function (k) { return C[k] / I.SMA155[k]; } },
    mayer: { f: 'preco', fn: function (k) { return C[k] / I.SMA200[k]; } },
    pctB: { f: 'preco', fn: function (k) { return (C[k] - I.BB_Inf2[k]) / (I.BB_Sup2[k] - I.BB_Inf2[k]); } },
    rsi: { f: 'momentum', fn: function (k) { return I.RSI14[k]; } },
    vol: { f: 'volatilidade', fn: function (k) { return I.Z30[k]; } },   // Z30 é do retorno COM sinal: alto = alta atípica (risco), baixo = queda atípica
  };
  const fam = { preco: [], momentum: [], volatilidade: [], sentimento: [], derivativos: [] };
  Object.keys(serie).forEach(function (nm) {
    const atual = serie[nm].fn(L); if (!isFinite(atual)) return;
    let abaixo = 0, tot = 0;
    for (let k = ini; k < L; k++) {
      if (regime(k) !== regime(L)) continue;
      const v = serie[nm].fn(k); if (!isFinite(v)) continue;
      tot++; if (v < atual) abaixo++;
    }
    if (tot >= 60) fam[serie[nm].f].push(abaixo / tot * 100);
  });
  if (der && der.fg !== null) fam.sentimento.push(der.fg);
  if (der && der.funding !== null) fam.derivativos.push(Math.max(0, Math.min(100, 50 + der.funding / 0.0005 * 40)));
  const notas = Object.keys(fam).filter(function (k) { return fam[k].length; }).map(function (k) {
    return fam[k].reduce(function (a, b) { return a + b; }, 0) / fam[k].length;
  });
  const v = notas.length ? notas.reduce(function (a, b) { return a + b; }, 0) / notas.length : 50;
  const f = v >= 85 ? ['MUITO ESTICADO', 'Postura de referência: evitar novas compras e alavancagem; avaliar realização parcial e manter proteções.']
    : v >= 70 ? ['ESTICADO', 'Postura de referência: aportar aos poucos (escalonado), sem alavancagem e sem perseguir preço.']
    : v >= 30 ? ['NEUTRO', 'Postura de referência: seguir o plano de aportes normal; sem excesso de preço nem de pessimismo.']
    : v >= 15 ? ['DESCONTADO', 'Postura de referência: ambiente favorável a acumular, de forma escalonada e sem alavancagem.']
    : ['MUITO DESCONTADO', 'Postura de referência: janela histórica de acumulação (medo extremo); aportar em partes e sem alavancagem.'];
  return { valor: Math.round(v), faixa: f[0], acao: f[1], regime: regime(L) ? 'ALTA (preço > SMA200)' : 'BAIXA (preço < SMA200)',
    familias: notas.length, cobertura: notas.length + '/5 famílias' + (notas.length < 5 ? ' (parcial: sem ' + Object.keys(fam).filter(function (k) { return !fam[k].length; }).join(', ') + ')' : '') };
}

/* =============================================================================
 * 7B. ZONAS DE LIQUIDEZ — geradores objetivos + validação por backtest
 *  Geradores (todos usam apenas dados até a vela i — sem look-ahead):
 *   LIQ   : clusters de liquidação estimados de alavancados (25x/50x/100x) abertos
 *           nos últimos 30 fechamentos, ponderados por volume, ainda NÃO liquidados.
 *           Compra = liquidações de comprados abaixo; Venda = de vendidos acima.
 *   HVN   : nós de alto volume (volume profile 365d, faixas de 1%).
 *   PIVO  : pivôs (fractal 5) não rompidos em 180d; liquidez de stops logo além do pivô.
 *   RSI   : em tendência de alta, faixa de preço que leva o RSI14 a 40-50 (compra);
 *           faixa que leva a 70-80 (venda).
 *   MEDIAS: faixa SMA140/EMA147/SMA155 (suporte de ciclo).
 *   BB    : 2σ-2,5σ das Bandas de Bollinger 20.
 *   MAYER : 0,8-1,0x (compra) e 2,0-2,4x (venda) da SMA200.
 *  Validação: a cada 3 velas mede-se a zona; se o preço a toca em até W dias,
 *  simula-se entrada no toque e mede-se o retorno H dias depois. Critério validado =
 *  amostras >= mínimo, taxa de acerto >= mínimo e retorno médio melhor que o
 *  retorno incondicional de H dias (o "acaso").
 * ===========================================================================*/
const TIPOS_ZONA = ['LIQ', 'HVN', 'PIVO', 'RSI', 'MEDIAS', 'BB', 'MAYER'];

function prepararZonas_(o) {
  const C = o.closes, rf = rsiFull_(C, 14), m20 = sma(C, 20), sd20 = stdevPop_(C, 20);
  return { atr: atrWilder(o.highs, o.lows, C, 14), g: rf.avgGain, l: rf.avgLoss, rsi: rf.rsi,
    s200: sma(C, 200), s140: sma(C, 140), e147: ema(C, 147), s155: sma(C, 155), m20: m20, sd20: sd20 };
}
function cluster_(pts, passo) {
  if (!pts.length) return null;
  const bins = {};
  pts.forEach(function (p) { const k = Math.floor(Math.log(p.p) / passo); bins[k] = (bins[k] || 0) + p.w; });
  let kMax = null; Object.keys(bins).forEach(function (k) { if (kMax === null || bins[k] > bins[kMax]) kMax = k; });
  kMax = parseInt(kMax, 10); let a = kMax, b = kMax;
  while (bins[a - 1] >= 0.4 * bins[kMax]) a--;
  while (bins[b + 1] >= 0.4 * bins[kMax]) b++;
  return { lo: Math.exp(a * passo), hi: Math.exp((b + 1) * passo) };
}
function gerarZonas_(o, Z, i) {
  const C = o.closes, H = o.highs, Lw = o.lows, V = o.volumes, c = C[i], atr = Z.atr[i], out = { c: [], v: [] };
  if (!(atr > 0)) return out;
  const add = function (lado, t, lo, hi) {
    if (!isFinite(lo) || !isFinite(hi) || hi <= lo) return;
    // Largura máxima 3%, ancorada na borda mais próxima do preço (mesma regra no backtest e na exibição)
    if (hi / lo - 1 > 0.03) { if (lado === 'c') lo = hi / 1.03; else hi = lo * 1.03; }
    if (lado === 'c' && hi < c) out.c.push({ t: t, lo: lo, hi: hi });
    if (lado === 'v' && lo > c) out.v.push({ t: t, lo: lo, hi: hi });
  };
  // LIQ — liquidações estimadas ainda vivas
  const minAte = {}, maxAte = {}; let mn = Infinity, mx = -Infinity;
  for (let k = i; k >= Math.max(1, i - 30); k--) { minAte[k] = mn; maxAte[k] = mx; mn = Math.min(mn, Lw[k]); mx = Math.max(mx, H[k]); }
  const pl = [], ps = [];
  for (let j = Math.max(1, i - 29); j <= i; j++) {
    const w = V[j] || 1;
    [25, 50, 100].forEach(function (lev) {
      const ll = C[j] * (1 - 1 / lev + 0.004), ls = C[j] * (1 + 1 / lev - 0.004);
      if (ll < c && ll < minAte[j]) pl.push({ p: ll, w: w });
      if (ls > c && ls > maxAte[j]) ps.push({ p: ls, w: w });
    });
  }
  const zl = cluster_(pl, 0.005), zs = cluster_(ps, 0.005);
  if (zl) add('c', 'LIQ', zl.lo, zl.hi);
  if (zs) add('v', 'LIQ', zs.lo, zs.hi);
  // HVN — volume profile 365d
  if (i >= 365) {
    const vp = {}, passo = 0.01;
    for (let k = i - 364; k <= i; k++) { const kk = Math.floor(Math.log((H[k] + Lw[k] + C[k]) / 3) / passo); vp[kk] = (vp[kk] || 0) + (V[k] || 0); }
    const ks = Object.keys(vp).map(Number).sort(function (a, b) { return a - b; });
    const vals = ks.map(function (k) { return vp[k]; }).filter(function (x) { return x > 0; }).sort(function (a, b) { return a - b; });
    const med = vals.length ? vals[Math.floor(vals.length / 2)] : 0, kc = Math.floor(Math.log(c) / passo);
    let kb = null, ka = null;
    ks.forEach(function (k) {
      const ok = vp[k] >= 1.5 * med && vp[k] >= (vp[k - 1] || 0) && vp[k] >= (vp[k + 1] || 0);
      if (!ok) return;
      if (k < kc && (kb === null || k > kb)) kb = k;
      if (k > kc && (ka === null || k < ka)) ka = k;
    });
    if (kb !== null) add('c', 'HVN', Math.exp(kb * passo), Math.exp((kb + 1) * passo));
    if (ka !== null) add('v', 'HVN', Math.exp(ka * passo), Math.exp((ka + 1) * passo));
  }
  // PIVO — pivôs não rompidos (fechamento) em 180d
  let pivL = null, pivH = null;
  for (let j = Math.max(5, i - 180); j <= i - 5; j++) {
    let isL = true, isH = true;
    for (let k = j - 5; k <= j + 5; k++) { if (Lw[k] < Lw[j]) isL = false; if (H[k] > H[j]) isH = false; }
    if (!isL && !isH) continue;
    let rompL = false, rompH = false;
    for (let k = j + 1; k <= i; k++) { if (C[k] < Lw[j]) rompL = true; if (C[k] > H[j]) rompH = true; }
    if (isL && !rompL && Lw[j] < c && (pivL === null || Lw[j] > pivL)) pivL = Lw[j];
    if (isH && !rompH && H[j] > c && (pivH === null || H[j] < pivH)) pivH = H[j];
  }
  if (pivL !== null) add('c', 'PIVO', pivL - 0.5 * atr, Math.min(c * 0.999, pivL + 0.15 * atr));
  if (pivH !== null) add('v', 'PIVO', Math.max(c * 1.001, pivH - 0.15 * atr), pivH + 0.5 * atr);
  // RSI
  if (isFinite(Z.g[i]) && isFinite(Z.l[i])) {
    if (c > Z.s200[i] && Z.rsi[i] > 50) add('c', 'RSI', precoParaRsi_(c, Z.g[i], Z.l[i], 40, 14), precoParaRsi_(c, Z.g[i], Z.l[i], 50, 14));
    if (Z.rsi[i] < 70) add('v', 'RSI', precoParaRsi_(c, Z.g[i], Z.l[i], 70, 14), precoParaRsi_(c, Z.g[i], Z.l[i], 80, 14));
  }
  // MEDIAS de ciclo
  const ms = [Z.s140[i], Z.e147[i], Z.s155[i]];
  if (ms.every(isFinite)) add('c', 'MEDIAS', Math.min.apply(null, ms), Math.max.apply(null, ms));
  // BB
  if (isFinite(Z.sd20[i])) {
    add('c', 'BB', Z.m20[i] - 2.5 * Z.sd20[i], Z.m20[i] - 2 * Z.sd20[i]);
    add('v', 'BB', Z.m20[i] + 2 * Z.sd20[i], Z.m20[i] + 2.5 * Z.sd20[i]);
  }
  // MAYER
  if (isFinite(Z.s200[i])) { add('c', 'MAYER', 0.8 * Z.s200[i], 1.0 * Z.s200[i]); add('v', 'MAYER', 2.0 * Z.s200[i], 2.4 * Z.s200[i]); }
  return out;
}

/** Backtest dos critérios de zona. Retorna estatísticas por tipo e lado. */
function backtestZonas_(o) {
  const Z = prepararZonas_(o), C = o.closes, O = o.opens, n = C.length;
  const Hh = cfgNum_('ZONA_HORIZONTE_DIAS'), W = cfgNum_('ZONA_JANELA_TOQUE_DIAS');
  const acc = {}; TIPOS_ZONA.forEach(function (t) { acc[t] = { c: { n: 0, win: 0, ret: 0, def: 0, ult: -1e9 }, v: { n: 0, win: 0, ret: 0, def: 0, ult: -1e9 } }; });
  for (let t = 400; t < n - 1 - Hh - W; t += 3) {
    const zs = gerarZonas_(o, Z, t);
    zs.c.forEach(function (z) {
      for (let j = t + 1; j <= t + W; j++) {
        if (o.lows[j] > z.hi) continue;
        const a = acc[z.t].c;
        if (Math.abs(j - a.ult) < Hh) break;   // toque independente: retornos de Hh dias não podem se sobrepor
        a.ult = j;
        const e = Math.min(O[j], z.hi), ret = C[j + Hh] / e - 1;
        a.n++; a.ret += ret; if (ret > 0) a.win++; if (C[Math.min(j + 5, n - 1)] >= z.lo) a.def++;
        break;
      }
    });
    zs.v.forEach(function (z) {
      for (let j = t + 1; j <= t + W; j++) {
        if (o.highs[j] < z.lo) continue;
        const a = acc[z.t].v;
        if (Math.abs(j - a.ult) < Hh) break;
        a.ult = j;
        const e = Math.max(O[j], z.lo), ret = C[j + Hh] / e - 1;
        a.n++; a.ret += ret; if (ret < 0) a.win++; if (C[Math.min(j + 5, n - 1)] <= z.hi) a.def++;
        break;
      }
    });
  }
  let bs = 0, bn = 0, bup = 0;
  for (let k = 400; k < n - Hh; k++) { const rr = C[k + Hh] / C[k] - 1; bs += rr; bn++; if (rr > 0) bup++; }
  const pUp = bn ? bup / bn : 0.5;   // taxa de acerto "ao acaso": compra acerta quando sobe; venda quando cai
  const base = bn ? bs / bn * 100 : 0, minN = cfgNum_('ZONA_MIN_AMOSTRAS');
  const stats = { base: r_(base, 2), horizonte: Hh, tipos: {} };
  TIPOS_ZONA.forEach(function (t) {
    stats.tipos[t] = {};
    ['c', 'v'].forEach(function (l) {
      const a = acc[t][l], ac = a.n ? a.win / a.n * 100 : 0, rm = a.n ? a.ret / a.n * 100 : 0;
      const p0 = l === 'c' ? pUp : 1 - pUp, z = a.n ? (a.win / a.n - p0) / Math.sqrt(p0 * (1 - p0) / a.n) : 0;
      const valid = a.n >= minN && z >= cfgNum_('ZONA_Z_MIN') && (l === 'c' ? ac >= cfgNum_('ZONA_MIN_ACERTO_COMPRA') && rm > base : ac >= cfgNum_('ZONA_MIN_ACERTO_VENDA') && rm < base);
      stats.tipos[t][l] = { n: a.n, acerto: r_(ac, 1), ret: r_(rm, 2), defesa: a.n ? r_(a.def / a.n * 100, 1) : 0, z: r_(z, 2), valid: valid };
    });
  });
  PropertiesService.getScriptProperties().setProperty('ZONAS_STATS', JSON.stringify(stats));
  return stats;
}
function statsZonas_() {
  const s = PropertiesService.getScriptProperties().getProperty('ZONAS_STATS');
  return s ? JSON.parse(s) : null;
}

/** Zonas atuais: só critérios validados; zonas sobrepostas são fundidas (confluência). */
function zonas_(o, stats) {
  const L = o.closes.length - 1, C = o.closes[L], z = gerarZonas_(o, prepararZonas_(o), L);
  const montar = function (lista, lado) {
    const st = function (t) { return stats && stats.tipos[t] ? stats.tipos[t][lado] : null; };
    let cand = lista.map(function (x) {
      const s = st(x.t);
      return { lo: x.lo, hi: x.hi, tipos: [x.t], valid: !!(s && s.valid), acerto: s ? s.acerto : 0, n: s ? s.n : 0 };
    });
    const dmax = cfgNum_('ZONA_DIST_MAX_PCT');
    cand = cand.filter(function (x) { return Math.abs((lado === 'c' ? x.hi / C - 1 : x.lo / C - 1) * 100) <= dmax; });
    const ok = cand.filter(function (x) { return x.valid; });
    cand = ok.length >= 3 ? ok : ok.concat(cand.filter(function (x) { return !x.valid; }));
    cand.sort(function (a, b) { return lado === 'c' ? b.hi - a.hi : a.lo - b.lo; });
    const fund = [];
    cand.forEach(function (x) {
      const u = fund[fund.length - 1];
      // Funde só confluência real: sobreposição >= 50% da menor faixa e resultado <= 5% de largura
      const sobre = u ? Math.min(u.hi, x.hi) - Math.max(u.lo, x.lo) : -1;
      const menor = u ? Math.min(u.hi - u.lo, x.hi - x.lo) : 1;
      if (u && x.valid === u.valid && sobre >= 0.5 * menor && Math.max(u.hi, x.hi) / Math.min(u.lo, x.lo) - 1 <= 0.05) {
        u.lo = Math.min(u.lo, x.lo); u.hi = Math.max(u.hi, x.hi); u.tipos = u.tipos.concat(x.tipos);
        u.acerto = Math.max(u.acerto, x.acerto); u.n += x.n;
      } else fund.push(x);
    });
    return fund.slice(0, 3).map(function (x, k) {
      const dist = lado === 'c' ? (x.hi / C - 1) * 100 : (x.lo / C - 1) * 100;
      let status;
      if (C >= x.lo && C <= x.hi) status = 'ATIVA (preço na zona)';
      else if (Math.abs(dist) <= 3) status = 'PRÓXIMA (≤3%)';
      else status = lado === 'c' ? 'AGUARDANDO' : 'DISTANTE';
      return { nome: (lado === 'c' ? 'Zona de Aporte ' : 'Zona de Venda ') + (k + 1), lo: x.lo, hi: x.hi, distPct: dist, status: status,
        acerto: x.acerto, n: x.n, confluencia: x.tipos.length, tipos: x.tipos.join('+'), validado: x.valid };
    });
  };
  return { aporte: montar(z.c, 'c'), venda: montar(z.v, 'v') };
}
function gravarTabelaZonas_(sh, linha, stats) {
  const cab = [['BACKTEST DE ZONAS DE LIQUIDEZ (uso interno) — horizonte ' + stats.horizonte + 'd · retorno incondicional ' + stats.base + '% · toques independentes · z mín. ' + cfgNum_('ZONA_Z_MIN'), '', '', '', '', '', '', ''],
    ['Critério', 'Lado', 'Toques indep. (N)', 'Acerto_pct', 'Retorno_medio_pct', 'Defesa_5d_pct', 'Z_vs_acaso', 'Validado']];
  const rows = [];
  TIPOS_ZONA.forEach(function (t) {
    ['c', 'v'].forEach(function (l) {
      const s = stats.tipos[t][l];
      if (s.n || l === 'c') rows.push([t, l === 'c' ? 'COMPRA' : 'VENDA', s.n, s.acerto, s.ret, s.defesa, s.z, s.valid ? 'SIM' : 'NÃO']);
    });
  });
  const all = cab.concat(rows);
  sh.getRange(linha, 1, all.length, 8).setValues(all);
  sh.getRange(linha, 1, 1, 8).setFontWeight('bold').setBackground('#081428').setFontColor('#f5c542');
  sh.getRange(linha + 1, 1, 1, 8).setFontWeight('bold').setBackground('#0b1f3a').setFontColor('#ffffff');
  rows.forEach(function (r, i) { sh.getRange(linha + 2 + i, 8).setBackground(r[7] === 'SIM' ? '#d9ead3' : '#f4cccc'); });
}

/* =============================================================================
 * 8. ONCHAIN_DERIVATIVOS (OKX -> Bybit -> Binance; Fear & Greed; Aave V3)
 * ===========================================================================*/
function lerDerivativos_() {
  const d = { funding: null, fundingFonte: '', oiBtc: null, oiUsd: null, oiFonte: '', fg: null, fgClass: '', spot: null, var24h: null, vol24hUsd: null };
  try {
    const f = fetchJson_('https://www.okx.com/api/v5/public/funding-rate?instId=BTC-USDT-SWAP');
    d.funding = parseFloat(f.data[0].fundingRate); d.fundingFonte = 'OKX';
  } catch (e) {
    try { const b = fetchJson_('https://api.bybit.com/v5/market/tickers?category=linear&symbol=BTCUSDT'); d.funding = parseFloat(b.result.list[0].fundingRate); d.fundingFonte = 'Bybit'; }
    catch (e2) { try { d.funding = parseFloat(fetchJson_('https://fapi.binance.com/fapi/v1/premiumIndex?symbol=BTCUSDT').lastFundingRate); d.fundingFonte = 'Binance'; } catch (e3) {} }
  }
  try {
    const oi = fetchJson_('https://www.okx.com/api/v5/public/open-interest?instType=SWAP&instId=BTC-USDT-SWAP').data[0];
    d.oiBtc = parseFloat(oi.oiCcy); d.oiUsd = parseFloat(oi.oiUsd); d.oiFonte = 'OKX';
  } catch (e) {
    try { const b = fetchJson_('https://api.bybit.com/v5/market/tickers?category=linear&symbol=BTCUSDT').result.list[0]; d.oiBtc = parseFloat(b.openInterest); d.oiUsd = parseFloat(b.openInterestValue); d.oiFonte = 'Bybit'; }
    catch (e2) {}
  }
  try {
    const g = fetchJson_('https://api.alternative.me/fng/?limit=1').data[0];
    d.fg = parseInt(g.value, 10); d.fgClass = g.value_classification;
  } catch (e) {}
  try {
    const t = fetchJson_('https://www.okx.com/api/v5/market/ticker?instId=BTC-USDT').data[0];
    d.spot = parseFloat(t.last); d.var24h = (d.spot / parseFloat(t.open24h) - 1) * 100; d.vol24hUsd = parseFloat(t.volCcy24h);
  } catch (e) {
    try {
      const s = fetchJson_('https://api.exchange.coinbase.com/products/BTC-USD/stats');
      d.spot = parseFloat(s.last); d.var24h = (d.spot / parseFloat(s.open) - 1) * 100; d.vol24hUsd = parseFloat(s.volume) * d.spot;
    } catch (e2) {}
  }
  if (d.oiUsd === null && d.oiBtc !== null && d.spot) d.oiUsd = d.oiBtc * d.spot;
  return d;
}
/** Carteira monitorada: guardada em Propriedades do Script (nunca no código nem na CONFIG). */
function carteiraAave_() {
  const a = PropertiesService.getScriptProperties().getProperty('AAVE_CARTEIRA');
  return a && /^0x[0-9a-fA-F]{40}$/.test(a) ? a : null;
}
/** Menu A: grava (ou apaga, se vazio) o endereço da carteira. Uso exclusivo da planilha. */
function configurarCarteiraAave() {
  const ui = SpreadsheetApp.getUi();
  const r = ui.prompt('Carteira para o monitor Aave (somente aba ONCHAIN_DERIVATIVOS)', 'Endereço 0x... (deixe vazio para apagar):', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  const v = String(r.getResponseText() || '').trim(), props = PropertiesService.getScriptProperties();
  if (!v) { props.deleteProperty('AAVE_CARTEIRA'); safeToast_('Carteira Aave removida.'); return; }
  if (!/^0x[0-9a-fA-F]{40}$/.test(v)) { ui.alert('Endereço inválido: use 0x seguido de 40 caracteres hexadecimais.'); return; }
  props.setProperty('AAVE_CARTEIRA', v);
  safeToast_('Carteira Aave gravada nas Propriedades do Script. Ative AAVE_MONITORAR=SIM na CONFIG_SISTEMA para usar.');
}
function lerAave_(spot) {
  const carteira = carteiraAave_();
  if (!carteira) { Logger.log('AAVE_MONITORAR=SIM, mas não há carteira configurada (menu A).'); return []; }
  return P2.MERCADOS_AAVE.map(function (m) {
    const data = P2.SELECTOR_HF + carteira.toLowerCase().replace('0x', '').padStart(64, '0');
    const payload = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to: m.pool, data: data }, 'latest'] });
    for (let i = 0; i < m.rpcs.length; i++) {
      try {
        const r = UrlFetchApp.fetch(m.rpcs[i], { method: 'post', contentType: 'application/json', payload: payload, muteHttpExceptions: true });
        if (r.getResponseCode() !== 200) continue;
        const j = JSON.parse(r.getContentText());
        if (j.error || !j.result || j.result.length < 2 + 6 * 64) continue;
        const hex = j.result.slice(2), slot = function (k) { return parseInt(hex.substr(k * 64, 64), 16); };
        const hfRaw = slot(5) / 1e18, hf = (!isFinite(hfRaw) || hfRaw > 1e6) ? 999 : Math.round(hfRaw * 10000) / 10000;
        const col = slot(0) / 1e8, div = slot(1) / 1e8;
        return { rede: m.rede, hf: hf, colateralUsd: col, dividaUsd: div, ltvPct: col > 0 ? div / col * 100 : 0,
          precoLiq: hf > 0 && hf < 999 && spot ? spot / hf : null };
      } catch (e) {}
    }
    return { rede: m.rede, hf: null };
  });
}
function gravarOnchain_(der, aave) {
  const sh = ss_().getSheetByName(P2.ABAS.onchain);
  const hfs = aave.filter(function (a) { return a.hf !== null && a.hf < 999; }).map(function (a) { return a.hf; });
  const oi24 = variacaoOi24h_(sh, der.oiUsd);
  const row = [new Date(), der.spot, der.funding, der.funding !== null ? r_(der.funding * 3 * 365 * 100, 2) : '', der.fundingFonte,
    der.oiUsd, der.oiBtc, oi24 === null ? '' : r_(oi24, 2), der.oiFonte, der.fg, der.fgClass,
    aave[0] ? aave[0].hf : '', aave[1] ? aave[1].hf : '', hfs.length ? Math.min.apply(null, hfs) : '',
    aave.map(function (a) { return a.rede + ':' + (a.precoLiq ? r_(a.precoLiq, 0) : '—'); }).join(' | ')];
  sh.appendRow(row);
  const excesso = sh.getLastRow() - 1 - P2.MAX_LINHAS_ONCHAIN;
  if (excesso > 0) sh.deleteRows(2, excesso);
  der.oiVar24h = oi24;
  return der;
}
function variacaoOi24h_(sh, oiAtual) {
  if (!oiAtual || sh.getLastRow() < 3) return null;
  const n = Math.min(sh.getLastRow() - 1, 60), vals = sh.getRange(sh.getLastRow() - n + 1, 1, n, 6).getValues();
  const alvo = Date.now() - 24 * 3600000;
  let melhor = null;
  vals.forEach(function (r) {
    if (!(r[0] instanceof Date) || !(r[5] > 0)) return;
    const dt = Math.abs(r[0].getTime() - alvo);
    if (r[0].getTime() <= alvo + 3600000 && (melhor === null || dt < melhor.dt)) melhor = { dt: dt, oi: r[5] };
  });
  return melhor && melhor.dt < 6 * 3600000 ? (oiAtual / melhor.oi - 1) * 100 : null;
}

/* =============================================================================
 * 9. DETECÇÃO DE ANOMALIAS (sempre gráfico DIÁRIO — vela fechada)
 *    'interno' = gatilho técnico (só LOG). 'cliente' = texto neutro (milagre sem santo).
 * ===========================================================================*/
function detectarEventos_(o, I, res, der) {
  const ev = [], L = o.closes.length - 1, P = L - 1, C = o.closes, dia = Utilities.formatDate(o.dates[L], 'UTC', 'yyyy-MM-dd');
  const add = function (tipo, interno, titulo, texto, vies, urg) { ev.push({ tipo: tipo, interno: interno, titulo: titulo, texto: texto, vies: vies, urgencia: urg, ref: dia }); };
  const cruz = function (serie, nomeInt, horizonte, tipoBase) {
    const a = serie[P], b = serie[L];
    if (isNaN(a) || isNaN(b)) return;
    if (C[P] <= a && C[L] > b) add(tipoBase + '_ALTA', 'Close cruzou p/ cima ' + nomeInt, 'Transição Estrutural de ' + horizonte, 'Rompimento altista de uma referência estrutural de ' + horizonte.toLowerCase() + ' no fechamento diário.', 'ALTISTA', 'ATENÇÃO');
    if (C[P] >= a && C[L] < b) add(tipoBase + '_BAIXA', 'Close cruzou p/ baixo ' + nomeInt, 'Transição Estrutural de ' + horizonte, 'Perda de uma referência estrutural de ' + horizonte.toLowerCase() + ' no fechamento diário.', 'BAIXISTA', 'URGENTE');
  };
  // 1. Price action & volatilidade
  const lim = cfgNum_('ZSCORE_LIMIAR');
  const janelas = String(cfg_('ZSCORE_JANELAS')).split(',').map(function (x) { return parseInt(x, 10); }).filter(function (x) { return [9, 21, 30, 90].indexOf(x) >= 0; });
  const zHit = janelas.filter(function (N) { return Math.abs(I['Z' + N][L]) >= lim; });
  if (zHit.length) {
    const faixa = janelas.map(function (N) { return lim * I['SD' + N][L - 1] + I['MU' + N][L - 1]; }).filter(isFinite);
    add('VOL_SPIKE_' + (I.RET[L] > 0 ? 'ALTA' : 'BAIXA'), '|Z| >= ' + lim + ' nas janelas ' + zHit.join('/') + 'd (Z' + zHit[0] + '=' + r_(I['Z' + zHit[0]][L], 2) + ')',
      'Anomalia de Volatilidade Diária', 'Retorno de ' + r_(I.RET[L], 2) + '% em 24h — movimento estatisticamente atípico (≥ ' + lim.toFixed(1) + 'σ; limiar típico de ±' + r_(Math.min.apply(null, faixa), 1) + '% a ±' + r_(Math.max.apply(null, faixa), 1) + '%).',
      I.RET[L] > 0 ? 'ALTISTA' : 'BAIXISTA', 'URGENTE');
  }
  if (C[L] > I.BB_Sup25[L]) add('BB25_SUP', 'Close > BB(20; 2,5σ)', 'Esticamento Estatístico Extremo', 'Fechamento diário acima do envelope estatístico extremo — probabilidade elevada de reversão à média ou consolidação.', 'EUFORIA', 'ATENÇÃO');
  if (C[L] < I.BB_Inf25[L]) add('BB25_INF', 'Close < BB(20; 2,5σ)', 'Esticamento Estatístico Extremo', 'Fechamento diário abaixo do envelope estatístico extremo — capitulação de curto prazo em curso.', 'CAPITULAÇÃO', 'URGENTE');
  // 2. Indicadores lentos
  cruz(I.SMA90, 'SMA90', 'Médio Prazo', 'CRUZ_SMA90');
  cruz(I.SMA155, 'SMA155 (STH-RP)', 'Ciclo de Médio Prazo', 'CRUZ_SMA155');
  cruz(I.BMSB_Topo, 'BMSB topo', 'Suporte de Mercado em Alta', 'CRUZ_BMSB_TOPO');
  cruz(I.BMSB_Base, 'BMSB base', 'Suporte de Mercado em Alta', 'CRUZ_BMSB_BASE');
  cruz(I.EMA200, 'EMA200', 'Ciclo Plurianual', 'CRUZ_EMA200');
  cruz(I.EMA365, 'EMA365', 'Ciclo Plurianual', 'CRUZ_EMA365');
  if (!isNaN(I.SMA140[P]) && !isNaN(I.EMA147[P])) {
    const s0 = I.SMA140[P] - I.EMA147[P], s1 = I.SMA140[L] - I.EMA147[L];
    if (s0 <= 0 && s1 > 0) add('BMSB_INTERNO_ALTA', 'SMA140 cruzou p/ cima EMA147', 'Reconfiguração de Suporte Estrutural', 'Reconfiguração interna da faixa de suporte estrutural com viés construtivo.', 'ALTISTA', 'ATENÇÃO');
    if (s0 >= 0 && s1 < 0) add('BMSB_INTERNO_BAIXA', 'SMA140 cruzou p/ baixo EMA147', 'Reconfiguração de Suporte Estrutural', 'Reconfiguração interna da faixa de suporte estrutural com viés de deterioração.', 'BAIXISTA', 'ATENÇÃO');
  }
  if (!isNaN(I.EMA6[P]) && !isNaN(I.EMA55[P])) {
    if (I.EMA6[P] <= I.EMA55[P] && I.EMA6[L] > I.EMA55[L]) add('CRUZ_RAPIDO_ALTA', 'EMA6 x EMA55 p/ cima', 'Inflexão de Momentum de Curto Prazo', 'Inflexão positiva de momentum de curto prazo no diário.', 'ALTISTA', 'ATENÇÃO');
    if (I.EMA6[P] >= I.EMA55[P] && I.EMA6[L] < I.EMA55[L]) add('CRUZ_RAPIDO_BAIXA', 'EMA6 x EMA55 p/ baixo', 'Inflexão de Momentum de Curto Prazo', 'Inflexão negativa de momentum de curto prazo no diário.', 'BAIXISTA', 'ATENÇÃO');
  }
  const h = I.MACD_Hist;
  if (!isNaN(h[P]) && !isNaN(h[L]) && Math.sign(h[P]) !== Math.sign(h[L]) && h[L] !== 0) {
    let dur = 0; for (let i = P; i >= 0 && !isNaN(h[i]) && Math.sign(h[i]) === Math.sign(h[P]); i--) dur++;
    if (dur >= cfgNum_('MACD_DIVERGENCIA_MIN_BARRAS')) {
      const alta = h[L] > 0;
      add('MACD_INFLEXAO_' + (alta ? 'ALTA' : 'BAIXA'), 'MACD cruzou sinal após ' + dur + ' barras', 'Inflexão de Momentum de Médio Prazo',
        'Inflexão de momentum após regime prolongado de ' + dur + ' sessões.', alta ? 'ALTISTA' : 'BAIXISTA', 'ATENÇÃO');
    }
  }
  // 3. Derivativos & sentimento
  if (der) {
    if (der.funding !== null && der.funding >= cfgNum_('FUNDING_ALTO'))
      add('FUNDING_ALTO', 'Funding ' + r_(der.funding * 100, 4) + '%', 'Alavancagem Comprada Excessiva', 'Custo de financiamento das posições compradas em ' + r_(der.funding * 100, 4) + '% por 8h (' + r_(der.funding * 1095 * 100, 1) + '% a.a.) — risco elevado de liquidações em cascata (long squeeze).', 'RISCO', 'URGENTE');
    if (der.funding !== null && der.funding <= cfgNum_('FUNDING_BAIXO'))
      add('FUNDING_NEGATIVO', 'Funding ' + r_(der.funding * 100, 4) + '%', 'Pressão Vendida nos Derivativos', 'Financiamento negativo de ' + r_(der.funding * 100, 4) + '% por 8h — mercado de derivativos posicionado vendido (combustível para short squeeze).', 'CONTRÁRIO', 'ATENÇÃO');
    if (der.fg !== null && der.fg <= cfgNum_('FG_MEDO_EXTREMO')) add('FG_MEDO', 'F&G ' + der.fg, 'Sentimento em Medo Extremo', 'Índice de sentimento em ' + der.fg + '/100 (Medo Extremo).', 'CONTRÁRIO', 'ATENÇÃO');
    if (der.fg !== null && der.fg >= cfgNum_('FG_GANANCIA_EXTREMA')) add('FG_GANANCIA', 'F&G ' + der.fg, 'Sentimento em Ganância Extrema', 'Índice de sentimento em ' + der.fg + '/100 (Ganância Extrema).', 'RISCO', 'ATENÇÃO');
    if (der.oiVar24h !== null && der.oiVar24h !== undefined && Math.abs(der.oiVar24h) > cfgNum_('OI_VARIACAO_24H_PCT'))
      add('OI_' + (der.oiVar24h > 0 ? 'EXPANSAO' : 'CONTRACAO'), 'OI 24h ' + r_(der.oiVar24h, 2) + '%', 'Variação Brusca de Posições em Aberto',
        'Posições em aberto em derivativos variaram ' + r_(der.oiVar24h, 1) + '% em 24h' + (der.oiVar24h > 0 ? ' — acúmulo rápido de alavancagem.' : ' — desalavancagem forçada em curso.'), 'RISCO', 'URGENTE');
  }
  // 4. Sinais operacionais (viradas e stops) — agregados, sem nomes
  const viradas = res.filter(function (r) { return r.ativa && r.evento === 'ENTRADA'; }).length;
  const saidas = res.filter(function (r) { return r.ativa && (r.evento === 'SAIDA' || r.evento === 'STOP'); });
  const stops = saidas.filter(function (r) { return r.evento === 'STOP'; }).length;
  if (viradas) add('CONSENSO_COMPRA', viradas + ' entrada(s): ' + res.filter(function (r) { return r.ativa && r.evento === 'ENTRADA'; }).map(function (r) { return r.id; }).join(','),
    'Rotação Positiva no Consenso Algorítmico', 'Componentes do Consenso Algorítmico Proprietário migraram de Caixa para Exposição na abertura da próxima sessão.', 'ALTISTA', 'ATENÇÃO');
  if (saidas.length) add(stops ? 'CONSENSO_STOP' : 'CONSENSO_SAIDA', saidas.length + ' saída(s) (' + stops + ' stop): ' + saidas.map(function (r) { return r.id; }).join(','),
    stops ? 'Acionamento de Proteção de Capital' : 'Rotação Defensiva no Consenso Algorítmico',
    stops ? 'Níveis de proteção de capital foram acionados no Consenso Algorítmico Proprietário.' : 'Componentes do Consenso Algorítmico Proprietário migraram de Exposição para Caixa.', 'BAIXISTA', 'URGENTE');
  return ev;
}

/** Spike intraday: vela em formação (spot vs fechamento anterior) contra desvios históricos. */
function eventoIntradayVela_(o, I, der) {
  if (!cfgSim_('ALERTA_INTRADAY_VELA_ABERTA') || !der || !der.spot) return [];
  const L = o.closes.length - 1, ret = (der.spot / o.closes[L] - 1) * 100, lim = cfgNum_('ZSCORE_LIMIAR');
  const z = (ret - I.MU30[L]) / I.SD30[L];
  if (!isFinite(z) || Math.abs(z) < lim) return [];
  const hoje = Utilities.formatDate(new Date(), 'UTC', 'yyyy-MM-dd');
  return [{ tipo: 'VOL_INTRADAY_' + (ret > 0 ? 'ALTA' : 'BAIXA'), interno: 'Vela aberta Z30=' + r_(z, 2), titulo: 'Anomalia de Volatilidade em Curso',
    texto: 'Variação de ' + r_(ret, 2) + '% na sessão diária em andamento — deslocamento estatisticamente atípico (≥ ' + lim.toFixed(1) + 'σ).', vies: ret > 0 ? 'ALTISTA' : 'BAIXISTA', urgencia: 'URGENTE', ref: hoje }];
}

/* =============================================================================
 * 10. LOG_DISPAROS + DEDUP (MD5 de data + tipo)
 * ===========================================================================*/
function md5_(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, s, Utilities.Charset.UTF_8)
    .map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}
function hashesRecentes_() {
  const sh = ss_().getSheetByName(P2.ABAS.log), set = {};
  if (sh.getLastRow() < 2) return set;
  const n = Math.min(sh.getLastRow() - 1, 500), lim = Date.now() - cfgNum_('JANELA_DEDUP_HORAS') * 3600000;
  sh.getRange(sh.getLastRow() - n + 1, 1, n, 6).getValues().forEach(function (r) {
    const t = r[0] instanceof Date ? r[0].getTime() : Date.parse(r[0]);
    if (t >= lim && String(r[5]).indexOf('ENVIADO') === 0) set[r[4]] = true;
  });
  return set;
}
function logDisparo_(tipo, gatilho, dest, hash, status, efet) {
  ss_().getSheetByName(P2.ABAS.log).appendRow([Utilities.formatDate(new Date(), P2.TZ_BRT, 'yyyy-MM-dd HH:mm:ss'), tipo, gatilho, dest, hash, status, efet]);
}

/* =============================================================================
 * 11. E-MAIL (HTML institucional + disclaimer CVM 19/20)
 * ===========================================================================*/
const DISCLAIMER =
  'Este material possui caráter exclusivamente informativo e educacional, elaborado a partir de modelos quantitativos ' +
  'proprietários, e não constitui oferta, solicitação, recomendação individualizada de investimento, consultoria de valores ' +
  'mobiliários ou análise de valores mobiliários nos termos da Resolução CVM nº 19/2021 (consultoria) e da Resolução CVM nº 20/2021 ' +
  '(analista de valores mobiliários). Criptoativos são ativos de altíssima volatilidade, podendo gerar perdas superiores ao capital ' +
  'investido quando operados com alavancagem. Rentabilidade passada não é garantia de rentabilidade futura. As decisões de investimento ' +
  'são de responsabilidade exclusiva do leitor, que deve avaliar sua situação financeira, objetivos e perfil de risco (suitability).';

function moldura_(titulo, corTag, tag, corpo) {
  return '<div style="font-family:Arial,Helvetica,sans-serif;max-width:680px;margin:auto;color:#1b1b1b">' +
    '<div style="background:#0b1f3a;color:#fff;padding:18px 22px;border-radius:8px 8px 0 0">' +
    '<span style="background:' + corTag + ';color:#fff;font-weight:bold;font-size:12px;padding:4px 10px;border-radius:4px">' + tag + '</span>' +
    '<h2 style="margin:10px 0 0;font-size:20px">' + titulo + '</h2>' +
    '<div style="font-size:12px;opacity:.8;margin-top:4px">MVP Projeto Cripto · Terminal Quantitativo · ' + Utilities.formatDate(new Date(), P2.TZ_BRT, "dd/MM/yyyy HH:mm 'BRT'") + '</div></div>' +
    '<div style="border:1px solid #d6dbe3;border-top:none;padding:20px 22px;border-radius:0 0 8px 8px">' + corpo +
    '<hr style="border:none;border-top:1px solid #e3e6eb;margin:22px 0 12px">' +
    '<p style="font-size:11px;color:#374151;line-height:1.5"><b>Convenção de execução:</b> sinais são apurados no fechamento diário; a entrada de referência é a abertura do próximo candle diário (D+1). Preços e níveis citados são referências do fechamento e a execução real pode divergir por gap e slippage.</p>' +
    '<p style="font-size:10.5px;color:#6b7280;line-height:1.5">' + DISCLAIMER + '</p></div></div>';
}
function tabela_(linhas) {
  return '<table style="width:100%;border-collapse:collapse;font-size:13px">' + linhas.map(function (l, i) {
    return '<tr style="background:' + (i % 2 ? '#f7f9fc' : '#fff') + '"><td style="padding:7px 10px;border-bottom:1px solid #eef0f4;color:#4b5563">' + l[0] +
      '</td><td style="padding:7px 10px;border-bottom:1px solid #eef0f4;text-align:right;font-weight:bold">' + l[1] + '</td></tr>';
  }).join('') + '</table>';
}
function diretriz_(vies) {
  const m = {
    ALTISTA: 'Evitar perseguir preço após movimentos atípicos; escalonar eventual aumento de exposição e manter níveis de proteção definidos previamente.',
    BAIXISTA: 'Priorizar preservação de capital: revisar exposição, reduzir alavancagem e respeitar níveis de proteção. Evitar aumentos de posição até nova estabilização.',
    EUFORIA: 'Ambiente de esticamento: considerar realizações parciais e reforço de proteções; evitar novas entradas alavancadas.',
    CAPITULAÇÃO: 'Ambiente de capitulação: evitar vendas por pânico; aportes, se houver, apenas de forma escalonada e sem alavancagem.',
    RISCO: 'Elevação do risco sistêmico de curto prazo: reduzir alavancagem, revisar margem/garantias e evitar posições excessivamente concentradas.',
    CONTRÁRIO: 'Sentimento extremo costuma anteceder reversões: manter disciplina, evitar decisões emocionais e seguir o plano de alocação.',
  };
  return m[vies] || m.RISCO;
}
function enviar_(assunto, html) {
  const dest = emails_(); let ok = 0; const falhas = [];
  dest.forEach(function (e) {
    try { MailApp.sendEmail({ to: e, subject: assunto, htmlBody: html, name: 'MVP Projeto Cripto · Inteligência Quantitativa' }); ok++; }
    catch (err) { falhas.push(e + ': ' + err.message); }
  });
  return { dest: dest.join(', '), ok: ok, total: dest.length, efet: dest.length ? r_(ok / dest.length * 100, 1) : 0, falhas: falhas };
}

/* =============================================================================
 * 12. DASHBOARD
 * ===========================================================================*/
function zonaLinhas_(lista, rotulo, fmtUsd, pct) {
  if (!lista.length) return [[rotulo, 'nenhuma zona dentro de ' + cfgNum_('ZONA_DIST_MAX_PCT') + '% do preço atual']];
  return lista.map(function (z) {
    return [z.nome, fmtUsd(z.lo) + ' – ' + fmtUsd(z.hi) + '  (' + pct(z.distPct, 1) + ')  ·  ' + z.status +
      '  ·  ' + (z.validado ? 'acerto hist. ' + z.acerto + '% (N=' + z.n + ')' : 'NÃO VALIDADA') + '  ·  ' + z.tipos];
  });
}
function gravarDashboard_(o, I, res, der, aave, cons, termo, zon) {
  const sh = ss_().getSheetByName(P2.ABAS.dash), L = o.closes.length - 1, C = o.closes[L];
  const meta = JSON.parse(PropertiesService.getScriptProperties().getProperty('BASE_META') || '{}');
  const logSh = ss_().getSheetByName(P2.ABAS.log);
  const ult = logSh.getLastRow() > 1 ? logSh.getRange(logSh.getLastRow(), 1, 1, 7).getValues()[0] : ['—', '—', '—', '', '', '—', ''];
  if (ult[0] instanceof Date) ult[0] = Utilities.formatDate(ult[0], P2.TZ_BRT, 'dd/MM/yyyy HH:mm') + ' BRT';   // o Sheets converte o texto do log em Date
  const fmtUsd = function (v) { return v === null || v === undefined || isNaN(v) ? '—' : '$ ' + Number(v).toLocaleString('en-US', { maximumFractionDigits: 0 }); };
  const pct = function (v, d) { return v === null || v === undefined || isNaN(v) ? '—' : r_(v, d || 2) + '%'; };
  const rel = function (nivel) { return isNaN(nivel) ? '—' : fmtUsd(nivel) + '  (' + (C >= nivel ? '▲ preço ' : '▼ preço ') + pct((C / nivel - 1) * 100, 1) + ')'; };
  const blocos = [
    ['MVP PROJETO CRIPTO — TERMINAL QUANTITATIVO', ''],
    ['Última leitura (BRT)', Utilities.formatDate(new Date(), P2.TZ_BRT, 'dd/MM/yyyy HH:mm:ss')],
    ['', ''],
    ['▌ MERCADO SPOT', ''],
    ['BTC Spot (USD)', fmtUsd(der.spot)],
    ['Variação 24h', pct(der.var24h)],
    ['Volume 24h (USD, OKX)', fmtUsd(der.vol24hUsd)],
    ['Último fechamento diário (UTC)', Utilities.formatDate(o.dates[L], 'UTC', 'yyyy-MM-dd') + '  ·  ' + fmtUsd(C) + '  ·  ret ' + pct(I.RET[L])],
    ['', ''],
    ['▌ CONSENSO ALGORÍTMICO PROPRIETÁRIO', ''],
    ['Índice de Exposição Tática', r_(cons.pct, 0) + '% Favorável / ' + r_(cons.defensivo, 0) + '% Defensivo'],
    ['Leitura do Consenso', cons.leitura + '  ·  interno: ponderado ' + r_(cons.pct, 1) + '% | voto simples ' + cons.comprados + '/' + cons.n + ' (' + r_(cons.bruto, 0) + '%) | ' + cons.comPeso + ' componentes com peso > 0 | modo ' + cons.modo + ' (soma de pesos ' + r_(cons.somaPesos, 2) + ')'],
    ['Esticamento do Mercado (0 = barato, 100 = caro)', termo.valor + '/100 — ' + termo.faixa + '  ·  ' + termo.acao],
    ['Como interpretar o Esticamento', 'Compara o preço de hoje com os últimos 4 anos, só em dias do mesmo regime (preço acima ou abaixo da média de 200 dias). Acima de 70: mercado caro, aportar aos poucos e evitar alavancagem. Abaixo de 30: mercado descontado, favorável a acumular. Não indica a direção do preço e não substitui o Índice de Exposição Tática.'],
    ['Regime e cobertura do Esticamento', termo.regime + '  ·  cobertura ' + termo.cobertura],
    ['', ''],
    ['▌ ESTRUTURA DE TENDÊNCIA', ''],
    ['Bull Market Support Band (SMA140 / EMA147)', fmtUsd(I.SMA140[L]) + ' / ' + fmtUsd(I.EMA147[L]) + '  ·  preço ' + I.Preco_vs_BMSB[L] + '  ·  spread ' + pct(I.BMSB_Spread[L], 2)],
    ['SMA 90 (médio prazo)', rel(I.SMA90[L])],
    ['SMA 155 (emulador STH-RP)', rel(I.SMA155[L])],
    ['EMA 200', rel(I.EMA200[L])],
    ['EMA 365', rel(I.EMA365[L])],
    ['RSI 14 / ATR 14', r_(I.RSI14[L], 1) + '  /  ' + fmtUsd(I.ATR14[L])],
    ['MACD (12,26,9) — linha / sinal / hist', r_(I.MACD[L], 0) + ' / ' + r_(I.MACD_Sinal[L], 0) + ' / ' + r_(I.MACD_Hist[L], 0)],
    ['Vol. anualizada 30d / 90d', pct(I.Vol30[L], 1) + ' / ' + pct(I.Vol90[L], 1)],
    ['Z-score retorno (9/21/30/90d)', [9, 21, 30, 90].map(function (N) { return r_(I['Z' + N][L], 2); }).join(' / ')],
    ['', ''],
    ['▌ DERIVATIVOS & SENTIMENTO', ''],
    ['Funding Rate 8h (' + der.fundingFonte + ')', der.funding === null ? '—' : r_(der.funding * 100, 4) + '%  ·  anualizado ' + r_(der.funding * 1095 * 100, 2) + '%'],
    ['Open Interest (' + der.oiFonte + ')', fmtUsd(der.oiUsd) + '  ·  ' + (der.oiBtc ? r_(der.oiBtc, 0) + ' BTC' : '—') + '  ·  24h ' + pct(der.oiVar24h)],
    ['Fear & Greed', der.fg === null ? '—' : der.fg + '/100 — ' + der.fgClass],
    ['', ''],
    ['▌ MAPA DE ZONAS DE LIQUIDEZ (referência visual · ' + zon.aporte.concat(zon.venda).filter(function (z) { return z.validado; }).length + ' de ' + zon.aporte.concat(zon.venda).length + ' validadas por backtest)', ''],
  ].concat(zonaLinhas_(zon.aporte, 'Zona de Aporte', fmtUsd, pct)).concat(zonaLinhas_(zon.venda, 'Zona de Venda', fmtUsd, pct))
   .concat([
    ['', ''],
    ['▌ ÚLTIMO ALERTA DISPARADO', ''],
    ['Data / Tipo', ult[0] + '  ·  ' + ult[1]],
    ['Gatilho (interno) / Status', ult[2] + '  ·  ' + ult[5] + (ult[6] !== '' ? ' (' + ult[6] + '%)' : '')],
    ['', ''],
    ['Fonte histórica / lacunas preenchidas', (meta.fonte || '—') + ' / ' + (meta.lacunas || 0) + '  ·  ' + o.closes.length + ' velas desde ' + Utilities.formatDate(o.dates[0], 'UTC', 'yyyy-MM-dd')],
  ]);
  sh.clear();
  // Coluna B como TEXTO: impede o Sheets (pt-BR) de reinterpretar "$ 86,610" como 86,61
  sh.getRange(1, 2, blocos.length, 1).setNumberFormat('@');
  sh.getRange(1, 1, blocos.length, 2).setValues(blocos);
  sh.getRange(1, 1, blocos.length, 2).setFontWeight('normal').setBackground(null).setFontColor('#1b1b1b');
  blocos.forEach(function (b, i) {
    if (String(b[0]).indexOf('▌') === 0) sh.getRange(i + 1, 1, 1, 2).setFontWeight('bold').setBackground('#0b1f3a').setFontColor('#ffffff');
  });
  sh.getRange(1, 1, 1, 2).setFontWeight('bold').setFontSize(14).setBackground('#081428').setFontColor('#f5c542');
  const corT = termo.valor >= 70 ? '#f4cccc' : termo.valor <= 30 ? '#d9ead3' : '#fff2cc';
  const linhaDe = function (prefixo) { for (let i = 0; i < blocos.length; i++) if (String(blocos[i][0]).indexOf(prefixo) === 0) return i + 1; return 0; };
  const lT = linhaDe('Esticamento do Mercado'), lC = linhaDe('Índice de Exposição Tática');
  if (lT) sh.getRange(lT, 2).setBackground(corT).setFontWeight('bold');
  if (lC) sh.getRange(lC, 2).setBackground(cons.pct >= 60 ? '#d9ead3' : cons.pct < 40 ? '#f4cccc' : '#fff2cc').setFontWeight('bold');
  sh.setColumnWidth(1, 330); sh.setColumnWidth(2, 760);
  sh.getRange(1, 1, blocos.length, 2).setWrap(true).setVerticalAlignment('top');
}

/* =============================================================================
 * 13. MOTORES
 * ===========================================================================*/
/** Núcleo: atualiza base (se houver vela nova), recalcula, lê derivativos, grava painéis. */
function processar_(forcarRecalculo) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error('Outro ciclo em execução.');
  try {
    const b = atualizarBaseDados_(), o = b.ohlcv;
    if (o.closes.length < P2.MIN_CANDLES) throw new Error('Base insuficiente: ' + o.closes.length + ' velas.');
    const I = calcularIndicadores_(o), res = rodarEstrategias_(o);
    let zst = statsZonas_();
    if (b.novaVela || forcarRecalculo || !zst) {
      zst = backtestZonas_(o);
      gravarIndicadores_(o, I); gravarEstrategias_(o, res, zst);
    }
    const der = lerDerivativos_();
    const aave = cfgSim_('AAVE_MONITORAR') ? lerAave_(der.spot) : [];   // pessoal: só log interno
    gravarOnchain_(der, aave);
    const cons = consenso_(res), termo = termometro_(o, I, der), zon = zonas_(o, zst);
    return { o: o, I: I, res: res, der: der, aave: aave, cons: cons, termo: termo, zon: zon, novaVela: b.novaVela };
  } finally { lock.releaseLock(); }
}

/** MOTOR INTRADAY — gatilho a cada 1h. Avalia anomalias e dispara se inédito em 24h. */
function motorIntraday() {
  const x = processar_(false);
  let eventos = detectarEventos_(x.o, x.I, x.res, x.der).concat(eventoIntradayVela_(x.o, x.I, x.der));
  // Hash = MD5(data da vela de referência + tipo): reavaliado a cada hora, enviado no máximo 1x por janela
  const recentes = hashesRecentes_(), novos = [];
  eventos.forEach(function (e) {
    e.hash = md5_(e.ref + '|' + e.tipo);
    if (!recentes[e.hash]) novos.push(e);
  });
  if (novos.length && cfgSim_('ALERTAS_ATIVOS')) {
    const urg = novos.some(function (e) { return e.urgencia === 'URGENTE'; });
    const corpo = '<p style="font-size:14px">O monitoramento horário identificou <b>' + novos.length + ' evento(s) atípico(s)</b> no gráfico diário do Bitcoin.</p>' +
      novos.map(function (e) {
        return '<div style="border-left:4px solid ' + (e.urgencia === 'URGENTE' ? '#b00020' : '#e8710a') + ';background:#fafbfc;padding:10px 14px;margin:12px 0">' +
          '<div style="font-weight:bold;font-size:15px">' + e.titulo + '</div><div style="font-size:13.5px;margin-top:4px">' + e.texto + '</div>' +
          '<div style="font-size:12.5px;margin-top:8px;color:#0b1f3a"><b>Diretriz de gestão de risco:</b> ' + diretriz_(e.vies) + '</div></div>';
      }).join('') +
      '<h3 style="font-size:15px;margin-top:20px">Leitura consolidada</h3>' +
      tabela_([
        ['BTC Spot', '$ ' + Number(x.der.spot || x.o.closes[x.o.closes.length - 1]).toLocaleString('en-US', { maximumFractionDigits: 0 })],
        ['Índice de Exposição Tática', r_(x.cons.pct, 0) + '% Favorável / ' + r_(x.cons.defensivo, 0) + '% Defensivo'],
        ['Esticamento do Mercado (0 = barato, 100 = caro)', x.termo.valor + '/100 — ' + x.termo.faixa],
      ]) + '<p style="font-size:12px;color:#374151;margin:8px 0 0">' + x.termo.acao + '</p>';
    const tagTxt = urg ? 'URGENTE' : 'ATENÇÃO';
    const env = enviar_('[' + tagTxt + '] Alerta Quantitativo BTC — ' + novos[0].titulo + (novos.length > 1 ? ' (+' + (novos.length - 1) + ')' : ''),
      moldura_('Alerta de Anomalia Estatística', urg ? '#b00020' : '#e8710a', tagTxt, corpo));
    const status = env.ok === env.total ? 'ENVIADO' : (env.ok ? 'ENVIADO_PARCIAL' : 'FALHA: ' + env.falhas.join('; '));
    novos.forEach(function (e) { logDisparo_(e.tipo, e.interno, env.dest, e.hash, status, env.efet); });
  } else if (novos.length) {
    novos.forEach(function (e) { logDisparo_(e.tipo, e.interno, '—', e.hash, 'SUPRIMIDO (ALERTAS_ATIVOS=NAO)', 0); });
  }
  gravarDashboard_(x.o, x.I, x.res, x.der, x.aave, x.cons, x.termo, x.zon);
}

/** MOTOR SEMANAL — segundas 08:00 BRT. Relatório Quantitativo & On-Chain Semanal. */
function motorSemanal() {
  const x = processar_(false);
  gravarDashboard_(x.o, x.I, x.res, x.der, x.aave, x.cons, x.termo, x.zon);
  if (!cfgSim_('RELATORIO_SEMANAL_ATIVO')) return;
  const tipo = 'RELATORIO_SEMANAL', hash = md5_(Utilities.formatDate(new Date(), P2.TZ_BRT, 'yyyy-MM-dd') + '|' + tipo);
  if (hashesRecentes_()[hash]) return;
  const html = montarRelatorioSemanal_(x);
  const env = enviar_('Relatório Quantitativo & On-Chain Semanal — BTC · ' + Utilities.formatDate(new Date(), P2.TZ_BRT, 'dd/MM/yyyy'), html);
  logDisparo_(tipo, 'Agenda semanal', env.dest, hash, env.ok === env.total ? 'ENVIADO' : (env.ok ? 'ENVIADO_PARCIAL' : 'FALHA: ' + env.falhas.join('; ')), env.efet);
  gravarDashboard_(x.o, x.I, x.res, x.der, x.aave, x.cons, x.termo, x.zon);
}

function montarRelatorioSemanal_(x) {
  const o = x.o, I = x.I, L = o.closes.length - 1, C = o.closes[L];
  // Fechamento semanal = última vela de domingo (UTC) disponível
  let w = L; while (w > 0 && o.dates[w].getUTCDay() !== 0) w--;
  const fechSem = o.closes[w], fechAnt = w >= 7 ? o.closes[w - 7] : NaN;
  const usd = function (v) { return isNaN(v) || v === null ? '—' : '$ ' + Number(v).toLocaleString('en-US', { maximumFractionDigits: 0 }); };
  const pct = function (v, d) { return v === null || v === undefined || isNaN(v) ? '—' : r_(v, d || 2) + '%'; };
  const estr = I.Preco_vs_BMSB[L] === 'ACIMA' ? 'acima da faixa de suporte estrutural de mercado em alta'
    : I.Preco_vs_BMSB[L] === 'ABAIXO' ? 'abaixo da faixa de suporte estrutural de mercado em alta' : 'testando a faixa de suporte estrutural de mercado em alta';
  const barra = function (p) {
    return '<div style="background:#f4cccc;border-radius:6px;height:16px;overflow:hidden;margin:6px 0 2px"><div style="width:' + r_(p, 0) + '%;background:#0b8043;height:16px"></div></div>' +
      '<div style="font-size:12px;color:#4b5563">' + r_(p, 0) + '% Favorável · ' + r_(100 - p, 0) + '% Defensivo</div>';
  };
  // Cliente vê apenas faixa, distância, status e confiabilidade histórica — nunca o critério.
  const zonaRows = x.zon.aporte.concat(x.zon.venda).map(function (z) {
    return [z.nome, usd(z.lo) + ' – ' + usd(z.hi) + ' (' + pct(z.distPct, 1) + ') · ' + z.status + (z.validado ? ' · reação histórica ' + z.acerto + '%' : '')];
  });
  const corpo =
    '<h3 style="font-size:15px;margin:0 0 8px">1. Fechamento Semanal</h3>' +
    tabela_([
      ['Fechamento semanal (dom ' + Utilities.formatDate(o.dates[w], 'UTC', 'dd/MM') + ')', usd(fechSem)],
      ['Variação semanal', pct((fechSem / fechAnt - 1) * 100)],
      ['Spot atual', usd(x.der.spot || C) + ' · 24h ' + pct(x.der.var24h)],
      ['Volatilidade anualizada 30d / 90d', pct(I.Vol30[L], 1) + ' / ' + pct(I.Vol90[L], 1)],
    ]) +
    '<h3 style="font-size:15px;margin:20px 0 8px">2. Consenso Algorítmico Proprietário</h3>' +
    '<div style="font-size:14px"><b>Índice de Exposição Tática:</b> ' + x.cons.leitura + '</div>' + barra(x.cons.pct) +
    '<div style="font-size:14px;margin-top:10px"><b>Esticamento do Mercado (0 = barato, 100 = caro):</b> ' + x.termo.valor + '/100 — ' + x.termo.faixa + '</div>' +
    '<p style="font-size:12px;color:#374151;margin:4px 0 0">Mede o quanto o preço está esticado frente aos últimos 4 anos em condições semelhantes; não indica a direção. ' + x.termo.acao + '</p>' +
    '<p style="font-size:13px;color:#374151">Estrutura de preço: o BTC encerra a semana ' + estr + '.</p>' +
    '<h3 style="font-size:15px;margin:20px 0 8px">3. Derivativos & Sentimento</h3>' +
    tabela_([
      ['Funding Rate (8h)', x.der.funding === null ? '—' : r_(x.der.funding * 100, 4) + '% · ' + r_(x.der.funding * 1095 * 100, 1) + '% a.a.'],
      ['Open Interest', usd(x.der.oiUsd) + (x.der.oiBtc ? ' · ' + r_(x.der.oiBtc, 0) + ' BTC' : '')],
      ['Fear & Greed', x.der.fg === null ? '—' : x.der.fg + '/100 — ' + x.der.fgClass],
    ]) +
    '<h3 style="font-size:15px;margin:20px 0 8px">4. Mapa de Risco — Zonas de Liquidez</h3>' + tabela_(zonaRows) +
    '<p style="font-size:12px;color:#6b7280">Zonas de Aporte: regiões historicamente associadas a suporte estrutural. Zonas de Venda: regiões de esticamento estatístico onde a assimetria risco/retorno se deteriora.</p>';
  return moldura_('Relatório Quantitativo & On-Chain Semanal', '#0b8043', 'SEMANAL', corpo);
}

/* =============================================================================
 * 14. SETUP, GATILHOS, MENU, TESTES
 * ===========================================================================*/
function setupPlanilha() {
  const ss = ss_();
  const defs = [
    [P2.ABAS.dash, ['Painel', 'Valor'], 1],
    [P2.ABAS.base, ['Data', 'Open', 'High', 'Low', 'Close', 'Volume', 'Retorno_Diario_pct', 'Retorno_Log'], 2],
    [P2.ABAS.ind, COLS_IND, 3],
    [P2.ABAS.estr, COLS_ESTR, 4],
    [P2.ABAS.onchain, ['Timestamp_BRT', 'BTC_Spot', 'Funding_8h', 'Funding_Anual_pct', 'Fonte_Funding', 'OI_USD', 'OI_BTC', 'OI_Var_24h_pct', 'Fonte_OI', 'Fear_Greed', 'FG_Classe', 'Aave_HF_Polygon', 'Aave_HF_Base', 'Aave_HF_Min', 'Aave_Preco_Liquidacao'], 5],
    [P2.ABAS.log, ['Data_Hora_BRT', 'Tipo_Evento', 'Indicador_Gatilho', 'Destinatarios', 'Hash_Evento', 'Status_Envio', 'Taxa_Efetividade_pct'], 6],
    [P2.ABAS.cfg, ['Parametro', 'Valor', 'Descricao'], 7],
  ];
  defs.forEach(function (d) {
    let sh = ss.getSheetByName(d[0]);
    if (!sh) sh = ss.insertSheet(d[0]);
    if (d[0] !== P2.ABAS.dash) {
      sh.getRange(1, 1, 1, d[1].length).setValues([d[1]]).setFontWeight('bold').setBackground('#0b1f3a').setFontColor('#ffffff').setWrap(true);
      sh.setFrozenRows(1);
    }
    ss.setActiveSheet(sh); ss.moveActiveSheet(d[2]);
  });
  const cfgSh = ss.getSheetByName(P2.ABAS.cfg), existentes = {};
  if (cfgSh.getLastRow() > 1) cfgSh.getRange(2, 1, cfgSh.getLastRow() - 1, 1).getValues().forEach(function (r) { existentes[r[0]] = true; });
  // Remove parâmetros obsoletos de versões anteriores (ex.: HF_ALERTA_INTERNO, ZONA_VENDA*)
  const validos = {}; CFG_PADRAO.forEach(function (r) { validos[r[0]] = true; });
  for (let rr = cfgSh.getLastRow(); rr >= 2; rr--) {
    const k = cfgSh.getRange(rr, 1).getValue();
    if (k !== '' && !validos[k]) { cfgSh.deleteRow(rr); delete existentes[k]; }
  }
  const novos = CFG_PADRAO.filter(function (r) { return !existentes[r[0]]; });
  if (novos.length) cfgSh.getRange(cfgSh.getLastRow() + 1, 1, novos.length, 3).setValues(novos);
  cfgSh.setColumnWidth(1, 260); cfgSh.setColumnWidth(2, 330); cfgSh.setColumnWidth(3, 520);
  const dash = ss.getSheetByName(P2.ABAS.dash); dash.setColumnWidth(1, 330); dash.setColumnWidth(2, 620);
  ss.getSheetByName(P2.ABAS.estr).setColumnWidth(2, 330);
  ss.getSheetByName(P2.ABAS.log).setColumnWidth(5, 260);
  ss.getSheetByName(P2.ABAS.onchain).getRange('A:A').setNumberFormat('dd/MM/yyyy HH:mm');
  ['Página1', 'Sheet1', 'Planilha1'].forEach(function (nm) { const s = ss.getSheetByName(nm); if (s && s.getLastRow() === 0 && ss.getSheets().length > 7) ss.deleteSheet(s); });
  ss.setSpreadsheetTimeZone(P2.TZ_BRT);
  ss.setActiveSheet(dash);
  safeToast_('Estrutura das 7 abas criada. Rode "Ciclo completo".');
}

/** Baixa/atualiza tudo e força regravação de indicadores e estratégias (sem disparar e-mails). */
function cicloCompleto() {
  const x = processar_(true);
  gravarDashboard_(x.o, x.I, x.res, x.der, x.aave, x.cons, x.termo, x.zon);
  safeToast_('Ciclo completo: ' + x.o.closes.length + ' velas · Exposição Tática ' + r_(x.cons.pct, 0) + '%');
}

/* =============================================================================
 * 15. BACKUP DIÁRIO (02:00 BRT) — cópia datada, nunca sobrescreve
 *     Destino: Meu Drive / MVP - Projeto 2035 / MVP #2 Cripto (ainda sem nome) / Planilhas
 * ===========================================================================*/
const BACKUP_CAMINHO = ['MVP - Projeto 2035', 'MVP #2 Cripto (ainda sem nome)', 'Planilhas'];

function pastaBackup_() {
  let pasta = DriveApp.getRootFolder();   // "Meu Drive"
  BACKUP_CAMINHO.forEach(function (nome) {
    const it = pasta.getFoldersByName(nome);
    pasta = it.hasNext() ? it.next() : pasta.createFolder(nome);
  });
  return pasta;
}

function backupDiario() {
  const pasta = pastaBackup_();
  const carimbo = Utilities.formatDate(new Date(), P2.TZ_BRT, 'yyyy-MM-dd_HHmm');
  let nome = 'MVP Projeto Cripto (PROJETO 02) - BACKUP ' + carimbo;
  // Garante que nada seja sobrescrito: se o nome já existir (execução manual repetida), acrescenta sufixo
  let k = 2;
  while (pasta.getFilesByName(nome).hasNext()) nome = 'MVP Projeto Cripto (PROJETO 02) - BACKUP ' + carimbo + ' (' + k++ + ')';
  const copia = DriveApp.getFileById(P2.PLANILHA_ID).makeCopy(nome, pasta);
  Logger.log('Backup criado: ' + copia.getName() + ' -> ' + copia.getUrl());
  return copia.getUrl();
}

function instalarGatilhoBackup() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'backupDiario') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('backupDiario').timeBased().everyDays(1).atHour(2).nearMinute(0).inTimezone(P2.TZ_BRT).create();
  safeToast_('Backup diário instalado: todos os dias às 02:00 BRT.');
}

function instalarGatilhosAutomaticos() {
  instalarGatilhoBackup();
  const alvo = ['motorIntraday', 'motorSemanal'];
  ScriptApp.getProjectTriggers().forEach(function (t) { if (alvo.indexOf(t.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('motorSemanal').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(8).nearMinute(0).inTimezone(P2.TZ_BRT).create();
  ScriptApp.newTrigger('motorIntraday').timeBased().everyHours(1).create();
  safeToast_('Gatilhos instalados: semanal (seg 08:00 BRT) + intraday (1h).');
  return conferirGatilhos();
}
function removerGatilhos() { ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); }); safeToast_('Todos os gatilhos removidos.'); }
function conferirGatilhos() {
  const s = ScriptApp.getProjectTriggers().map(function (t) { return t.getHandlerFunction() + ' (' + t.getEventType() + ')'; }).join('\n') || 'Nenhum gatilho.';
  Logger.log(s); return s;
}
/** Envia prévia do relatório semanal e de um alerta fictício APENAS ao 1º e-mail (não grava hash). */
function testarEmailInterno() {
  const x = processar_(false), dest = emails_()[0];
  MailApp.sendEmail({ to: dest, subject: '[TESTE] Relatório Semanal', htmlBody: montarRelatorioSemanal_(x) });
  MailApp.sendEmail({ to: dest, subject: '[TESTE] Alerta', htmlBody: moldura_('Alerta de Anomalia Estatística (TESTE)', '#b00020', 'URGENTE',
    '<p>Exemplo de layout. Nenhum evento real.</p><p><b>Diretriz:</b> ' + diretriz_('RISCO') + '</p>') });
  logDisparo_('TESTE', 'testarEmailInterno', dest, '—', 'ENVIADO', 100);
}
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Projeto 02 — Quant')
    .addItem('0) Criar/formatar as 7 abas', 'setupPlanilha')
    .addItem('1) Ciclo completo (dados + indicadores + estratégias)', 'cicloCompleto')
    .addItem('2) Rodar motor intraday agora (pode enviar e-mail)', 'motorIntraday')
    .addSeparator()
    .addItem('T) Teste de e-mail (somente 1º destinatário)', 'testarEmailInterno')
    .addItem('A) Configurar carteira Aave (só planilha)', 'configurarCarteiraAave')
    .addItem('G) Instalar gatilhos automáticos', 'instalarGatilhosAutomaticos')
    .addItem('B) Fazer backup agora', 'backupDiario')
    .addItem('C) Conferir gatilhos', 'conferirGatilhos')
    .addItem('X) Remover todos os gatilhos', 'removerGatilhos')
    .addToUi();
}
function safeToast_(m) { try { ss_().toast(m, 'Projeto 02', 6); } catch (e) {} Logger.log(m); }
function r_(v, d) { if (v === null || v === undefined || typeof v !== 'number' || !isFinite(v)) return ''; const f = Math.pow(10, d === undefined ? 2 : d); return Math.round(v * f) / f; }

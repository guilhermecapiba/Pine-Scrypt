/**
 * =============================================================================
 * CRYPTO BACKTEST MACHINE — TOP 10 (PROJETO 02) — v1.0
 * Planilha: https://docs.google.com/spreadsheets/d/1WubiUb2K9s8J_a9AGfqphKYFFYi6ezAWCVBqn21A0jk
 *
 * Paradigma: MVP Projeto Cripto (PROJETO 02) v2.5. Motor de backtest, indicadores, Consenso Algorítmico, Esticamento do Mercado
 * e detecção de alertas são CÓPIAS FIÉIS do código do BTC. A diferença desta planilha: CADA MOEDA TEM AS PRÓPRIAS 5 MELHORES
 * ESTRATÉGIAS (até 50 distintas no total; SELECAO_N_ESTRATEGIAS é editável), escolhidas de um conjunto candidato de 51 (mais uma busca ampliada de ~300 quando faltam) por critério de
 * desempenho (Sharpe mínimo de 1,00 por estratégia) e diversificação medidos só no período de seleção (IS 70%), com os 30% finais (OOS) reservados para medir a decaída
 * real. O BTC é a referência e roda as 10 fixas do Projeto 02. Ver seção 2B (SELEÇÃO).
 *
 * UNIVERSO: BTC (referência) + 10 moedas: as 8 primeiras NEGOCIÁVEIS do ranking de valor de mercado (sem stablecoins, ativos
 * tokenizados e derivados/wrapped) + LINK e AAVE por escolha manual. Hoje: ETH, BNB, XRP, SOL, TRX, ZEC, HYPE, DOGE, LINK, AAVE.
 * A lista vive na aba UNIVERSO (editável); a aba RANKING_COINGECKO sugere ajustes, sem aplicá-los sozinha.
 *
 * DIFERENÇAS EM RELAÇÃO AO BTC (de propósito):
 *  - Sem zonas de liquidez (dependem de dados de liquidação), sem Aave e sem on-chain/derivativos.
 *  - Dados diários de cada moeda vêm de uma cascata de corretoras definida na aba UNIVERSO (coluna Fontes).
 *  - Indicadores técnicos são calculados em memória (não gravados em aba): a planilha fica leve.
 *  - Uma planilha, um script, onze ativos processados em rodízio dentro do limite de 6 minutos do Apps Script.
 *
 * ABAS: PAINEL_TOP10 | DESEMPENHO_10 | ESTRATEGIAS_TOP10 | SELECAO_CANDIDATAS | UNIVERSO | RANKING_COINGECKO | DIAGNOSTICO_FONTES |
 *       LOG_DISPAROS | CONFIG_SISTEMA | BASE_<SIMBOLO> (uma por ativo, OHLCV diário)
 *
 * INSTALAÇÃO
 *  1. Planilha -> Extensões -> Apps Script -> apagar tudo -> colar este arquivo -> salvar.
 *  2. Menu "Top 10 — Quant" (recarregue a planilha): 0) Criar/formatar abas.
 *  3. 1) Diagnóstico das fontes de dados (confirma qual corretora responde para cada moeda).
 *  4. 2) Carga inicial / ciclo completo (repita até todos os ativos estarem carregados; o gatilho horário também continua).
 *  5. G) Instalar gatilhos automáticos (a cada hora + segunda 08:00 BRT + backup 02:00 BRT).
 *
 * REGRAS INVIOLÁVEIS (herdadas do Projeto 02)
 *  - Sem look-ahead: sinais no FECHAMENTO da vela D, execução simulada na ABERTURA de D+1; a vela do dia corrente é descartada.
 *  - Comunicação ao cliente: nunca nomes/quantidade de estratégias, nem o indicador que disparou o alerta.
 * =============================================================================
 */

const P2 = {
  PLANILHA_ID: '1WubiUb2K9s8J_a9AGfqphKYFFYi6ezAWCVBqn21A0jk',
  TZ_BRT: 'America/Sao_Paulo',
  ABAS: {
    painel: 'PAINEL_TOP10',
    desemp: 'DESEMPENHO_10',
    estr: 'ESTRATEGIAS_TOP10',
    sel: 'SELECAO_CANDIDATAS',
    universo: 'UNIVERSO',
    ranking: 'RANKING_COINGECKO',
    diag: 'DIAGNOSTICO_FONTES',
    log: 'LOG_DISPAROS',
    cfg: 'CONFIG_SISTEMA',
  },
  CAPITAL_BASE: 10000,
  FEE_PCT: 0.075,        // idêntico ao BTC (custo total 0,125% por lado com o slippage)
  SLIPPAGE_PCT: 0.050,
  MIN_CANDLES: 200,
  HIST_INICIO_MS: Date.UTC(2013, 0, 1),
};

/** Parâmetros editáveis (chave, valor padrão, descrição). Gravados em CONFIG_SISTEMA. */
const CFG_PADRAO = [
  ['EMAILS_CLIENTES', 'guilhermecapiba@gmail.com, capibatrader@gmail.com', 'Destinatários (separados por vírgula)'],
  ['ALERTAS_ATIVOS', 'SIM', 'SIM/NAO — liga/desliga o e-mail consolidado de alertas'],
  ['RELATORIO_SEMANAL_ATIVO', 'SIM', 'SIM/NAO — liga/desliga o relatório consolidado de segunda 08:00 BRT'],
  ['JANELA_DEDUP_HORAS', 24, 'Janela anti-reenvio do mesmo evento (ativo + data da vela + tipo)'],
  ['ZSCORE_LIMIAR', 2.0, '|Z-score| do retorno diário para spike de volatilidade'],
  ['ZSCORE_JANELAS', '9,21,30,90', 'Janelas (dias) avaliadas para o Z-score'],
  ['MACD_DIVERGENCIA_MIN_BARRAS', 20, 'Barras mínimas do regime anterior para inflexão MACD relevante'],
  ['CONSENSO_PESO_REF', 5, 'Soma de pesos (Sharpe 3 anos, cada um entre 0 e 3) a partir da qual o Consenso é 100% ponderado'],
  ['CONSENSO_JANELA_SHARPE_DIAS', 1095, 'Janela (dias) do Sharpe que pondera cada componente do consenso (se o ativo tiver menos histórico, usa o que existe)'],
  ['MIN_VELAS_CONSENSO', 500, 'Velas diárias mínimas para calcular consenso e esticamento (abaixo disso: HISTORICO_INSUFICIENTE)'],
  ['JANELA_INICIO_BARRAS', 200, 'Barra a partir da qual o desempenho (CAGR, MaxDD, Calmar) é medido, depois do aquecimento das médias'],
  ['ORCAMENTO_SEG', 270, 'Tempo máximo de cada execução (segundos); o Apps Script corta em 360'],
  ['UNIVERSO_N_ATIVOS', 8, 'Quantidade de moedas do ranking CoinGecko (além do BTC e das escolhas manuais)'],
  ['UNIVERSO_MANUAIS', 'chainlink,aave', 'IDs CoinGecko escolhidos manualmente: ficam no universo mesmo fora da janela do ranking'],
  ['SELECAO_ATIVA', 'SIM', 'SIM = cada moeda usa as próprias 10 melhores; NAO = todas usam as 10 fixas do Projeto 02'],
  ['SELECAO_N_ESTRATEGIAS', 5, 'Quantidade de estratégias escolhidas por moeda'],
  ['SELECAO_CORTE_IS', 0.70, 'Fração do histórico usada para NOTA (in-sample). O restante (out-of-sample) nunca entra na escolha'],
  ['SELECAO_MIN_TRADES_IS', 12, 'Trades mínimos no IS (reduz automaticamente para moedas de histórico curto, piso 5)'],
  ['SELECAO_SHARPE_MIN', 1.0, 'Sharpe mínimo (IS e 3 anos) para uma estratégia entrar e permanecer na tabela da moeda. Vaga sem candidato fica ABERTA'],
  ['SELECAO_JANELA_PERM_DIAS', 730, 'Janela (dias) do Sharpe de 24 meses usado na permanência'],
  ['SELECAO_SHARPE_MIN_24M', 0.9, 'Sharpe mínimo dos últimos 24 meses para entrar e permanecer (vale também para o BTC)'],
  ['SELECAO_SHARPE_MIN_12M', 0.4, 'Sharpe mínimo dos últimos 12 meses para entrar e permanecer (vale também para o BTC)'],
  ['SELECAO_HISTERESE', 0, 'Folga na saída: quem já está na tabela (e o BTC) só sai abaixo de (mínimo - folga). 0 = régua estrita; 0,1 evita sair por diferença de milésimos'],
  ['SELECAO_REVISAO_DIAS', 30, 'Intervalo mínimo entre revisões que trocam estratégias que caíram abaixo do Sharpe mínimo ou preenchem vagas abertas'],
  ['SELECAO_DD_MAX', 70, 'Drawdown máximo (%) no IS para um candidato ser elegível'],
  ['SELECAO_MAX_POR_FAMILIA', 2, 'Máximo de estratégias da mesma família entre as 10'],
  ['SELECAO_CORR_MAX', 0.92, 'Correlação máxima dos retornos diários (IS) entre duas escolhidas'],
  ['SELECAO_REFRESH_DIAS', 90, 'Dias até refazer a seleção sozinha (ou use o menu S). Entre reseleções, a escolha fica congelada'],
  ['UNIVERSO_EXCLUIR_IDS', 'tether,usd-coin,usds,dai,ethena-usde,usd1-world-liberty-financial,paypal-usd,first-digital-usd,true-usd,usdd,figure-heloc,tether-gold,pax-gold,wrapped-bitcoin,staked-ether,wrapped-steth,weth,coinbase-wrapped-btc,wrapped-eeth,usdt0,blackrock-usd-institutional-digital-liquidity-fund',
    'IDs CoinGecko que nunca entram no universo (stablecoins, RWA, wrapped/staked). Separe por vírgula'],
];


/* ---- copiado do Projeto 02: configuração e planilha ---- */
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
 * 2. BIBLIOTECA DE ESTRATÉGIAS
 *    FIXAS_BTC : as 10 do Projeto 02 (usadas no BTC de referência, sem alteração).
 *    POOL      : conjunto candidato (as 10 acima + gatilhos + variantes paramétricas de famílias clássicas).
 *                Para cada moeda, a seleção (seção 2B) escolhe as 10 melhores desse conjunto.
 * ===========================================================================*/
const FIXAS_BTC = [
  { id: 'M1-01', fam: 'momentum', grupo: 'Machine #1', key: 'rocMomentum', nome: 'ROC Momentum 30/15% + SMA200', fn: sinalRocMomentum },
  { id: 'M1-02', fam: 'momentum', grupo: 'Machine #1', key: 'macd205012', nome: 'MACD 20/50/12', fn: sinalMacd205012 },
  { id: 'M1-04', fam: 'rompimento', grupo: 'Machine #1', key: 'adxTrendBreakout', nome: 'ADX(7) Trend Breakout + SMA50', fn: sinalAdxTrendBreakout },
  { id: 'M1-05', fam: 'cruzamento', grupo: 'Machine #1', key: 'sma200ema1030', nome: 'SMA200 + EMA10xEMA30', fn: sinalSma200Ema1030 },
  { id: 'M1-06', fam: 'estrutura', grupo: 'Machine #1', key: 'confluenciaSmcIct', nome: 'Confluência SMC + ICT + Trendline', fn: sinalConfluencia },
  { id: 'M1-11', fam: 'estrutura', grupo: 'Machine #1/#2', key: 'hibridoSthRp', nome: 'Híbrido STH-RP (SMA155) & Confluência', fn: sinalHibridoSthRp },
  { id: 'M2-02', fam: 'cruzamento', grupo: 'Machine #2', key: 'emaCrossSma76', nome: 'EMA10 Cross + SMA76', fn: sinalEmaCrossSma76 },
  { id: 'M2-03', fam: 'rompimento', grupo: 'Machine #2', key: 'bollingerSqueeze', nome: 'Bollinger Squeeze (20, 2.25) + SMA200', fn: sinalBollingerSqueeze },
  { id: 'M2-04', fam: 'cruzamento', grupo: 'Machine #2', key: 'nuvemEma655Sma100', nome: 'Nuvem EMA 6/55 + SMA100', fn: sinalNuvemEma655 },
  { id: 'M2-05', fam: 'momentum', grupo: 'Machine #2', key: 'larryWilliams9394', nome: 'Larry Williams 9.3/9.4 (EMA12 + SMA50)', fn: sinalLarryWilliams9394 },
];

/** Sinais simples: entra enquanto cond de entrada, sai enquanto cond de saída (sem look-ahead: o motor executa em D+1). */
function sigGen_(o, entrada, saida, inv) {
  const n = o.closes.length, en = new Array(n).fill(false), ex = new Array(n).fill(false);
  for (let i = 0; i < n; i++) { en[i] = !!entrada(i); ex[i] = !!saida(i); }
  return { entrySignal: en, exitSignal: ex, invalidationSeries: inv };
}
/** Cache de indicadores por série (evita recalcular a mesma média para vários candidatos). */
function cacheInd_(o, chave, fn) { const c = o._c || (o._c = {}); return c[chave] || (c[chave] = fn()); }
function smaC_(o, p) { return cacheInd_(o, 's' + p, function () { return sma(o.closes, p); }); }
function emaC_(o, p) { return cacheInd_(o, 'e' + p, function () { return ema(o.closes, p); }); }
function atrC_(o, p) { return cacheInd_(o, 'a' + p, function () { return atrWilder(o.highs, o.lows, o.closes, p); }); }
function ok_(v) { return v !== null && v !== undefined && !isNaN(v); }

function candPrecoMedia_(tipo, p) {
  return function (o) {
    const m = tipo === 'sma' ? smaC_(o, p) : emaC_(o, p), C = o.closes;
    return sigGen_(o, function (i) { return ok_(m[i]) && C[i] > m[i]; }, function (i) { return ok_(m[i]) && C[i] < m[i]; }, m);
  };
}
function candCruzamento_(tipo, f, s) {
  return function (o) {
    const a = tipo === 'sma' ? smaC_(o, f) : emaC_(o, f), b = tipo === 'sma' ? smaC_(o, s) : emaC_(o, s);
    return sigGen_(o, function (i) { return ok_(a[i]) && ok_(b[i]) && a[i] > b[i]; }, function (i) { return ok_(a[i]) && ok_(b[i]) && a[i] < b[i]; }, b);
  };
}
function candTripla_(a, b, c) {
  return function (o) {
    const x = emaC_(o, a), y = emaC_(o, b), z = emaC_(o, c);
    return sigGen_(o, function (i) { return ok_(z[i]) && x[i] > y[i] && y[i] > z[i]; }, function (i) { return ok_(y[i]) && x[i] < y[i]; }, z);
  };
}
function candDonchian_(N, M) {
  return function (o) {
    const H = o.highs, L = o.lows, C = o.closes, n = C.length, hi = new Array(n).fill(NaN), lo = new Array(n).fill(NaN);
    for (let i = 0; i < n; i++) {
      if (i >= N) { let m = -Infinity; for (let j = i - N; j < i; j++) if (H[j] > m) m = H[j]; hi[i] = m; }
      if (i >= M) { let m = Infinity; for (let j = i - M; j < i; j++) if (L[j] < m) m = L[j]; lo[i] = m; }
    }
    return sigGen_(o, function (i) { return ok_(hi[i]) && C[i] > hi[i]; }, function (i) { return ok_(lo[i]) && C[i] < lo[i]; }, lo);
  };
}
function candMacd_(f, s, g) {
  return function (o) {
    const m = cacheInd_(o, 'm' + f + '_' + s + '_' + g, function () { return calcMACD(o.closes, f, s, g); });
    return sigGen_(o, function (i) { return ok_(m.histogram[i]) && m.histogram[i] > 0; }, function (i) { return ok_(m.histogram[i]) && m.histogram[i] < 0; });
  };
}
function candRoc_(N) {
  return function (o) {
    const C = o.closes, s200 = smaC_(o, 200);
    return sigGen_(o, function (i) { return i >= N && ok_(s200[i]) && C[i] / C[i - N] - 1 > 0 && C[i] > s200[i]; }, function (i) { return i >= N && C[i] / C[i - N] - 1 < 0; }, s200);
  };
}
function candSupertrend_(len, mult) {
  return function (o) {
    const H = o.highs, L = o.lows, C = o.closes, n = C.length, atr = atrC_(o, len);
    const fu = new Array(n).fill(NaN), fl = new Array(n).fill(NaN), dir = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      if (!ok_(atr[i])) continue;
      const hl2 = (H[i] + L[i]) / 2, bu = hl2 + mult * atr[i], bl = hl2 - mult * atr[i];
      if (!ok_(fu[i - 1])) { fu[i] = bu; fl[i] = bl; dir[i] = C[i] > bu ? 1 : -1; continue; }
      fu[i] = (bu < fu[i - 1] || C[i - 1] > fu[i - 1]) ? bu : fu[i - 1];
      fl[i] = (bl > fl[i - 1] || C[i - 1] < fl[i - 1]) ? bl : fl[i - 1];
      dir[i] = dir[i - 1] === 1 ? (C[i] < fl[i] ? -1 : 1) : (C[i] > fu[i] ? 1 : -1);
    }
    return sigGen_(o, function (i) { return dir[i] === 1; }, function (i) { return dir[i] === -1; }, fl);
  };
}
function candBollRompe_(p, k) {
  return function (o) {
    const m = smaC_(o, p), sd = cacheInd_(o, 'sd' + p, function () { return stdevPop_(o.closes, p); }), C = o.closes;
    return sigGen_(o, function (i) { return ok_(m[i]) && C[i] > m[i] + k * sd[i]; }, function (i) { return ok_(m[i]) && C[i] < m[i]; }, m);
  };
}
function candKeltner_(p, mult) {
  return function (o) {
    const m = emaC_(o, p), atr = atrC_(o, 10), C = o.closes;
    return sigGen_(o, function (i) { return ok_(m[i]) && ok_(atr[i]) && C[i] > m[i] + mult * atr[i]; }, function (i) { return ok_(m[i]) && C[i] < m[i]; }, m);
  };
}
function candRsiRegime_(p, alto, baixo) {
  return function (o) {
    const r = cacheInd_(o, 'r' + p, function () { return rsi(o.closes, p); });
    return sigGen_(o, function (i) { return ok_(r[i]) && r[i] > alto; }, function (i) { return ok_(r[i]) && r[i] < baixo; });
  };
}
function candRsiReversao_(p, compra, saida) {
  return function (o) {
    const r = cacheInd_(o, 'r' + p, function () { return rsi(o.closes, p); }), m = smaC_(o, 200), C = o.closes;
    return sigGen_(o, function (i) { return ok_(r[i]) && ok_(m[i]) && r[i] < compra && C[i] > m[i]; }, function (i) { return ok_(r[i]) && r[i] > saida; });
  };
}

const POOL = FIXAS_BTC.concat([
  { id: 'T-01', fam: 'media', nome: 'Preço x SMA50', fn: candPrecoMedia_('sma', 50) },
  { id: 'T-02', fam: 'media', nome: 'Preço x SMA100', fn: candPrecoMedia_('sma', 100) },
  { id: 'T-03', fam: 'media', nome: 'Preço x SMA150', fn: candPrecoMedia_('sma', 150) },
  { id: 'T-04', fam: 'media', nome: 'Preço x SMA200', fn: candPrecoMedia_('sma', 200) },
  { id: 'T-05', fam: 'media', nome: 'Preço x EMA21', fn: candPrecoMedia_('ema', 21) },
  { id: 'T-06', fam: 'media', nome: 'Preço x EMA50', fn: candPrecoMedia_('ema', 50) },
  { id: 'T-07', fam: 'media', nome: 'Preço x EMA100', fn: candPrecoMedia_('ema', 100) },
  { id: 'T-08', fam: 'media', nome: 'Preço x EMA200', fn: candPrecoMedia_('ema', 200) },
  { id: 'G-02', fam: 'media', nome: 'Preço x SMA155 (STH-RP)', fn: function (o) { return gatilhoPrecoMedia_(o, smaC_(o, 155)); } },
  { id: 'G-03', fam: 'media', nome: 'Preço x Bull Market Support Band (SMA140/EMA147)', fn: gatilhoBmsb_ },
  { id: 'T-09', fam: 'cruzamento', nome: 'Cruzamento EMA9 x EMA21', fn: candCruzamento_('ema', 9, 21) },
  { id: 'T-10', fam: 'cruzamento', nome: 'Cruzamento EMA10 x EMA30', fn: candCruzamento_('ema', 10, 30) },
  { id: 'T-11', fam: 'cruzamento', nome: 'Cruzamento EMA12 x EMA50', fn: candCruzamento_('ema', 12, 50) },
  { id: 'T-12', fam: 'cruzamento', nome: 'Cruzamento EMA20 x EMA50', fn: candCruzamento_('ema', 20, 50) },
  { id: 'T-13', fam: 'cruzamento', nome: 'Cruzamento EMA21 x EMA55', fn: candCruzamento_('ema', 21, 55) },
  { id: 'T-14', fam: 'cruzamento', nome: 'Cruzamento EMA50 x EMA200', fn: candCruzamento_('ema', 50, 200) },
  { id: 'T-15', fam: 'cruzamento', nome: 'Cruzamento SMA20 x SMA100', fn: candCruzamento_('sma', 20, 100) },
  { id: 'T-16', fam: 'cruzamento', nome: 'Cruzamento SMA50 x SMA100', fn: candCruzamento_('sma', 50, 100) },
  { id: 'T-17', fam: 'cruzamento', nome: 'Cruzamento SMA50 x SMA200', fn: candCruzamento_('sma', 50, 200) },
  { id: 'T-18', fam: 'cruzamento', nome: 'Cruzamento SMA30 x SMA90', fn: candCruzamento_('sma', 30, 90) },
  { id: 'G-05', fam: 'cruzamento', nome: 'Cruzamento EMA6 x EMA55', fn: gatilhoEma655_ },
  { id: 'T-19', fam: 'cruzamento', nome: 'Alinhamento EMA8 > EMA21 > EMA55', fn: candTripla_(8, 21, 55) },
  { id: 'T-20', fam: 'cruzamento', nome: 'Alinhamento EMA10 > EMA30 > EMA100', fn: candTripla_(10, 30, 100) },
  { id: 'T-21', fam: 'rompimento', nome: 'Donchian 20/10', fn: candDonchian_(20, 10) },
  { id: 'T-22', fam: 'rompimento', nome: 'Donchian 55/20', fn: candDonchian_(55, 20) },
  { id: 'T-23', fam: 'rompimento', nome: 'Donchian 100/50', fn: candDonchian_(100, 50) },
  { id: 'T-24', fam: 'rompimento', nome: 'Rompimento da banda de Bollinger (20, 2) e saída na média', fn: candBollRompe_(20, 2) },
  { id: 'T-25', fam: 'rompimento', nome: 'Rompimento de Keltner (EMA20 + 2 ATR10)', fn: candKeltner_(20, 2) },
  { id: 'T-26', fam: 'momentum', nome: 'MACD 12/26/9 (histograma)', fn: candMacd_(12, 26, 9) },
  { id: 'T-27', fam: 'momentum', nome: 'MACD 24/52/18 (histograma)', fn: candMacd_(24, 52, 18) },
  { id: 'T-28', fam: 'momentum', nome: 'ROC 20d + SMA200', fn: candRoc_(20) },
  { id: 'T-29', fam: 'momentum', nome: 'ROC 60d + SMA200', fn: candRoc_(60) },
  { id: 'T-30', fam: 'momentum', nome: 'ROC 120d + SMA200', fn: candRoc_(120) },
  { id: 'T-31', fam: 'momentum', nome: 'RSI(14) regime 55/45', fn: candRsiRegime_(14, 55, 45) },
  { id: 'T-32', fam: 'momentum', nome: 'RSI(30) regime 55/45', fn: candRsiRegime_(30, 55, 45) },
  { id: 'T-33', fam: 'supertrend', nome: 'Supertrend ATR10 x 3', fn: candSupertrend_(10, 3) },
  { id: 'T-34', fam: 'supertrend', nome: 'Supertrend ATR14 x 2', fn: candSupertrend_(14, 2) },
  { id: 'T-35', fam: 'supertrend', nome: 'Supertrend ATR21 x 4', fn: candSupertrend_(21, 4) },
  { id: 'G-09', fam: 'reversao', nome: 'Reversão Bollinger 2,5σ (compra abaixo, sai na média)', fn: gatilhoBb25_ },
  { id: 'G-10', fam: 'reversao', nome: 'Capitulação Z-score ≤ -2σ (30d)', fn: gatilhoZscore_ },
  { id: 'T-36', fam: 'reversao', nome: 'RSI(14) < 35 acima da SMA200, sai > 55', fn: candRsiReversao_(14, 35, 55) },
]);

/**
 * BUSCA AMPLIADA (fase 2): grade de parâmetros das mesmas famílias clássicas, usada só quando o conjunto base não
 * fornece 10 estratégias com Sharpe mínimo para a moeda. Gera ~300 candidatos sob demanda (não ocupa memória no dia a dia).
 * Aviso estatístico: quanto maior a grade, maior a chance de um Sharpe alto ser acaso; por isso a seleção continua
 * usando só o IS, o OOS segue visível e o número de candidatos testados é gravado.
 */
function gerarPoolAmpliado_() {
  const L = [], add = function (id, fam, nome, fn) { L.push({ id: id, fam: fam, nome: nome, fn: fn, ampliado: true }); };
  [20, 30, 40, 50, 60, 75, 90, 100, 120, 150, 180, 200, 250, 300].forEach(function (p) {
    add('X-SMA' + p, 'media', 'Preço x SMA' + p, candPrecoMedia_('sma', p));
    add('X-EMA' + p, 'media', 'Preço x EMA' + p, candPrecoMedia_('ema', p));
  });
  const rap = [5, 8, 10, 12, 15, 20, 21, 25, 30, 40, 50], len = [21, 30, 50, 55, 75, 100, 150, 200, 250];
  ['ema', 'sma'].forEach(function (t) {
    rap.forEach(function (f) { len.forEach(function (sl) {
      if (sl >= f * 2) add('X-' + t.toUpperCase() + 'X' + f + '-' + sl, 'cruzamento', 'Cruzamento ' + t.toUpperCase() + f + ' x ' + t.toUpperCase() + sl, candCruzamento_(t, f, sl));
    }); });
  });
  [10, 20, 30, 40, 55, 70, 100, 150].forEach(function (N) { [5, 10, 20, 30, 50].forEach(function (M) {
    if (M < N) add('X-DON' + N + '-' + M, 'rompimento', 'Donchian ' + N + '/' + M, candDonchian_(N, M));
  }); });
  [[8, 17, 9], [12, 26, 5], [16, 34, 9], [19, 39, 9], [20, 50, 12], [10, 40, 10]].forEach(function (m) { add('X-MACD' + m.join('-'), 'momentum', 'MACD ' + m.join('/') + ' (histograma)', candMacd_(m[0], m[1], m[2])); });
  [10, 20, 30, 45, 60, 90, 120, 180].forEach(function (N) { add('X-ROC' + N, 'momentum', 'ROC ' + N + 'd + SMA200', candRoc_(N)); });
  [[10, 55, 45], [14, 60, 40], [21, 55, 45], [21, 60, 40], [30, 50, 50], [30, 60, 40]].forEach(function (x) { add('X-RSI' + x[0] + '-' + x[1], 'momentum', 'RSI(' + x[0] + ') regime ' + x[1] + '/' + x[2], candRsiRegime_(x[0], x[1], x[2])); });
  [7, 10, 14, 21, 28].forEach(function (a) { [1.5, 2, 2.5, 3, 4].forEach(function (m) { add('X-ST' + a + '-' + m, 'supertrend', 'Supertrend ATR' + a + ' x ' + m, candSupertrend_(a, m)); }); });
  [10, 20, 30, 50].forEach(function (p) { [1.5, 2, 2.5].forEach(function (k) { add('X-BB' + p + '-' + k, 'rompimento', 'Rompimento Bollinger (' + p + ', ' + k + ') e saída na média', candBollRompe_(p, k)); }); });
  [10, 20, 50].forEach(function (p) { [1.5, 2, 3].forEach(function (m) { add('X-KC' + p + '-' + m, 'rompimento', 'Rompimento Keltner (EMA' + p + ' + ' + m + ' ATR10)', candKeltner_(p, m)); }); });
  const base = {}; POOL.forEach(function (e) { base[e.id] = true; });
  return L;
}

/* =============================================================================
 * 2B. SELEÇÃO DAS 10 MELHORES ESTRATÉGIAS DE CADA MOEDA
 *
 * Princípio: escolher entre muitos candidatos contamina a medida (quem escolhe o melhor de 46 sempre vê um número
 * bonito, parte dele sorte). Por isso:
 *  1. A nota de cada candidato usa SOMENTE o período de seleção (IS = primeiros 70% do histórico, após o aquecimento
 *     das médias). O restante (OOS = últimos 30%) NUNCA entra na nota; ele serve para medir a decaída real.
 *  2. Elegível: Sharpe IS >= SELECAO_SHARPE_MIN (1,00) E Sharpe de 24 meses >= SELECAO_SHARPE_MIN_24M (0,90) E Sharpe de 12 meses >= SELECAO_SHARPE_MIN_12M (0,40), drawdown IS <=
 *     SELECAO_DD_MAX e trades mínimos no IS. Nenhuma vaga é preenchida com candidato abaixo disso (vaga fica ABERTA).
 *     Se faltarem estratégias, entra a BUSCA AMPLIADA (grade de ~300 parâmetros) e a escolha é refeita.
 *  3. Nota = média dos percentis de Sharpe IS e Calmar IS entre os elegíveis.
 *  4. Diversificação gulosa pela ordem da nota: no máximo SELECAO_MAX_POR_FAMILIA por família e correlação dos
 *     retornos diários no IS menor que SELECAO_CORR_MAX com as já escolhidas (evita 10 versões da mesma média móvel).
 *  5. A escolha fica congelada e só muda a cada SELECAO_REFRESH_DIAS ou pelo menu S. Entre reseleções, o desempenho
 *     "desde a seleção" é evidência genuinamente futura.
 * ===========================================================================*/
function dataStr_(d) { return Utilities.formatDate(d, 'UTC', 'yyyy-MM-dd'); }
function idxData_(o, str) { for (let i = 0; i < o.dates.length; i++) if (dataStr_(o.dates[i]) >= str) return i; return o.dates.length; }

/** Desempenho da curva de equity no intervalo de barras [a, b): base na barra a. */
function metricasFaixa_(eq, a, b) {
  if (!(b - a >= 90) || !(eq[a] > 0)) return null;
  const e0 = eq[a], r = []; let peak = 1, dd = 0;
  for (let i = a; i < b; i++) {
    const v = eq[i] / e0; if (v > peak) peak = v; dd = Math.max(dd, (peak - v) / peak * 100);
    if (i > a) r.push(eq[i] / eq[i - 1] - 1);
  }
  return metricasRet_(r, dd, eq[b - 1] / e0);
}
/** Sharpe anualizado (raiz 365) dos últimos `dias` retornos da curva de equity, sem contar o aquecimento (barra 210). Sem arredondar. */
function sharpeUlt_(eq, n, dias) {
  const ini = Math.max(211, n - dias), r = []; for (let i = ini; i < n; i++) r.push(eq[i] / eq[i - 1] - 1);
  if (r.length < 60) return null;
  const mu = r.reduce(function (a, b) { return a + b; }, 0) / r.length, sd = Math.sqrt(r.reduce(function (a, b) { return a + (b - mu) * (b - mu); }, 0) / r.length);
  return sd > 0 ? mu / sd * Math.sqrt(365) : 0;
}
/** Verdadeiro se a curva cumpre os mínimos de 24 e 12 meses. margem > 0 = histerese: quem já está na tabela só sai abaixo de (mínimo - margem). */
function cumprePermanencia_(eq, n, margem) {
  margem = margem || 0;
  const a = sharpeUlt_(eq, n, cfgNum_('SELECAO_JANELA_PERM_DIAS')), b = sharpeUlt_(eq, n, 365);
  return { ok: a !== null && b !== null && a >= cfgNum_('SELECAO_SHARPE_MIN_24M') - margem && b >= cfgNum_('SELECAO_SHARPE_MIN_12M') - margem, s24: a, s12: b };
}
function contarTrades_(r, a, b) { let k = 0; (r.tradeIdx || []).forEach(function (t) { if (t[0] >= a && t[0] < b) k++; }); return k; }
function retornos_(eq, a, b) { const x = []; for (let i = a + 1; i < b; i++) x.push(eq[i] / eq[i - 1] - 1); return x; }
function correl_(x, y) {
  const n = Math.min(x.length, y.length); if (n < 30) return 0;
  let sx = 0, sy = 0; for (let i = 0; i < n; i++) { sx += x[i]; sy += y[i]; }
  const mx = sx / n, my = sy / n; let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) * (x[i] - mx); syy += (y[i] - my) * (y[i] - my); }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : 0;
}
function percentis_(vals) {
  const idx = vals.map(function (v, i) { return i; }).sort(function (a, b) { return vals[a] - vals[b]; }), out = new Array(vals.length);
  idx.forEach(function (k, pos) { out[k] = vals.length > 1 ? pos / (vals.length - 1) : 1; });
  return out;
}

function avaliarCandidatos_(resLista, w0, cut, n, minTr, ddMax, shMin, idsBase) {
  return resLista.map(function (r) {
    const d = { id: r.id, fam: r.fam, nome: r.nome, r: r, situacao: '', slot: 0, base: !!idsBase[r.id] };
    if (r.erro || !r.eqCurve) { d.situacao = 'ERRO no cálculo'; return d; }
    d.isM = metricasFaixa_(r.eqCurve, w0, cut); d.oosM = metricasFaixa_(r.eqCurve, cut, n);
    d.nTrIS = contarTrades_(r, w0, cut); d.perm = cumprePermanencia_(r.eqCurve, n);
    if (!d.isM) d.situacao = 'sem dados no IS';
    else if (d.isM.sharpe < shMin) d.situacao = 'Sharpe IS ' + d.isM.sharpe + ' < ' + shMin;
    else if (!d.perm.ok) d.situacao = d.perm.s24 === null || d.perm.s12 === null ? 'histórico recente curto demais' : d.perm.s24 < cfgNum_('SELECAO_SHARPE_MIN_24M') ? 'Sharpe 24 meses ' + r_(d.perm.s24, 2) + ' < ' + cfgNum_('SELECAO_SHARPE_MIN_24M') : 'Sharpe 12 meses ' + r_(d.perm.s12, 2) + ' < ' + cfgNum_('SELECAO_SHARPE_MIN_12M');
    else if (d.isM.dd > ddMax) d.situacao = 'drawdown IS acima de ' + ddMax + '%';
    else if (d.nTrIS < minTr) d.situacao = 'poucos trades no IS (' + d.nTrIS + ' < ' + minTr + ')';
    else d.elegivel = true;
    return d;
  });
}
/** Nota e escolha gulosa (diversificação por família e correlação). Marca slot/situacao em det e devolve as escolhidas. */
function escolherDe_(det, alvo, maxFam, corrMax, w0, cut) {
  const eleg = det.filter(function (d) { return d.elegivel; });
  const pS = percentis_(eleg.map(function (d) { return d.isM.sharpe; })), pC = percentis_(eleg.map(function (d) { return d.isM.calmar; }));
  eleg.forEach(function (d, i) { d.nota = (pS[i] + pC[i]) / 2; });
  eleg.sort(function (a, b) { return b.nota - a.nota || b.isM.calmar - a.isM.calmar; });
  const escolhidas = [], porFam = {};
  eleg.forEach(function (d) {
    if (escolhidas.length >= alvo) { d.situacao = 'elegível, não escolhida (nota ' + r_(d.nota, 2) + ')'; return; }
    if ((porFam[d.fam] || 0) >= maxFam) { d.situacao = 'família ' + d.fam + ' já tem ' + maxFam; return; }
    d.ret = retornos_(d.r.eqCurve, w0, cut);
    for (let k = 0; k < escolhidas.length; k++) {
      const c = correl_(d.ret, escolhidas[k].ret);
      if (c > corrMax) { d.situacao = 'correlação ' + r_(c, 2) + ' com ' + escolhidas[k].id; return; }
    }
    d.slot = escolhidas.length + 1; d.situacao = 'ESCOLHIDA #' + d.slot; porFam[d.fam] = (porFam[d.fam] || 0) + 1; escolhidas.push(d);
  });
  return { escolhidas: escolhidas, nElegiveis: eleg.length };
}

/**
 * Seleção em duas fases. Fase 1: conjunto base. Se faltarem estratégias com Sharpe mínimo, fase 2 (busca ampliada):
 * roda a grade de parâmetros (gerarAmpliado devolve os resultados já calculados) e refaz a escolha sobre base + grade.
 * Se mesmo assim faltar, as vagas ficam ABERTAS (nunca se completa com candidato abaixo do Sharpe mínimo).
 */
function selecionar_(o, resBase, gerarAmpliado) {
  const n = o.closes.length, w0 = Math.min(210, n - 150);
  const cut = w0 + Math.floor((n - w0) * cfgNum_('SELECAO_CORTE_IS'));
  const isAnos = (cut - w0) / 365.25;
  const minTr = Math.max(5, Math.min(cfgNum_('SELECAO_MIN_TRADES_IS'), Math.round(isAnos * 2)));
  const ddMax = cfgNum_('SELECAO_DD_MAX'), maxFam = cfgNum_('SELECAO_MAX_POR_FAMILIA'), corrMax = cfgNum_('SELECAO_CORR_MAX'), alvo = cfgNum_('SELECAO_N_ESTRATEGIAS'), shMin = cfgNum_('SELECAO_SHARPE_MIN');
  const idsBase = {}; resBase.forEach(function (r) { idsBase[r.id] = true; });
  let det = avaliarCandidatos_(resBase, w0, cut, n, minTr, ddMax, shMin, idsBase), esc = escolherDe_(det, alvo, maxFam, corrMax, w0, cut), fase = 'base', nTestados = resBase.length;
  if (esc.escolhidas.length < alvo && gerarAmpliado) {
    const extra = gerarAmpliado();
    det = avaliarCandidatos_(resBase.concat(extra), w0, cut, n, minTr, ddMax, shMin, idsBase);
    esc = escolherDe_(det, alvo, maxFam, corrMax, w0, cut); fase = 'ampliada'; nTestados = resBase.length + extra.length;
  }
  det.forEach(function (d) { if (!d.situacao) d.situacao = '—'; });
  return { ids: esc.escolhidas.map(function (d) { return d.id; }), detalhe: det, w0Data: dataStr_(o.dates[w0]), corteData: dataStr_(o.dates[cut]),
    parcial: esc.escolhidas.length < alvo, vagas: alvo - esc.escolhidas.length, nElegiveis: esc.nElegiveis, minTr: minTr, fase: fase, nTestados: nTestados, shMin: shMin };
}

function lerSel_(sym) {
  const s = PropertiesService.getScriptProperties().getProperty('SEL_' + sym);
  try { return s ? JSON.parse(s) : null; } catch (e) { return null; }
}
function guardarSel_(sym, sel, dataHoje) {
  PropertiesService.getScriptProperties().setProperty('SEL_' + sym, JSON.stringify({ data: dataHoje, ids: sel.ids, w0: sel.w0Data, corte: sel.corteData, parcial: sel.parcial, vagas: sel.vagas, nElig: sel.nElegiveis, fase: sel.fase, nTest: sel.nTestados }));
}
function idadeDias_(str) { return str ? (Date.now() - new Date(str + 'T00:00:00Z').getTime()) / 86400000 : 1e9; }

function pendentesSel_() { try { return JSON.parse(PropertiesService.getScriptProperties().getProperty('SEL_PENDENTES') || '[]'); } catch (e) { return []; } }
function setPendentesSel_(l) { PropertiesService.getScriptProperties().setProperty('SEL_PENDENTES', JSON.stringify(l)); }

const COLS_SELECAO = ['Ativo', 'Posicao_Nota', 'ID', 'Familia', 'Estrategia', 'Trades_IS', 'Sharpe_IS', 'Calmar_IS', 'CAGR_IS_pct', 'MaxDD_IS_pct', 'Sharpe_OOS', 'Calmar_OOS', 'CAGR_OOS_pct', 'MaxDD_OOS_pct', 'Situacao', 'Periodo_IS', 'Data_Selecao'];
/** Auditoria: todos os candidatos de uma moeda, com a razão de cada um ter entrado ou não. Substitui as linhas anteriores da moeda. */
function gravarSelecaoCandidatos_(sym, sel, dataHoje) {
  const sh = ss_().getSheetByName(P2.ABAS.sel); if (!sh) return;
  let antigas = [];
  if (sh.getLastRow() > 1) antigas = sh.getRange(2, 1, sh.getLastRow() - 1, COLS_SELECAO.length).getValues().filter(function (r) { return r[0] !== sym; });
  const visiveis = sel.detalhe.filter(function (d) { return d.base || d.elegivel || d.slot; }), ocultos = sel.detalhe.length - visiveis.length;
  const ord = visiveis.sort(function (a, b) { return (b.slot ? 1000 - b.slot : 0) - (a.slot ? 1000 - a.slot : 0) || (b.nota || -1) - (a.nota || -1); });
  const novas = ord.map(function (d, i) {
    const a = d.isM || {}, b = d.oosM || {};
    return [sym, d.slot || '', d.id, d.fam, d.nome, d.nTrIS === undefined ? '' : d.nTrIS, a.sharpe === undefined ? '' : a.sharpe, a.calmar === undefined ? '' : a.calmar, a.cagr === undefined ? '' : a.cagr, a.dd === undefined ? '' : a.dd,
      b.sharpe === undefined ? '' : b.sharpe, b.calmar === undefined ? '' : b.calmar, b.cagr === undefined ? '' : b.cagr, b.dd === undefined ? '' : b.dd, d.situacao, sel.w0Data + ' a ' + sel.corteData, dataHoje];
  });
  novas.push([sym, '', '(resumo)', '', 'Fase ' + sel.fase + ': ' + sel.nTestados + ' candidatos testados; ' + sel.nElegiveis + ' passaram nos filtros (Sharpe IS >= ' + sel.shMin + ', 24 meses >= ' + cfgNum_('SELECAO_SHARPE_MIN_24M') + ', 12 meses >= ' + cfgNum_('SELECAO_SHARPE_MIN_12M') + ', drawdown, trades); ' + ocultos + ' da busca ampliada reprovados não listados. Vagas abertas: ' + sel.vagas, '', '', '', '', '', '', '', '', '', '', sel.parcial ? 'VAGAS ABERTAS' : 'COMPLETA', sel.w0Data + ' a ' + sel.corteData, dataHoje]);
  const todas = antigas.concat(novas);
  sh.clear();
  sh.getRange(1, 1, 1, COLS_SELECAO.length).setValues([COLS_SELECAO]).setFontWeight('bold').setBackground('#0b1f3a').setFontColor('#ffffff').setWrap(true);
  sh.getRange(2, 16, todas.length, 2).setNumberFormat('@');
  sh.getRange(2, 1, todas.length, COLS_SELECAO.length).setValues(todas);
  todas.forEach(function (r, i) { if (r[1] !== '') sh.getRange(i + 2, 1, 1, COLS_SELECAO.length).setBackground('#e6f4ea'); });
  sh.setFrozenRows(1); sh.setColumnWidth(5, 330); sh.setColumnWidth(15, 280); sh.setColumnWidth(16, 170);
}


/* ---- copiado do Projeto 02: confluência SMC/ICT/Trendline ---- */
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



/* ---- copiado do Projeto 02: gatilhos ---- */
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


/* ---- copiado do Projeto 02: estratégias, motor de backtest e indicadores (runBacktest_ devolve também eqCurve e tradeIdx) ---- */
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
        trades.push({ ei: entryIdx, xi: i, entryDate: o.dates[entryIdx], exitDate: o.dates[i], ret: ret * 100, motivo: (stopHit && !s.exitSignal[i - 1]) ? 'STOP' : 'SINAL' });
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
    eqCurve: eq,
    tradeIdx: trades.map(function (t) { return [t.ei, t.xi]; }),
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
 * 5. INGESTÃO — ver top10_data (adaptadores por corretora)
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


/* =============================================================================
 * 5. FONTES DE DADOS — adaptadores por corretora (candles diários UTC)
 *    Cada adaptador devolve [{date, open, high, low, close, volume}]. o.dias = baixa só os últimos N dias
 *    (atualização incremental e diagnóstico); sem o.dias baixa todo o histórico disponível.
 * ===========================================================================*/
const MS_DIA = 86400000;

function candle_(ts, o, h, l, c, v) { return { date: new Date(ts), open: +o, high: +h, low: +l, close: +c, volume: +v || 0 }; }

function fetchBinance_(par, o) {
  const base = 'https://data-api.binance.vision/api/v3/klines?symbol=' + par + '&interval=1d&limit=1000';
  let start = o.dias ? Date.now() - o.dias * MS_DIA : P2.HIST_INICIO_MS;
  const out = []; let g = 0;
  while (g++ < 20) {
    const rows = fetchJson_(base + '&startTime=' + start, null, 2);
    if (!Array.isArray(rows) || !rows.length) break;
    rows.forEach(function (r) { out.push(candle_(r[0], r[1], r[2], r[3], r[4], r[5])); });
    if (rows.length < 1000) break;
    start = rows[rows.length - 1][0] + MS_DIA;
  }
  return out;
}
function fetchOkxPar_(par, o) {
  const by = {}; let after = null, g = 0; const lim = o.dias ? Math.min(100, o.dias + 2) : 100;
  while (g++ < 80) {
    let url = 'https://www.okx.com/api/v5/market/history-candles?instId=' + par + '&bar=1Dutc&limit=' + lim;
    if (after) url += '&after=' + after;
    const p = fetchJson_(url, null, 2);
    if (String(p.code) !== '0' || !p.data || !p.data.length) break;
    let min = Infinity;
    p.data.forEach(function (r) { const ts = parseInt(r[0], 10); by[ts] = candle_(ts, r[1], r[2], r[3], r[4], r[5]); if (ts < min) min = ts; });
    if (o.dias || p.data.length < lim) break;
    after = min;
  }
  return Object.keys(by).map(function (k) { return by[k]; });
}
function fetchBybit_(par, o) {
  const out = []; let end = null, g = 0; const lim = o.dias ? o.dias + 2 : 1000;
  while (g++ < 12) {
    let url = 'https://api.bybit.com/v5/market/kline?category=spot&symbol=' + par + '&interval=D&limit=' + lim;
    if (end) url += '&end=' + end;
    const p = fetchJson_(url, null, 2), list = p && p.result && p.result.list;
    if (!list || !list.length) break;
    let min = Infinity;
    list.forEach(function (r) { const ts = +r[0]; out.push(candle_(ts, r[1], r[2], r[3], r[4], r[5])); if (ts < min) min = ts; });
    if (o.dias || list.length < lim) break;
    end = min - 1;
  }
  return out;
}
function fetchKucoinPar_(par, o) {
  const by = {}, gen = Math.floor(P2.HIST_INICIO_MS / 1000), span = (o.dias || 1400) * 86400; let end = Math.floor(Date.now() / 1000), g = 0, vazios = 0;
  while (end > gen && g++ < 12) {
    const start = Math.max(gen, end - span);
    const p = fetchJson_('https://api.kucoin.com/api/v1/market/candles?type=1day&symbol=' + par + '&startAt=' + start + '&endAt=' + end, null, 2), d = (p && p.data) || [];
    if (!d.length) { vazios++; if (Object.keys(by).length || vazios >= 2) break; }
    else vazios = 0;
    d.forEach(function (r) { const t = parseInt(r[0], 10) * 1000; by[t] = candle_(t, r[1], r[3], r[4], r[2], r[5]); });
    if (o.dias) break;
    end = start;
  }
  return Object.keys(by).map(function (k) { return by[k]; });
}
function fetchCoinbasePar_(par, o) {
  const now = Math.floor(Date.now() / 1000), passo = 300 * 86400, by = {}, desde = o.dias ? now - o.dias * 86400 : Math.floor(P2.HIST_INICIO_MS / 1000);
  let end = now, g = 0, vazios = 0;
  while (end > desde && g++ < 60) {
    const start = Math.max(desde, end - passo);
    const rows = fetchJson_('https://api.exchange.coinbase.com/products/' + par + '/candles?granularity=86400&start=' + new Date(start * 1000).toISOString() + '&end=' + new Date(end * 1000).toISOString(), null, 2);
    const lista = Array.isArray(rows) ? rows : [];
    if (!lista.length) { vazios++; if (Object.keys(by).length || vazios >= 3) break; } else vazios = 0;
    lista.forEach(function (r) { by[r[0] * 1000] = candle_(r[0] * 1000, r[3], r[2], r[1], r[4], r[5]); });
    end = start;
  }
  return Object.keys(by).map(function (k) { return by[k]; });
}
function fetchKrakenPar_(par, o) {
  const p = fetchJson_('https://api.kraken.com/0/public/OHLC?pair=' + par + '&interval=1440', null, 2);
  const k = Object.keys((p && p.result) || {}).filter(function (x) { return x !== 'last'; })[0];
  return (k ? p.result[k] : []).map(function (r) { return candle_(r[0] * 1000, r[1], r[2], r[3], r[4], r[6]); });   // Kraken devolve no máximo 720 velas
}
function fetchBitfinex_(par, o) {
  let url = 'https://api-pub.bitfinex.com/v2/candles/trade:1D:t' + par + '/hist?limit=10000&sort=1';
  if (o.dias) url += '&start=' + (Date.now() - o.dias * MS_DIA);
  const rows = fetchJson_(url, null, 2);
  return (Array.isArray(rows) ? rows : []).map(function (r) { return candle_(r[0], r[1], r[3], r[4], r[2], r[5]); });   // [MTS, OPEN, CLOSE, HIGH, LOW, VOLUME]
}
const ADAPTADORES = { binance: fetchBinance_, okx: fetchOkxPar_, bybit: fetchBybit_, kucoin: fetchKucoinPar_, coinbase: fetchCoinbasePar_, kraken: fetchKrakenPar_, bitfinex: fetchBitfinex_ };

/** "binance:ETHUSDT,okx:ETH-USDT" -> [{src, par}] */
function parseFontes_(txt) {
  return String(txt || '').split(',').map(function (s) { s = s.trim(); const i = s.indexOf(':'); return i > 0 ? { src: s.substring(0, i).toLowerCase(), par: s.substring(i + 1).trim() } : null; })
    .filter(function (x) { return x && ADAPTADORES[x.src]; });
}

/**
 * Tenta as fontes do ativo em ordem (a que já funcionou vai primeiro) e devolve a primeira com velas suficientes.
 * minVelas: 1 para incremental, MIN_CANDLES para carga completa.
 */
function baixarSerieAtivo_(u, o, minVelas) {
  const fontes = parseFontes_(u.fontes), falhas = [];
  if (u.fonteOk) { const i = fontes.map(function (f) { return f.src + ':' + f.par; }).indexOf(u.fonteOk); if (i > 0) fontes.unshift(fontes.splice(i, 1)[0]); }
  for (let i = 0; i < fontes.length; i++) {
    const f = fontes[i];
    try {
      const serie = sanearSerie_(ADAPTADORES[f.src](f.par, o));
      if (serie.length >= minVelas) { serie.fonte = f.src + ':' + f.par; return serie; }
      falhas.push(f.src + ': ' + serie.length + ' velas');
    } catch (e) { falhas.push(f.src + ': ' + e.message); }
  }
  throw new Error('Sem fonte para ' + u.sym + ' (' + (falhas.join(' | ') || 'nenhuma fonte configurada') + ')');
}

/* =============================================================================
 * 5B. ABAS BASE_<SIMBOLO> (OHLCV diário) — leitura, carga completa e atualização incremental
 * ===========================================================================*/
function abaBase_(sym, criar) {
  const nome = 'BASE_' + sym; let sh = ss_().getSheetByName(nome);
  if (!sh && criar) {
    sh = ss_().insertSheet(nome);
    sh.getRange(1, 1, 1, 7).setValues([['Data', 'Open', 'High', 'Low', 'Close', 'Volume', 'Retorno_Diario_pct']]).setFontWeight('bold').setBackground('#0b1f3a').setFontColor('#ffffff');
    sh.setFrozenRows(1);
  }
  return sh;
}
function lerBase_(sym) {
  const sh = abaBase_(sym, false), o = { dates: [], opens: [], highs: [], lows: [], closes: [], volumes: [] };
  if (!sh || sh.getLastRow() < 2) return o;
  sh.getRange(2, 1, sh.getLastRow() - 1, 6).getValues().forEach(function (r) {
    if (r[0] === '' || !(r[4] > 0)) return;
    const d = r[0] instanceof Date ? new Date(Date.UTC(r[0].getFullYear(), r[0].getMonth(), r[0].getDate())) : new Date(String(r[0]) + 'T00:00:00Z');
    o.dates.push(d); o.opens.push(+r[1]); o.highs.push(+r[2]); o.lows.push(+r[3]); o.closes.push(+r[4]); o.volumes.push(+r[5] || 0);
  });
  return o;
}
function linhasBase_(serie, anterior) {
  return serie.map(function (c, i) {
    const p = i ? serie[i - 1].close : anterior;
    return [Utilities.formatDate(c.date, 'UTC', 'yyyy-MM-dd'), c.open, c.high, c.low, c.close, r_(c.volume, 4), p ? r_((c.close / p - 1) * 100, 4) : ''];
  });
}
function ontemUtcMs_() { const d = new Date(); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - MS_DIA; }

/** Atualiza a aba base do ativo. Retorna { ohlcv, novaVela, fonte, carga }. */
function atualizarBase_(u) {
  const sh = abaBase_(u.sym, true), atual = lerBase_(u.sym), n = atual.dates.length;
  if (n < P2.MIN_CANDLES) {
    const serie = baixarSerieAtivo_(u, {}, P2.MIN_CANDLES);
    const linhas = linhasBase_(serie, null);
    if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 7).clearContent();
    sh.getRange(2, 1, linhas.length, 1).setNumberFormat('@');
    sh.getRange(2, 1, linhas.length, 7).setValues(linhas);
    return { ohlcv: lerBase_(u.sym), novaVela: true, fonte: serie.fonte, carga: 'COMPLETA' };
  }
  const ultimo = atual.dates[n - 1].getTime();
  if (ultimo >= ontemUtcMs_()) return { ohlcv: atual, novaVela: false, fonte: u.fonteOk, carga: 'NENHUMA' };
  const dias = Math.min(400, Math.ceil((Date.now() - ultimo) / MS_DIA) + 6);
  const novos = baixarSerieAtivo_(u, { dias: dias }, 1), fonte = novos.fonte;
  // reconstrói a continuidade (preenche lacunas planas) a partir das últimas 3 velas existentes
  const ponte = [];
  for (let i = Math.max(0, n - 3); i < n; i++) ponte.push({ date: atual.dates[i], open: atual.opens[i], high: atual.highs[i], low: atual.lows[i], close: atual.closes[i], volume: atual.volumes[i] });
  const unido = sanearSerie_(ponte.concat(novos.filter(function (c) { return c.date.getTime() > ultimo; })));
  const adicionar = unido.filter(function (c) { return c.date.getTime() > ultimo; });
  if (!adicionar.length) return { ohlcv: atual, novaVela: false, fonte: fonte, carga: 'NENHUMA' };
  const linhas = linhasBase_(adicionar, atual.closes[n - 1]);
  const ini = sh.getLastRow() + 1;
  sh.getRange(ini, 1, linhas.length, 1).setNumberFormat('@');
  sh.getRange(ini, 1, linhas.length, 7).setValues(linhas);
  return { ohlcv: lerBase_(u.sym), novaVela: true, fonte: fonte, carga: 'INCREMENTAL' };
}



/* ---- copiado do Projeto 02: indicadores para consenso e esticamento ---- */
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


/* =============================================================================
 * 8. UNIVERSO — lista de ativos (aba UNIVERSO) e semente inicial
 *    Colunas: A Ordem | B Simbolo | C CoinGecko_ID | D Nome | E Rank_MC | F Tipo | G Status | H Fontes |
 *             I Fonte_OK | J Inicio_Historico | K N_Velas | L Ultima_Vela | M Ultima_Atualizacao | N Observacao
 *    Status: REFERENCIA (BTC) | ATIVO | EXCLUIDO. Fontes: "corretora:PAR,corretora:PAR" na ordem de preferência.
 * ===========================================================================*/
const COLS_UNIVERSO = ['Ordem', 'Simbolo', 'CoinGecko_ID', 'Nome', 'Rank_MC', 'Tipo', 'Status', 'Fontes', 'Fonte_OK', 'Inicio_Historico', 'N_Velas', 'Ultima_Vela', 'Ultima_Atualizacao', 'Observacao'];
const SEED_UNIVERSO = [
  [1, 'BTC', 'bitcoin', 'Bitcoin', 'CRIPTO', 'REFERENCIA', 'coinbase:BTC-USD,binance:BTCUSDT,okx:BTC-USDT,kraken:XBTUSD', 'Referência: o mesmo motor roda no BTC para comparação com o Projeto 02'],
  [2, 'ETH', 'ethereum', 'Ethereum', 'CRIPTO', 'ATIVO', 'binance:ETHUSDT,coinbase:ETH-USD,okx:ETH-USDT,kucoin:ETH-USDT,kraken:ETHUSD', ''],
  [3, 'USDT', 'tether', 'Tether', 'STABLECOIN', 'EXCLUIDO', '', 'Stablecoin: não há tendência para testar'],
  [4, 'BNB', 'binancecoin', 'BNB', 'CRIPTO', 'ATIVO', 'binance:BNBUSDT,okx:BNB-USDT,kucoin:BNB-USDT,bybit:BNBUSDT', 'Não está na Coinbase nem na Kraken'],
  [5, 'XRP', 'ripple', 'XRP', 'CRIPTO', 'ATIVO', 'binance:XRPUSDT,coinbase:XRP-USD,okx:XRP-USDT,kucoin:XRP-USDT,kraken:XRPUSD', ''],
  [6, 'USDC', 'usd-coin', 'USDC', 'STABLECOIN', 'EXCLUIDO', '', 'Stablecoin: não há tendência para testar'],
  [7, 'SOL', 'solana', 'Solana', 'CRIPTO', 'ATIVO', 'binance:SOLUSDT,coinbase:SOL-USD,okx:SOL-USDT,kucoin:SOL-USDT,kraken:SOLUSD', 'Histórico desde 2020'],
  [8, 'TRX', 'tron', 'TRON', 'CRIPTO', 'ATIVO', 'binance:TRXUSDT,okx:TRX-USDT,kucoin:TRX-USDT,kraken:TRXUSD', ''],
  [9, 'FIGR_HELOC', 'figure-heloc', 'Figure Heloc', 'RWA', 'EXCLUIDO', '', 'Empréstimo tokenizado cotado perto de US$ 1: não é um ativo de tendência'],
  [10, 'ZEC', 'zcash', 'Zcash', 'CRIPTO', 'ATIVO', 'binance:ZECUSDT,coinbase:ZEC-USD,okx:ZEC-USDT,kucoin:ZEC-USDT,kraken:ZECUSD,bitfinex:ZECUSD', ''],
  [11, 'HYPE', 'hyperliquid', 'Hyperliquid', 'CRIPTO', 'ATIVO', 'okx:HYPE-USDT,bybit:HYPEUSDT,kucoin:HYPE-USDT,binance:HYPEUSDT', 'Histórico curto (desde o fim de 2024): consenso só com 450+ velas'],
  [12, 'DOGE', 'dogecoin', 'Dogecoin', 'CRIPTO', 'ATIVO', 'binance:DOGEUSDT,coinbase:DOGE-USD,okx:DOGE-USDT,kucoin:DOGE-USDT,kraken:XDGUSD', ''],
  [13, 'LINK', 'chainlink', 'Chainlink', 'CRIPTO', 'ATIVO', 'binance:LINKUSDT,coinbase:LINK-USD,okx:LINK-USDT,kucoin:LINK-USDT,kraken:LINKUSD,bitfinex:LINK:USD', 'MANUAL: escolha do usuário (fora da janela #2 a #13 do ranking)'],
  [14, 'AAVE', 'aave', 'Aave', 'CRIPTO', 'ATIVO', 'binance:AAVEUSDT,coinbase:AAVE-USD,okx:AAVE-USDT,kucoin:AAVE-USDT,kraken:AAVEUSD,bitfinex:AAVE:USD', 'MANUAL: escolha do usuário (fora da janela #2 a #13 do ranking). Histórico desde out/2020'],
  [15, 'XMR', 'monero', 'Monero', 'CRIPTO', 'EXCLUIDO', 'bitfinex:XMRUSD,kucoin:XMR-USDT,kraken:XMRUSD', 'Retirada por decisão do usuário (substituída por LINK e AAVE)'],
  [16, 'USDS', 'usds', 'USDS', 'STABLECOIN', 'EXCLUIDO', '', 'Stablecoin'],
];

function universo_() {
  const sh = ss_().getSheetByName(P2.ABAS.universo), out = [];
  if (!sh || sh.getLastRow() < 2) return out;
  sh.getRange(2, 1, sh.getLastRow() - 1, COLS_UNIVERSO.length).getValues().forEach(function (r, i) {
    if (!r[1]) return;
    out.push({ row: i + 2, ordem: r[0], sym: String(r[1]).trim(), geckoId: String(r[2]).trim(), nome: r[3], rank: r[4], tipo: r[5], status: String(r[6]).trim().toUpperCase(),
      fontes: r[7], fonteOk: String(r[8] || '').trim(), inicio: r[9], nVelas: r[10], ultimaVela: r[11] instanceof Date ? Utilities.formatDate(r[11], 'UTC', 'yyyy-MM-dd') : String(r[11] || ''), obs: r[13] });
  });
  return out;
}
function ativosUniverso_() { return universo_().filter(function (u) { return u.status === 'ATIVO' || u.status === 'REFERENCIA'; }); }
function gravarLinhaUniverso_(u, fonteOk, o) {
  const n = o.closes.length, fmt = function (d) { return Utilities.formatDate(d, 'UTC', 'yyyy-MM-dd'); };
  ss_().getSheetByName(P2.ABAS.universo).getRange(u.row, 9, 1, 5).setValues([[fonteOk || u.fonteOk, n ? fmt(o.dates[0]) : '', n, n ? fmt(o.dates[n - 1]) : '',
    Utilities.formatDate(new Date(), P2.TZ_BRT, 'dd/MM/yyyy HH:mm')]]);
}

/* =============================================================================
 * 9. PROCESSAMENTO POR ATIVO — mesmo motor do BTC + métricas de desempenho
 * ===========================================================================*/
function guardarRes_(sym, obj) { PropertiesService.getScriptProperties().setProperty('RES_' + sym, JSON.stringify(obj)); }
function lerRes_(sym) {
  const s = PropertiesService.getScriptProperties().getProperty('RES_' + sym);
  try { return s ? JSON.parse(s) : null; } catch (e) { return null; }
}

/** Desempenho de uma curva de equity (ou de preços) a partir da barra ini, já depois do aquecimento das médias. */
function metricasJanela_(eq, ini) { return metricasFaixa_(eq, ini, eq.length); }
function metricasRet_(r, dd, final) {
  const yrs = r.length / 365.25, cagr = final > 0 ? (Math.pow(final, 1 / yrs) - 1) * 100 : -100;
  const mu = r.reduce(function (a, b) { return a + b; }, 0) / r.length;
  const sd = Math.sqrt(r.reduce(function (a, b) { return a + (b - mu) * (b - mu); }, 0) / r.length);
  return { cagr: r_(cagr, 1), dd: r_(dd, 1), sharpe: r_(sd > 0 ? mu / sd * Math.sqrt(365) : 0, 2), calmar: r_(dd > 0 ? cagr / dd : 0, 2), anos: r_(yrs, 1) };
}
/** Painel das 10 em peso igual no intervalo [a, b): média dos retornos diários das curvas de equity das estratégias. */
function metricasPainel_(res, a, b) {
  const curvas = res.filter(function (x) { return x.eqCurve && !x.erro && x.ativa !== false; }).map(function (x) { return x.eqCurve; });
  if (!curvas.length) return null;
  b = b || curvas[0].length; if (b - a < 90) return null;
  const r = []; let v = 1, peak = 1, dd = 0;
  for (let i = a + 1; i < b; i++) {
    let s = 0; curvas.forEach(function (c) { s += c[i] / c[i - 1] - 1; });
    const x = s / curvas.length; r.push(x); v *= (1 + x); if (v > peak) peak = v; dd = Math.max(dd, (peak - v) / peak * 100);
  }
  return metricasRet_(r, dd, v);
}

/** Roda uma lista de candidatos sobre a série (mesmo motor para todos). */
function rodarLista_(o, lista) {
  return lista.map(function (e) {
    let r;
    try { r = runBacktest_(o, e.fn(o)); } catch (err) { r = { erro: err.message, posAtual: 0 }; }
    r.id = e.id; r.key = e.key || e.id; r.nome = e.nome; r.ativa = true; r.grupo = e.grupo || 'Seleção'; r.fam = e.fam;
    return r;
  });
}

/** Recompõe, só se a seleção usou a fase ampliada, os candidatos da grade (IDs começam com X-). */
function gerarPoolAmpliadoSeNecessario_(sel) {
  return sel.ids.some(function (id) { return id.indexOf('X-') === 0; }) ? gerarPoolAmpliado_() : [];
}

function processarAtivo_(u, forcar) {
  const prev = lerRes_(u.sym), ontemStr = Utilities.formatDate(new Date(ontemUtcMs_()), 'UTC', 'yyyy-MM-dd');
  const pend = pendentesSel_(), pendente = pend.indexOf(u.sym) >= 0;
  if (!forcar && !pendente && prev && prev.estado === 'OK' && u.ultimaVela >= ontemStr) return { resumo: prev, eventos: [], pulou: true };
  const b = atualizarBase_(u), o = b.ohlcv, n = o.closes.length;
  gravarLinhaUniverso_(u, b.fonte, o);
  const base = { sym: u.sym, ordem: u.ordem, nome: u.nome, status: u.status, fonte: b.fonte || u.fonteOk, n: n, atualizado: new Date().toISOString() };
  if (n < cfgNum_('MIN_VELAS_CONSENSO')) {
    const res0 = Object.assign(base, { estado: 'HISTORICO_INSUFICIENTE', ultimaVela: n ? Utilities.formatDate(o.dates[n - 1], 'UTC', 'yyyy-MM-dd') : '', preco: n ? o.closes[n - 1] : null });
    guardarRes_(u.sym, res0); return { resumo: res0, eventos: [] };
  }
  const hoje = Utilities.formatDate(new Date(), 'UTC', 'yyyy-MM-dd');
  const fixas = u.status === 'REFERENCIA' || !cfgSim_('SELECAO_ATIVA');
  let sel = null, res, cutStr, w0Str, dataSel = '';
  if (fixas) {
    res = rodarLista_(o, FIXAS_BTC); cutStr = '2023-06-02'; w0Str = dataStr_(o.dates[Math.min(200, n - 150)]); dataSel = 'fixas (Projeto 02)';
  } else {
    sel = lerSel_(u.sym);
    const shMin = cfgNum_('SELECAO_SHARPE_MIN');
    const fazer = function () {
      const pool = rodarLista_(o, POOL), s = selecionar_(o, pool, function () { return rodarLista_(o, gerarPoolAmpliado_()); });
      guardarSel_(u.sym, s, hoje); gravarSelecaoCandidatos_(u.sym, s, hoje);
      sel = lerSel_(u.sym);
      res = s.ids.map(function (id) { return s.detalhe.filter(function (d) { return d.id === id; })[0].r; });
      if (pendente) setPendentesSel_(pend.filter(function (x) { return x !== u.sym; }));
    };
    if (!sel || pendente || idadeDias_(sel.data) >= cfgNum_('SELECAO_REFRESH_DIAS')) fazer();
    else {
      const lista = sel.ids.map(function (id) { return POOL.concat(gerarPoolAmpliadoSeNecessario_(sel)).filter(function (e) { return e.id === id; })[0]; }).filter(Boolean);
      res = rodarLista_(o, lista);
      // permanência: estratégia cujo Sharpe de 24 meses cai abaixo do mínimo sai da tabela (revisão no máximo a cada SELECAO_REVISAO_DIAS)
      const caiu = res.filter(function (r) { return !r.erro && !cumprePermanencia_(r.eqCurve, n, cfgNum_('SELECAO_HISTERESE')).ok; }).length;
      if ((caiu || sel.vagas > 0) && idadeDias_(sel.data) >= cfgNum_('SELECAO_REVISAO_DIAS')) fazer();
    }
    cutStr = sel.corte; w0Str = sel.w0; dataSel = sel.data;
  }
  if (!res.length) {
    const res1 = Object.assign(base, { estado: 'SEM_ESTRATEGIA_ELEGIVEL', vagas: sel ? sel.vagas : 10, fase: sel ? sel.fase : '', ultimaVela: Utilities.formatDate(o.dates[n - 1], 'UTC', 'yyyy-MM-dd'), preco: o.closes[n - 1] });
    guardarRes_(u.sym, res1); return { resumo: res1, eventos: [] };
  }
  res.forEach(function (r) {
    if (r.erro || !r.eqCurve) return;
    r.perm = cumprePermanencia_(r.eqCurve, n);
    if (fixas && !cumprePermanencia_(r.eqCurve, n, cfgNum_('SELECAO_HISTERESE')).ok) r.ativa = false;   // BTC: estratégia fora do mínimo sai do consenso (continua visível na tabela como FORA DA REGRA)
  });
  const I = calcularIndicadores_(o), cons = consenso_(res), termo = termometro_(o, I, null);
  const w0 = idxData_(o, w0Str), cut = idxData_(o, cutStr), ini = Math.min(n - 91, cfgNum_('JANELA_INICIO_BARRAS')), C = o.closes, L = n - 1;
  const iSel = sel ? idxData_(o, sel.data) : -1;
  const somaPeso = res.reduce(function (a, r) { return a + (r.ativa && !r.erro ? r.peso || 0 : 0); }, 0);
  const estr = res.map(function (r, k) {
    const m = r.eqCurve ? metricasJanela_(r.eqCurve, ini) : null, mi = r.eqCurve ? metricasFaixa_(r.eqCurve, w0, cut) : null, mo = r.eqCurve ? metricasFaixa_(r.eqCurve, cut, n) : null;
    const fw = r.eqCurve && iSel > 0 ? metricasFaixa_(r.eqCurve, iSel, n) : null;
    return { id: r.id, fam: r.fam || '', nome: r.nome, slot: k + 1, pos: r.posAtual, evento: r.evento || (r.erro ? 'ERRO' : ''), pe: r.precoEntrada ? r_(r.precoEntrada, 6) : null, stop: r.stopAtual ? r_(r.stopAtual, 6) : null,
      la: r_(r.lucroAbertoPct || 0), lacum: r_(r.lucroAcumPct || 0), nt: r.nTrades || 0, win: r.winRate === null || r.winRate === undefined ? null : r_(r.winRate, 1),
      sh3: r_(r.sharpe || 0, 2), peso: somaPeso > 0 ? r_((r.peso || 0) / somaPeso * 100, 1) : 0, cagr: m ? m.cagr : null, dd: m ? m.dd : null, calmar: m ? m.calmar : null,
      sh12: r.perm && r.perm.s12 !== null ? r_(r.perm.s12, 2) : null, sh24: r.perm && r.perm.s24 !== null ? r_(r.perm.s24, 2) : null, fora: r.ativa === false, isSh: mi ? mi.sharpe : null, isCa: mi ? mi.calmar : null, isTr: r.eqCurve ? contarTrades_(r, w0, cut) : null,
      oosSh: mo ? mo.sharpe : null, oosCa: mo ? mo.calmar : null, oosCagr: mo ? mo.cagr : null, oosDd: mo ? mo.dd : null, fwCagr: fw ? fw.cagr : null, fwDd: fw ? fw.dd : null };
  });
  const bhEq = C, eventos = detectarEventos_(o, I, res, null).map(function (e) { e.sym = u.sym; return e; });
  const out = Object.assign(base, {
    estado: 'OK', ultimaVela: Utilities.formatDate(o.dates[L], 'UTC', 'yyyy-MM-dd'), preco: C[L],
    v1: r_((C[L] / C[L - 1] - 1) * 100, 2), v7: r_((C[L] / C[L - 7] - 1) * 100, 2), v30: r_((C[L] / C[L - 30] - 1) * 100, 2),
    sma200: r_(I.SMA200[L], 6), acima200: C[L] > I.SMA200[L], idx: r_(cons.pct, 1), leitura: cons.leitura, comprados: cons.comprados, nEstr: cons.n, modo: cons.modo,
    estic: termo.valor, faixa: termo.faixa, acao: termo.acao, regime: termo.regime, cobertura: termo.cobertura,
    painel: metricasPainel_(res, ini), painelIS: metricasPainel_(res, w0, cut), painelOOS: metricasPainel_(res, cut, n),
    bh: metricasJanela_(bhEq, ini), bhIS: metricasFaixa_(bhEq, w0, cut), bhOOS: metricasFaixa_(bhEq, cut, n),
    selData: dataSel, w0: w0Str, corte: cutStr, fixas: fixas, parcial: sel ? !!sel.parcial : false, vagas: sel ? (sel.vagas || 0) : 0, fase: sel ? sel.fase : '', nTest: sel ? sel.nTest : null, nElig: sel ? sel.nElig : null, estr: estr, carga: b.carga,
  });
  guardarRes_(u.sym, out);
  return { resumo: out, eventos: eventos };
}


/* ---- copiado do Projeto 02: consenso e termômetro ---- */
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



/* ---- copiado do Projeto 02: detecção de anomalias ---- */
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



/* ---- copiado do Projeto 02: log e deduplicação ---- */
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



/* ---- copiado do Projeto 02: e-mail institucional ---- */
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
    '<div style="font-size:12px;opacity:.8;margin-top:4px">Crypto Top 10 · Terminal Quantitativo · ' + Utilities.formatDate(new Date(), P2.TZ_BRT, "dd/MM/yyyy HH:mm 'BRT'") + '</div></div>' +
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
    try { MailApp.sendEmail({ to: e, subject: assunto, htmlBody: html, name: 'Crypto Top 10 · Inteligência Quantitativa' }); ok++; }
    catch (err) { falhas.push(e + ': ' + err.message); }
  });
  return { dest: dest.join(', '), ok: ok, total: dest.length, efet: dest.length ? r_(ok / dest.length * 100, 1) : 0, falhas: falhas };
}


/* =============================================================================
 * 12. PAINÉIS — PAINEL_TOP10, ESTRATEGIAS_TOP10 e DESEMPENHO_10 (reconstruídos a partir dos resultados guardados)
 * ===========================================================================*/
function resultadosOrdenados_() {
  return ativosUniverso_().sort(function (a, b) { return a.ordem - b.ordem; }).map(function (u) { return { u: u, r: lerRes_(u.sym) }; });
}
function fmtPreco_(v) {
  if (v === null || v === undefined || isNaN(v)) return '—';
  const d = v >= 100 ? 0 : v >= 1 ? 2 : 4;
  return '$ ' + Number(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}
function fmtPct_(v) { return v === null || v === undefined || isNaN(v) ? '—' : (v > 0 ? '+' : '') + v + '%'; }

function gravarPainel_() {
  const sh = ss_().getSheetByName(P2.ABAS.painel), lista = resultadosOrdenados_();
  const cab = ['Ordem', 'Ativo', 'Preço (fechamento)', '24h', '7 dias', '30 dias', 'Preço vs média de 200d', 'Índice de Exposição Tática', 'Leitura do Consenso', 'Estratégias compradas',
    'Esticamento (0 barato a 100 caro)', 'Faixa', 'Histórico (anos)', 'Fonte dos dados', 'Última vela (UTC)', 'Estado'];
  const rows = lista.map(function (x) {
    const r = x.r, u = x.u;
    if (!r) return [u.ordem, u.sym, '—', '—', '—', '—', '—', '—', '—', '—', '—', '—', '—', u.fonteOk || '—', '—', 'AGUARDANDO CARGA'];
    if (r.estado !== 'OK') return [u.ordem, u.sym, fmtPreco_(r.preco), '—', '—', '—', '—', '—', '—', '—', '—', '—', r.n ? r_(r.n / 365.25, 1) : '—', r.fonte || '—', r.ultimaVela || '—', r.estado];
    return [u.ordem, u.sym + (u.status === 'REFERENCIA' ? ' (referência)' : ''), fmtPreco_(r.preco), fmtPct_(r.v1), fmtPct_(r.v7), fmtPct_(r.v30), r.acima200 ? 'ACIMA' : 'ABAIXO',
      r_(r.idx, 0) + '% Favorável / ' + r_(100 - r.idx, 0) + '% Defensivo', r.leitura, r.comprados + '/' + r.nEstr, r.estic + '/100', r.faixa, r_(r.n / 365.25, 1), r.fonte, r.ultimaVela, 'OK'];
  });
  sh.clear();
  sh.getRange(1, 1).setValue('CRYPTO BACKTEST MACHINE — TOP 10 · TERMINAL QUANTITATIVO').setFontWeight('bold').setFontSize(14).setFontColor('#f5c542');
  sh.getRange(1, 1, 1, cab.length).setBackground('#081428');
  sh.getRange(2, 1).setValue('Última leitura (BRT): ' + Utilities.formatDate(new Date(), P2.TZ_BRT, 'dd/MM/yyyy HH:mm:ss') + '  ·  estratégias próprias de cada moeda (BTC: as 10 fixas do Projeto 02)  ·  execução: sinal no fechamento, entrada na abertura do dia seguinte');
  sh.getRange(4, 1, 1, cab.length).setValues([cab]).setFontWeight('bold').setBackground('#0b1f3a').setFontColor('#ffffff').setWrap(true);
  if (rows.length) {
    sh.getRange(5, 1, rows.length, cab.length).setNumberFormat('@').setValues(rows).setVerticalAlignment('top');
    rows.forEach(function (row, i) {
      const x = lista[i].r; if (!x || x.estado !== 'OK') return;
      sh.getRange(5 + i, 8).setBackground(x.idx >= 60 ? '#d9ead3' : x.idx < 40 ? '#f4cccc' : '#fff2cc').setFontWeight('bold');
      sh.getRange(5 + i, 11).setBackground(x.estic >= 70 ? '#f4cccc' : x.estic <= 30 ? '#d9ead3' : '#fff2cc');
      sh.getRange(5 + i, 7).setBackground(x.acima200 ? '#d9ead3' : '#f4cccc');
    });
  }
  const nota = 5 + rows.length + 1;
  sh.getRange(nota, 1).setValue('Como ler: o Índice de Exposição Tática pondera o voto das estratégias pelo Sharpe de 3 anos (ou pelo histórico existente). O Esticamento compara o preço de hoje com os últimos 4 anos em dias do mesmo regime; não indica direção. A aba DESEMPENHO_10 compara as estratégias escolhidas com comprar e segurar, separando o período de escolha (IS) do período de teste (OOS).');
  sh.setFrozenRows(4); sh.setColumnWidth(1, 55); sh.setColumnWidth(2, 120);
  for (let c = 3; c <= 7; c++) sh.setColumnWidth(c, 105);
  sh.setColumnWidth(8, 215); sh.setColumnWidth(9, 190); sh.setColumnWidth(10, 105); sh.setColumnWidth(11, 125); sh.setColumnWidth(12, 130); sh.setColumnWidth(13, 90); sh.setColumnWidth(14, 140); sh.setColumnWidth(15, 105); sh.setColumnWidth(16, 190);
}

function gravarEstrategiasTop10_() {
  const sh = ss_().getSheetByName(P2.ABAS.estr), lista = resultadosOrdenados_();
  const cab = ['Ativo', 'Slot', 'ID', 'Familia', 'Estrategia', 'Posicao_Atual (1/0)', 'Status', 'Evento_Ultima_Vela', 'Preco_Entrada', 'Stop_Loss_Atual', 'Lucro_Trade_Aberto_pct', 'Lucro_Acumulado_pct', 'N_Trades', 'Win_Rate_pct',
    'Sharpe_Janela (3a, peso do consenso)', 'Peso_Consenso_pct', 'Sharpe_24m (mín. 0,90)', 'Sharpe_12m (mín. 0,40)', 'Trades_IS', 'Sharpe_IS (seleção)', 'Calmar_IS (seleção)', 'Sharpe_OOS', 'Calmar_OOS', 'CAGR_OOS_pct', 'MaxDD_OOS_pct', 'CAGR_desde_selecao_pct', 'Selecionada_em', 'Data_Ultima_Vela'];
  const rows = [], v = function (x) { return x === null || x === undefined ? '' : x; };
  lista.forEach(function (x) {
    if (!x.r || x.r.estado !== 'OK') return;
    x.r.estr.forEach(function (e) {
      rows.push([x.u.sym, e.slot, e.id, e.fam, e.nome, e.pos, e.fora ? 'FORA DA REGRA (Sharpe)' : (e.pos === 1 ? 'COMPRADO' : 'CAIXA'), e.evento || '—', e.pe === null ? '—' : e.pe, e.stop === null ? '—' : e.stop, e.la, e.lacum, e.nt,
        e.win === null ? 'N/D (N=' + e.nt + ')' : e.win, e.sh3, e.peso, v(e.sh24), v(e.sh12), v(e.isTr), v(e.isSh), v(e.isCa), v(e.oosSh), v(e.oosCa), v(e.oosCagr), v(e.oosDd), v(e.fwCagr), x.r.selData, x.r.ultimaVela]);
    });
    // vagas abertas aparecem como linhas explícitas: cada moeda sempre mostra todas as posições
    if (!x.r.fixas) for (let k = x.r.estr.length + 1; k <= cfgNum_('SELECAO_N_ESTRATEGIAS'); k++) {
      rows.push([x.u.sym, k, '—', '—', 'VAGA ABERTA: nenhum candidato passa nos mínimos de Sharpe (IS ' + cfgNum_('SELECAO_SHARPE_MIN') + ', 24m ' + cfgNum_('SELECAO_SHARPE_MIN_24M') + ', 12m ' + cfgNum_('SELECAO_SHARPE_MIN_12M') + ')', '', 'VAGA', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', x.r.selData, x.r.ultimaVela]);
    }
  });
  sh.clear();
  sh.getRange(1, 1, 1, cab.length).setValues([cab]).setFontWeight('bold').setBackground('#0b1f3a').setFontColor('#ffffff').setWrap(true);
  if (rows.length) {
    sh.getRange(2, 27, rows.length, 2).setNumberFormat('@');
    sh.getRange(2, 1, rows.length, cab.length).setValues(rows);
    rows.forEach(function (r, i) {
      if (r[6] === 'VAGA') { sh.getRange(i + 2, 1, 1, cab.length).setBackground('#eeeeee'); return; }
      sh.getRange(i + 2, 6, 1, 2).setBackground(r[5] === 1 ? '#d9ead3' : '#f4cccc');
      if (r[16] !== '' && r[16] < cfgNum_('SELECAO_SHARPE_MIN_24M')) sh.getRange(i + 2, 17).setBackground('#f4cccc').setFontWeight('bold');
      if (r[17] !== '' && r[17] < cfgNum_('SELECAO_SHARPE_MIN_12M')) sh.getRange(i + 2, 18).setBackground('#f4cccc').setFontWeight('bold');
      if (r[6] === 'FORA DA REGRA (Sharpe)') sh.getRange(i + 2, 1, 1, cab.length).setBackground('#eeeeee');
      if (r[21] !== '' && r[21] < 0) sh.getRange(i + 2, 22, 1, 4).setBackground('#fce5cd');
    });
  }
  sh.setFrozenRows(1); sh.setFrozenColumns(3); sh.setColumnWidth(5, 330);
}

function gravarDesempenho_() {
  const sh = ss_().getSheetByName(P2.ABAS.desemp), lista = resultadosOrdenados_().filter(function (x) { return x.r && x.r.estado === 'OK'; });
  sh.clear();
  if (!lista.length) { sh.getRange(1, 1).setValue('Sem ativos carregados ainda. Rode o menu 2) Carga inicial.'); return; }
  sh.getRange(1, 1).setValue('DESEMPENHO DAS ESTRATÉGIAS ESCOLHIDAS DE CADA MOEDA (peso igual) CONTRA COMPRAR E SEGURAR — custo de 0,125% por lado, sinal no fechamento e execução na abertura seguinte.').setFontWeight('bold').setFontColor('#f5c542');
  sh.getRange(1, 1, 1, 22).setBackground('#081428');
  sh.getRange(2, 1).setValue('IS = período usado para ESCOLHER as estratégias. OOS = período que não participou da escolha: é o número que deve ser levado a sério. Para o BTC (referência) as 10 são fixas e o corte é 02/06/2023. Verde = painel supera o buy and hold do mesmo período em Calmar.');
  const cab = ['Ativo', 'Anos de histórico', 'Selecionada em', 'Período IS', 'Corte OOS',
    'IS Calmar', 'IS Sharpe', 'IS CAGR %', 'IS MaxDD %',
    'OOS Calmar', 'OOS Sharpe', 'OOS CAGR %', 'OOS MaxDD %',
    'B&H OOS Calmar', 'B&H OOS CAGR %', 'B&H OOS MaxDD %',
    'Estratégias com Calmar OOS > B&H OOS', 'Estratégias com Sharpe OOS < 0', 'Painel total Calmar', 'Painel total CAGR %', 'B&H total Calmar', 'Observação'];
  sh.getRange(4, 1, 1, cab.length).setValues([cab]).setFontWeight('bold').setBackground('#0b1f3a').setFontColor('#ffffff').setWrap(true);
  const g = function (m, k) { return m && m[k] !== undefined && m[k] !== null ? m[k] : ''; };
  const rows = lista.map(function (x) {
    const r = x.r, bhO = r.bhOOS ? r.bhOOS.calmar : null;
    const sup = r.bhOOS ? r.estr.filter(function (e) { return e.oosCa !== null && e.oosCa > bhO; }).length : '';
    const neg = r.estr.filter(function (e) { return e.oosSh !== null && e.oosSh < 0; }).length;
    const obs = (r.fixas ? 'estratégias fixas do Projeto 02' : 'seleção própria da moeda') + (r.parcial ? ' · VAGAS ABERTAS: ' + r.vagas + ' (só ' + r.estr.length + ' de ' + cfgNum_('SELECAO_N_ESTRATEGIAS') + ' com Sharpe >= ' + cfgNum_('SELECAO_SHARPE_MIN') + ')' : '') + (r.fase === 'ampliada' ? ' · busca ampliada usada (' + r.nTest + ' candidatos testados)' : '') + (r.n < 1000 ? ' · histórico curto: leitura frágil' : '');
    return [x.u.sym + (x.u.status === 'REFERENCIA' ? ' (ref.)' : ''), r_(r.n / 365.25, 1), r.selData, r.w0 + ' a ' + r.corte, r.corte,
      g(r.painelIS, 'calmar'), g(r.painelIS, 'sharpe'), g(r.painelIS, 'cagr'), g(r.painelIS, 'dd'),
      g(r.painelOOS, 'calmar'), g(r.painelOOS, 'sharpe'), g(r.painelOOS, 'cagr'), g(r.painelOOS, 'dd'),
      g(r.bhOOS, 'calmar'), g(r.bhOOS, 'cagr'), g(r.bhOOS, 'dd'), sup, neg, g(r.painel, 'calmar'), g(r.painel, 'cagr'), g(r.bh, 'calmar'), obs];
  });
  sh.getRange(5, 3, rows.length, 3).setNumberFormat('@');
  sh.getRange(5, 1, rows.length, cab.length).setValues(rows);
  rows.forEach(function (row, i) {
    if (row[9] !== '' && row[13] !== '') sh.getRange(5 + i, 10).setBackground(row[9] > row[13] ? '#d9ead3' : '#f4cccc').setFontWeight('bold');
    if (row[5] !== '' && row[9] !== '') sh.getRange(5 + i, 6).setBackground(row[9] >= row[5] * 0.5 ? '#fff2cc' : '#fce5cd');
  });
  const nota = 5 + rows.length + 1;
  sh.getRange(nota, 1).setValue('Decaída = OOS contra IS. Quando o Calmar OOS cai a menos de metade do IS (célula laranja em IS Calmar), parte do desempenho histórico era sorte de seleção. Moedas com menos de 3 anos de histórico (HYPE, e AAVE/SOL em parte) têm OOS curto demais para conclusão firme.');
  sh.setFrozenRows(4); sh.setFrozenColumns(1); sh.setColumnWidth(1, 110); sh.setColumnWidth(4, 190); sh.setColumnWidth(22, 330);
  for (let c = 2; c <= 21; c++) if (c !== 4) sh.setColumnWidth(c, 92);
}

/* =============================================================================
 * 11B. E-MAIL CONSOLIDADO (alertas de todos os ativos e relatório semanal)
 * ===========================================================================*/
function enviarAlertasConsolidados_(eventos) {
  if (!eventos.length) return;
  const recentes = hashesRecentes_(), novos = [];
  eventos.forEach(function (e) { e.hash = md5_(e.sym + '|' + e.ref + '|' + e.tipo); if (!recentes[e.hash]) novos.push(e); });
  if (!novos.length) return;
  if (!cfgSim_('ALERTAS_ATIVOS')) { novos.forEach(function (e) { logDisparo_(e.sym + ':' + e.tipo, e.interno, '—', e.hash, 'SUPRIMIDO (ALERTAS_ATIVOS=NAO)', 0); }); return; }
  const urg = novos.some(function (e) { return e.urgencia === 'URGENTE'; });
  const porAtivo = {}; novos.forEach(function (e) { (porAtivo[e.sym] = porAtivo[e.sym] || []).push(e); });
  const corpo = '<p style="font-size:14px">O monitoramento identificou <b>' + novos.length + ' evento(s) atípico(s)</b> no gráfico diário em <b>' + Object.keys(porAtivo).length + ' ativo(s)</b>.</p>' +
    Object.keys(porAtivo).map(function (sym) {
      const r = lerRes_(sym);
      return '<h3 style="font-size:15px;margin:18px 0 4px;color:#0b1f3a">' + sym + (r && r.estado === 'OK' ? ' · ' + fmtPreco_(r.preco) + ' · Exposição Tática ' + r_(r.idx, 0) + '%' : '') + '</h3>' +
        porAtivo[sym].map(function (e) {
          return '<div style="border-left:4px solid ' + (e.urgencia === 'URGENTE' ? '#b00020' : '#e8710a') + ';background:#fafbfc;padding:10px 14px;margin:8px 0">' +
            '<div style="font-weight:bold;font-size:14px">' + e.titulo + '</div><div style="font-size:13px;margin-top:4px">' + e.texto + '</div>' +
            '<div style="font-size:12px;margin-top:6px;color:#0b1f3a"><b>Diretriz de gestão de risco:</b> ' + diretriz_(e.vies) + '</div></div>';
        }).join('');
    }).join('');
  const tag = urg ? 'URGENTE' : 'ATENÇÃO';
  const env = enviar_('[' + tag + '] Alertas Quantitativos Crypto Top 10 — ' + novos.length + ' evento(s) em ' + Object.keys(porAtivo).join(', '),
    moldura_('Alertas de Anomalia Estatística', urg ? '#b00020' : '#e8710a', tag, corpo));
  const status = env.ok === env.total ? 'ENVIADO' : (env.ok ? 'ENVIADO_PARCIAL' : 'FALHA: ' + env.falhas.join('; '));
  novos.forEach(function (e) { logDisparo_(e.sym + ':' + e.tipo, e.interno, env.dest, e.hash, status, env.efet); });
}

function montarRelatorioSemanal_() {
  const lista = resultadosOrdenados_().filter(function (x) { return x.r && x.r.estado === 'OK'; });
  const linhas = lista.map(function (x) {
    const r = x.r;
    return '<tr><td style="padding:7px 10px;border-bottom:1px solid #eef0f4;font-weight:bold">' + x.u.sym + '</td>' +
      '<td style="padding:7px 10px;border-bottom:1px solid #eef0f4;text-align:right">' + fmtPreco_(r.preco) + '</td>' +
      '<td style="padding:7px 10px;border-bottom:1px solid #eef0f4;text-align:right">' + fmtPct_(r.v7) + '</td>' +
      '<td style="padding:7px 10px;border-bottom:1px solid #eef0f4;text-align:right">' + r_(r.idx, 0) + '% Favorável</td>' +
      '<td style="padding:7px 10px;border-bottom:1px solid #eef0f4">' + r.leitura + '</td>' +
      '<td style="padding:7px 10px;border-bottom:1px solid #eef0f4;text-align:right">' + r.estic + '/100 · ' + r.faixa + '</td></tr>';
  }).join('');
  const corpo = '<h3 style="font-size:15px;margin:0 0 8px">Panorama semanal — principais criptoativos</h3>' +
    '<table style="width:100%;border-collapse:collapse;font-size:13px"><tr style="background:#f3f4f6"><th style="padding:7px 10px;text-align:left">Ativo</th><th style="padding:7px 10px;text-align:right">Preço</th><th style="padding:7px 10px;text-align:right">7 dias</th><th style="padding:7px 10px;text-align:right">Exposição Tática</th><th style="padding:7px 10px;text-align:left">Leitura</th><th style="padding:7px 10px;text-align:right">Esticamento (0 barato a 100 caro)</th></tr>' + linhas + '</table>' +
    '<p style="font-size:12px;color:#374151;margin-top:12px">O Índice de Exposição Tática resume o consenso do modelo proprietário. O Esticamento compara o preço atual com os últimos 4 anos em condições semelhantes e não indica a direção. Moedas com pouco histórico têm leitura menos confiável.</p>';
  return moldura_('Relatório Quantitativo Semanal — Crypto Top 10', '#0b8043', 'SEMANAL', corpo);
}

/* =============================================================================
 * 13. MOTOR (rodízio dentro do limite de tempo) e gatilhos
 * ===========================================================================*/
function motorTop10(forcar) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) { Logger.log('Outro ciclo em execução.'); return { processados: 0, restantes: 0 }; }
  try {
    const t0 = Date.now(), orcamento = cfgNum_('ORCAMENTO_SEG') * 1000, props = PropertiesService.getScriptProperties();
    const us = ativosUniverso_().sort(function (a, b) { return a.ordem - b.ordem; });
    if (!us.length) throw new Error('Aba UNIVERSO vazia. Rode o menu 0) Criar/formatar abas.');
    const cursor = (parseInt(props.getProperty('CURSOR') || '0', 10) || 0) % us.length, eventos = [], falhas = [];
    let feitos = 0;
    for (let k = 0; k < us.length; k++) {
      if (k > 0 && Date.now() - t0 > orcamento - 60000) break;   // deixa folga para gravar painéis e enviar e-mail
      const u = us[(cursor + k) % us.length];
      try {
        const r = processarAtivo_(u, forcar);
        r.eventos.forEach(function (e) { eventos.push(e); });
      } catch (e) {
        falhas.push(u.sym + ': ' + e.message);
        const prev = lerRes_(u.sym) || { sym: u.sym, ordem: u.ordem, nome: u.nome, status: u.status };
        if (!prev.estado || prev.estado !== 'OK') { prev.estado = 'ERRO: ' + String(e.message).substring(0, 120); guardarRes_(u.sym, prev); }
      }
      feitos++;
    }
    props.setProperty('CURSOR', String((cursor + feitos) % us.length));
    gravarPainel_(); gravarEstrategiasTop10_(); gravarDesempenho_();
    enviarAlertasConsolidados_(eventos);
    if (falhas.length) logDisparo_('FALHA_DADOS', falhas.join(' | ').substring(0, 450), '—', '—', 'FALHA', '');
    return { processados: feitos, restantes: us.length - feitos, falhas: falhas };
  } finally { lock.releaseLock(); }
}
function motorHorario() { motorTop10(false); }

function motorSemanal() {
  motorTop10(false);
  if (!cfgSim_('RELATORIO_SEMANAL_ATIVO')) return;
  const tipo = 'RELATORIO_SEMANAL', hash = md5_(Utilities.formatDate(new Date(), P2.TZ_BRT, 'yyyy-MM-dd') + '|' + tipo);
  if (hashesRecentes_()[hash]) return;
  const env = enviar_('Relatório Quantitativo Semanal — Crypto Top 10 · ' + Utilities.formatDate(new Date(), P2.TZ_BRT, 'dd/MM/yyyy'), montarRelatorioSemanal_());
  logDisparo_(tipo, 'Agenda semanal', env.dest, hash, env.ok === env.total ? 'ENVIADO' : (env.ok ? 'ENVIADO_PARCIAL' : 'FALHA: ' + env.falhas.join('; ')), env.efet);
}

/** Menu 2: processa em rodízio até esgotar o tempo; repita até o painel mostrar todos os ativos com Estado OK. */
function cargaInicial() {
  const r = motorTop10(true);
  const msg = 'Processados nesta rodada: ' + r.processados + (r.restantes ? '. Restam ' + r.restantes + ': rode este menu de novo (ou aguarde o gatilho horário).' : '. Todos os ativos foram percorridos.') +
    (r.falhas && r.falhas.length ? '\nFalhas: ' + r.falhas.join(' | ') : '');
  safeToast_(msg);
  try { SpreadsheetApp.getUi().alert('Carga inicial', msg, SpreadsheetApp.getUi().ButtonSet.OK); } catch (e) {}
}
/** Menu S: marca todas as moedas (menos o BTC) para refazer a seleção; repita o menu 2 até concluir. */
function reselecionarTodas() {
  const syms = ativosUniverso_().filter(function (u) { return u.status === 'ATIVO'; }).map(function (u) { return u.sym; });
  setPendentesSel_(syms); PropertiesService.getScriptProperties().setProperty('CURSOR', '0');
  cargaInicial();
}
function reprocessarTudo() { PropertiesService.getScriptProperties().setProperty('CURSOR', '0'); cargaInicial(); }

/* =============================================================================
 * 14. DIAGNÓSTICO DE FONTES, RANKING COINGECKO, SETUP, BACKUP, GATILHOS, MENU
 * ===========================================================================*/
function diagnosticoFontes() {
  const sh = ss_().getSheetByName(P2.ABAS.diag), linhas = [], t0 = Date.now();
  ativosUniverso_().sort(function (a, b) { return a.ordem - b.ordem; }).forEach(function (u) {
    let primeira = '';
    parseFontes_(u.fontes).forEach(function (f) {
      if (Date.now() - t0 > cfgNum_('ORCAMENTO_SEG') * 1000 - 20000) { linhas.push([u.sym, f.src, f.par, 'NAO TESTADA', '', '', 'tempo esgotado: rode de novo']); return; }
      try {
        const s = ADAPTADORES[f.src](f.par, { dias: 5 });
        if (!s.length) { linhas.push([u.sym, f.src, f.par, 'FALHA', 0, '', 'resposta sem velas (par inexistente ou moeda não listada)']); return; }
        s.sort(function (a, b) { return a.date - b.date; });
        linhas.push([u.sym, f.src, f.par, 'OK', s.length, Utilities.formatDate(s[s.length - 1].date, 'UTC', 'yyyy-MM-dd'), '']);
        if (!primeira) primeira = f.src + ':' + f.par;
      } catch (e) { linhas.push([u.sym, f.src, f.par, 'FALHA', 0, '', String(e.message).substring(0, 160)]); }
    });
    if (primeira) { ss_().getSheetByName(P2.ABAS.universo).getRange(u.row, 9).setValue(primeira); }
    else linhas.push([u.sym, '—', '—', 'SEM FONTE', '', '', 'nenhuma corretora respondeu: ajuste a coluna Fontes na aba UNIVERSO']);
  });
  sh.clear();
  sh.getRange(1, 1, 1, 7).setValues([['Ativo', 'Corretora', 'Par', 'Resultado', 'Velas_recebidas (últimos 5 dias)', 'Ultima_vela (UTC)', 'Detalhe']]).setFontWeight('bold').setBackground('#0b1f3a').setFontColor('#ffffff').setWrap(true);
  if (linhas.length) sh.getRange(2, 1, linhas.length, 7).setValues(linhas);
  linhas.forEach(function (l, i) { sh.getRange(i + 2, 4).setBackground(l[3] === 'OK' ? '#d9ead3' : '#f4cccc'); });
  sh.setFrozenRows(1); sh.setColumnWidth(7, 420);
  const ok = {}, sem = {}; linhas.forEach(function (l) { if (l[3] === 'OK') ok[l[0]] = true; if (l[3] === 'SEM FONTE') sem[l[0]] = true; });
  safeToast_('Diagnóstico: ' + Object.keys(ok).length + ' ativo(s) com fonte OK' + (Object.keys(sem).length ? ' · SEM FONTE: ' + Object.keys(sem).join(', ') : '') + '. Veja a aba DIAGNOSTICO_FONTES.');
}

function classificarCoinGecko_(c, excluir) {
  const sym = String(c.symbol || '').toLowerCase(), nome = String(c.name || ''), id = String(c.id || ''), p = +c.current_price;
  if (excluir[id]) return 'EXCLUIDO (lista de exclusão)';
  if (p >= 0.97 && p <= 1.03 && (/usd|dai|dollar|stable|tether/i.test(sym + ' ' + nome))) return 'EXCLUIDO (stablecoin)';
  if (/heloc|treasury|gold|t-bill|tbill|money market|fund/i.test(id + ' ' + nome)) return 'EXCLUIDO (ativo tokenizado)';
  if (/wrapped|staked|bridged|restaked|liquid staking/i.test(nome)) return 'EXCLUIDO (derivado/wrapped)';
  return 'CRIPTO';
}
function atualizarRanking() {
  const excluir = {}; String(cfg_('UNIVERSO_EXCLUIR_IDS')).split(',').forEach(function (s) { if (s.trim()) excluir[s.trim()] = true; });
  const dados = fetchJson_('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=40&page=1', null, 3);
  const manuais = {}; String(cfg_('UNIVERSO_MANUAIS')).split(',').forEach(function (x) { if (x.trim()) manuais[x.trim()] = true; });
  const n = cfgNum_('UNIVERSO_N_ATIVOS'), atuais = {}; ativosUniverso_().forEach(function (u) { atuais[u.geckoId] = u; });
  const alvo = []; const linhas = [];
  dados.forEach(function (c, i) {
    const classe = classificarCoinGecko_(c, excluir);
    const entra = c.id !== 'bitcoin' && classe === 'CRIPTO' && alvo.length < n;
    if (entra) alvo.push(c.id);
    linhas.push([i + 1, c.id, String(c.symbol).toUpperCase(), c.name, c.market_cap, c.current_price, classe, atuais[c.id] ? 'SIM' : 'NAO', entra ? 'DEVE ESTAR' : '']);
  });
  linhas.forEach(function (l) {
    const deve = l[8] === 'DEVE ESTAR', esta = l[7] === 'SIM' && l[1] !== 'bitcoin';
    l.push(deve && !esta ? 'ENTRAR no universo' : (!deve && esta ? (manuais[l[1]] ? 'OK (escolha manual)' : 'SAIR do universo') : 'OK'));
  });
  const sh = ss_().getSheetByName(P2.ABAS.ranking);
  sh.clear();
  sh.getRange(1, 1, 1, 10).setValues([['Rank_MC', 'CoinGecko_ID', 'Simbolo', 'Nome', 'Valor_de_Mercado_USD', 'Preco_USD', 'Classificacao', 'No_Universo', 'Regra', 'Sugestao']]).setFontWeight('bold').setBackground('#0b1f3a').setFontColor('#ffffff');
  sh.getRange(2, 1, linhas.length, 10).setValues(linhas);
  linhas.forEach(function (l, i) { if (l[9] !== 'OK' && l[9] !== 'OK (escolha manual)') sh.getRange(i + 2, 10).setBackground('#fff2cc').setFontWeight('bold'); });
  sh.setFrozenRows(1);
  const muda = linhas.filter(function (l) { return l[9] !== 'OK' && l[9] !== 'OK (escolha manual)'; }).map(function (l) { return l[9] + ': ' + l[2]; });
  // atualiza só o Rank_MC (coluna E) das linhas conhecidas da UNIVERSO
  const pos = {}; linhas.forEach(function (l) { pos[l[1]] = l[0]; });
  const su = ss_().getSheetByName(P2.ABAS.universo);
  universo_().forEach(function (u) { if (pos[u.geckoId]) su.getRange(u.row, 5).setValue(pos[u.geckoId]); });
  logDisparo_('RANKING', muda.length ? muda.join(' | ') : 'Universo igual ao ranking', '—', '—', muda.length ? 'REVISAR' : 'OK', '');
  safeToast_(muda.length ? 'Ranking atualizado. Sugestões: ' + muda.join(' · ') + ' (aba RANKING_COINGECKO; edite a UNIVERSO para aplicar).' : 'Ranking atualizado: o universo continua igual ao ranking.');
}

function setupPlanilha() {
  const ss = ss_();
  const abas = [P2.ABAS.painel, P2.ABAS.desemp, P2.ABAS.estr, P2.ABAS.sel, P2.ABAS.universo, P2.ABAS.ranking, P2.ABAS.diag, P2.ABAS.log, P2.ABAS.cfg];
  const velha = ss.getSheetByName('Página1');
  if (velha && !ss.getSheetByName(P2.ABAS.painel)) velha.setName(P2.ABAS.painel);
  abas.forEach(function (nome, i) {
    let sh = ss.getSheetByName(nome); if (!sh) sh = ss.insertSheet(nome);
    ss.setActiveSheet(sh); ss.moveActiveSheet(i + 1);
  });
  const log = ss.getSheetByName(P2.ABAS.log);
  log.getRange(1, 1, 1, 7).setValues([['Data_Hora_BRT', 'Tipo_Evento', 'Indicador_Gatilho', 'Destinatarios', 'Hash_Evento', 'Status_Envio', 'Taxa_Efetividade_pct']]).setFontWeight('bold').setBackground('#0b1f3a').setFontColor('#ffffff'); log.setFrozenRows(1); log.setColumnWidth(5, 260);
  const cfgSh = ss.getSheetByName(P2.ABAS.cfg);
  cfgSh.getRange(1, 1, 1, 3).setValues([['Parametro', 'Valor', 'Descricao']]).setFontWeight('bold').setBackground('#0b1f3a').setFontColor('#ffffff'); cfgSh.setFrozenRows(1);
  const existentes = {}; if (cfgSh.getLastRow() > 1) cfgSh.getRange(2, 1, cfgSh.getLastRow() - 1, 1).getValues().forEach(function (r) { existentes[r[0]] = true; });
  const novos = CFG_PADRAO.filter(function (r) { return !existentes[r[0]]; });
  if (novos.length) cfgSh.getRange(cfgSh.getLastRow() + 1, 1, novos.length, 3).setValues(novos);
  cfgSh.setColumnWidth(1, 260); cfgSh.setColumnWidth(2, 330); cfgSh.setColumnWidth(3, 620);
  const uni = ss.getSheetByName(P2.ABAS.universo);
  uni.getRange(1, 1, 1, COLS_UNIVERSO.length).setValues([COLS_UNIVERSO]).setFontWeight('bold').setBackground('#0b1f3a').setFontColor('#ffffff').setWrap(true); uni.setFrozenRows(1);
  if (uni.getLastRow() < 2) {
    uni.getRange(2, 1, SEED_UNIVERSO.length, COLS_UNIVERSO.length).setNumberFormat('@');
    uni.getRange(2, 1, SEED_UNIVERSO.length, COLS_UNIVERSO.length).setValues(SEED_UNIVERSO.map(function (s) {
      return [s[0], s[1], s[2], s[3], s[0], s[4], s[5], s[6], '', '', '', '', '', s[7]];
    }));
  }
  uni.setColumnWidth(8, 420); uni.setColumnWidth(14, 380);
  ativosUniverso_().forEach(function (u) { abaBase_(u.sym, true); });
  ss.setSpreadsheetTimeZone(P2.TZ_BRT);
  ss.setActiveSheet(ss.getSheetByName(P2.ABAS.painel));
  safeToast_('Estrutura criada. Próximo passo: 1) Diagnóstico das fontes e 2) Carga inicial.');
}

const BACKUP_CAMINHO = ['MVP - Projeto 2035', 'MVP #2 Cripto (ainda sem nome)', 'Planilhas'];
function pastaBackup_() {
  let pasta = DriveApp.getRootFolder();
  BACKUP_CAMINHO.forEach(function (nome) { const it = pasta.getFoldersByName(nome); pasta = it.hasNext() ? it.next() : pasta.createFolder(nome); });
  return pasta;
}
function backupDiario() {
  const pasta = pastaBackup_(), carimbo = Utilities.formatDate(new Date(), P2.TZ_BRT, 'yyyy-MM-dd_HHmm');
  let nome = 'Crypto Backtest Machine Top 10 - BACKUP ' + carimbo, k = 2;
  while (pasta.getFilesByName(nome).hasNext()) nome = 'Crypto Backtest Machine Top 10 - BACKUP ' + carimbo + ' (' + k++ + ')';
  const copia = DriveApp.getFileById(P2.PLANILHA_ID).makeCopy(nome, pasta);
  Logger.log('Backup criado: ' + copia.getUrl()); return copia.getUrl();
}
function instalarGatilhosAutomaticos() {
  const alvo = ['motorHorario', 'motorSemanal', 'backupDiario', 'atualizarRanking'];
  ScriptApp.getProjectTriggers().forEach(function (t) { if (alvo.indexOf(t.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('backupDiario').timeBased().everyDays(1).atHour(2).nearMinute(0).inTimezone(P2.TZ_BRT).create();
  ScriptApp.newTrigger('motorSemanal').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(8).nearMinute(0).inTimezone(P2.TZ_BRT).create();
  ScriptApp.newTrigger('motorHorario').timeBased().everyHours(1).create();
  ScriptApp.newTrigger('atualizarRanking').timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(9).nearMinute(0).inTimezone(P2.TZ_BRT).create();
  safeToast_('Gatilhos instalados: ciclo horário, relatório semanal (seg 08:00 BRT), ranking (dom 09:00 BRT) e backup (02:00 BRT).');
  return conferirGatilhos();
}
function removerGatilhos() { ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); }); safeToast_('Todos os gatilhos removidos.'); }
function conferirGatilhos() {
  const s = ScriptApp.getProjectTriggers().map(function (t) { return t.getHandlerFunction() + ' (' + t.getEventType() + ')'; }).join('\n') || 'Nenhum gatilho.';
  Logger.log(s); try { SpreadsheetApp.getUi().alert('Gatilhos', s, SpreadsheetApp.getUi().ButtonSet.OK); } catch (e) {} return s;
}
/** Envia prévia do relatório semanal APENAS ao 1º e-mail (não grava hash). */
function testarEmailInterno() {
  const dest = emails_()[0];
  MailApp.sendEmail({ to: dest, subject: '[TESTE] Relatório Semanal — Crypto Top 10', htmlBody: montarRelatorioSemanal_() });
  logDisparo_('TESTE', 'testarEmailInterno', dest, '—', 'ENVIADO', 100);
}
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Top 10 — Quant')
    .addItem('0) Criar/formatar abas', 'setupPlanilha')
    .addItem('1) Diagnóstico das fontes de dados', 'diagnosticoFontes')
    .addItem('2) Carga inicial / ciclo completo (repita até concluir)', 'cargaInicial')
    .addItem('3) Rodar o ciclo normal agora (só o que mudou)', 'motorHorario')
    .addSeparator()
    .addItem('R) Atualizar ranking CoinGecko (sugere ajustes ao universo)', 'atualizarRanking')
    .addItem('T) Teste de e-mail (somente 1º destinatário)', 'testarEmailInterno')
    .addItem('S) Refazer a seleção das 10 estratégias de cada moeda', 'reselecionarTodas')
    .addItem('P) Reprocessar tudo do zero (recalcula todos os ativos)', 'reprocessarTudo')
    .addItem('G) Instalar gatilhos automáticos', 'instalarGatilhosAutomaticos')
    .addItem('B) Fazer backup agora', 'backupDiario')
    .addItem('C) Conferir gatilhos', 'conferirGatilhos')
    .addItem('X) Remover todos os gatilhos', 'removerGatilhos')
    .addToUi();
}


function safeToast_(m) { try { ss_().toast(m, 'Top 10', 6); } catch (e) {} Logger.log(m); }
function r_(v, d) { if (v === null || v === undefined || typeof v !== 'number' || !isFinite(v)) return ''; const f = Math.pow(10, d === undefined ? 2 : d); return Math.round(v * f) / f; }

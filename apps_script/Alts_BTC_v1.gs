/**
 * =============================================================================
 * MVP PROJETO ALTS/BTC (PROJETO 02) — v1.0
 * Planilha: https://docs.google.com/spreadsheets/d/1lSPN3qRQMfGUWGiL8OmeGagXXjmxhPAfG9NhaDwNQvg
 *
 * Paradigma: Crypto Backtest Machine Top 10 (PROJETO 02). O motor de backtest, a seleção de estratégias, os indicadores, o Consenso
 * Algorítmico, o Esticamento, os alertas e a auditoria são os mesmos. A diferença: CADA MOEDA É MEDIDA CONTRA O BTC, não contra o dólar.
 * A série de cada moeda é o par ALT/BTC (ETH/BTC, AAVE/BTC, LINK/BTC...), construída dividindo, dia a dia, a vela diária ALT/USD pela vela
 * BTC/USD da aba BASE_BTC (mesma data). Abrir (open), fechar (close): open = open ALT / open BTC, close = close ALT / close BTC;
 * máxima = maior entre abertura, fechamento e (máxima ALT / fechamento BTC); mínima = menor entre abertura, fechamento e (mínima ALT / fechamento BTC).
 * Estar "comprado" numa estratégia significa estar posicionado na ALT contra o BTC; fora, a posição é o próprio BTC. O benchmark (buy and hold) é
 * segurar a ALT em vez de BTC.
 *
 * UNIVERSO: as mesmas 10 moedas da planilha Top 10, sem o BTC: ETH, BNB, XRP, SOL, TRX, ZEC, HYPE, DOGE, LINK, AAVE. O BTC fica na aba
 * UNIVERSO com status BASE: é atualizado e usado só para montar as razões e como filtro de regime de algumas estratégias (tendência do BTC em dólar).
 *
 * RÉGUA (sarrafo) DAS ESTRATÉGIAS, por estratégia: Sharpe do histórico >= 0,60, dos últimos 24 meses >= 0,30 e dos últimos 12 meses >= 0,00.
 * Escolhida por walk-forward em 9 moedas ALT/BTC (reseleção a cada 90 dias): quanto mais alta a régua, menos estratégias fecham e pior o Sharpe seguinte.
 * Cada moeda só é analisada com 5 estratégias que atendam à régua (nível PLENA) e à regra de classe de indicador (1 em 5). Moeda com menos de 5
 * aparece como SEM_ESTRATEGIA_ELEGIVEL, com as vagas abertas, e é reavaliada a cada SELECAO_REVISAO_DIAS dias.
 *
 * HISTÓRICO MÍNIMO: moeda com menos de MIN_VELAS_CONSENSO velas (500) usa como mínimo as velas atuais menos 1 (nunca fica de fora só por ser nova).
 *
 * ESTRATÉGIAS JÁ TESTADAS: o arquivo traz as sementes (SEMENTES_ALTBTC) com as 5 estratégias de cada moeda escolhidas offline em 15/10/2026 sobre o
 * histórico completo, com a mesma régua e o mesmo código de seleção. O menu 0 as grava; o primeiro ciclo já recalcula cada uma com os dados atuais.
 * A busca completa de candidatos roda de novo sozinha a cada SELECAO_REFRESH_DIAS dias (90) ou pelo menu S.
 *
 * ABAS: PAINEL_ALTS_BTC | DESEMPENHO_ALTS_BTC | ESTRATEGIAS_ALTS_BTC | SELECAO_CANDIDATAS | AUDITORIA | UNIVERSO | RANKING_COINGECKO |
 *       DIAGNOSTICO_FONTES | LOG_DISPAROS | CONFIG_SISTEMA | BASE_BTC (dólar) | BASE_<SIMBOLO> (razão ALT/BTC, uma por moeda)
 *
 * INSTALAÇÃO
 *  1. Planilha -> Extensões -> Apps Script -> apagar tudo -> colar este arquivo -> salvar.
 *  2. Menu "Alts/BTC — Quant" (recarregue a planilha): 0) Criar/formatar abas (grava também as estratégias já testadas).
 *  3. 1) Diagnóstico das fontes de dados.
 *  4. 2) Carga inicial / ciclo completo (repita até todos os ativos estarem com Estado OK).
 *  5. A) Auditoria; depois G) Instalar gatilhos automáticos: atualização diária principal ~22:00 BRT e redundância ~01:00 BRT (a vela diária fecha às 21:00 BRT),
 *     relatório segunda 08:00, backup ~02:00 e ranking domingo 09:00 BRT. Se alguma moeda ficar sem a vela do dia depois da redundância, vai e-mail de falha.
 *
 * REGRAS INVIOLÁVEIS (herdadas do Projeto 02)
 *  - Sem look-ahead: sinais no FECHAMENTO da vela D, execução simulada na ABERTURA de D+1; a vela do dia corrente é descartada.
 *  - Custo de 0,125% por lado aplicado à posição na ALT. Comunicação ao cliente: nunca nomes/quantidade de estratégias nem o indicador que disparou o alerta.
 * =============================================================================
 */

const P2 = {
  PLANILHA_ID: '1lSPN3qRQMfGUWGiL8OmeGagXXjmxhPAfG9NhaDwNQvg',
  TZ_BRT: 'America/Sao_Paulo',
  ABAS: {
    painel: 'PAINEL_ALTS_BTC',
    desemp: 'DESEMPENHO_ALTS_BTC',
    estr: 'ESTRATEGIAS_ALTS_BTC',
    sel: 'SELECAO_CANDIDATAS',
    audit: 'AUDITORIA',
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
  ['ALERTA_FALHA_ATUALIZACAO', 'SIM', 'SIM/NAO: e-mail quando, depois da redundância das ~01:00 BRT, alguma moeda (ou a BASE_BTC) continua sem a vela do dia'],
  ['ALERTAS_ATIVOS', 'SIM', 'SIM/NAO — liga/desliga o e-mail consolidado de alertas'],
  ['RELATORIO_SEMANAL_ATIVO', 'SIM', 'SIM/NAO — liga/desliga o relatório consolidado de segunda 08:00 BRT'],
  ['JANELA_DEDUP_HORAS', 24, 'Janela anti-reenvio do mesmo evento (ativo + data da vela + tipo)'],
  ['ZSCORE_LIMIAR', 2.0, '|Z-score| do retorno diário para spike de volatilidade'],
  ['ZSCORE_JANELAS', '9,21,30,90', 'Janelas (dias) avaliadas para o Z-score'],
  ['MACD_DIVERGENCIA_MIN_BARRAS', 20, 'Barras mínimas do regime anterior para inflexão MACD relevante'],
  ['CONSENSO_PESO_REF', 5, 'Soma de pesos (Sharpe 3 anos, cada um entre 0 e 3) a partir da qual o Consenso é 100% ponderado'],
  ['CONSENSO_JANELA_SHARPE_DIAS', 1095, 'Janela (dias) do Sharpe que pondera cada componente do consenso (se o ativo tiver menos histórico, usa o que existe)'],
  ['MIN_VELAS_POR_ATIVO', 'AUTO', 'AUTO = moeda com menos de MIN_VELAS_CONSENSO velas usa as velas atuais menos 1. Ou informe SIMBOLO:VELAS separados por vírgula para fixar o mínimo de uma moeda. Moedas recentes: a amostra é curta, leia com cautela'],
  ['MIN_VELAS_CONSENSO', 500, 'Velas diárias mínimas para calcular consenso e esticamento (abaixo disso: HISTORICO_INSUFICIENTE)'],
  ['JANELA_INICIO_BARRAS', 200, 'Barra a partir da qual o desempenho (CAGR, MaxDD, Calmar) é medido, depois do aquecimento das médias'],
  ['ORCAMENTO_SEG', 270, 'Tempo máximo de cada execução (segundos); o Apps Script corta em 360'],
  ['UNIVERSO_N_ATIVOS', 8, 'Quantidade de moedas do ranking CoinGecko (além do BTC e das escolhas manuais)'],
  ['UNIVERSO_MANUAIS', 'chainlink,aave', 'IDs CoinGecko escolhidos manualmente: ficam no universo mesmo fora da janela do ranking (o BTC é a base das razões e não entra no universo)'],
  ['SELECAO_ATIVA', 'SIM', 'Mantido por compatibilidade: cada moeda sempre usa as próprias melhores estratégias'],
  ['SELECAO_N_ESTRATEGIAS', 5, 'Quantidade de estratégias escolhidas por moeda'],
  ['SELECAO_CORTE_IS', 0.70, 'Fração inicial do histórico para a divisão DESCRITIVA 70% iniciais x 30% finais (não é teste fora da amostra)'],
  ['SELECAO_MIN_TRADES_IS', 12, 'Trades mínimos no histórico (reduz automaticamente para moedas de histórico curto, piso 5)'],
  ['SELECAO_SHARPE_MIN', 0.6, 'Sharpe mínimo do histórico todo (régua cheia: níveis PLENA e RECENTE FRACA). Régua Alts/BTC: 0,60 / 0,30 / 0,00, escolhida por walk-forward em 9 moedas (réguas mais altas escolheram pior)'],
  ['SELECAO_EXIGE_PLENA', 'SIM', 'SIM = só entra estratégia no nível PLENA (histórico >= 0,60, 24m >= 0,30, 12m >= 0,00). NAO = aceita também RECENTE FRACA e PROVISORIA'],
  ['SELECAO_PISO_PROVISORIO', 0.6, 'Piso do nível PROVISORIA (Sharpe do histórico entre este valor e a régua). Só preenche vaga quando não há candidato acima da régua. Padrão = igual ao mínimo do histórico (desligado). Use um valor menor para permitir estratégias provisórias'],
  ['SELECAO_JANELA_PERM_DIAS', 730, 'Janela (dias) do Sharpe de 24 meses usado na permanência'],
  ['SELECAO_SHARPE_MIN_24M', 0.3, 'Sharpe mínimo dos últimos 24 meses para o nível PLENA'],
  ['SELECAO_SHARPE_MIN_12M', 0.0, 'Sharpe mínimo dos últimos 12 meses para o nível PLENA'],
      ['SELECAO_REVISAO_DIAS', 30, 'Intervalo mínimo entre revisões que tentam melhorar o nível das estratégias (vaga aberta ou fora do nível PLENA)'],
  ['SELECAO_DD_MAX', 70, 'Drawdown máximo (%) do histórico para um candidato ser elegível'],
  ['SELECAO_MAX_MESMA_CLASSE_POR_5', 1, 'Máximo de estratégias da mesma classe de indicador (a ideia, ex.: MACD com parâmetros vizinhos) a cada 5 escolhidas: 1 em 5, 2 em 10. Regra rígida, nunca relaxada'],
  ['SELECAO_MIN_PARA_MEDIR', 5, 'Mínimo de estratégias aceitas para a moeda ser analisada (índice, consenso, desempenho). Abaixo disso a moeda fica como SEM_ESTRATEGIA_ELEGIVEL com as vagas abertas'],
  ['SELECAO_ORCAMENTO_SEG', 150, 'Tempo máximo (segundos) da busca de candidatos de uma moeda; passado disso a busca é interrompida e a resposta indica'],
  ['SELECAO_RELAXAR_SE_FALTAR', 'SIM', 'SIM = se faltarem estratégias PLENA, relaxa SÓ os filtros secundários (drawdown, trades e correlação) para completar as vagas; o Sharpe mínimo nunca é relaxado. A coluna Criterio_secundario mostra o que foi relaxado'],
  ['SELECAO_DD_MAX_RELAX', 85, 'Drawdown máximo (%) do histórico na passada relaxada'],
  ['SELECAO_MIN_TRADES_RELAX', 5, 'Trades mínimos na passada relaxada'],
  ['SELECAO_CORR_MAX_RELAX', 0.97, 'Correlação máxima entre escolhidas na passada relaxada'],
  ['SELECAO_CORR_MAX', 0.92, 'Correlação máxima dos retornos diários (histórico) entre duas escolhidas'],
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
  { id: 'M1-01', ind: 'ROC', fam: 'momentum', grupo: 'Machine #1', key: 'rocMomentum', nome: 'ROC Momentum 30/15% + SMA200', fn: sinalRocMomentum },
  { id: 'M1-02', ind: 'MACD', fam: 'momentum', grupo: 'Machine #1', key: 'macd205012', nome: 'MACD 20/50/12', fn: sinalMacd205012 },
  { id: 'M1-04', ind: 'ADX', fam: 'rompimento', grupo: 'Machine #1', key: 'adxTrendBreakout', nome: 'ADX(7) Trend Breakout + SMA50', fn: sinalAdxTrendBreakout },
  { id: 'M1-05', ind: 'Cruzamento de médias', fam: 'cruzamento', grupo: 'Machine #1', key: 'sma200ema1030', nome: 'SMA200 + EMA10xEMA30', fn: sinalSma200Ema1030 },
  { id: 'M1-06', ind: 'SMC/ICT', fam: 'estrutura', grupo: 'Machine #1', key: 'confluenciaSmcIct', nome: 'Confluência SMC + ICT + Trendline', fn: sinalConfluencia },
  { id: 'M1-11', ind: 'Híbrido STH-RP', fam: 'estrutura', grupo: 'Machine #1/#2', key: 'hibridoSthRp', nome: 'Híbrido STH-RP (SMA155) & Confluência', fn: sinalHibridoSthRp },
  { id: 'M2-02', ind: 'Cruzamento de médias', fam: 'cruzamento', grupo: 'Machine #2', key: 'emaCrossSma76', nome: 'EMA10 Cross + SMA76', fn: sinalEmaCrossSma76 },
  { id: 'M2-03', ind: 'Bollinger', fam: 'rompimento', grupo: 'Machine #2', key: 'bollingerSqueeze', nome: 'Bollinger Squeeze (20, 2.25) + SMA200', fn: sinalBollingerSqueeze },
  { id: 'M2-04', ind: 'Cruzamento de médias', fam: 'cruzamento', grupo: 'Machine #2', key: 'nuvemEma655Sma100', nome: 'Nuvem EMA 6/55 + SMA100', fn: sinalNuvemEma655 },
  { id: 'M2-05', ind: 'Larry Williams', fam: 'momentum', grupo: 'Machine #2', key: 'larryWilliams9394', nome: 'Larry Williams 9.3/9.4 (EMA12 + SMA50)', fn: sinalLarryWilliams9394 },
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
 * 2C. BUSCA ESTENDIDA — famílias adicionais de candidatos (indicadores, filtro de regime do BTC, stops por ATR,
 *     reversão com filtro de tendência, volume). Só roda quando o conjunto base e a grade da seção 2 não completam as vagas.
 *     Todas são causais: o sinal da vela D usa só dados até o fechamento de D; a execução é na abertura de D+1.
 * ===========================================================================*/
/**
 * Classe do indicador de uma estratégia (a "ideia"): variações de parâmetros, filtros de tendência, de regime do BTC e stops pertencem à
 * classe do indicador principal. A regra de diversificação usa a classe: no máximo 1 da mesma classe em 5 estratégias (2 em 10).
 */
function classeInd_(nome) {
  const s = String(nome), t = [
    [/Comitê/, 'Comitê de votação'], [/Engolfo/, 'Engolfo de alta'], [/Martelo/, 'Martelo'], [/Inside bar/, 'Inside bar'], [/soldados/, 'Três soldados'], [/Marubozu/, 'Marubozu'], [/CPR/, 'CPR (pivôs)'], [/Didi/, 'Agulhada do Didi'], [/Barras de tendência/, 'Barras de tendência'], [/Awesome/, 'Awesome Oscillator'], [/Vortex/, 'Vortex'], [/TSI/, 'TSI'], [/MFI/, 'MFI'], [/Índice de Força/, 'Índice de Força'], [/Elder/, 'Elder Ray'], [/KST/, 'KST'], [/Coppock/, 'Coppock'],
    [/Fisher/, 'Fisher Transform'], [/StochRSI/, 'StochRSI'], [/Connors/, 'Connors RSI'], [/Squeeze de volatilidade/, 'Squeeze'], [/Heikin/, 'Heikin-Ashi'], [/Gann/, 'Gann HiLo'], [/ZLEMA/, 'ZLEMA'], [/Z-score de preço/, 'Z-score de preço'],
    [/Pico de volume/, 'Pico de volume'], [/Alligator/, 'Alligator'], [/Choppiness/, 'Choppiness'], [/Tendência semanal/, 'Tendência semanal'], [/Regime de volatilidade/, 'Regime de volatilidade'], [/altas seguidas/, 'Altas seguidas'], [/Proximidade da máxima/, 'Proximidade da máxima'], [/MACD/, 'MACD'], [/Bollinger/, 'Bollinger'], [/Keltner/, 'Keltner'], [/Donchian/, 'Donchian'], [/trailing de|Chandelier/, 'Chandelier'],
    [/Rompimento de volatilidade/, 'Rompimento por ATR'], [/Supertrend/, 'Supertrend'], [/Parabolic/, 'Parabolic SAR'], [/Ichimoku/, 'Ichimoku'], [/KAMA/, 'KAMA'], [/Hull/, 'Hull MA'],
    [/DEMA|TEMA/, 'DEMA/TEMA'], [/Regressão linear/, 'Regressão linear'], [/ADX/, 'ADX'], [/CCI/, 'CCI'], [/TRIX/, 'TRIX'], [/Aroon/, 'Aroon'], [/OBV/, 'OBV'], [/Chaikin/, 'Fluxo de Chaikin'],
    [/VWAP/, 'VWAP'], [/Estocástico/, 'Estocástico'], [/Williams %R/, 'Williams %R'], [/IBS/, 'IBS'], [/mínima de/, 'Mínima de N dias'], [/quedas seguidas/, 'Quedas seguidas'],
    [/RSI\(\d+\) regime/, 'RSI regime'], [/RSI/, 'RSI reversão'], [/Retorno de|ROC/, 'ROC'], [/Pullback/, 'Pullback à média'], [/Força relativa/, 'Força relativa'],
    [/Cruzamento|Alinhamento|(EMA|SMA)\d+ x (EMA|SMA)\d+/, 'Cruzamento de médias'], [/Preço x/, 'Preço x média'], [/Z-score|Capitulação/, 'Z-score'],
  ];
  for (let i = 0; i < t.length; i++) if (t[i][0].test(s)) return t[i][1];
  return 'Outra: ' + s.split(' ')[0];
}

function wma_(v, len) {
  const n = v.length, out = new Array(n).fill(NaN), den = len * (len + 1) / 2;
  for (let i = len - 1; i < n; i++) { let s = 0, ok = true; for (let j = 0; j < len; j++) { const x = v[i - len + 1 + j]; if (isNaN(x)) { ok = false; break; } s += x * (j + 1); } if (ok) out[i] = s / den; }
  return out;
}
function hma_(v, len) {
  const a = wma_(v, Math.max(2, Math.round(len / 2))), b = wma_(v, len), d = v.map(function (x, i) { return 2 * a[i] - b[i]; });
  return wma_(d, Math.max(2, Math.round(Math.sqrt(len))));
}
function kama_(C, len, fast, slow) {
  const n = C.length, out = new Array(n).fill(NaN), f = 2 / (fast + 1), s = 2 / (slow + 1);
  if (n <= len) return out;
  out[len] = C[len];
  for (let i = len + 1; i < n; i++) {
    let vol = 0; for (let j = i - len + 1; j <= i; j++) vol += Math.abs(C[j] - C[j - 1]);
    const er = vol > 0 ? Math.abs(C[i] - C[i - len]) / vol : 0, sc = Math.pow(er * (f - s) + s, 2);
    out[i] = out[i - 1] + sc * (C[i] - out[i - 1]);
  }
  return out;
}
function linreg_(C, len) {
  const n = C.length, slope = new Array(n).fill(NaN), val = new Array(n).fill(NaN), sx = len * (len - 1) / 2, sxx = (len - 1) * len * (2 * len - 1) / 6;
  for (let i = len - 1; i < n; i++) {
    let sy = 0, sxy = 0; for (let j = 0; j < len; j++) { const y = C[i - len + 1 + j]; sy += y; sxy += j * y; }
    const b = (len * sxy - sx * sy) / (len * sxx - sx * sx), a = (sy - b * sx) / len; slope[i] = b; val[i] = a + b * (len - 1);
  }
  return { slope: slope, val: val };
}
function psar_(H, L, af0, afMax) {
  const n = H.length, dir = new Array(n).fill(0); if (n < 3) return dir;
  let up = true, sar = L[0], ep = H[0], af = af0; dir[0] = 1;
  for (let i = 1; i < n; i++) {
    sar = sar + af * (ep - sar);
    if (up) {
      sar = Math.min(sar, L[i - 1], i > 1 ? L[i - 2] : L[i - 1]);
      if (L[i] < sar) { up = false; sar = ep; ep = L[i]; af = af0; } else if (H[i] > ep) { ep = H[i]; af = Math.min(afMax, af + af0); }
    } else {
      sar = Math.max(sar, H[i - 1], i > 1 ? H[i - 2] : H[i - 1]);
      if (H[i] > sar) { up = true; sar = ep; ep = H[i]; af = af0; } else if (L[i] < ep) { ep = L[i]; af = Math.min(afMax, af + af0); }
    }
    dir[i] = up ? 1 : -1;
  }
  return dir;
}
function hhll_(H, L, len) {
  const n = H.length, hh = new Array(n).fill(NaN), ll = new Array(n).fill(NaN);
  for (let i = len - 1; i < n; i++) { let a = -Infinity, b = Infinity; for (let j = i - len + 1; j <= i; j++) { if (H[j] > a) a = H[j]; if (L[j] < b) b = L[j]; } hh[i] = a; ll[i] = b; }
  return { hh: hh, ll: ll };
}
function adxDi_(H, L, C, len) {
  const n = H.length, pdm = new Array(n).fill(0), mdm = new Array(n).fill(0), tr = new Array(n).fill(0);
  for (let i = 1; i < n; i++) {
    const up = H[i] - H[i - 1], dn = L[i - 1] - L[i];
    pdm[i] = up > dn && up > 0 ? up : 0; mdm[i] = dn > up && dn > 0 ? dn : 0; tr[i] = Math.max(H[i] - L[i], Math.abs(H[i] - C[i - 1]), Math.abs(L[i] - C[i - 1]));
  }
  const rma = function (v) { const o = new Array(n).fill(NaN); let p = null; for (let i = 1; i < n; i++) { if (p === null) { if (i >= len) { let s = 0; for (let j = i - len + 1; j <= i; j++) s += v[j]; p = s; o[i] = p; } } else { p = p - p / len + v[i]; o[i] = p; } } return o; };
  const a = rma(pdm), b = rma(mdm), t = rma(tr), pdi = new Array(n).fill(NaN), mdi = new Array(n).fill(NaN), dx = new Array(n).fill(NaN);
  for (let i = 0; i < n; i++) if (t[i] > 0) { pdi[i] = 100 * a[i] / t[i]; mdi[i] = 100 * b[i] / t[i]; const s = pdi[i] + mdi[i]; dx[i] = s > 0 ? 100 * Math.abs(pdi[i] - mdi[i]) / s : 0; }
  const adx = new Array(n).fill(NaN); let p = null, k = 0, acc = 0;
  for (let i = 0; i < n; i++) { if (isNaN(dx[i])) continue; if (p === null) { acc += dx[i]; if (++k === len) { p = acc / len; adx[i] = p; } } else { p = (p * (len - 1) + dx[i]) / len; adx[i] = p; } }
  return { pdi: pdi, mdi: mdi, adx: adx };
}

/** Série de preços do BTC alinhada por data (NaN onde falta). Preenchida no processamento de cada moeda (o.btcC). */
function alinharBtc_(o, bo) {
  const mapa = {}; for (let i = 0; i < bo.dates.length; i++) mapa[dataStr_(bo.dates[i])] = bo.closes[i];
  return o.dates.map(function (d) { const v = mapa[dataStr_(d)]; return v === undefined ? NaN : v; });
}
function btcRegime_(o, p) {
  return cacheInd_(o, 'btcR' + p, function () {
    const b = o.btcC || [], m = sma(b, p), r = new Array(b.length).fill(false);
    for (let i = 0; i < b.length; i++) r[i] = isFinite(b[i]) && isFinite(m[i]) && b[i] > m[i];
    return r;
  });
}
/** Envolve um candidato: só compra com o BTC acima da média de p dias; sai quando o BTC perde a média. */
function candBtcFiltro_(fnBase, p) {
  return function (o) {
    const s = fnBase(o), reg = btcRegime_(o, p), n = o.closes.length, en = new Array(n).fill(false), ex = new Array(n).fill(false);
    for (let i = 0; i < n; i++) { en[i] = s.entrySignal[i] && reg[i]; ex[i] = s.exitSignal[i] || !reg[i]; }
    return { entrySignal: en, exitSignal: ex, invalidationSeries: s.invalidationSeries, stopIfEnteredSeries: s.stopIfEnteredSeries };
  };
}
/** Envolve um candidato com stop de k ATR abaixo do fechamento do sinal (congelado na entrada pelo motor). */
function candStopAtr_(fnBase, k) {
  return function (o) {
    const s = fnBase(o), atr = atrC_(o, 14), n = o.closes.length, st = new Array(n).fill(NaN);
    for (let i = 0; i < n; i++) if (isFinite(atr[i])) st[i] = o.closes[i] - k * atr[i];
    return { entrySignal: s.entrySignal, exitSignal: s.exitSignal, invalidationSeries: st, stopIfEnteredSeries: st };
  };
}
/** Rompimento de N barras com saída por trailing de k ATR a partir da máxima de fechamento desde a entrada (Chandelier). */
function candChandelier_(N, atrLen, k) {
  return function (o) {
    const H = o.highs, C = o.closes, n = C.length, atr = atrC_(o, atrLen), en = new Array(n).fill(false), ex = new Array(n).fill(false), inv = new Array(n).fill(NaN);
    let pos = false, pico = 0;
    for (let i = N; i < n; i++) {
      if (!pos) {
        let m = -Infinity; for (let j = i - N; j < i; j++) if (H[j] > m) m = H[j];
        if (C[i] > m) { pos = true; pico = C[i]; en[i] = true; }
      } else {
        if (C[i] > pico) pico = C[i];
        if (isFinite(atr[i])) { inv[i] = pico - k * atr[i]; if (C[i] < inv[i]) { pos = false; ex[i] = true; } }
      }
    }
    return { entrySignal: en, exitSignal: ex, invalidationSeries: inv };
  };
}
function candRsiPullback_(p, compra, saida, mTrend) {
  return function (o) {
    const r = cacheInd_(o, 'r' + p, function () { return rsi(o.closes, p); }), m = smaC_(o, mTrend), C = o.closes;
    return sigGen_(o, function (i) { return isFinite(r[i]) && isFinite(m[i]) && r[i] < compra && C[i] > m[i]; }, function (i) { return isFinite(r[i]) && r[i] > saida; }, m);
  };
}
function candBbReversaoTrend_(p, k, mTrend) {
  return function (o) {
    const m = smaC_(o, p), sd = cacheInd_(o, 'sd' + p, function () { return stdevPop_(o.closes, p); }), t = smaC_(o, mTrend), C = o.closes;
    return sigGen_(o, function (i) { return isFinite(m[i]) && isFinite(t[i]) && C[i] < m[i] - k * sd[i] && C[i] > t[i]; }, function (i) { return isFinite(m[i]) && C[i] > m[i]; }, t);
  };
}
function candMomCurto_(N, filtro) {
  return function (o) {
    const C = o.closes, m = filtro ? smaC_(o, filtro) : null;
    return sigGen_(o, function (i) { return i >= N && C[i] / C[i - N] - 1 > 0 && (!m || (isFinite(m[i]) && C[i] > m[i])); }, function (i) { return i >= N && C[i] / C[i - N] - 1 < 0; }, m || undefined);
  };
}
function candHma_(len) {
  return function (o) { const h = cacheInd_(o, 'h' + len, function () { return hma_(o.closes, len); }), C = o.closes;
    return sigGen_(o, function (i) { return i > 0 && isFinite(h[i]) && isFinite(h[i - 1]) && h[i] > h[i - 1] && C[i] > h[i]; }, function (i) { return i > 0 && isFinite(h[i]) && isFinite(h[i - 1]) && (h[i] < h[i - 1] || C[i] < h[i]); }, h); };
}
function candKama_(len, slow) {
  return function (o) { const k = cacheInd_(o, 'k' + len + '_' + slow, function () { return kama_(o.closes, len, 2, slow); }), C = o.closes;
    return sigGen_(o, function (i) { return i > 0 && isFinite(k[i]) && isFinite(k[i - 1]) && k[i] > k[i - 1] && C[i] > k[i]; }, function (i) { return isFinite(k[i]) && C[i] < k[i]; }, k); };
}
function candLinreg_(len) {
  return function (o) { const L = cacheInd_(o, 'lr' + len, function () { return linreg_(o.closes, len); }), C = o.closes;
    return sigGen_(o, function (i) { return isFinite(L.slope[i]) && L.slope[i] > 0 && C[i] > L.val[i]; }, function (i) { return isFinite(L.slope[i]) && (L.slope[i] < 0 || C[i] < L.val[i]); }, L.val); };
}
function candPsar_(af, mx) {
  return function (o) { const d = cacheInd_(o, 'ps' + af + '_' + mx, function () { return psar_(o.highs, o.lows, af, mx); });
    return sigGen_(o, function (i) { return d[i] === 1 && i > 0 && d[i - 1] === -1; }, function (i) { return d[i] === -1; }); };
}
function candPsarEstado_(af, mx) {
  return function (o) { const d = cacheInd_(o, 'ps' + af + '_' + mx, function () { return psar_(o.highs, o.lows, af, mx); });
    return sigGen_(o, function (i) { return i > 20 && d[i] === 1; }, function (i) { return d[i] === -1; }); };
}
function candIchimoku_(t, k, b) {
  return function (o) {
    const C = o.closes, n = C.length, a = hhll_(o.highs, o.lows, t), c = hhll_(o.highs, o.lows, k), d = hhll_(o.highs, o.lows, b);
    const tenkan = a.hh.map(function (x, i) { return (x + a.ll[i]) / 2; }), kijun = c.hh.map(function (x, i) { return (x + c.ll[i]) / 2; }), spanB = d.hh.map(function (x, i) { return (x + d.ll[i]) / 2; });
    const top = new Array(n).fill(NaN); for (let i = k; i < n; i++) { const sa = (tenkan[i - k] + kijun[i - k]) / 2, sb = spanB[i - k]; if (isFinite(sa) && isFinite(sb)) top[i] = Math.max(sa, sb); }
    return sigGen_(o, function (i) { return isFinite(top[i]) && C[i] > top[i] && tenkan[i] > kijun[i]; }, function (i) { return isFinite(kijun[i]) && C[i] < kijun[i]; }, kijun);
  };
}
function candAroon_(len) {
  return function (o) {
    const H = o.highs, L = o.lows, n = H.length, up = new Array(n).fill(NaN), dn = new Array(n).fill(NaN);
    for (let i = len; i < n; i++) { let ih = i, il = i; for (let j = i - len; j <= i; j++) { if (H[j] >= H[ih]) ih = j; if (L[j] <= L[il]) il = j; } up[i] = 100 * (len - (i - ih)) / len; dn[i] = 100 * (len - (i - il)) / len; }
    return sigGen_(o, function (i) { return isFinite(up[i]) && up[i] > 70 && up[i] > dn[i]; }, function (i) { return isFinite(up[i]) && up[i] < dn[i]; });
  };
}
function candAdx_(len, lim) {
  return function (o) { const a = cacheInd_(o, 'adx' + len, function () { return adxDi_(o.highs, o.lows, o.closes, len); });
    return sigGen_(o, function (i) { return isFinite(a.adx[i]) && a.adx[i] > lim && a.pdi[i] > a.mdi[i]; }, function (i) { return isFinite(a.pdi[i]) && a.pdi[i] < a.mdi[i]; }); };
}
function candCci_(len) {
  return function (o) {
    const C = o.closes, n = C.length, tp = C.map(function (c, i) { return (o.highs[i] + o.lows[i] + c) / 3; }), m = sma(tp, len), cci = new Array(n).fill(NaN);
    for (let i = len - 1; i < n; i++) { if (!isFinite(m[i])) continue; let d = 0; for (let j = i - len + 1; j <= i; j++) d += Math.abs(tp[j] - m[i]); d /= len; cci[i] = d > 0 ? (tp[i] - m[i]) / (0.015 * d) : 0; }
    return sigGen_(o, function (i) { return isFinite(cci[i]) && cci[i] > 100; }, function (i) { return isFinite(cci[i]) && cci[i] < 0; });
  };
}
function candTrix_(len) {
  return function (o) {
    const e3 = ema(ema(ema(o.closes, len), len), len), n = e3.length;
    return sigGen_(o, function (i) { return i > 0 && isFinite(e3[i]) && e3[i] > e3[i - 1]; }, function (i) { return i > 0 && isFinite(e3[i]) && e3[i] < e3[i - 1]; });
  };
}
function candObv_(len, mTrend) {
  return function (o) {
    const C = o.closes, V = o.volumes, n = C.length, obv = new Array(n).fill(0);
    for (let i = 1; i < n; i++) obv[i] = obv[i - 1] + (C[i] > C[i - 1] ? V[i] : C[i] < C[i - 1] ? -V[i] : 0);
    const m = sma(obv, len), t = smaC_(o, mTrend);
    return sigGen_(o, function (i) { return isFinite(m[i]) && isFinite(t[i]) && obv[i] > m[i] && C[i] > t[i]; }, function (i) { return isFinite(m[i]) && (obv[i] < m[i] || C[i] < t[i]); });
  };
}
function candCmf_(len, lim) {
  return function (o) {
    const n = o.closes.length, mf = new Array(n).fill(0), V = o.volumes;
    for (let i = 0; i < n; i++) { const r = o.highs[i] - o.lows[i]; mf[i] = r > 0 ? ((o.closes[i] - o.lows[i]) - (o.highs[i] - o.closes[i])) / r * V[i] : 0; }
    const a = sma(mf, len), b = sma(V, len);
    return sigGen_(o, function (i) { return isFinite(a[i]) && b[i] > 0 && a[i] / b[i] > lim; }, function (i) { return isFinite(a[i]) && b[i] > 0 && a[i] / b[i] < 0; });
  };
}

/** Constrói a lista estendida (~700 candidatos). IDs começam com Y-. */
function gerarPoolEstendido_() {
  const L = [], add = function (id, fam, nome, fn) { L.push({ id: id, fam: fam, nome: nome, fn: fn, ampliado: true }); };
  const bases = [
    ['sma50', 'Preço x SMA50', candPrecoMedia_('sma', 50)], ['sma100', 'Preço x SMA100', candPrecoMedia_('sma', 100)], ['sma200', 'Preço x SMA200', candPrecoMedia_('sma', 200)],
    ['emax10-30', 'EMA10 x EMA30', candCruzamento_('ema', 10, 30)], ['emax20-50', 'EMA20 x EMA50', candCruzamento_('ema', 20, 50)],
    ['don20-10', 'Donchian 20/10', candDonchian_(20, 10)], ['don55-20', 'Donchian 55/20', candDonchian_(55, 20)], ['roc60', 'ROC 60d + SMA200', candRoc_(60)],
    ['st10-3', 'Supertrend ATR10 x 3', candSupertrend_(10, 3)], ['macd12', 'MACD 12/26/9', candMacd_(12, 26, 9)],
  ];
  bases.forEach(function (b) {
    [100, 200].forEach(function (p) { add('Y-BTC' + p + '-' + b[0], 'regimeBTC', b[1] + ' com BTC acima da SMA' + p, candBtcFiltro_(b[2], p)); });
    [2, 3, 4].forEach(function (k) { add('Y-STOP' + k + '-' + b[0], 'stop', b[1] + ' com stop de ' + k + ' ATR', candStopAtr_(b[2], k)); });
  });
  [20, 55].forEach(function (N) { [14, 22].forEach(function (a) { [2, 3, 4, 5].forEach(function (k) { add('Y-CH' + N + '-' + a + '-' + k, 'rompimento', 'Rompimento ' + N + 'd com trailing de ' + k + ' ATR' + a, candChandelier_(N, a, k)); }); }); });
  [2, 3, 5].forEach(function (p) { [[10, 50], [15, 50], [25, 70]].forEach(function (x) { [100, 200].forEach(function (t) { add('Y-RSIP' + p + '-' + x[0] + '-' + t, 'reversao', 'RSI(' + p + ') < ' + x[0] + ' acima da SMA' + t + ', sai > ' + x[1], candRsiPullback_(p, x[0], x[1], t)); }); }); });
  [[14, 30, 55], [14, 40, 60], [7, 35, 60]].forEach(function (x) { [100, 200].forEach(function (t) { add('Y-RSIP' + x[0] + '-' + x[1] + '-' + t, 'reversao', 'RSI(' + x[0] + ') < ' + x[1] + ' acima da SMA' + t + ', sai > ' + x[2], candRsiPullback_(x[0], x[1], x[2], t)); }); });
  [[20, 2], [20, 2.5], [10, 2]].forEach(function (x) { [100, 200].forEach(function (t) { add('Y-BBR' + x[0] + '-' + x[1] + '-' + t, 'reversao', 'Reversão Bollinger (' + x[0] + ', ' + x[1] + ') acima da SMA' + t, candBbReversaoTrend_(x[0], x[1], t)); }); });
  [5, 10, 15, 20, 30, 45].forEach(function (N) { [0, 100, 200].forEach(function (f) { add('Y-MOM' + N + '-' + f, 'momentum', 'Retorno de ' + N + 'd > 0' + (f ? ' acima da SMA' + f : ''), candMomCurto_(N, f)); }); });
  [21, 34, 50, 89, 144].forEach(function (n) { add('Y-HMA' + n, 'media', 'Hull MA ' + n + ' (inclinação)', candHma_(n)); });
  [[10, 30], [10, 60], [20, 30], [20, 60]].forEach(function (x) { add('Y-KAMA' + x[0] + '-' + x[1], 'media', 'KAMA ' + x[0] + '/' + x[1], candKama_(x[0], x[1])); });
  [20, 30, 50, 75, 100].forEach(function (n) { add('Y-LR' + n, 'media', 'Regressão linear ' + n, candLinreg_(n)); });
  [[0.02, 0.2], [0.01, 0.1], [0.03, 0.3]].forEach(function (x) { add('Y-PSAR' + x[0], 'supertrend', 'Parabolic SAR ' + x[0] + '/' + x[1], candPsarEstado_(x[0], x[1])); add('Y-PSARC' + x[0], 'supertrend', 'Parabolic SAR ' + x[0] + '/' + x[1] + ' (virada)', candPsar_(x[0], x[1])); });
  [[9, 26, 52], [10, 30, 60], [7, 22, 44], [12, 36, 72]].forEach(function (x) { add('Y-ICH' + x.join('-'), 'rompimento', 'Ichimoku ' + x.join('/'), candIchimoku_(x[0], x[1], x[2])); });
  [14, 25, 50].forEach(function (n) { add('Y-AROON' + n, 'momentum', 'Aroon ' + n, candAroon_(n)); });
  [10, 14, 21].forEach(function (n) { [20, 25, 30].forEach(function (l) { add('Y-ADX' + n + '-' + l, 'momentum', 'ADX(' + n + ') > ' + l + ' com +DI > -DI', candAdx_(n, l)); }); });
  [14, 20, 40].forEach(function (n) { add('Y-CCI' + n, 'momentum', 'CCI(' + n + ') > 100', candCci_(n)); });
  [8, 15, 30].forEach(function (n) { add('Y-TRIX' + n, 'momentum', 'TRIX(' + n + ')', candTrix_(n)); });
  [10, 20, 50].forEach(function (n) { [50, 100].forEach(function (t) { add('Y-OBV' + n + '-' + t, 'volume', 'OBV acima da média de ' + n + ' e preço acima da SMA' + t, candObv_(n, t)); }); });
  [10, 20, 40].forEach(function (n) { [0, 0.05, 0.1].forEach(function (l) { add('Y-CMF' + n + '-' + l, 'volume', 'Fluxo de Chaikin(' + n + ') > ' + l, candCmf_(n, l)); }); });
  return L;
}

/* =============================================================================
 * 2D. BUSCA MASSIVA — grades densas, famílias da planilha de vídeos (VWAP, estocástico, DEMA/TEMA, pullback, força relativa contra o BTC)
 *     e as combinações "estratégia + filtro de tendência SMA" que a planilha de vídeos testa (X + SMA50/100/150/200).
 *     IDs começam com Z-.
 * ===========================================================================*/
function candFiltroSma_(fnBase, f, sairPeloFiltro) {
  return function (o) {
    const s = fnBase(o), m = smaC_(o, f), C = o.closes, n = C.length, en = new Array(n).fill(false), ex = new Array(n).fill(false);
    for (let i = 0; i < n; i++) { const ok = isFinite(m[i]) && C[i] > m[i]; en[i] = s.entrySignal[i] && ok; ex[i] = s.exitSignal[i] || (sairPeloFiltro && isFinite(m[i]) && C[i] < m[i]); }
    return { entrySignal: en, exitSignal: ex, invalidationSeries: s.invalidationSeries || m, stopIfEnteredSeries: s.stopIfEnteredSeries };
  };
}
function candVwap_(len) {
  return function (o) {
    const C = o.closes, n = C.length, vw = cacheInd_(o, 'vw' + len, function () {
      const tp = o.highs.map(function (h, i) { return (h + o.lows[i] + C[i]) / 3; }), pv = tp.map(function (x, i) { return x * o.volumes[i]; }), a = sma(pv, len), b = sma(o.volumes, len);
      return a.map(function (x, i) { return b[i] > 0 ? x / b[i] : NaN; });
    });
    return sigGen_(o, function (i) { return isFinite(vw[i]) && C[i] > vw[i]; }, function (i) { return isFinite(vw[i]) && C[i] < vw[i]; }, vw);
  };
}
function candEstocastico_(k, f, sobrevendido, saida) {
  return function (o) {
    const hl = hhll_(o.highs, o.lows, k), C = o.closes, n = C.length, raw = new Array(n).fill(NaN);
    for (let i = 0; i < n; i++) if (isFinite(hl.hh[i]) && hl.hh[i] > hl.ll[i]) raw[i] = 100 * (C[i] - hl.ll[i]) / (hl.hh[i] - hl.ll[i]);
    const st = sma(raw, 3), m = smaC_(o, f);
    return sigGen_(o, function (i) { return isFinite(st[i]) && isFinite(m[i]) && st[i] < sobrevendido && C[i] > m[i]; }, function (i) { return isFinite(st[i]) && st[i] > saida; }, m);
  };
}
function candDema_(len, tripla) {
  return function (o) {
    const C = o.closes, e1 = emaC_(o, len), e2 = ema(e1, len), e3 = tripla ? ema(e2, len) : null, n = C.length, d = new Array(n).fill(NaN);
    for (let i = 0; i < n; i++) d[i] = tripla ? 3 * e1[i] - 3 * e2[i] + e3[i] : 2 * e1[i] - e2[i];
    return sigGen_(o, function (i) { return isFinite(d[i]) && C[i] > d[i]; }, function (i) { return isFinite(d[i]) && C[i] < d[i]; }, d);
  };
}
function candPullbackSma_(trend, toque) {
  return function (o) {
    const C = o.closes, L = o.lows, t = smaC_(o, trend), m = smaC_(o, toque);
    return sigGen_(o, function (i) { return isFinite(t[i]) && isFinite(m[i]) && C[i] > t[i] && L[i] <= m[i] && C[i] > m[i]; }, function (i) { return isFinite(t[i]) && C[i] < Math.min(t[i], m[i]); }, t);
  };
}
function candForcaRelativa_(n, f) {
  return function (o) {
    const C = o.closes, b = o.btcC || [], N = C.length, r = new Array(N).fill(NaN);
    for (let i = 0; i < N; i++) if (isFinite(b[i]) && b[i] > 0) r[i] = C[i] / b[i];
    const m = sma(r, n), t = smaC_(o, f);
    return sigGen_(o, function (i) { return isFinite(m[i]) && isFinite(t[i]) && r[i] > m[i] && C[i] > t[i]; }, function (i) { return (isFinite(m[i]) && r[i] < m[i]) || (isFinite(t[i]) && C[i] < t[i]); }, t);
  };
}
function candRompeVol_(k, saidaMedia) {
  return function (o) {
    const C = o.closes, atr = atrC_(o, 14), m = smaC_(o, saidaMedia);
    return sigGen_(o, function (i) { return i > 0 && isFinite(atr[i - 1]) && C[i] > C[i - 1] + k * atr[i - 1]; }, function (i) { return isFinite(m[i]) && C[i] < m[i]; }, m);
  };
}

/** Bases usadas nas combinações com filtro de tendência. [id curto, família, nome, função] */
function basesFiltro_() {
  const B = [];
  [20, 50, 100, 200].forEach(function (p) { B.push(['SMA' + p, 'media', 'Preço x SMA' + p, candPrecoMedia_('sma', p)]); });
  [21, 50, 100].forEach(function (p) { B.push(['EMA' + p, 'media', 'Preço x EMA' + p, candPrecoMedia_('ema', p)]); });
  [[9, 21], [10, 30], [12, 26], [20, 50], [21, 55]].forEach(function (x) { B.push(['EX' + x[0] + '-' + x[1], 'cruzamento', 'EMA' + x[0] + ' x EMA' + x[1], candCruzamento_('ema', x[0], x[1])]); });
  [[20, 50], [50, 200]].forEach(function (x) { B.push(['SX' + x[0] + '-' + x[1], 'cruzamento', 'SMA' + x[0] + ' x SMA' + x[1], candCruzamento_('sma', x[0], x[1])]); });
  [[20, 10], [40, 20], [55, 20]].forEach(function (x) { B.push(['DON' + x[0] + '-' + x[1], 'rompimento', 'Donchian ' + x[0] + '/' + x[1], candDonchian_(x[0], x[1])]); });
  [[12, 26, 9], [8, 17, 9]].forEach(function (x) { B.push(['MACD' + x.join('-'), 'momentum', 'MACD ' + x.join('/'), candMacd_(x[0], x[1], x[2])]); });
  [[10, 2], [20, 2], [12, 2.5]].forEach(function (x) { B.push(['KC' + x[0] + '-' + x[1], 'rompimento', 'Keltner EMA' + x[0] + ' + ' + x[1] + ' ATR', candKeltner_(x[0], x[1])]); });
  [[20, 2], [20, 2.5]].forEach(function (x) { B.push(['BB' + x[0] + '-' + x[1], 'rompimento', 'Bollinger rompimento (' + x[0] + ', ' + x[1] + ')', candBollRompe_(x[0], x[1])]); });
  [[14, 55, 45], [21, 50, 50]].forEach(function (x) { B.push(['RSI' + x[0] + '-' + x[1], 'momentum', 'RSI(' + x[0] + ') regime ' + x[1] + '/' + x[2], candRsiRegime_(x[0], x[1], x[2])]); });
  [[10, 3], [14, 2], [7, 3]].forEach(function (x) { B.push(['ST' + x[0] + '-' + x[1], 'supertrend', 'Supertrend ATR' + x[0] + ' x ' + x[1], candSupertrend_(x[0], x[1])]); });
  [30, 60].forEach(function (n) { B.push(['ROC' + n, 'momentum', 'ROC ' + n + 'd', candMomCurto_(n, 0)]); });
  [[20, 22, 3], [55, 22, 3]].forEach(function (x) { B.push(['CH' + x[0] + '-' + x[2], 'rompimento', 'Chandelier ' + x[0] + 'd ATR' + x[1] + ' x ' + x[2], candChandelier_(x[0], x[1], x[2])]); });
  B.push(['VWAP20', 'vwap', 'Preço x VWAP 20', candVwap_(20)], ['VWAP50', 'vwap', 'Preço x VWAP 50', candVwap_(50)], ['PSAR', 'supertrend', 'Parabolic SAR 0.02/0.2', candPsarEstado_(0.02, 0.2)]);
  return B;
}


/** Estado (1 = comprado) implícito nos sinais de um candidato: liga na entrada, desliga na saída. */
function estadoSinal_(sg) {
  const n = sg.entrySignal.length, out = new Array(n).fill(0); let st = 0;
  for (let i = 0; i < n; i++) { if (!st && sg.entrySignal[i]) st = 1; else if (st && sg.exitSignal[i]) st = 0; out[i] = st; }
  return out;
}
/** Comitê: fração dos membros comprados; entra quando >= hi e sai quando < lo (histerese entre os dois). */
function candComite_(fns, hi, lo, btcP) {
  return function (o) {
    const est = fns.map(function (f) { return estadoSinal_(f(o)); }), n = o.closes.length, reg = btcP ? btcRegime_(o, btcP) : null, en = new Array(n).fill(false), ex = new Array(n).fill(false), K = fns.length;
    for (let i = 0; i < n; i++) { let v = 0; for (let k = 0; k < K; k++) v += est[k][i]; v /= K; en[i] = v >= hi && (!reg || reg[i]); ex[i] = v < lo || (reg && !reg[i]); }
    return { entrySignal: en, exitSignal: ex };
  };
}
function comitesMassivo_() {
  const sma_ = function (p) { return candPrecoMedia_('sma', p); }, ema_ = function (p) { return candPrecoMedia_('ema', p); };
  const grupos = {
    'sma': [20, 50, 100, 150, 200].map(sma_),
    'ema': [10, 21, 50, 100, 200].map(ema_),
    'cruz': [candCruzamento_('ema', 9, 21), candCruzamento_('ema', 12, 26), candCruzamento_('ema', 20, 50), candCruzamento_('ema', 21, 55), candCruzamento_('sma', 20, 50), candCruzamento_('sma', 50, 200)],
    'don': [candDonchian_(20, 10), candDonchian_(40, 20), candDonchian_(55, 20), candDonchian_(100, 50), candDonchian_(150, 50)],
    'mix8': [sma_(50), ema_(21), candCruzamento_('ema', 20, 50), candDonchian_(40, 20), candMacd_(12, 26, 9), candSupertrend_(10, 3), candKeltner_(20, 2), candRoc_(60)],
    'mix12': [sma_(20), sma_(100), ema_(50), candCruzamento_('ema', 12, 26), candCruzamento_('sma', 50, 200), candDonchian_(20, 10), candDonchian_(100, 50), candMacd_(8, 17, 9), candSupertrend_(14, 2), candKeltner_(10, 2), candBollRompe_(20, 2), candHma_(50)],
    'curto': [sma_(10), ema_(10), candCruzamento_('ema', 5, 13), candDonchian_(10, 5), candMacd_(5, 17, 5), candSupertrend_(7, 2), candRsiRegime_(7, 55, 45), candMomCurto_(10, 0)],
    'lento': [sma_(150), sma_(200), candCruzamento_('sma', 50, 200), candDonchian_(150, 50), candMacd_(24, 52, 18), candSupertrend_(28, 3), candMomCurto_(120, 0), candMomCurto_(180, 0)],
  };
  const L = []; const lims = [[0.5, 0.5], [0.6, 0.4], [0.75, 0.5], [0.4, 0.2], [0.8, 0.4]];
  Object.keys(grupos).forEach(function (g) {
    lims.forEach(function (l) {
      [0, 100, 200].forEach(function (b) { L.push({ id: 'Z-CM' + g + '-' + l[0] + '-' + l[1] + (b ? '-B' + b : ''), fam: 'comite', nome: 'Comitê ' + g + ' (entra com ' + Math.round(l[0] * 100) + '% dos votos, sai abaixo de ' + Math.round(l[1] * 100) + '%)' + (b ? ' com BTC acima da SMA' + b : ''), fn: candComite_(grupos[g], l[0], l[1], b), ampliado: true }); });
    });
  });
  return L;
}

/** Constrói a lista massiva. */
function gerarPoolMassivo_() {
  const L = [], add = function (id, fam, nome, fn) { L.push({ id: id, fam: fam, nome: nome, fn: fn, ampliado: true }); };
  // 1. combinações da planilha de vídeos: base + filtro SMA (entra só acima da SMA) e a variante que também sai ao perder a SMA
  basesFiltro_().forEach(function (b) {
    [50, 100, 150, 200].forEach(function (f) {
      add('Z-F' + f + '-' + b[0], b[1], b[2] + ' + SMA' + f + ' (filtro de entrada)', candFiltroSma_(b[3], f, false));
      add('Z-FS' + f + '-' + b[0], b[1], b[2] + ' + SMA' + f + ' (filtro e saída)', candFiltroSma_(b[3], f, true));
    });
  });
  // 2. grades densas
  [8, 10, 14, 21, 28, 40].forEach(function (a) { [1, 1.5, 2, 2.5, 3, 3.5, 4, 5].forEach(function (m) { add('Z-ST' + a + '-' + m, 'supertrend', 'Supertrend ATR' + a + ' x ' + m, candSupertrend_(a, m)); }); });
  [10, 15, 20, 30, 40, 55, 70, 100, 150, 200].forEach(function (N) { [5, 7, 10, 15, 20, 30, 50, 100].forEach(function (M) { if (M < N) add('Z-DON' + N + '-' + M, 'rompimento', 'Donchian ' + N + '/' + M, candDonchian_(N, M)); }); });
  [10, 15, 20, 30, 50].forEach(function (p) { [1, 1.5, 2, 2.5, 3].forEach(function (m) { add('Z-KC' + p + '-' + m, 'rompimento', 'Keltner EMA' + p + ' + ' + m + ' ATR10', candKeltner_(p, m)); add('Z-BB' + p + '-' + m, 'rompimento', 'Bollinger rompimento (' + p + ', ' + m + ')', candBollRompe_(p, m)); }); });
  [7, 10, 14, 21, 30].forEach(function (p) { [50, 55, 60, 65].forEach(function (a) { [40, 45, 50].forEach(function (b) { add('Z-RSI' + p + '-' + a + '-' + b, 'momentum', 'RSI(' + p + ') regime ' + a + '/' + b, candRsiRegime_(p, a, b)); }); }); });
  [5, 8, 12, 16, 20, 24].forEach(function (f) { [17, 21, 26, 34, 50, 52].forEach(function (s) { if (s > f * 1.4) [5, 9, 12, 18].forEach(function (g) { add('Z-MACD' + f + '-' + s + '-' + g, 'momentum', 'MACD ' + f + '/' + s + '/' + g + ' (histograma)', candMacd_(f, s, g)); }); }); });
  [5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 250].forEach(function (N) { [0, 50, 100, 200].forEach(function (f) { add('Z-ROC' + N + '-' + f, 'momentum', 'Retorno de ' + N + 'd > 0' + (f ? ' acima da SMA' + f : ''), candMomCurto_(N, f)); }); });
  [10, 15, 20, 30, 40, 50, 75, 100, 150, 200, 250].forEach(function (p) { add('Z-S' + p, 'media', 'Preço x SMA' + p, candPrecoMedia_('sma', p)); add('Z-E' + p, 'media', 'Preço x EMA' + p, candPrecoMedia_('ema', p)); });
  // 3. famílias da planilha de vídeos
  [10, 20, 30, 50, 100].forEach(function (n) { add('Z-VWAP' + n, 'vwap', 'Preço x VWAP ' + n, candVwap_(n)); });
  [[14, 100, 20, 50], [14, 200, 20, 70], [14, 100, 30, 70], [9, 100, 20, 60], [21, 200, 25, 70], [14, 50, 20, 50]].forEach(function (x) { add('Z-STO' + x.join('-'), 'reversao', 'Estocástico(' + x[0] + ') < ' + x[2] + ' acima da SMA' + x[1] + ', sai > ' + x[3], candEstocastico_(x[0], x[1], x[2], x[3])); });
  [10, 20, 34, 55, 89].forEach(function (n) { add('Z-DEMA' + n, 'media', 'Preço x DEMA ' + n, candDema_(n, false)); add('Z-TEMA' + n, 'media', 'Preço x TEMA ' + n, candDema_(n, true)); });
  [[200, 20], [100, 20], [100, 50], [200, 50], [50, 10], [50, 20]].forEach(function (x) { add('Z-PB' + x[0] + '-' + x[1], 'reversao', 'Pullback à SMA' + x[1] + ' em tendência acima da SMA' + x[0], candPullbackSma_(x[0], x[1])); });
  [20, 50, 100].forEach(function (n) { [50, 100, 200].forEach(function (f) { add('Z-RS' + n + '-' + f, 'forcaRelativa', 'Força relativa contra o BTC (média ' + n + ') com preço acima da SMA' + f, candForcaRelativa_(n, f)); }); });
  [1, 1.5, 2].forEach(function (k) { [10, 20, 50].forEach(function (m) { add('Z-VB' + k + '-' + m, 'rompimento', 'Rompimento de volatilidade ' + k + ' ATR, sai abaixo da SMA' + m, candRompeVol_(k, m)); }); });
  return L.concat(comitesMassivo_());
}

/* =============================================================================
 * 2E. REVERSÃO EM TENDÊNCIA — compra recuos curtos dentro de tendência de alta (IBS, mínimas de N dias, quedas seguidas,
 *     Williams %R, CCI, RSI curto) com saídas rápidas. IDs começam com Z-RV.
 * ===========================================================================*/
function candRevGen_(o, entrada, saida, f) {
  const C = o.closes, m = smaC_(o, f);
  return sigGen_(o, function (i) { return isFinite(m[i]) && C[i] > m[i] && entrada(i); }, function (i) { return saida(i); }, m);
}
function saidaRev_(o, tipo) {   // 0: fecha acima da SMA5; 1: fecha acima da SMA10; 2: fecha acima da máxima do dia anterior
  const C = o.closes, H = o.highs, a = smaC_(o, 5), b = smaC_(o, 10);
  return tipo === 0 ? function (i) { return isFinite(a[i]) && C[i] > a[i]; } : tipo === 1 ? function (i) { return isFinite(b[i]) && C[i] > b[i]; } : function (i) { return i > 0 && C[i] > H[i - 1]; };
}
function candIbs_(t, f, saida) {
  return function (o) { const C = o.closes, H = o.highs, L = o.lows; return candRevGen_(o, function (i) { return H[i] > L[i] && (C[i] - L[i]) / (H[i] - L[i]) < t; }, saidaRev_(o, saida), f); };
}
function candMinimaN_(N, f, saida) {
  return function (o) { const C = o.closes, L = o.lows; return candRevGen_(o, function (i) { if (i < N) return false; let m = Infinity; for (let j = i - N; j < i; j++) if (L[j] < m) m = L[j]; return C[i] < m; }, saidaRev_(o, saida), f); };
}
function candQuedas_(k, f, saida) {
  return function (o) { const C = o.closes; return candRevGen_(o, function (i) { if (i < k) return false; for (let j = 0; j < k; j++) if (!(C[i - j] < C[i - j - 1])) return false; return true; }, saidaRev_(o, saida), f); };
}
function candWilliams_(p, lim, f, saida) {
  return function (o) { const hl = cacheInd_(o, 'hl' + p, function () { return hhll_(o.highs, o.lows, p); }), C = o.closes;
    return candRevGen_(o, function (i) { return isFinite(hl.hh[i]) && hl.hh[i] > hl.ll[i] && -100 * (hl.hh[i] - C[i]) / (hl.hh[i] - hl.ll[i]) < lim; }, saidaRev_(o, saida), f); };
}
function candRsiRev_(p, thr, f, saida) {
  return function (o) { const r = cacheInd_(o, 'r' + p, function () { return rsi(o.closes, p); }); return candRevGen_(o, function (i) { return isFinite(r[i]) && r[i] < thr; }, saidaRev_(o, saida), f); };
}
function candCciRev_(p, lim, f, saida) {
  return function (o) {
    const C = o.closes, n = C.length, tp = C.map(function (c, i) { return (o.highs[i] + o.lows[i] + c) / 3; }), m = sma(tp, p), cci = cacheInd_(o, 'cciv' + p, function () {
      const out = new Array(n).fill(NaN); for (let i = p - 1; i < n; i++) { if (!isFinite(m[i])) continue; let d = 0; for (let j = i - p + 1; j <= i; j++) d += Math.abs(tp[j] - m[i]); d /= p; out[i] = d > 0 ? (tp[i] - m[i]) / (0.015 * d) : 0; } return out; });
    return candRevGen_(o, function (i) { return isFinite(cci[i]) && cci[i] < lim; }, saidaRev_(o, saida), f);
  };
}
function gerarPoolReversao_() {
  const L = [], add = function (id, nome, fn) { L.push({ id: id, fam: 'reversao', nome: nome, fn: fn, ampliado: true }); }, sn = ['SMA5', 'SMA10', 'máxima anterior'];
  [50, 100, 150, 200].forEach(function (f) { [0, 1, 2].forEach(function (sd) {
    [0.1, 0.2, 0.3].forEach(function (t) { add('Z-RVIBS' + t + '-' + f + '-' + sd, 'IBS < ' + t + ' acima da SMA' + f + ', sai > ' + sn[sd], candIbs_(t, f, sd)); });
    [3, 5, 7, 10].forEach(function (N) { add('Z-RVMIN' + N + '-' + f + '-' + sd, 'Fecha abaixo da mínima de ' + N + 'd acima da SMA' + f + ', sai > ' + sn[sd], candMinimaN_(N, f, sd)); });
    [2, 3, 4].forEach(function (k) { add('Z-RVQ' + k + '-' + f + '-' + sd, k + ' quedas seguidas acima da SMA' + f + ', sai > ' + sn[sd], candQuedas_(k, f, sd)); });
    [[10, -90], [14, -90], [14, -80], [21, -80]].forEach(function (x) { add('Z-RVWR' + x[0] + '-' + (-x[1]) + '-' + f + '-' + sd, 'Williams %R(' + x[0] + ') < ' + x[1] + ' acima da SMA' + f + ', sai > ' + sn[sd], candWilliams_(x[0], x[1], f, sd)); });
    [[2, 5], [2, 10], [2, 20], [3, 10], [3, 20], [4, 15], [4, 25], [5, 20], [5, 30]].forEach(function (x) { add('Z-RVRSI' + x[0] + '-' + x[1] + '-' + f + '-' + sd, 'RSI(' + x[0] + ') < ' + x[1] + ' acima da SMA' + f + ', sai > ' + sn[sd], candRsiRev_(x[0], x[1], f, sd)); });
    [[14, -100], [20, -100], [20, -150]].forEach(function (x) { add('Z-RVCCI' + x[0] + '-' + (-x[1]) + '-' + f + '-' + sd, 'CCI(' + x[0] + ') < ' + x[1] + ' acima da SMA' + f + ', sai > ' + sn[sd], candCciRev_(x[0], x[1], f, sd)); });
  }); });
  return L;
}

/* =============================================================================
 * 2F. GRADE FINA — passos curtos de parâmetros em MACD, Bollinger, Keltner, CCI e Supertrend (famílias que mais produziram candidatos
 *     aprovados). São variações da MESMA ideia: ajudam a completar vagas, mas contam como pouca diversificação. IDs começam com Z-N-.
 * ===========================================================================*/
function gerarPoolFino_() {
  const L = [], add = function (id, fam, nome, fn) { L.push({ id: 'Z-N-' + id, fam: fam, nome: nome, fn: fn, ampliado: true }); };
  [4, 5, 6, 8, 10, 12, 14, 16, 19, 20, 23, 26, 29].forEach(function (f) { [13, 17, 21, 26, 30, 34, 39, 42, 46, 50, 55, 60].forEach(function (s) { if (s >= f * 1.5) [5, 7, 9, 12, 16, 20].forEach(function (g) { add('MACD' + f + '-' + s + '-' + g, 'momentum', 'MACD ' + f + '/' + s + '/' + g + ' (histograma, grade fina)', candMacd_(f, s, g)); }); }); });
  [10, 12, 14, 16, 18, 20, 22, 25, 30, 40, 50].forEach(function (p) { [1, 1.2, 1.4, 1.6, 1.8, 2, 2.2, 2.5, 3].forEach(function (k) { add('BB' + p + '-' + k, 'rompimento', 'Bollinger rompimento (' + p + ', ' + k + ', grade fina)', candBollRompe_(p, k)); }); });
  [8, 10, 12, 14, 16, 18, 20, 25, 30].forEach(function (p) { [1, 1.2, 1.5, 1.9, 2, 2.5, 3].forEach(function (m) { add('KC' + p + '-' + m, 'rompimento', 'Keltner EMA' + p + ' + ' + m + ' ATR10 (grade fina)', candKeltner_(p, m)); }); });
  for (let n = 14; n <= 60; n += 2) add('CCI' + n, 'momentum', 'CCI(' + n + ') > 100 (grade fina)', candCci_(n));
  [5, 6, 7, 8, 9, 10, 12, 14, 16, 18, 21, 25, 28].forEach(function (a) { [1, 1.5, 1.8, 2, 2.2, 2.5, 3, 3.5, 4].forEach(function (m) { add('ST' + a + '-' + m, 'supertrend', 'Supertrend ATR' + a + ' x ' + m + ' (grade fina)', candSupertrend_(a, m)); }); });
  return L;
}

/* =============================================================================
 * 2G. NOVAS CLASSES DE INDICADOR — cada uma é uma "ideia" própria para a regra de diversificação (1 por classe a cada 5).
 *     IDs começam com Z-K-. Todas causais.
 * ===========================================================================*/
function filtroSmaOk_(o, f) { const m = f ? smaC_(o, f) : null, C = o.closes; return function (i) { return !m || (isFinite(m[i]) && C[i] > m[i]); }; }
function candAwesome_(a, b, f) {
  return function (o) { const md = o.highs.map(function (h, i) { return (h + o.lows[i]) / 2; }), x = sma(md, a), y = sma(md, b), ok = filtroSmaOk_(o, f);
    return sigGen_(o, function (i) { return isFinite(x[i]) && isFinite(y[i]) && x[i] - y[i] > 0 && ok(i); }, function (i) { return isFinite(x[i]) && isFinite(y[i]) && x[i] - y[i] < 0; }); };
}
function candVortex_(len) {
  return function (o) {
    const H = o.highs, L = o.lows, C = o.closes, n = C.length, pm = new Array(n).fill(0), mm = new Array(n).fill(0), tr = new Array(n).fill(0);
    for (let i = 1; i < n; i++) { pm[i] = Math.abs(H[i] - L[i - 1]); mm[i] = Math.abs(L[i] - H[i - 1]); tr[i] = Math.max(H[i] - L[i], Math.abs(H[i] - C[i - 1]), Math.abs(L[i] - C[i - 1])); }
    const a = sma(pm, len), b = sma(mm, len), t = sma(tr, len);
    return sigGen_(o, function (i) { return t[i] > 0 && a[i] > b[i]; }, function (i) { return t[i] > 0 && a[i] < b[i]; });
  };
}
function candTsi_(r, s, sig) {
  return function (o) {
    const C = o.closes, n = C.length, m = new Array(n).fill(NaN), am = new Array(n).fill(NaN);
    for (let i = 1; i < n; i++) { m[i] = C[i] - C[i - 1]; am[i] = Math.abs(m[i]); }
    const num = ema(ema(m, r), s), den = ema(ema(am, r), s), tsi = num.map(function (x, i) { return den[i] > 0 ? 100 * x / den[i] : NaN; }), sg = sig ? ema(tsi, sig) : null;
    return sigGen_(o, function (i) { return isFinite(tsi[i]) && (sg ? isFinite(sg[i]) && tsi[i] > sg[i] : tsi[i] > 0); }, function (i) { return isFinite(tsi[i]) && (sg ? isFinite(sg[i]) && tsi[i] < sg[i] : tsi[i] < 0); });
  };
}
function mfi_(o, len) {
  const n = o.closes.length, tp = o.highs.map(function (h, i) { return (h + o.lows[i] + o.closes[i]) / 3; }), pos = new Array(n).fill(0), neg = new Array(n).fill(0), out = new Array(n).fill(NaN);
  for (let i = 1; i < n; i++) { const f = tp[i] * o.volumes[i]; if (tp[i] > tp[i - 1]) pos[i] = f; else if (tp[i] < tp[i - 1]) neg[i] = f; }
  const a = sma(pos, len), b = sma(neg, len); for (let i = 0; i < n; i++) if (isFinite(a[i]) && isFinite(b[i])) out[i] = b[i] === 0 ? 100 : 100 - 100 / (1 + a[i] / b[i]);
  return out;
}
function candMfiRegime_(len, alto, baixo) { return function (o) { const m = cacheInd_(o, 'mfi' + len, function () { return mfi_(o, len); }); return sigGen_(o, function (i) { return isFinite(m[i]) && m[i] > alto; }, function (i) { return isFinite(m[i]) && m[i] < baixo; }); }; }
function candMfiRev_(len, lim, f) { return function (o) { const m = cacheInd_(o, 'mfi' + len, function () { return mfi_(o, len); }), ok = filtroSmaOk_(o, f); return sigGen_(o, function (i) { return isFinite(m[i]) && m[i] < lim && ok(i); }, function (i) { return isFinite(m[i]) && m[i] > 50; }); }; }
function candForceIndex_(len) {
  return function (o) { const C = o.closes, n = C.length, fi = new Array(n).fill(NaN); for (let i = 1; i < n; i++) fi[i] = (C[i] - C[i - 1]) * o.volumes[i]; const e = ema(fi, len);
    return sigGen_(o, function (i) { return isFinite(e[i]) && e[i] > 0; }, function (i) { return isFinite(e[i]) && e[i] < 0; }); };
}
function candElder_(len) {
  return function (o) { const e = emaC_(o, len), H = o.highs;
    return sigGen_(o, function (i) { return i > 0 && isFinite(e[i]) && isFinite(e[i - 1]) && e[i] > e[i - 1] && H[i] > e[i]; }, function (i) { return i > 0 && isFinite(e[i]) && isFinite(e[i - 1]) && e[i] < e[i - 1]; }, e); };
}
function candKst_(escala, sig) {
  return function (o) {
    const C = o.closes, n = C.length, roc = function (k) { const r = new Array(n).fill(NaN); for (let i = k; i < n; i++) r[i] = 100 * (C[i] / C[i - k] - 1); return r; };
    const w = [[10, 10], [15, 10], [20, 10], [30, 15]].map(function (x) { return sma(roc(Math.round(x[0] * escala)), Math.round(x[1] * escala)); }), kst = new Array(n).fill(NaN);
    for (let i = 0; i < n; i++) { let s = 0, ok = true; for (let k = 0; k < 4; k++) { if (!isFinite(w[k][i])) { ok = false; break; } s += w[k][i] * (k + 1); } if (ok) kst[i] = s; }
    const sg = sma(kst, sig); return sigGen_(o, function (i) { return isFinite(kst[i]) && isFinite(sg[i]) && kst[i] > sg[i]; }, function (i) { return isFinite(kst[i]) && isFinite(sg[i]) && kst[i] < sg[i]; });
  };
}
function candCoppock_(a, b, w) {
  return function (o) { const C = o.closes, n = C.length, r = new Array(n).fill(NaN); for (let i = Math.max(a, b); i < n; i++) r[i] = 100 * ((C[i] / C[i - a] - 1) + (C[i] / C[i - b] - 1)); const c = wma_(r, w);
    return sigGen_(o, function (i) { return i > 0 && isFinite(c[i]) && isFinite(c[i - 1]) && c[i] > 0 && c[i] > c[i - 1]; }, function (i) { return isFinite(c[i]) && c[i] < 0; }); };
}
function candFisher_(len) {
  return function (o) { const hl = hhll_(o.highs, o.lows, len), n = o.closes.length, f = new Array(n).fill(NaN), md = o.highs.map(function (h, i) { return (h + o.lows[i]) / 2; }); let v = 0, prev = 0;
    for (let i = 0; i < n; i++) { if (!isFinite(hl.hh[i]) || hl.hh[i] === hl.ll[i]) continue; v = 0.66 * ((md[i] - hl.ll[i]) / (hl.hh[i] - hl.ll[i]) - 0.5) + 0.67 * v; v = Math.max(-0.999, Math.min(0.999, v)); const x = 0.5 * Math.log((1 + v) / (1 - v)) + 0.5 * prev; f[i] = x; prev = x; }
    return sigGen_(o, function (i) { return i > 0 && isFinite(f[i]) && isFinite(f[i - 1]) && f[i] > f[i - 1]; }, function (i) { return i > 0 && isFinite(f[i]) && isFinite(f[i - 1]) && f[i] < f[i - 1]; }); };
}
function candStochRsi_(rp, sp) {
  return function (o) { const r = cacheInd_(o, 'r' + rp, function () { return rsi(o.closes, rp); }), n = r.length, k = new Array(n).fill(NaN);
    for (let i = sp - 1 + rp; i < n; i++) { let a = Infinity, b = -Infinity, ok = true; for (let j = i - sp + 1; j <= i; j++) { if (!isFinite(r[j])) { ok = false; break; } if (r[j] < a) a = r[j]; if (r[j] > b) b = r[j]; } if (ok && b > a) k[i] = 100 * (r[i] - a) / (b - a); }
    const d = sma(k, 3); return sigGen_(o, function (i) { return isFinite(d[i]) && d[i] > 60; }, function (i) { return isFinite(d[i]) && d[i] < 40; }); };
}
function candConnors_(lim, f, saida) {
  return function (o) {
    const C = o.closes, n = C.length, r3 = cacheInd_(o, 'r3', function () { return rsi(C, 3); }), st = new Array(n).fill(0), roc = new Array(n).fill(NaN), pr = new Array(n).fill(NaN);
    for (let i = 1; i < n; i++) { st[i] = C[i] > C[i - 1] ? Math.max(st[i - 1], 0) + 1 : C[i] < C[i - 1] ? Math.min(st[i - 1], 0) - 1 : 0; roc[i] = C[i] / C[i - 1] - 1; }
    const rs = rsi(st.map(function (x, i) { return i ? x : NaN; }), 2);
    for (let i = 101; i < n; i++) { let c = 0; for (let j = i - 100; j < i; j++) if (roc[j] < roc[i]) c++; pr[i] = c; }
    const crsi = C.map(function (x, i) { return (r3[i] + rs[i] + pr[i]) / 3; }), ok = filtroSmaOk_(o, f), sm = smaC_(o, 5);
    return sigGen_(o, function (i) { return isFinite(crsi[i]) && crsi[i] < lim && ok(i); }, function (i) { return saida === 0 ? (isFinite(crsi[i]) && crsi[i] > 60) : (isFinite(sm[i]) && C[i] > sm[i]); });
  };
}
function candSqueeze_(p, kb, kk) {
  return function (o) {
    const C = o.closes, n = C.length, m = smaC_(o, p), sd = cacheInd_(o, 'sd' + p, function () { return stdevPop_(C, p); }), atr = atrC_(o, p), lr = cacheInd_(o, 'lrm' + p, function () { return linreg_(C.map(function (c, i) { return isFinite(m[i]) ? c - m[i] : NaN; }), p); });
    const on = new Array(n).fill(false); for (let i = 0; i < n; i++) on[i] = isFinite(m[i]) && isFinite(atr[i]) && m[i] + kb * sd[i] < m[i] + kk * atr[i] && m[i] - kb * sd[i] > m[i] - kk * atr[i];
    return sigGen_(o, function (i) { return i > 0 && on[i - 1] && !on[i] && isFinite(lr.val[i]) && lr.val[i] > 0; }, function (i) { return isFinite(lr.val[i]) && lr.val[i] < 0; });
  };
}
function candHeikin_(k, f) {
  return function (o) {
    const n = o.closes.length, hc = new Array(n), ho = new Array(n); for (let i = 0; i < n; i++) { hc[i] = (o.opens[i] + o.highs[i] + o.lows[i] + o.closes[i]) / 4; ho[i] = i ? (ho[i - 1] + hc[i - 1]) / 2 : (o.opens[i] + o.closes[i]) / 2; }
    const ok = filtroSmaOk_(o, f); return sigGen_(o, function (i) { if (i < k) return false; for (let j = 0; j < k; j++) if (!(hc[i - j] > ho[i - j])) return false; return ok(i); }, function (i) { return hc[i] < ho[i]; });
  };
}
function candGann_(len) {
  return function (o) { const hi = sma(o.highs, len), lo = sma(o.lows, len), C = o.closes, n = C.length, st = new Array(n).fill(0); let s = 0;
    for (let i = 1; i < n; i++) { if (isFinite(hi[i - 1]) && C[i] > hi[i - 1]) s = 1; else if (isFinite(lo[i - 1]) && C[i] < lo[i - 1]) s = -1; st[i] = s; }
    return sigGen_(o, function (i) { return st[i] === 1; }, function (i) { return st[i] === -1; }, lo); };
}
function candZlema_(len) {
  return function (o) { const C = o.closes, lag = Math.round((len - 1) / 2), d = C.map(function (c, i) { return i >= lag ? 2 * c - C[i - lag] : NaN; }), z = ema(d, len);
    return sigGen_(o, function (i) { return i > 0 && isFinite(z[i]) && isFinite(z[i - 1]) && C[i] > z[i] && z[i] > z[i - 1]; }, function (i) { return isFinite(z[i]) && C[i] < z[i]; }, z); };
}
function candZscorePreco_(n, k, trend) {
  return function (o) { const C = o.closes, m = smaC_(o, n), sd = cacheInd_(o, 'sd' + n, function () { return stdevPop_(C, n); }), t = smaC_(o, trend);
    return sigGen_(o, function (i) { return isFinite(m[i]) && sd[i] > 0 && isFinite(t[i]) && (C[i] - m[i]) / sd[i] < -k && C[i] > t[i]; }, function (i) { return isFinite(m[i]) && C[i] > m[i]; }, t); };
}
function candPicoVolume_(mult, saidaEma) {
  return function (o) { const C = o.closes, V = o.volumes, av = sma(V, 20), e = emaC_(o, saidaEma);
    return sigGen_(o, function (i) { return i > 0 && isFinite(av[i - 1]) && av[i - 1] > 0 && V[i] > mult * av[i - 1] && C[i] > C[i - 1] && isFinite(e[i]) && C[i] > e[i]; }, function (i) { return isFinite(e[i]) && C[i] < e[i]; }, e); };
}
function candAlligator_(esc) {
  return function (o) { const md = o.highs.map(function (h, i) { return (h + o.lows[i]) / 2; }), smma = function (v, len) { const out = new Array(v.length).fill(NaN); let p = null; for (let i = 0; i < v.length; i++) { if (p === null) { if (i >= len - 1) { let s = 0; for (let j = i - len + 1; j <= i; j++) s += v[j]; p = s / len; out[i] = p; } } else { p = (p * (len - 1) + v[i]) / len; out[i] = p; } } return out; };
    const jw = smma(md, 13 * esc), te = smma(md, 8 * esc), li = smma(md, 5 * esc), sh = function (a, k) { return function (i) { return i - k >= 0 ? a[i - k] : NaN; }; }, J = sh(jw, 8 * esc), T = sh(te, 5 * esc), Li = sh(li, 3 * esc);
    return sigGen_(o, function (i) { return isFinite(J(i)) && isFinite(T(i)) && isFinite(Li(i)) && Li(i) > T(i) && T(i) > J(i); }, function (i) { return isFinite(T(i)) && isFinite(Li(i)) && Li(i) < T(i); }); };
}
function candChoppiness_(len, f) {
  return function (o) { const H = o.highs, L = o.lows, C = o.closes, n = C.length, tr = new Array(n).fill(0); for (let i = 1; i < n; i++) tr[i] = Math.max(H[i] - L[i], Math.abs(H[i] - C[i - 1]), Math.abs(L[i] - C[i - 1]));
    const s = sma(tr, len).map(function (x) { return x * len; }), hl = hhll_(H, L, len), ci = s.map(function (x, i) { return isFinite(x) && hl.hh[i] > hl.ll[i] ? 100 * Math.log10(x / (hl.hh[i] - hl.ll[i])) / Math.log10(len) : NaN; }), m = smaC_(o, f);
    return sigGen_(o, function (i) { return isFinite(ci[i]) && ci[i] < 45 && isFinite(m[i]) && C[i] > m[i]; }, function (i) { return (isFinite(ci[i]) && ci[i] > 61.8) || (isFinite(m[i]) && C[i] < m[i]); }, m); };
}
function candTendenciaSemanal_(sem) {
  return function (o) {
    const n = o.closes.length, k = 2 / (sem + 1), out = new Array(n).fill(NaN); let e = null, cont = 0, soma = 0;
    for (let i = 0; i < n; i++) { if (o.dates[i].getUTCDay() === 0) { const c = o.closes[i]; if (e === null) { soma += c; cont++; if (cont === sem) e = soma / sem; } else e = c * k + e * (1 - k); } out[i] = e === null ? NaN : e; }
    const C = o.closes; return sigGen_(o, function (i) { return isFinite(out[i]) && C[i] > out[i]; }, function (i) { return isFinite(out[i]) && C[i] < out[i]; }, out);
  };
}
function candRegimeVol_(p, f) {
  return function (o) { const C = o.closes, a = atrC_(o, 14), n = C.length, pct = new Array(n).fill(NaN), m = smaC_(o, f);
    for (let i = 100; i < n; i++) { if (!isFinite(a[i])) continue; let c = 0, t = 0; for (let j = i - 100; j < i; j++) if (isFinite(a[j])) { t++; if (a[j] / C[j] < a[i] / C[i]) c++; } pct[i] = t ? 100 * c / t : NaN; }
    return sigGen_(o, function (i) { return isFinite(pct[i]) && pct[i] < p && isFinite(m[i]) && C[i] > m[i]; }, function (i) { return (isFinite(pct[i]) && pct[i] > 85) || (isFinite(m[i]) && C[i] < m[i]); }, m); };
}
function candAltasSeguidas_(k, f) {
  return function (o) { const C = o.closes, ok = filtroSmaOk_(o, f);
    return sigGen_(o, function (i) { if (i < k) return false; for (let j = 0; j < k; j++) if (!(C[i - j] > C[i - j - 1])) return false; return ok(i); }, function (i) { return i > 0 && C[i] < C[i - 1]; }); };
}
function candMax52_(janela, ent, sai) {
  return function (o) { const C = o.closes, H = o.highs, n = C.length, mx = new Array(n).fill(NaN); for (let i = janela - 1; i < n; i++) { let m = -Infinity; for (let j = i - janela + 1; j <= i; j++) if (H[j] > m) m = H[j]; mx[i] = m; }
    return sigGen_(o, function (i) { return isFinite(mx[i]) && C[i] >= ent * mx[i]; }, function (i) { return isFinite(mx[i]) && C[i] < sai * mx[i]; }); };
}
function gerarPoolNovasClasses_() {
  const L = [], add = function (id, nome, fn) { L.push({ id: 'Z-K-' + id, fam: 'novas', nome: nome, fn: fn, ampliado: true }); };
  [[3, 21], [5, 34], [8, 50], [10, 60], [5, 20], [4, 28]].forEach(function (x) { [0, 100, 200].forEach(function (f) { add('AO' + x.join('-') + '-' + f, 'Awesome Oscillator ' + x.join('/') + (f ? ' acima da SMA' + f : ''), candAwesome_(x[0], x[1], f)); }); });
  [7, 10, 14, 21, 28, 40, 55].forEach(function (n) { add('VI' + n, 'Vortex (' + n + ')', candVortex_(n)); });
  [[25, 13], [15, 8], [40, 20], [10, 5], [30, 15]].forEach(function (x) { [0, 7].forEach(function (sg) { add('TSI' + x.join('-') + '-' + sg, 'TSI ' + x.join('/') + (sg ? ' x sinal' + sg : ' > 0'), candTsi_(x[0], x[1], sg)); }); });
  [10, 14, 21, 30].forEach(function (n) { [[55, 45], [60, 40], [50, 50], [65, 40]].forEach(function (x) { add('MFIR' + n + '-' + x[0] + '-' + x[1], 'MFI(' + n + ') regime ' + x[0] + '/' + x[1], candMfiRegime_(n, x[0], x[1])); }); [10, 20, 30].forEach(function (lm) { [100, 200].forEach(function (f) { add('MFIV' + n + '-' + lm + '-' + f, 'MFI(' + n + ') < ' + lm + ' acima da SMA' + f + ', sai > 50', candMfiRev_(n, lm, f)); }); }); });
  [2, 5, 13, 21, 34, 50].forEach(function (n) { add('FI' + n, 'Índice de Força (' + n + ')', candForceIndex_(n)); });
  [13, 21, 34, 55, 89].forEach(function (n) { add('EL' + n, 'Elder Ray bull power (EMA' + n + ')', candElder_(n)); });
  [0.6, 0.8, 1, 1.25, 1.5, 2].forEach(function (e) { [5, 9, 14].forEach(function (sg) { add('KST' + e + '-' + sg, 'KST (escala ' + e + ', sinal ' + sg + ')', candKst_(e, sg)); }); });
  [[14, 11, 10], [25, 18, 14], [10, 7, 6], [20, 14, 10], [30, 20, 14]].forEach(function (x) { add('CO' + x.join('-'), 'Coppock ' + x.join('/'), candCoppock_(x[0], x[1], x[2])); });
  [5, 9, 10, 14, 20, 30, 40].forEach(function (n) { add('FIS' + n, 'Fisher Transform (' + n + ')', candFisher_(n)); });
  [[14, 14], [10, 10], [21, 21], [7, 7], [14, 21], [21, 14]].forEach(function (x) { add('SRSI' + x.join('-'), 'StochRSI ' + x.join('/') + ' regime 60/40', candStochRsi_(x[0], x[1])); });
  [5, 10, 15, 20, 25, 30].forEach(function (lm) { [50, 100, 150, 200].forEach(function (f) { [0, 1].forEach(function (sd) { add('CRSI' + lm + '-' + f + '-' + sd, 'Connors RSI < ' + lm + ' acima da SMA' + f + (sd ? ', sai > SMA5' : ', sai > 60'), candConnors_(lm, f, sd)); }); }); });
  [[20, 2, 1.5], [20, 2, 1], [14, 2, 1.5], [20, 1.5, 1.5], [30, 2, 1.5], [10, 2, 1.5]].forEach(function (x) { add('SQ' + x.join('-'), 'Squeeze de volatilidade (BB dentro do canal ATR) ' + x.join('/'), candSqueeze_(x[0], x[1], x[2])); });
  [1, 2, 3, 4].forEach(function (k) { [0, 100, 200].forEach(function (f) { add('HA' + k + '-' + f, 'Heikin-Ashi ' + k + ' barras altistas' + (f ? ' acima da SMA' + f : ''), candHeikin_(k, f)); }); });
  [3, 5, 8, 10, 13, 21, 34].forEach(function (n) { add('GANN' + n, 'Gann HiLo Activator (' + n + ')', candGann_(n)); });
  [10, 20, 34, 50, 89, 144].forEach(function (n) { add('ZL' + n, 'ZLEMA (' + n + ') inclinação', candZlema_(n)); });
  [10, 20, 50].forEach(function (n) { [1, 1.5, 2].forEach(function (k) { [100, 200].forEach(function (t) { add('ZS' + n + '-' + k + '-' + t, 'Z-score de preço (' + n + ') < -' + k + ' acima da SMA' + t, candZscorePreco_(n, k, t)); }); }); });
  [1.5, 2, 3].forEach(function (m) { [10, 20, 50].forEach(function (e) { add('PV' + m + '-' + e, 'Pico de volume ' + m + 'x com preço acima da EMA' + e, candPicoVolume_(m, e)); }); });
  [1, 2].forEach(function (e) { add('AL' + e, 'Alligator de Williams (escala ' + e + ')', candAlligator_(e)); });
  [14, 21].forEach(function (n) { [20, 50, 100].forEach(function (f) { add('CHOP' + n + '-' + f, 'Choppiness (' + n + ') baixo acima da SMA' + f, candChoppiness_(n, f)); }); });
  [8, 10, 13, 21, 30, 40].forEach(function (s) { add('SEM' + s, 'Tendência semanal: preço x EMA de ' + s + ' semanas', candTendenciaSemanal_(s)); });
  [20, 35, 50, 65].forEach(function (p) { [100, 200].forEach(function (f) { add('RV' + p + '-' + f, 'Regime de volatilidade baixo (<' + p + '%) acima da SMA' + f, candRegimeVol_(p, f)); }); });
  [2, 3, 4, 5].forEach(function (k) { [0, 50, 100, 200].forEach(function (f) { add('UP' + k + '-' + f, k + ' altas seguidas' + (f ? ' acima da SMA' + f : ''), candAltasSeguidas_(k, f)); }); });
  [252, 180, 120, 60].forEach(function (j) { [[0.9, 0.8], [0.95, 0.85], [0.85, 0.75], [0.97, 0.9]].forEach(function (x) { add('MX' + j + '-' + x[0] + '-' + x[1], 'Proximidade da máxima de ' + j + ' dias (entra a ' + Math.round(x[0] * 100) + '%, sai abaixo de ' + Math.round(x[1] * 100) + '%)', candMax52_(j, x[0], x[1])); }); });
  return L;
}

/* =============================================================================
 * 2H. PADRÕES DE CANDLES, CPR, AGULHADA DO DIDI e BARRAS DE TENDÊNCIA (famílias da planilha de vídeos). IDs começam com Z-P-.
 * ===========================================================================*/
/** Entrada por padrão + saída por tempo (N barras) ou perda da média; estado interno para contar as barras desde a entrada. */
function candPadrao_(padrao, f, N, mSaida) {
  return function (o) {
    const n = o.closes.length, C = o.closes, ok = filtroSmaOk_(o, f), m = mSaida ? smaC_(o, mSaida) : null, en = new Array(n).fill(false), ex = new Array(n).fill(false); let pos = false, ent = 0;
    for (let i = 3; i < n; i++) {
      if (!pos) { if (padrao(o, i) && ok(i)) { pos = true; ent = i; en[i] = true; } }
      else if ((N && i - ent >= N) || (m && isFinite(m[i]) && C[i] < m[i])) { pos = false; ex[i] = true; }
    }
    return { entrySignal: en, exitSignal: ex };
  };
}
const PADROES_ = {
  engolfo: function (o, i) { const O = o.opens, C = o.closes; return C[i] > O[i] && C[i - 1] < O[i - 1] && C[i] >= O[i - 1] && O[i] <= C[i - 1]; },
  martelo: function (o, i) { const O = o.opens, C = o.closes, H = o.highs, L = o.lows, b = Math.abs(C[i] - O[i]), r = H[i] - L[i]; return r > 0 && b > 0 && Math.min(O[i], C[i]) - L[i] >= 2 * b && H[i] - Math.max(O[i], C[i]) <= 0.5 * b && C[i] > L[i] + 0.6 * r; },
  inside: function (o, i) { const H = o.highs, L = o.lows, C = o.closes; return H[i - 1] < H[i - 2] && L[i - 1] > L[i - 2] && C[i] > H[i - 2]; },
  soldados: function (o, i) { const O = o.opens, C = o.closes, H = o.highs, L = o.lows; for (let k = 0; k < 3; k++) { const j = i - k, r = H[j] - L[j]; if (!(C[j] > O[j] && r > 0 && C[j] > L[j] + 0.7 * r && C[j] > C[j - 1])) return false; } return true; },
  marubozu: function (o, i) { const O = o.opens, C = o.closes, H = o.highs, L = o.lows, a = atrC_(o, 14), r = H[i] - L[i]; return C[i] > O[i] && r > 0 && (C[i] - O[i]) >= 0.8 * r && isFinite(a[i - 1]) && r >= 1.2 * a[i - 1]; },
};
function candCpr_(f) {
  return function (o) { const H = o.highs, L = o.lows, C = o.closes, ok = filtroSmaOk_(o, f), n = C.length, tc = new Array(n).fill(NaN), bc = new Array(n).fill(NaN);
    for (let i = 1; i < n; i++) { const p = (H[i - 1] + L[i - 1] + C[i - 1]) / 3, b = (H[i - 1] + L[i - 1]) / 2, t = 2 * p - b; tc[i] = Math.max(t, b); bc[i] = Math.min(t, b); }
    return sigGen_(o, function (i) { return isFinite(tc[i]) && C[i] > tc[i] && ok(i); }, function (i) { return isFinite(bc[i]) && C[i] < bc[i]; }); };
}
function candDidi_(x, f) {
  return function (o) { const a = smaC_(o, 3), b = smaC_(o, 8), c = smaC_(o, 20), C = o.closes, ok = filtroSmaOk_(o, f);
    return sigGen_(o, function (i) { if (i < 1 || !isFinite(c[i - 1])) return false; const mx = Math.max(a[i - 1], b[i - 1], c[i - 1]), mn = Math.min(a[i - 1], b[i - 1], c[i - 1]); return (mx - mn) / C[i - 1] <= x && a[i] > b[i] && b[i] > c[i] && ok(i); }, function (i) { return isFinite(b[i]) && a[i] < b[i]; }); };
}
function candBarrasTendencia_(k, m, ema) {
  return function (o) { const O = o.opens, C = o.closes, H = o.highs, L = o.lows, e = emaC_(o, ema), n = C.length, t = new Array(n).fill(0);
    for (let i = 0; i < n; i++) { const r = H[i] - L[i]; t[i] = r > 0 && C[i] > O[i] && (C[i] - O[i]) >= 0.5 * r && C[i] >= L[i] + 0.66 * r ? 1 : 0; }
    const cnt = function (i) { let s = 0; for (let j = 0; j < k; j++) s += i - j >= 0 ? t[i - j] : 0; return s; };
    return sigGen_(o, function (i) { return i >= k && isFinite(e[i]) && cnt(i) >= m && C[i] > e[i]; }, function (i) { return (isFinite(e[i]) && C[i] < e[i]) || (i >= k && cnt(i) <= 1); }, e); };
}
function gerarPoolPadroes_() {
  const L = [], add = function (id, nome, fn) { L.push({ id: 'Z-P-' + id, fam: 'padroes', nome: nome, fn: fn, ampliado: true }); };
  const nomes = { engolfo: 'Engolfo de alta', martelo: 'Martelo', inside: 'Inside bar rompendo a máxima', soldados: 'Três soldados brancos', marubozu: 'Marubozu de alta' };
  Object.keys(PADROES_).forEach(function (k) { [50, 100, 200].forEach(function (f) { [2, 3, 5, 10].forEach(function (N) { add(k + f + '-' + N, nomes[k] + ' acima da SMA' + f + ', sai após ' + N + ' barras', candPadrao_(PADROES_[k], f, N, 0)); }); [10, 20].forEach(function (m) { add(k + f + '-m' + m, nomes[k] + ' acima da SMA' + f + ', sai abaixo da SMA' + m, candPadrao_(PADROES_[k], f, 0, m)); }); }); });
  [0, 50, 100, 200].forEach(function (f) { add('CPR' + f, 'CPR (pivôs): fecha acima do canal central' + (f ? ' acima da SMA' + f : ''), candCpr_(f)); });
  [0.01, 0.02, 0.04, 0.06].forEach(function (x) { [0, 100, 200].forEach(function (f) { add('DIDI' + x + '-' + f, 'Agulhada do Didi (médias 3, 8 e 20 juntas dentro de ' + Math.round(x * 100) + '%)' + (f ? ' acima da SMA' + f : ''), candDidi_(x, f)); }); });
  [[5, 3], [5, 4], [8, 5], [10, 6], [8, 4], [12, 7]].forEach(function (x) { [20, 50].forEach(function (e) { add('BT' + x.join('-') + '-' + e, 'Barras de tendência de alta (Al Brooks) ' + x[1] + ' em ' + x[0] + ' com preço acima da EMA' + e, candBarrasTendencia_(x[0], x[1], e)); }); });
  return L;
}

/* =============================================================================
 * 2B. SELEÇÃO DAS 10 MELHORES ESTRATÉGIAS DE CADA MOEDA
 *
 * Princípio: escolher entre muitos candidatos contamina a medida (quem escolhe o melhor de 46 sempre vê um número
 * bonito, parte dele sorte). Por isso:
 *  1. A nota de cada candidato usa SOMENTE o período de seleção (IS = primeiros 70% do histórico, após o aquecimento
 *     das médias). O restante (OOS = últimos 30%) NUNCA entra na nota; ele serve para medir a decaída real.
 *  2. Elegível: Sharpe IS >= SELECAO_SHARPE_MIN (0,60) E Sharpe de 24 meses >= SELECAO_SHARPE_MIN_24M (0,30) E Sharpe de 12 meses >= SELECAO_SHARPE_MIN_12M (0,00), drawdown IS <=
 *     SELECAO_DD_MAX e trades mínimos no IS. Nenhuma vaga é preenchida com candidato abaixo disso (vaga fica ABERTA).
 *     Se faltarem estratégias, entra a BUSCA AMPLIADA (grade de ~300 parâmetros) e a escolha é refeita.
 *  3. Nota = média dos percentis de Sharpe IS e Calmar IS entre os elegíveis.
 *  4. Diversificação gulosa pela ordem da nota: no máximo SELECAO_MAX_MESMA_CLASSE_POR_5 (1) estratégia da mesma classe de indicador a cada 5 e correlação dos
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

/**
 * Nível de uma curva de equity em relação aos mínimos (calculado a cada dia, sobre os dados atuais):
 *  PLENA          Sharpe do histórico todo >= SELECAO_SHARPE_MIN (0,60), 24 meses >= SELECAO_SHARPE_MIN_24M e 12 meses >= SELECAO_SHARPE_MIN_12M
 *  RECENTE FRACA  histórico todo >= 0,60, mas 24 ou 12 meses abaixo do mínimo
 *  PROVISORIA     histórico todo entre SELECAO_PISO_PROVISORIO e SELECAO_SHARPE_MIN
 *  FORA           abaixo disso
 */
function nivelSharpe_(eq, n) {
  const w0 = Math.min(210, n - 150), full = sharpeUlt_(eq, n, n - w0 - 1), p = cumprePermanencia_(eq, n), min = cfgNum_('SELECAO_SHARPE_MIN'), piso = cfgNum_('SELECAO_PISO_PROVISORIO');
  let nivel = 'FORA';
  if (full !== null && full >= min) nivel = p.ok ? 'PLENA' : 'RECENTE FRACA';
  else if (full !== null && full >= piso) nivel = 'PROVISORIA';
  return { nivel: nivel, full: full, s24: p.s24, s12: p.s12 };
}
const ORDEM_NIVEL = { 'PLENA': 0, 'RECENTE FRACA': 1, 'PROVISORIA': 2 };

/**
 * Seleciona as melhores estratégias de uma moeda entre todos os candidatos (base + grade + estendida), em uma passada
 * (cada candidato é calculado, avaliado e só guarda a curva se for elegível, para poupar memória).
 * Base de avaliação: histórico inteiro depois do aquecimento. As colunas IS (70% iniciais) e OOS (30% finais) são apenas descritivas.
 * Ordem de preenchimento: PLENA, depois RECENTE FRACA, depois PROVISORIA; dentro de cada nível por nota (percentil do Sharpe e do Calmar).
 * Diversificação gulosa: máximo SELECAO_MAX_POR_FAMILIA por família e correlação diária máxima SELECAO_CORR_MAX.
 */
function selecionar_(o, defs, opc) {
  opc = opc || {};
  const n = o.closes.length, w0 = Math.min(210, n - 150), cut = w0 + Math.floor((n - w0) * cfgNum_('SELECAO_CORTE_IS'));
  const anos = (n - w0) / 365.25, minTr = Math.max(5, Math.min(cfgNum_('SELECAO_MIN_TRADES_IS'), Math.round(anos * 2)));
  const ddMax = cfgNum_('SELECAO_DD_MAX'), ddMaxR = cfgNum_('SELECAO_DD_MAX_RELAX'), minTrR = cfgNum_('SELECAO_MIN_TRADES_RELAX'), corrR = cfgNum_('SELECAO_CORR_MAX_RELAX'), capCl = Math.max(1, Math.round(((opc.alvo || cfgNum_('SELECAO_N_ESTRATEGIAS')) / 5) * cfgNum_('SELECAO_MAX_MESMA_CLASSE_POR_5'))), corrMax = cfgNum_('SELECAO_CORR_MAX'), alvo = opc.alvo || cfgNum_('SELECAO_N_ESTRATEGIAS');
  const idsBase = {}; POOL.forEach(function (e) { idsBase[e.id] = true; });
  const det = [], tIni = Date.now(), orc = cfgNum_('SELECAO_ORCAMENTO_SEG') * 1000; let interrompida = false;
  defs.forEach(function (e) {
    if (Date.now() - tIni > orc) { interrompida = true; return; }   // guarda: a busca nunca estoura o limite de 6 minutos do Apps Script
    const r = rodarLista_(o, [e])[0], d = { id: e.id, fam: e.fam, ind: e.ind || classeInd_(e.nome), nome: e.nome, situacao: '', slot: 0, base: !!idsBase[e.id] };
    det.push(d);
    if (r.erro || !r.eqCurve) { d.situacao = 'ERRO no cálculo'; return; }
    const nv = nivelSharpe_(r.eqCurve, n), m = metricasFaixa_(r.eqCurve, w0, n);
    d.nivel = nv.nivel; d.sFull = nv.full; d.s24 = nv.s24; d.s12 = nv.s12; d.isM = metricasFaixa_(r.eqCurve, w0, cut); d.oosM = metricasFaixa_(r.eqCurve, cut, n);
    d.nTr = contarTrades_(r, w0, n); d.dd = m ? m.dd : null; d.calmar = m ? m.calmar : null;
    if (nv.nivel === 'FORA') d.situacao = 'Sharpe do histórico ' + (nv.full === null ? 'indisponível' : r_(nv.full, 2)) + ' < ' + cfgNum_('SELECAO_PISO_PROVISORIO');
    else if (cfgSim_('SELECAO_EXIGE_PLENA') && nv.nivel !== 'PLENA') d.situacao = 'nível ' + nv.nivel + ' (a regra exige PLENA)';
    else if (!m || m.dd > ddMax) { d.situacao = 'drawdown acima de ' + ddMax + '%'; if (m && m.dd <= ddMaxR && nv.nivel === 'PLENA') { d.relaxavel = true; d.r = r; d.ret = retornos_(r.eqCurve, w0, n); } }
    else if (d.nTr < minTr) { d.situacao = 'poucos trades (' + d.nTr + ' < ' + minTr + ')'; if (d.nTr >= minTrR && nv.nivel === 'PLENA') { d.relaxavel = true; d.r = r; d.ret = retornos_(r.eqCurve, w0, n); } }
    else { d.elegivel = true; d.r = r; d.ret = retornos_(r.eqCurve, w0, n); }
  });
  const eleg = det.filter(function (d) { return d.elegivel; }), pS = percentis_(eleg.map(function (d) { return d.sFull; })), pC = percentis_(eleg.map(function (d) { return d.calmar; }));
  eleg.forEach(function (d, i) { d.nota = (pS[i] + pC[i]) / 2; });
  eleg.sort(function (a, b) { return ORDEM_NIVEL[a.nivel] - ORDEM_NIVEL[b.nivel] || b.nota - a.nota; });
  const escolhidas = [], porFam = {};
  (opc.mantidas || []).forEach(function (r, k) {   // estratégias já aceitas (ex.: fixas do BTC que cumprem a régua) entram na conta de vagas, família e correlação
    const d = { id: r.id, fam: r.fam || 'p02', ind: r.ind || classeInd_(r.nome), ret: retornos_(r.eqCurve, w0, n), slot: k + 1, mantida: true, situacao: 'MANTIDA' }; escolhidas.push(d); porFam[d.ind] = (porFam[d.ind] || 0) + 1;
  });
  eleg.forEach(function (d) {
    if (escolhidas.length >= alvo) { d.situacao = 'elegível (' + d.nivel + '), não escolhida'; return; }
    if ((porFam[d.ind] || 0) >= capCl) { d.situacao = 'classe ' + d.ind + ' já tem ' + capCl + ' (regra: no máximo ' + capCl + ' da mesma classe)'; return; }
    for (let k = 0; k < escolhidas.length; k++) { const c = correl_(d.ret, escolhidas[k].ret); if (c > corrMax) { d.situacao = 'correlação ' + r_(c, 2) + ' com ' + escolhidas[k].id; return; } }
    d.slot = escolhidas.length + 1; d.situacao = 'ESCOLHIDA #' + d.slot + ' (' + d.nivel + ')'; porFam[d.ind] = (porFam[d.ind] || 0) + 1; escolhidas.push(d);
  });
  // terceira passada (critério relaxado): o Sharpe continua exigido no nível PLENA; relaxam só drawdown, trades e correlação; a regra de classe nunca é relaxada
  const relax = {};
  if (escolhidas.length < alvo && cfgSim_('SELECAO_RELAXAR_SE_FALTAR')) {
    const cand = det.filter(function (d) { return !d.slot && d.nivel === 'PLENA' && d.ret && (d.elegivel || d.relaxavel); });
    const pS2 = percentis_(cand.map(function (d) { return d.sFull; })), pC2 = percentis_(cand.map(function (d) { return d.calmar; }));
    cand.forEach(function (d, i) { d.nota2 = (pS2[i] + pC2[i]) / 2; });
    cand.sort(function (a, b) { return b.nota2 - a.nota2; });
    cand.forEach(function (d) {
      if (escolhidas.length >= alvo || (porFam[d.ind] || 0) >= capCl) return;
      let cmax = 0, com = ''; for (let k = 0; k < escolhidas.length; k++) { const c = correl_(d.ret, escolhidas[k].ret); if (c > cmax) { cmax = c; com = escolhidas[k].id; } }
      if (cmax > corrR) return;
      const motivo = []; if (d.dd > ddMax) motivo.push('drawdown ' + r_(d.dd, 0) + '%'); if (d.nTr < minTr) motivo.push(d.nTr + ' trades'); if (cmax > corrMax) motivo.push('correlação ' + r_(cmax, 2) + ' com ' + com);
      d.slot = escolhidas.length + 1; d.situacao = 'ESCOLHIDA #' + d.slot + ' (PLENA, critério relaxado' + (motivo.length ? ': ' + motivo.join(', ') : '') + ')'; relax[d.id] = motivo.length ? motivo.join(', ') : 'critério relaxado';
      porFam[d.ind] = (porFam[d.ind] || 0) + 1; escolhidas.push(d);
    });
  }
  det.forEach(function (d) { if (!d.situacao) d.situacao = '—'; });
  return { rel: relax, ids: escolhidas.filter(function (d) { return !d.mantida; }).map(function (d) { return d.id; }), detalhe: det, w0Data: dataStr_(o.dates[w0]), corteData: dataStr_(o.dates[cut]), parcial: escolhidas.length < alvo, vagas: alvo - escolhidas.length,
    naoPlenas: escolhidas.filter(function (d) { return d.nivel !== 'PLENA'; }).length, nRelax: Object.keys(relax).length, nElegiveis: eleg.length, minTr: minTr, nTestados: det.length, interrompida: interrompida, shMin: cfgNum_('SELECAO_SHARPE_MIN') };
}

function lerSel_(sym) {
  const s = PropertiesService.getScriptProperties().getProperty('SEL_' + sym);
  try { return s ? JSON.parse(s) : null; } catch (e) { return null; }
}
function guardarSel_(sym, sel, dataHoje) {
  PropertiesService.getScriptProperties().setProperty('SEL_' + sym, JSON.stringify({ data: dataHoje, ids: sel.ids, w0: sel.w0Data, corte: sel.corteData, parcial: sel.parcial, vagas: sel.vagas, naoPlenas: sel.naoPlenas, nElig: sel.nElegiveis, nTest: sel.nTestados, rel: sel.rel, sig: sel.sig || '' }));
}
function idadeDias_(str) { return str ? (Date.now() - new Date(str + 'T00:00:00Z').getTime()) / 86400000 : 1e9; }

function pendentesSel_() { try { return JSON.parse(PropertiesService.getScriptProperties().getProperty('SEL_PENDENTES') || '[]'); } catch (e) { return []; } }
function setPendentesSel_(l) { PropertiesService.getScriptProperties().setProperty('SEL_PENDENTES', JSON.stringify(l)); }

const COLS_SELECAO = ['Ativo', 'Posicao_Nota', 'ID', 'Familia', 'Estrategia', 'Trades', 'Sharpe_historico', 'Calmar_historico', 'Sharpe_24m', 'Sharpe_12m', 'Nivel', 'Sharpe_70pct_iniciais', 'Sharpe_30pct_finais', 'MaxDD_historico_pct', 'Situacao', 'Periodo_70_30', 'Data_Selecao'];
/** Auditoria: todos os candidatos de uma moeda, com a razão de cada um ter entrado ou não. Substitui as linhas anteriores da moeda. */
function gravarSelecaoCandidatos_(sym, sel, dataHoje) {
  const sh = ss_().getSheetByName(P2.ABAS.sel); if (!sh) return;
  let antigas = [];
  if (sh.getLastRow() > 1) antigas = sh.getRange(2, 1, sh.getLastRow() - 1, COLS_SELECAO.length).getValues().filter(function (r) { return r[0] !== sym; });
  const visiveis = sel.detalhe.filter(function (d) { return d.elegivel || d.slot; }), ocultos = sel.detalhe.length - visiveis.length, v = function (x) { return x === undefined || x === null ? '' : (typeof x === 'number' ? r_(x, 2) : x); };
  const ord = visiveis.sort(function (a, b) { return (b.slot ? 1000 - b.slot : 0) - (a.slot ? 1000 - a.slot : 0) || (b.nota || -1) - (a.nota || -1); }).slice(0, 60);
  const novas = ord.map(function (d) {
    return [sym, d.slot || '', d.id, d.fam, d.nome, v(d.nTr), v(d.sFull), v(d.calmar), v(d.s24), v(d.s12), d.nivel || '', d.isM ? d.isM.sharpe : '', d.oosM ? d.oosM.sharpe : '', v(d.dd), d.situacao, sel.w0Data + ' a ' + sel.corteData, dataHoje];
  });
  novas.push([sym, '', '(resumo)', '', sel.nTestados + ' candidatos testados; ' + sel.nElegiveis + ' elegíveis (Sharpe do histórico >= ' + cfgNum_('SELECAO_PISO_PROVISORIO') + ', drawdown, trades); ' + ocultos + ' reprovados não listados; mostrados os 60 melhores.' + (sel.interrompida ? ' BUSCA INTERROMPIDA POR TEMPO (parte dos candidatos não foi testada).' : '') + ' Vagas abertas: ' + sel.vagas + '. Fora do nível PLENA: ' + sel.naoPlenas, '', '', '', '', '', '', '', '', '', sel.parcial ? 'VAGAS ABERTAS' : 'COMPLETA', sel.w0Data + ' a ' + sel.corteData, dataHoje]);
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

function fetchBinance_(par, o, host, lim) {
  lim = lim || 1000;
  const base = (host || 'https://data-api.binance.vision/api/v3/klines') + '?symbol=' + par + '&interval=1d&limit=' + lim;
  let start = o.dias ? Date.now() - o.dias * MS_DIA : P2.HIST_INICIO_MS;
  const out = []; let g = 0;
  while (g++ < 20) {
    const rows = fetchJson_(base + '&startTime=' + start, null, 2);
    if (!Array.isArray(rows) || !rows.length) break;
    rows.forEach(function (r) { out.push(candle_(r[0], r[1], r[2], r[3], r[4], r[5])); });
    if (rows.length < lim) break;
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
function fetchMexc_(par, o) { return fetchBinance_(par, o, 'https://api.mexc.com/api/v3/klines', 500); }   // a MEXC devolve no máximo 500 velas por chamada
/** Gate.io: janelas de até 900 dias para trás. Linha: [ts(s), volume_quote, close, high, low, open, volume_base, fechada]. */
function fetchGate_(par, o) {
  const by = {}, passo = 900 * 86400; let to = Math.floor(Date.now() / 1000), g = 0, vazios = 0; const desde = o.dias ? to - o.dias * 86400 : Math.floor(P2.HIST_INICIO_MS / 1000);
  while (to > desde && g++ < 12) {
    const from = Math.max(desde, to - passo);
    const rows = fetchJson_('https://api.gateio.ws/api/v4/spot/candlesticks?currency_pair=' + par + '&interval=1d&from=' + from + '&to=' + to, null, 2);
    const lista = Array.isArray(rows) ? rows : [];
    if (!lista.length) { vazios++; if (Object.keys(by).length || vazios >= 2) break; } else vazios = 0;
    lista.forEach(function (r) { const t = parseInt(r[0], 10) * 1000; by[t] = candle_(t, r[5], r[3], r[4], r[2], r[6]); });
    to = from;
  }
  return Object.keys(by).map(function (k) { return by[k]; });
}
const ADAPTADORES = { mexc: fetchMexc_, gate: fetchGate_, binance: fetchBinance_, okx: fetchOkxPar_, bybit: fetchBybit_, kucoin: fetchKucoinPar_, coinbase: fetchCoinbasePar_, kraken: fetchKrakenPar_, bitfinex: fetchBitfinex_ };

/** "binance:ETHUSDT,okx:ETH-USDT" -> [{src, par}] */
function parseFontes_(txt) {
  return String(txt || '').split(',').map(function (s) { s = s.trim(); const i = s.indexOf(':'); return i > 0 ? { src: s.substring(0, i).toLowerCase(), par: s.substring(i + 1).trim() } : null; })
    .filter(function (x) { return x && ADAPTADORES[x.src]; });
}

const HIST_BOM = 2500;   // velas: acima disso a carga completa para de procurar fonte mais longa
/**
 * Atualização incremental (o.dias): usa a fonte que já funcionou, com cascata. Carga completa: consulta as fontes e fica com a de MAIOR
 * histórico (a primeira que responde nem sempre é a mais longa: ex. Coinbase só tem XRP desde 2023), parando cedo se uma passar de HIST_BOM velas.
 */
function baixarUsd_(u, o, minVelas) {
  const fontes = parseFontes_(u.fontes), falhas = [];
  if (u.fonteOk) { const i = fontes.map(function (f) { return f.src + ':' + f.par; }).indexOf(u.fonteOk); if (i > 0) fontes.unshift(fontes.splice(i, 1)[0]); }
  let melhor = null;
  for (let i = 0; i < fontes.length; i++) {
    const f = fontes[i];
    try {
      const serie = sanearSerie_(ADAPTADORES[f.src](f.par, o));
      if (serie.length >= minVelas) {
        serie.fonte = f.src + ':' + f.par;
        if (o.dias) return serie;
        if (!melhor || serie.length > melhor.length) melhor = serie;
        if (serie.length >= HIST_BOM) break;
      } else falhas.push(f.src + ': ' + serie.length + ' velas');
    } catch (e) { falhas.push(f.src + ': ' + e.message); }
  }
  if (melhor) return melhor;
  throw new Error('Sem fonte para ' + u.sym + ' (' + (falhas.join(' | ') || 'nenhuma fonte configurada') + ')');
}

/**
 * Série ALT/BTC: divide, por data, a vela ALT/USD pela vela BTC/USD da aba BASE_BTC. Datas sem vela do BTC são ignoradas (voltam no próximo ciclo).
 * open = open ALT / open BTC; close = close ALT / close BTC; máxima e mínima: ver o cabeçalho. Volume = volume da ALT (em moedas).
 */
function ratioSerie_(usd, btc) {
  const mb = {}; btc.dates.forEach(function (d, i) { mb[d.getTime()] = i; });
  const out = [];
  usd.forEach(function (c) {
    const j = mb[c.date.getTime()]; if (j === undefined) return;
    const bo = btc.opens[j], bc = btc.closes[j]; if (!(bo > 0) || !(bc > 0)) return;
    const op = c.open / bo, cl = c.close / bc;
    out.push({ date: c.date, open: op, high: Math.max(op, cl, c.high / bc), low: Math.min(op, cl, c.low / bc), close: cl, volume: c.volume, preenchido: c.preenchido });
  });
  return out;
}
/** Série diária da moeda em BTC (ou o BTC em dólar, quando u é a linha BASE). Mantém a cascata de corretoras da UNIVERSO para o lado ALT/USD. */
function baixarSerieAtivo_(u, o, minVelas) {
  const usd = baixarUsd_(u, o, minVelas);
  if (u.sym === 'BTC') return usd;
  const serie = ratioSerie_(usd, lerBase_('BTC'));
  if (serie.length < Math.min(minVelas, 1) || !serie.length) throw new Error('Razão ' + u.sym + '/BTC vazia: confira a BASE_BTC (menu 2 carrega o BTC primeiro)');
  serie.fonte = usd.fonte;
  return serie;
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
/**
 * Remove o começo não confiável da série: se houver uma descontinuidade de preço maior que 20x em um dia nos primeiros 70% do histórico
 * (pré-lançamento ou mercado ilíquido, como a HYPE antes de dez/2024), descarta tudo até esse dia. Não altera a aba BASE.
 */
function aparaInicio_(o) {
  const C = o.closes, lim = Math.floor(C.length * 0.7); let corte = 0;
  for (let i = 1; i < lim; i++) { const r = C[i] / C[i - 1]; if (r > 20 || r < 0.05) corte = i; }
  if (!corte) return o;
  ['dates', 'opens', 'highs', 'lows', 'closes', 'volumes'].forEach(function (k) { o[k] = o[k].slice(corte); });
  o.aparadas = corte; return o;
}
function ontemUtcMs_() { const d = new Date(); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - MS_DIA; }

/** Atualiza a aba base do ativo. Retorna { ohlcv, novaVela, fonte, carga }. */
function pendentesHist_() { try { return JSON.parse(PropertiesService.getScriptProperties().getProperty('HIST_PENDENTES') || '[]'); } catch (e) { return []; } }
function setPendentesHist_(l) { PropertiesService.getScriptProperties().setProperty('HIST_PENDENTES', JSON.stringify(l)); }
function atualizarBase_(u) {
  const sh = abaBase_(u.sym, true), atual = lerBase_(u.sym), n = atual.dates.length, pendH = pendentesHist_();
  if (pendH.indexOf(u.sym) >= 0) {   // menu H: procura a fonte com mais histórico; só troca se ganhar pelo menos 30 velas
    setPendentesHist_(pendH.filter(function (x) { return x !== u.sym; }));
    const serie = baixarSerieAtivo_(u, {}, P2.MIN_CANDLES);
    if (serie.length > n + 30) {
      const linhas = linhasBase_(serie, null);
      if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 7).clearContent();
      sh.getRange(2, 1, linhas.length, 1).setNumberFormat('@');
      sh.getRange(2, 1, linhas.length, 7).setValues(linhas);
      const ps = pendentesSel_(); if (ps.indexOf(u.sym) < 0) { ps.push(u.sym); setPendentesSel_(ps); }
      return { ohlcv: lerBase_(u.sym), novaVela: true, fonte: serie.fonte, carga: 'RECARGA (' + n + ' -> ' + serie.length + ' velas)' };
    }
  }
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
 *    Status: BASE (BTC em dólar, usado nas razões) | ATIVO (razão ALT/BTC) | EXCLUIDO. Fontes: "corretora:PAR,corretora:PAR" na ordem de preferência.
 * ===========================================================================*/
const COLS_UNIVERSO = ['Ordem', 'Simbolo', 'CoinGecko_ID', 'Nome', 'Rank_MC', 'Tipo', 'Status', 'Fontes', 'Fonte_OK', 'Inicio_Historico', 'N_Velas', 'Ultima_Vela', 'Ultima_Atualizacao', 'Observacao'];
const SEED_UNIVERSO = [
  [1, 'BTC', 'bitcoin', 'Bitcoin', 'CRIPTO', 'BASE', 'coinbase:BTC-USD,okx:BTC-USDT,kraken:XBTUSD,kucoin:BTC-USDT,bitfinex:BTCUSD,mexc:BTCUSDT,gate:BTC_USDT,binance:BTCUSDT', 'BASE: BTC/USD diário, denominador de todas as razões e filtro de regime. Não é analisado nem entra no painel'],
  [2, 'ETH', 'ethereum', 'Ethereum', 'CRIPTO', 'ATIVO', 'kucoin:ETH-USDT,bitfinex:ETHUSD,okx:ETH-USDT,mexc:ETHUSDT,gate:ETH_USDT,coinbase:ETH-USD,kraken:ETHUSD,binance:ETHUSDT,bybit:ETHUSDT', ''],
  [3, 'USDT', 'tether', 'Tether', 'STABLECOIN', 'EXCLUIDO', '', 'Stablecoin: não há tendência para testar'],
  [4, 'BNB', 'binancecoin', 'BNB', 'CRIPTO', 'ATIVO', 'kucoin:BNB-USDT,okx:BNB-USDT,mexc:BNBUSDT,gate:BNB_USDT,binance:BNBUSDT,bybit:BNBUSDT', 'Não está na Coinbase nem na Kraken'],
  [5, 'XRP', 'ripple', 'XRP', 'CRIPTO', 'ATIVO', 'kucoin:XRP-USDT,bitfinex:XRPUSD,okx:XRP-USDT,mexc:XRPUSDT,gate:XRP_USDT,coinbase:XRP-USD,kraken:XRPUSD,binance:XRPUSDT,bybit:XRPUSDT', ''],
  [6, 'USDC', 'usd-coin', 'USDC', 'STABLECOIN', 'EXCLUIDO', '', 'Stablecoin: não há tendência para testar'],
  [7, 'SOL', 'solana', 'Solana', 'CRIPTO', 'ATIVO', 'kucoin:SOL-USDT,bitfinex:SOLUSD,okx:SOL-USDT,mexc:SOLUSDT,gate:SOL_USDT,coinbase:SOL-USD,kraken:SOLUSD,binance:SOLUSDT,bybit:SOLUSDT', 'Histórico desde 2020'],
  [8, 'TRX', 'tron', 'TRON', 'CRIPTO', 'ATIVO', 'kucoin:TRX-USDT,bitfinex:TRXUSD,okx:TRX-USDT,mexc:TRXUSDT,gate:TRX_USDT,kraken:TRXUSD,binance:TRXUSDT,bybit:TRXUSDT', ''],
  [9, 'FIGR_HELOC', 'figure-heloc', 'Figure Heloc', 'RWA', 'EXCLUIDO', '', 'Empréstimo tokenizado cotado perto de US$ 1: não é um ativo de tendência'],
  [10, 'ZEC', 'zcash', 'Zcash', 'CRIPTO', 'ATIVO', 'kucoin:ZEC-USDT,bitfinex:ZECUSD,okx:ZEC-USDT,mexc:ZECUSDT,gate:ZEC_USDT,coinbase:ZEC-USD,kraken:ZECUSD,binance:ZECUSDT,bybit:ZECUSDT', ''],
  [11, 'HYPE', 'hyperliquid', 'Hyperliquid', 'CRIPTO', 'ATIVO', 'kucoin:HYPE-USDT,gate:HYPE_USDT,mexc:HYPEUSDT,bitfinex:HYPE:USD,okx:HYPE-USDT,bybit:HYPEUSDT,binance:HYPEUSDT', 'Histórico curto: consenso só com 500+ velas; a carga completa escolhe a fonte com mais histórico'],
  [12, 'DOGE', 'dogecoin', 'Dogecoin', 'CRIPTO', 'ATIVO', 'kucoin:DOGE-USDT,bitfinex:DOGE:USD,okx:DOGE-USDT,mexc:DOGEUSDT,gate:DOGE_USDT,coinbase:DOGE-USD,kraken:XDGUSD,binance:DOGEUSDT,bybit:DOGEUSDT', ''],
  [13, 'LINK', 'chainlink', 'Chainlink', 'CRIPTO', 'ATIVO', 'kucoin:LINK-USDT,bitfinex:LINK:USD,okx:LINK-USDT,mexc:LINKUSDT,gate:LINK_USDT,coinbase:LINK-USD,kraken:LINKUSD,binance:LINKUSDT,bybit:LINKUSDT', 'MANUAL: escolha do usuário (fora da janela #2 a #13 do ranking)'],
  [14, 'AAVE', 'aave', 'Aave', 'CRIPTO', 'ATIVO', 'kucoin:AAVE-USDT,bitfinex:AAVE:USD,okx:AAVE-USDT,mexc:AAVEUSDT,gate:AAVE_USDT,coinbase:AAVE-USD,kraken:AAVEUSD,binance:AAVEUSDT,bybit:AAVEUSDT', 'MANUAL: escolha do usuário (fora da janela #2 a #13 do ranking). Histórico desde out/2020'],
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
function ativosUniverso_() { return universo_().filter(function (u) { return u.status === 'ATIVO'; }); }
function baseBtc_() { return universo_().filter(function (u) { return u.sym === 'BTC' && u.status === 'BASE'; })[0] || null; }
/** Mantém a BASE_BTC (dólar) em dia: roda antes das moedas, porque todas as razões usam a vela do BTC da mesma data. */
function garantirBtc_() {
  const b = baseBtc_(); if (!b) throw new Error('A aba UNIVERSO precisa da linha BTC com status BASE (menu 0).');
  const r = atualizarBase_(b); gravarLinhaUniverso_(b, r.fonte, r.ohlcv); return r;
}
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
    r.id = e.id; r.key = e.key || e.id; r.nome = e.nome; r.ativa = true; r.grupo = e.grupo || 'Seleção'; r.fam = e.fam; r.ind = e.ind || classeInd_(e.nome);
    return r;
  });
}

/** Recompõe as definições dos candidatos escolhidos (só gera as grades se algum ID delas foi escolhido). */
function defsPorId_(ids) {
  const mapa = {}; POOL.forEach(function (e) { mapa[e.id] = e; });
  if (ids.some(function (id) { return id.indexOf('X-') === 0; })) gerarPoolAmpliado_().forEach(function (e) { mapa[e.id] = e; });
  if (ids.some(function (id) { return id.indexOf('Y-') === 0; })) gerarPoolEstendido_().forEach(function (e) { mapa[e.id] = e; });
  if (ids.some(function (id) { return id.indexOf('Z-P-') === 0; })) gerarPoolPadroes_().forEach(function (e) { mapa[e.id] = e; });
  if (ids.some(function (id) { return id.indexOf('Z-K-') === 0; })) gerarPoolNovasClasses_().forEach(function (e) { mapa[e.id] = e; });
  if (ids.some(function (id) { return id.indexOf('Z-N-') === 0; })) gerarPoolFino_().forEach(function (e) { mapa[e.id] = e; });
  if (ids.some(function (id) { return id.indexOf('Z-') === 0; })) gerarPoolMassivo_().concat(gerarPoolReversao_()).forEach(function (e) { mapa[e.id] = e; });
  return ids.map(function (id) { return mapa[id]; }).filter(Boolean);
}

/**
 * Mínimo de velas do ativo. MIN_VELAS_POR_ATIVO (SIMBOLO:VELAS) fixa o mínimo de uma moeda. Na falta, vale MIN_VELAS_CONSENSO (500); mas moeda com
 * menos velas que isso usa as velas atuais menos 1 (a moeda nova nunca fica de fora por falta de histórico). nAtual = velas da série da moeda.
 */
function minVelas_(sym, nAtual) {
  const m = {}; String(cfg_('MIN_VELAS_POR_ATIVO') || '').split(',').forEach(function (x) { const p = x.split(':'); if (p.length === 2 && parseInt(p[1], 10) > 0) m[p[0].trim().toUpperCase()] = parseInt(p[1], 10); });
  if (m[String(sym).toUpperCase()]) return m[String(sym).toUpperCase()];
  const padrao = cfgNum_('MIN_VELAS_CONSENSO');
  return nAtual !== undefined && nAtual < padrao ? Math.max(1, nAtual - 1) : padrao;
}

function todosDefs_() { return POOL.concat(gerarPoolAmpliado_(), gerarPoolEstendido_(), gerarPoolMassivo_(), gerarPoolReversao_(), gerarPoolFino_(), gerarPoolNovasClasses_(), gerarPoolPadroes_()); }

function processarAtivo_(u, forcar) {
  const prev = lerRes_(u.sym), ontemStr = Utilities.formatDate(new Date(ontemUtcMs_()), 'UTC', 'yyyy-MM-dd');
  const pend = pendentesSel_(), pendente = pend.indexOf(u.sym) >= 0 || pendentesHist_().indexOf(u.sym) >= 0;
  if (!forcar && !pendente && prev && prev.estado === 'OK' && u.ultimaVela >= ontemStr) return { resumo: prev, eventos: [], pulou: true };
  const b = atualizarBase_(u), o = aparaInicio_(b.ohlcv), n = o.closes.length;
  gravarLinhaUniverso_(u, b.fonte, o);
  const base = { sym: u.sym, ordem: u.ordem, nome: u.nome, status: u.status, fonte: b.fonte || u.fonteOk, n: n, atualizado: new Date().toISOString() };
  if (n < minVelas_(u.sym, n)) {
    const res0 = Object.assign(base, { estado: 'HISTORICO_INSUFICIENTE', ultimaVela: n ? Utilities.formatDate(o.dates[n - 1], 'UTC', 'yyyy-MM-dd') : '', preco: n ? o.closes[n - 1] : null });
    guardarRes_(u.sym, res0); return { resumo: res0, eventos: [] };
  }
  o.btcC = alinharBtc_(o, lerBase_('BTC'));
  const hoje = Utilities.formatDate(new Date(), 'UTC', 'yyyy-MM-dd');
  const fixas = false;   // ALT/BTC: todas as moedas têm seleção própria (o BTC não é analisado)
  let sel = null, res, cutStr, w0Str, dataSel = '';
  if (fixas) {
    // BTC: as 10 fixas do Projeto 02; a que ficar abaixo dos mínimos de Sharpe sai e é substituída pela melhor candidata que cumpre a régua
    const fx = rodarLista_(o, FIXAS_BTC), hist = cfgNum_('SELECAO_HISTERESE'), min = cfgNum_('SELECAO_SHARPE_MIN');
    const cumpre = function (r) { return !r.erro && r.eqCurve && nivelSharpe_(r.eqCurve, n).full >= min - hist && cumprePermanencia_(r.eqCurve, n, hist).ok; };
    const okFx = fx.filter(cumpre), fora = fx.filter(function (r) { return !cumpre(r); });
    cutStr = '2023-06-02'; w0Str = dataStr_(o.dates[Math.min(200, n - 150)]); dataSel = 'fixas (Projeto 02)';
    if (fora.length && cfgSim_('SELECAO_BTC_SUBSTITUI')) {
      const sig = fora.map(function (r) { return r.id; }).join(','), pBtc = pend.indexOf('BTC') >= 0;
      let sb = lerSel_('BTC');
      if (!sb || sb.sig !== sig || pBtc || idadeDias_(sb.data) >= cfgNum_('SELECAO_REFRESH_DIAS')) {
        const s = selecionar_(o, todosDefs_(), { mantidas: okFx, alvo: FIXAS_BTC.length }), rel = {};
        const motivo = fora.map(function (r) { const nv = r.eqCurve ? nivelSharpe_(r.eqCurve, n) : { full: null, s24: null, s12: null }; return r.id + ' (Sharpe histórico ' + r_(nv.full, 2) + ', 24m ' + r_(nv.s24, 2) + ', 12m ' + r_(nv.s12, 2) + ')'; });
        s.ids.forEach(function (id, k) { rel[id] = 'substitui ' + motivo[k % motivo.length]; });
        s.rel = Object.assign(s.rel || {}, rel); s.sig = sig;
        guardarSel_('BTC', s, hoje); gravarSelecaoCandidatos_('BTC', s, hoje); sb = lerSel_('BTC');
        res = okFx.concat(s.ids.map(function (id) { return s.detalhe.filter(function (d) { return d.id === id; })[0].r; }));
        if (pBtc) setPendentesSel_(pend.filter(function (x) { return x !== 'BTC'; }));
      } else res = okFx.concat(rodarLista_(o, defsPorId_(sb.ids)));
      sel = sb; dataSel = 'fixas + ' + (sb.ids.length) + ' substituta(s)';
    } else res = fx;
  } else {
    sel = lerSel_(u.sym);
    const fazer = function () {
      const s = selecionar_(o, todosDefs_());
      guardarSel_(u.sym, s, hoje); gravarSelecaoCandidatos_(u.sym, s, hoje);
      sel = lerSel_(u.sym);
      res = s.ids.map(function (id) { return s.detalhe.filter(function (d) { return d.id === id; })[0].r; });
      if (pendente) setPendentesSel_(pend.filter(function (x) { return x !== u.sym; }));
    };
    const idade = sel ? idadeDias_(sel.data) : 1e9;
    if (!sel || pendente || idade >= cfgNum_('SELECAO_REFRESH_DIAS') || (idade >= cfgNum_('SELECAO_REVISAO_DIAS') && (sel.vagas > 0 || sel.naoPlenas > 0))) fazer();
    else res = rodarLista_(o, defsPorId_(sel.ids));
    cutStr = sel.corte; w0Str = sel.w0; dataSel = sel.data;
  }
  if (res.length < Math.min(cfgNum_('SELECAO_MIN_PARA_MEDIR'), fixas ? FIXAS_BTC.length : cfgNum_('SELECAO_N_ESTRATEGIAS'))) {   // moeda com menos estratégias aceitas que o mínimo: não é analisada
    const res1 = Object.assign(base, { estado: 'SEM_ESTRATEGIA_ELEGIVEL', achadas: res.length, vagas: sel ? sel.vagas : 10, ultimaVela: Utilities.formatDate(o.dates[n - 1], 'UTC', 'yyyy-MM-dd'), preco: o.closes[n - 1] });
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
    return { id: r.id, fam: r.fam || '', ind: r.ind || '', nome: r.nome, slot: k + 1, pos: r.posAtual, evento: r.evento || (r.erro ? 'ERRO' : ''), pe: r.precoEntrada ? r_(r.precoEntrada, 12) : null, stop: r.stopAtual ? r_(r.stopAtual, 12) : null,
      la: r_(r.lucroAbertoPct || 0), lacum: r_(r.lucroAcumPct || 0), nt: r.nTrades || 0, win: r.winRate === null || r.winRate === undefined ? null : r_(r.winRate, 1),
      sh3: r_(r.sharpe || 0, 2), peso: somaPeso > 0 ? r_((r.peso || 0) / somaPeso * 100, 1) : 0, cagr: m ? m.cagr : null, dd: m ? m.dd : null, calmar: m ? m.calmar : null,
      sh12: r.perm && r.perm.s12 !== null ? r_(r.perm.s12, 2) : null, sh24: r.perm && r.perm.s24 !== null ? r_(r.perm.s24, 2) : null, shH: r.eqCurve ? r_(nivelSharpe_(r.eqCurve, n).full, 2) : null, fora: r.ativa === false, nivel: r.eqCurve ? nivelSharpe_(r.eqCurve, n).nivel : '', rel: sel && sel.rel && sel.rel[r.id] ? sel.rel[r.id] : '', isSh: mi ? mi.sharpe : null, isCa: mi ? mi.calmar : null, isTr: r.eqCurve ? contarTrades_(r, w0, cut) : null,
      oosSh: mo ? mo.sharpe : null, oosCa: mo ? mo.calmar : null, oosCagr: mo ? mo.cagr : null, oosDd: mo ? mo.dd : null, fwCagr: fw ? fw.cagr : null, fwDd: fw ? fw.dd : null };
  });
  const bhEq = C;
  let eventos = detectarEventos_(o, I, res, null).map(function (e) { e.sym = u.sym; return e; });
  // alertas: sem e-mail na primeira leitura da moeda (não há "mudança" a comunicar) e, fora do BTC, o consenso só alerta quando a leitura muda de faixa
  if (!prev || prev.estado !== 'OK') eventos = [];
  else if (!fixas) { const mudou = prev.leitura !== cons.leitura; eventos = eventos.filter(function (e) { return !/^CONSENSO_/.test(e.tipo) || mudou; }); }
  const out = Object.assign(base, {
    estado: 'OK', ultimaVela: Utilities.formatDate(o.dates[L], 'UTC', 'yyyy-MM-dd'), preco: C[L],
    v1: r_((C[L] / C[L - 1] - 1) * 100, 2), v7: r_((C[L] / C[L - 7] - 1) * 100, 2), v30: r_((C[L] / C[L - 30] - 1) * 100, 2),
    sma200: r_(I.SMA200[L], 12), acima200: C[L] > I.SMA200[L], idx: r_(cons.pct, 1), leitura: cons.leitura, comprados: cons.comprados, nEstr: cons.n, modo: cons.modo,
    estic: termo.valor, faixa: termo.faixa, acao: termo.acao, regime: termo.regime, cobertura: termo.cobertura,
    painel: metricasPainel_(res, ini), painelIS: metricasPainel_(res, w0, cut), painelOOS: metricasPainel_(res, cut, n),
    bh: metricasJanela_(bhEq, ini), bhIS: metricasFaixa_(bhEq, w0, cut), bhOOS: metricasFaixa_(bhEq, cut, n),
    selData: dataSel, w0: w0Str, corte: cutStr, fixas: fixas, parcial: sel ? !!sel.parcial : false, vagas: sel ? (sel.vagas || 0) : 0, naoPlenas: sel ? (sel.naoPlenas || 0) : 0, nTest: sel ? sel.nTest : null, nElig: sel ? sel.nElig : null, estr: estr, carga: b.carga,
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
    '<div style="font-size:12px;opacity:.8;margin-top:4px">MVP Alts/BTC · Terminal Quantitativo · ' + Utilities.formatDate(new Date(), P2.TZ_BRT, "dd/MM/yyyy HH:mm 'BRT'") + '</div></div>' +
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
    try { MailApp.sendEmail({ to: e, subject: assunto, htmlBody: html, name: 'MVP Alts/BTC · Inteligência Quantitativa' }); ok++; }
    catch (err) { falhas.push(e + ': ' + err.message); }
  });
  return { dest: dest.join(', '), ok: ok, total: dest.length, efet: dest.length ? r_(ok / dest.length * 100, 1) : 0, falhas: falhas };
}


/* =============================================================================
 * 12. PAINÉIS — PAINEL_ALTS_BTC, ESTRATEGIAS_ALTS_BTC e DESEMPENHO_ALTS_BTC (reconstruídos a partir dos resultados guardados)
 * ===========================================================================*/
function resultadosOrdenados_() {
  return ativosUniverso_().sort(function (a, b) { return a.ordem - b.ordem; }).map(function (u) { return { u: u, r: lerRes_(u.sym) }; });
}
/** Preço em BTC (a série de cada moeda é ALT/BTC): casas decimais suficientes para 6 algarismos significativos. */
function fmtPreco_(v) {
  if (v === null || v === undefined || isNaN(v) || !(v > 0)) return '—';
  const d = Math.min(14, Math.max(6, 5 - Math.floor(Math.log(v) / Math.LN10)));
  return Number(v).toFixed(d) + ' BTC';
}
function fmtPct_(v) { return v === null || v === undefined || isNaN(v) ? '—' : (v > 0 ? '+' : '') + v + '%'; }

function gravarPainel_() {
  const sh = ss_().getSheetByName(P2.ABAS.painel), lista = resultadosOrdenados_();
  const cab = ['Ordem', 'Ativo', 'Preço em BTC (fechamento)', '24h', '7 dias', '30 dias', 'Razão vs média de 200d', 'Índice de Exposição Tática', 'Leitura do Consenso', 'Estratégias compradas',
    'Esticamento (0 barato a 100 caro)', 'Faixa', 'Histórico (anos)', 'Fonte dos dados', 'Última vela (UTC)', 'Estado'];
  const rows = lista.map(function (x) {
    const r = x.r, u = x.u;
    if (!r) return [u.ordem, u.sym + '/BTC', '—', '—', '—', '—', '—', '—', '—', '—', '—', '—', '—', u.fonteOk || '—', '—', 'AGUARDANDO CARGA'];
    if (r.estado !== 'OK') return [u.ordem, u.sym + '/BTC', fmtPreco_(r.preco), '—', '—', '—', '—', '—', '—', '—', '—', '—', r.n ? r_(r.n / 365.25, 1) : '—', r.fonte || '—', r.ultimaVela || '—', r.estado];
    return [u.ordem, u.sym + '/BTC', fmtPreco_(r.preco), fmtPct_(r.v1), fmtPct_(r.v7), fmtPct_(r.v30), r.acima200 ? 'ACIMA' : 'ABAIXO',
      r_(r.idx, 0) + '% Favorável / ' + r_(100 - r.idx, 0) + '% Defensivo', r.leitura, r.comprados + '/' + r.nEstr, r.estic + '/100', r.faixa, r_(r.n / 365.25, 1), r.fonte, r.ultimaVela, 'OK'];
  });
  sh.clear();
  sh.getRange(1, 1).setValue('MVP PROJETO ALTS/BTC (PROJETO 02) · TERMINAL QUANTITATIVO').setFontWeight('bold').setFontSize(14).setFontColor('#f5c542');
  sh.getRange(1, 1, 1, cab.length).setBackground('#081428');
  sh.getRange(2, 1).setValue('Última leitura (BRT): ' + Utilities.formatDate(new Date(), P2.TZ_BRT, 'dd/MM/yyyy HH:mm:ss') + '  ·  cada moeda medida contra o BTC (ALT/BTC) com as próprias 5 estratégias  ·  execução: sinal no fechamento, entrada na abertura do dia seguinte');
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
  sh.getRange(nota, 1).setValue('Como ler: o Índice de Exposição Tática pondera o voto das estratégias pelo Sharpe de 3 anos (ou pelo histórico existente). O Esticamento compara a razão ALT/BTC de hoje com os últimos 4 anos em dias do mesmo regime; não indica direção. Comprado = posicionado na ALT contra o BTC; caixa = posicionado em BTC. A aba DESEMPENHO_ALTS_BTC compara as estratégias escolhidas com segurar a ALT em vez de BTC, separando o período de escolha (IS) do período de teste (OOS).');
  sh.setFrozenRows(4); sh.setColumnWidth(1, 55); sh.setColumnWidth(2, 120);
  for (let c = 3; c <= 7; c++) sh.setColumnWidth(c, 105);
  sh.setColumnWidth(8, 215); sh.setColumnWidth(9, 190); sh.setColumnWidth(10, 105); sh.setColumnWidth(11, 125); sh.setColumnWidth(12, 130); sh.setColumnWidth(13, 90); sh.setColumnWidth(14, 140); sh.setColumnWidth(15, 105); sh.setColumnWidth(16, 190);
}

function fmtMin_(k) { return String(cfgNum_(k)).replace('.', ','); }

function gravarEstrategiasTop10_() {
  const sh = ss_().getSheetByName(P2.ABAS.estr), lista = resultadosOrdenados_();
  const cab = ['Ativo', 'Slot', 'ID', 'Familia', 'Estrategia', 'Posicao_Atual (1/0)', 'Status', 'Evento_Ultima_Vela', 'Preco_Entrada', 'Stop_Loss_Atual', 'Lucro_Trade_Aberto_pct', 'Lucro_Acumulado_pct', 'N_Trades', 'Win_Rate_pct',
    'Nivel_Sharpe', 'Sharpe_historico (mín. ' + fmtMin_('SELECAO_SHARPE_MIN') + ')', 'Sharpe_24m (mín. ' + fmtMin_('SELECAO_SHARPE_MIN_24M') + ')', 'Sharpe_12m (mín. ' + fmtMin_('SELECAO_SHARPE_MIN_12M') + ')', 'Sharpe_3a (peso do consenso)', 'Peso_Consenso_pct',
    'Sharpe_70pct_iniciais', 'Calmar_70pct_iniciais', 'Sharpe_30pct_finais', 'Calmar_30pct_finais', 'CAGR_30pct_finais', 'MaxDD_30pct_finais', 'CAGR_desde_selecao_pct', 'Selecionada_em', 'Data_Ultima_Vela', 'Criterio_secundario', 'Classe_indicador'];
  const rows = [], v = function (x) { return x === null || x === undefined ? '' : x; }, NC = cab.length;
  lista.forEach(function (x) {
    if (!x.r || x.r.estado !== 'OK') {   // moeda sem estratégia aceita (ou sem histórico): aparece com as vagas abertas para o painel e esta aba baterem
      for (let k = 1; k <= cfgNum_('SELECAO_N_ESTRATEGIAS'); k++) {
        const l = new Array(NC).fill(''); l[0] = x.u.sym; l[1] = k; l[2] = '—'; l[3] = '—'; l[4] = 'VAGA ABERTA (' + (x.r ? x.r.estado : 'AGUARDANDO CARGA') + (x.r && x.r.achadas !== undefined ? ': ' + x.r.achadas + ' de ' + cfgNum_('SELECAO_N_ESTRATEGIAS') + ' estratégias atenderam aos mínimos e à regra de diversificação; a moeda só é analisada com ' + cfgNum_('SELECAO_MIN_PARA_MEDIR') : '') + ')'; l[6] = 'VAGA'; rows.push(l);
      }
      return;
    }
    x.r.estr.forEach(function (e) {
      rows.push([x.u.sym, e.slot, e.id, e.fam, e.nome, e.pos, e.fora ? 'FORA DA REGRA (Sharpe)' : (e.pos === 1 ? 'COMPRADO' : 'CAIXA'), e.evento || '—', e.pe === null ? '—' : e.pe, e.stop === null ? '—' : e.stop, e.la, e.lacum, e.nt,
        e.win === null ? 'N/D (N=' + e.nt + ')' : e.win, e.nivel || '', v(e.shH), v(e.sh24), v(e.sh12), e.sh3, e.peso, v(e.isSh), v(e.isCa), v(e.oosSh), v(e.oosCa), v(e.oosCagr), v(e.oosDd), v(e.fwCagr), x.r.selData, x.r.ultimaVela, (e.rel ? 'RELAXADO: ' + e.rel : 'padrão') + (e.nt < 15 ? ' · amostra curta (' + e.nt + ' trades)' : ''), e.ind || '']);
    });
    // vagas abertas aparecem como linhas explícitas: cada moeda sempre mostra todas as posições
    if (!x.r.fixas) for (let k = x.r.estr.length + 1; k <= cfgNum_('SELECAO_N_ESTRATEGIAS'); k++) {
      const l = new Array(NC).fill(''); l[0] = x.u.sym; l[1] = k; l[2] = '—'; l[3] = '—'; l[4] = 'VAGA ABERTA: nenhum candidato com Sharpe do histórico >= ' + cfgNum_('SELECAO_PISO_PROVISORIO') + ' nos filtros'; l[6] = 'VAGA'; l[27] = x.r.selData; l[28] = x.r.ultimaVela; l[29] = ''; l[30] = ''; rows.push(l);
    }
  });
  sh.clear();
  sh.getRange(1, 1, 1, NC).setValues([cab]).setFontWeight('bold').setBackground('#0b1f3a').setFontColor('#ffffff').setWrap(true);
  if (rows.length) {
    sh.getRange(2, 28, rows.length, 2).setNumberFormat('@');
    sh.getRange(2, 1, rows.length, NC).setValues(rows);
    const cor = { 'PLENA': '#d9ead3', 'RECENTE FRACA': '#fff2cc', 'PROVISORIA': '#fce5cd', 'FORA': '#f4cccc' };
    rows.forEach(function (r, i) {
      if (r[6] === 'VAGA' || r[6] === 'FORA DA REGRA (Sharpe)') { sh.getRange(i + 2, 1, 1, NC).setBackground('#eeeeee'); return; }
      sh.getRange(i + 2, 6, 1, 2).setBackground(r[5] === 1 ? '#d9ead3' : '#f4cccc');
      if (cor[r[14]]) sh.getRange(i + 2, 15).setBackground(cor[r[14]]).setFontWeight('bold');
      if (r[15] !== '' && r[15] < cfgNum_('SELECAO_SHARPE_MIN')) sh.getRange(i + 2, 16).setBackground('#fce5cd');
      if (r[16] !== '' && r[16] < cfgNum_('SELECAO_SHARPE_MIN_24M')) sh.getRange(i + 2, 17).setBackground('#f4cccc').setFontWeight('bold');
      if (r[17] !== '' && r[17] < cfgNum_('SELECAO_SHARPE_MIN_12M')) sh.getRange(i + 2, 18).setBackground('#f4cccc').setFontWeight('bold');
    });
  }
  sh.getRange(rows.length + 3, 1).setValue('Nível: PLENA = Sharpe do histórico, 24m e 12m nos mínimos da régua (CONFIG_SISTEMA); RECENTE FRACA = histórico no mínimo mas 24m ou 12m abaixo do mínimo; PROVISORIA = histórico entre SELECAO_PISO_PROVISORIO e 1,00 (desligado por padrão). As colunas 70%/30% descrevem o desempenho por período e NÃO são teste fora da amostra, pois a escolha usa o histórico todo.');
  sh.setFrozenRows(1); sh.setFrozenColumns(3); sh.setColumnWidth(5, 330);
}

function gravarDesempenho_() {
  const sh = ss_().getSheetByName(P2.ABAS.desemp), lista = resultadosOrdenados_().filter(function (x) { return x.r && x.r.estado === 'OK'; });
  sh.clear();
  if (!lista.length) { sh.getRange(1, 1).setValue('Sem ativos carregados ainda. Rode o menu 2) Carga inicial.'); return; }
  sh.getRange(1, 1).setValue('DESEMPENHO EM BTC DAS ESTRATÉGIAS ESCOLHIDAS DE CADA MOEDA (peso igual) CONTRA SEGURAR A ALT — razão ALT/BTC, custo de 0,125% por lado, sinal no fechamento e execução na abertura seguinte.').setFontWeight('bold').setFontColor('#f5c542');
  sh.getRange(1, 1, 1, 22).setBackground('#081428');
  sh.getRange(2, 1).setValue('As estratégias de cada moeda são escolhidas com o histórico INTEIRO: os números abaixo são de dentro da amostra (otimistas). 70% iniciais x 30% finais é só descrição por período. Todas as séries são ALT/BTC: ganhar significa render mais que o BTC, e o benchmark é segurar a ALT. Verde = painel supera segurar a ALT no mesmo período em Calmar.');
  const cab = ['Ativo', 'Anos de histórico', 'Selecionada em', 'Período dos 70% iniciais', 'Início dos 30% finais',
    '70% iniciais: Calmar', 'Sharpe', 'CAGR %', 'MaxDD %',
    '30% finais: Calmar', 'Sharpe', 'CAGR %', 'MaxDD %',
    'ALT 30% finais: Calmar', 'CAGR %', 'MaxDD %',
    'Estratégias PLENAS', 'Estratégias fora do nível PLENA', 'Painel total Calmar', 'Painel total CAGR %', 'ALT total Calmar', 'Observação'];
  sh.getRange(4, 1, 1, cab.length).setValues([cab]).setFontWeight('bold').setBackground('#0b1f3a').setFontColor('#ffffff').setWrap(true);
  const g = function (m, k) { return m && m[k] !== undefined && m[k] !== null ? m[k] : ''; };
  const rows = lista.map(function (x) {
    const r = x.r, bhO = r.bhOOS ? r.bhOOS.calmar : null;
    const sup = r.estr.filter(function (e) { return e.nivel === 'PLENA'; }).length;
    const neg = r.estr.length - sup;
    const obs = 'seleção própria da moeda (série ALT/BTC)' + (r.parcial ? ' · VAGAS ABERTAS: ' + r.vagas : '') + (r.nTest ? ' · ' + r.nTest + ' candidatos testados' : '') + (r.n < 1000 ? ' · histórico curto: leitura frágil' : '');
    return [x.u.sym + '/BTC', r_(r.n / 365.25, 1), r.selData, r.w0 + ' a ' + r.corte, r.corte,
      g(r.painelIS, 'calmar'), g(r.painelIS, 'sharpe'), g(r.painelIS, 'cagr'), g(r.painelIS, 'dd'),
      g(r.painelOOS, 'calmar'), g(r.painelOOS, 'sharpe'), g(r.painelOOS, 'cagr'), g(r.painelOOS, 'dd'),
      g(r.bhOOS, 'calmar'), g(r.bhOOS, 'cagr'), g(r.bhOOS, 'dd'), sup, neg, g(r.painel, 'calmar'), g(r.painel, 'cagr'), g(r.bh, 'calmar'), obs];
  });
  sh.getRange(5, 3, rows.length, 3).setNumberFormat('@');
  sh.getRange(5, 1, rows.length, cab.length).setValues(rows);
  rows.forEach(function (row, i) {
    if (row[9] !== '' && row[13] !== '') sh.getRange(5 + i, 10).setBackground(row[9] > row[13] ? '#d9ead3' : '#f4cccc').setFontWeight('bold');
  });
  const nota = 5 + rows.length + 1;
  sh.getRange(nota, 1).setValue('Moedas com pouco histórico (HYPE, e AAVE/SOL em parte) têm medidas frágeis; em ALT/BTC a maioria das moedas tem tendência de queda de longo prazo contra o BTC. Escolher o melhor de milhares de candidatos produz Sharpe alto também por acaso: leia estes números como teto, não como previsão.');
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
  const env = enviar_('[' + tag + '] Alertas Quantitativos Alts/BTC — ' + novos.length + ' evento(s) em ' + Object.keys(porAtivo).join(', '),
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
  return moldura_('Relatório Quantitativo Semanal — Alts/BTC', '#0b8043', 'SEMANAL', corpo);
}

/* =============================================================================
 * 13. MOTOR (rodízio dentro do limite de tempo) e gatilhos
 * ===========================================================================*/
function motorTop10(forcar) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) { Logger.log('Outro ciclo em execução.'); return { processados: 0, restantes: 0 }; }
  try {
    const t0 = Date.now(), orcamento = cfgNum_('ORCAMENTO_SEG') * 1000, props = PropertiesService.getScriptProperties();
    garantirBtc_();   // BASE_BTC primeiro: todas as razões usam a vela do BTC da mesma data
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
    if (Date.now() - t0 > 200000) logDisparo_('TEMPO_ALTO', 'Execução de ' + Math.round((Date.now() - t0) / 1000) + 's com ' + feitos + ' ativo(s); o limite do Apps Script é 360s', '—', '—', 'AVISO', '');
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
  const env = enviar_('Relatório Quantitativo Semanal — Alts/BTC · ' + Utilities.formatDate(new Date(), P2.TZ_BRT, 'dd/MM/yyyy'), montarRelatorioSemanal_());
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
/** Menu H: refaz a carga do histórico de cada moeda escolhendo a fonte com mais dados (só troca se ganhar 30+ velas) e refaz a seleção. Repita o menu 2 até concluir. */
function recarregarHistorico() {
  const syms = ativosUniverso_().filter(function (u) { return u.status === 'ATIVO'; }).map(function (u) { return u.sym; });
  setPendentesHist_(syms); PropertiesService.getScriptProperties().setProperty('CURSOR', '0');
  cargaInicial();
}
/** Menu F: reescreve a coluna Fontes da UNIVERSO com a lista do código (mais corretoras) e limpa a fonte já escolhida. */
function atualizarFontes() {
  const sh = ss_().getSheetByName(P2.ABAS.universo), mapa = {}; SEED_UNIVERSO.forEach(function (s) { mapa[s[1]] = s[6]; });
  let k = 0; universo_().forEach(function (u) { if (mapa[u.sym] && u.status !== 'EXCLUIDO') { sh.getRange(u.row, 8).setValue(mapa[u.sym]); sh.getRange(u.row, 9).setValue(''); k++; } });
  safeToast_('Fontes atualizadas para ' + k + ' ativo(s). Rode o menu 1 (diagnóstico) e depois o H (recarregar histórico).');
}
function reprocessarTudo() { PropertiesService.getScriptProperties().setProperty('CURSOR', '0'); cargaInicial(); }

/* =============================================================================
 * 14. DIAGNÓSTICO DE FONTES, RANKING COINGECKO, SETUP, BACKUP, GATILHOS, MENU
 * ===========================================================================*/
function diagnosticoFontes() {
  const sh = ss_().getSheetByName(P2.ABAS.diag), linhas = [], t0 = Date.now();
  universo_().filter(function (u) { return u.status === 'ATIVO' || u.status === 'BASE'; }).sort(function (a, b) { return a.ordem - b.ordem; }).forEach(function (u) {
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
  const abas = [P2.ABAS.painel, P2.ABAS.desemp, P2.ABAS.estr, P2.ABAS.sel, P2.ABAS.audit, P2.ABAS.universo, P2.ABAS.ranking, P2.ABAS.diag, P2.ABAS.log, P2.ABAS.cfg];
  const primeira = ss.getSheets()[0];   // a aba inicial (resultados do teste offline, se a planilha veio pronta) é preservada
  if (primeira && abas.indexOf(primeira.getName()) < 0 && primeira.getName().indexOf('BASE_') !== 0) {
    if (primeira.getLastRow() > 1) primeira.setName('RESULTADOS_BACKTEST_INICIAL'); else primeira.setName(P2.ABAS.painel);
  }
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
  if (cfgSh.getLastRow() > 1) {   // remove parâmetros que o código não usa mais (não têm efeito) e sincroniza as descrições
    const codigoCfg = {}; CFG_PADRAO.forEach(function (r) { codigoCfg[r[0]] = true; });
    const todas = cfgSh.getRange(2, 1, cfgSh.getLastRow() - 1, 3).getValues(), mantidas = todas.filter(function (r) { return !r[0] || codigoCfg[r[0]]; });
    if (mantidas.length < todas.length) { cfgSh.getRange(2, 1, todas.length, 3).clearContent(); if (mantidas.length) cfgSh.getRange(2, 1, mantidas.length, 3).setValues(mantidas); }
  }
  if (cfgSh.getLastRow() > 1) {   // sincroniza as descrições com o código e marca parâmetros que não são mais usados
    const desc = {}; CFG_PADRAO.forEach(function (r) { desc[r[0]] = r[2]; });
    cfgSh.getRange(2, 1, cfgSh.getLastRow() - 1, 3).getValues().forEach(function (r, i) {
      const d = desc[r[0]]; cfgSh.getRange(i + 2, 3).setValue(d !== undefined ? d : (String(r[2]).indexOf('OBSOLETO') === 0 ? r[2] : 'OBSOLETO (não usado pelo código): ' + r[2]));
    });
  }
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
  abaBase_('BTC', true); ativosUniverso_().forEach(function (u) { abaBase_(u.sym, true); });
  aplicarSementes_();
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
  let nome = 'MVP Projeto Alts-BTC (PROJETO 02) - BACKUP ' + carimbo, k = 2;
  while (pasta.getFilesByName(nome).hasNext()) nome = 'MVP Projeto Alts-BTC (PROJETO 02) - BACKUP ' + carimbo + ' (' + k++ + ')';
  const copia = DriveApp.getFileById(P2.PLANILHA_ID).makeCopy(nome, pasta);
  Logger.log('Backup criado: ' + copia.getUrl()); return copia.getUrl();
}
/**
 * Gatilhos: a vela diária (UTC) fecha às 21:00 de Brasília. Principal ~22:00 e redundância ~01:00 BRT: ambos rodam o mesmo ciclo, que só trabalha nas moedas
 * sem a vela do dia (moeda já atualizada é pulada). A redundância, depois do ciclo, confere todas as moedas e avisa por e-mail se alguma continua desatualizada.
 * O Apps Script dispara dentro da hora pedida (22h-23h e 01h-02h).
 */
function instalarGatilhosAutomaticos() {
  const alvo = ['motorHorario', 'motorDiarioPrincipal', 'motorDiarioRedundancia', 'motorContinuacao', 'motorSemanal', 'backupDiario', 'atualizarRanking'];
  ScriptApp.getProjectTriggers().forEach(function (t) { if (alvo.indexOf(t.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('motorDiarioPrincipal').timeBased().everyDays(1).atHour(22).nearMinute(0).inTimezone(P2.TZ_BRT).create();
  ScriptApp.newTrigger('motorDiarioRedundancia').timeBased().everyDays(1).atHour(1).nearMinute(0).inTimezone(P2.TZ_BRT).create();
  ScriptApp.newTrigger('backupDiario').timeBased().everyDays(1).atHour(3).nearMinute(0).inTimezone(P2.TZ_BRT).create();
  ScriptApp.newTrigger('motorSemanal').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(8).nearMinute(0).inTimezone(P2.TZ_BRT).create();
  ScriptApp.newTrigger('atualizarRanking').timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(9).nearMinute(0).inTimezone(P2.TZ_BRT).create();
  safeToast_('Gatilhos instalados: atualização diária ~22:00 BRT, redundância ~01:00 BRT, backup ~03:00 BRT, relatório semanal (seg 08:00 BRT) e ranking (dom 09:00 BRT).');
  return conferirGatilhos();
}
/** Ciclo do dia. Se o tempo acabar antes de percorrer todas as moedas, agenda a continuação para 5 minutos depois (uma de cada vez). */
function cicloDiario_() {
  const r = motorTop10(false);
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'motorContinuacao') ScriptApp.deleteTrigger(t); });
  if (r && r.restantes > 0) ScriptApp.newTrigger('motorContinuacao').timeBased().after(5 * 60 * 1000).create();
  return r;
}
function motorDiarioPrincipal() { cicloDiario_(); }
function motorContinuacao() { cicloDiario_(); }
function motorDiarioRedundancia() { cicloDiario_(); verificarAtualizacao_(); }
/** Menu V: confere agora se todas as moedas têm a vela do dia (e avisa por e-mail se não). */
function verificarAtualizacao() { const a = verificarAtualizacao_(); safeToast_(a.length ? 'Desatualizados: ' + a.join(' | ') : 'Todas as moedas estão com a vela do dia.'); }
/** Confere a BASE_BTC e todas as moedas: a última vela precisa ser a de ontem (UTC). Avisa por e-mail (uma vez por dia) e registra no LOG_DISPAROS. */
function verificarAtualizacao_() {
  const ontem = dataStr_(new Date(ontemUtcMs_())), atrasadas = [];
  const b = baseBtc_(); if (b) { const o = lerBase_('BTC'), n = o.dates.length; if (!n || dataStr_(o.dates[n - 1]) < ontem) atrasadas.push('BTC (base): última vela ' + (n ? dataStr_(o.dates[n - 1]) : 'nenhuma')); }
  ativosUniverso_().forEach(function (u) {
    const r = lerRes_(u.sym);
    if (!r) { atrasadas.push(u.sym + ': sem resultado'); return; }
    if (String(r.estado).indexOf('ERRO') === 0) { atrasadas.push(u.sym + ': ' + r.estado); return; }
    if (!r.ultimaVela || r.ultimaVela < ontem) atrasadas.push(u.sym + ': última vela ' + (r.ultimaVela || 'nenhuma'));
  });
  if (!atrasadas.length) { logDisparo_('ATUALIZACAO_DIARIA', 'Todas as moedas com a vela de ' + ontem, '—', '—', 'OK', ''); return []; }
  const hash = md5_(Utilities.formatDate(new Date(), P2.TZ_BRT, 'yyyy-MM-dd') + '|FALHA_ATUALIZACAO');
  if (hashesRecentes_()[hash]) return atrasadas;
  const corpo = '<p style="font-size:14px">Depois da atualização de redundância (~01:00 BRT), <b>' + atrasadas.length + ' item(ns)</b> continua(m) sem a vela de <b>' + ontem + '</b> (UTC):</p><ul style="font-size:13px">' + atrasadas.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul><p style="font-size:12px">Abra a planilha, rode o menu 2) Carga inicial / ciclo completo e confira a aba DIAGNOSTICO_FONTES e o LOG_DISPAROS.</p>';
  let status = 'ALERTA_DESLIGADO';
  if (cfgSim_('ALERTA_FALHA_ATUALIZACAO')) { const env = enviar_('[FALHA] Atualização diária Alts/BTC incompleta — ' + atrasadas.length + ' item(ns)', moldura_('Atualização diária incompleta', '#b00020', 'FALHA', corpo)); status = env.ok === env.total ? 'ENVIADO' : (env.ok ? 'ENVIADO_PARCIAL' : 'FALHA: ' + env.falhas.join('; ')); }
  logDisparo_('FALHA_ATUALIZACAO', atrasadas.join(' | ').substring(0, 450), emails_().join(', '), hash, status, '');
  return atrasadas;
}
function removerGatilhos() { ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); }); safeToast_('Todos os gatilhos removidos.'); }
function conferirGatilhos() {
  const s = ScriptApp.getProjectTriggers().map(function (t) { return t.getHandlerFunction() + ' (' + t.getEventType() + ')'; }).join('\n') || 'Nenhum gatilho.';
  Logger.log(s); try { SpreadsheetApp.getUi().alert('Gatilhos', s, SpreadsheetApp.getUi().ButtonSet.OK); } catch (e) {} return s;
}
/** Envia prévia do relatório semanal APENAS ao 1º e-mail (não grava hash). */
function testarEmailInterno() {
  const dest = emails_()[0];
  MailApp.sendEmail({ to: dest, subject: '[TESTE] Relatório Semanal — Alts/BTC', htmlBody: montarRelatorioSemanal_() });
  logDisparo_('TESTE', 'testarEmailInterno', dest, '—', 'ENVIADO', 100);
}
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Alts/BTC — Quant')
    .addItem('0) Criar/formatar abas', 'setupPlanilha')
    .addItem('1) Diagnóstico das fontes de dados', 'diagnosticoFontes')
    .addItem('2) Carga inicial / ciclo completo (repita até concluir)', 'cargaInicial')
    .addItem('3) Rodar o ciclo normal agora (só o que mudou)', 'motorHorario')
    .addItem('V) Verificar se todas as moedas têm a vela do dia', 'verificarAtualizacao')
    .addSeparator()
    .addItem('R) Atualizar ranking CoinGecko (sugere ajustes ao universo)', 'atualizarRanking')
    .addItem('T) Teste de e-mail (somente 1º destinatário)', 'testarEmailInterno')
    .addItem('F) Atualizar a lista de fontes de dados (pelo código)', 'atualizarFontes')
    .addItem('H) Recarregar o histórico pela fonte mais longa', 'recarregarHistorico')
    .addItem('A) Auditoria: conciliar abas e recalcular os números', 'auditoria')
    .addItem('S) Refazer a seleção das 5 estratégias de cada moeda', 'reselecionarTodas')
    .addItem('P) Reprocessar tudo do zero (recalcula todos os ativos)', 'reprocessarTudo')
    .addItem('G) Instalar gatilhos automáticos', 'instalarGatilhosAutomaticos')
    .addItem('B) Fazer backup agora', 'backupDiario')
    .addItem('C) Conferir gatilhos', 'conferirGatilhos')
    .addItem('X) Remover todos os gatilhos', 'removerGatilhos')
    .addToUi();
}

/* =============================================================================
 * 15. AUDITORIA — conciliação entre abas e recálculo independente dos números (menu A)
 *     Escreve a aba AUDITORIA com uma linha por verificação: Grupo | Escopo | Esperado | Encontrado | Status (OK, ATENCAO, ERRO).
 *     O recálculo refaz do zero as estratégias a partir das abas BASE (sem usar os resultados guardados) e compara com o que as abas mostram.
 * ===========================================================================*/
function auditoria() {
  const t0 = Date.now(), L = [], ss = ss_();
  const add = function (grupo, escopo, esperado, achado, ok, nivel) { L.push([grupo, escopo, String(esperado), String(achado), ok ? 'OK' : (nivel || 'ERRO')]); };
  const lerAba = function (nome) { const sh = ss.getSheetByName(nome); if (!sh || sh.getLastRow() < 1) return []; return sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues(); };
  const num = function (x) { const v = parseFloat(String(x).replace(/[$%\s]/g, '').replace(/,(?=\d{3}(\D|$))/g, '').replace(',', '.')); return isFinite(v) ? v : null; };
  const painel = lerAba(P2.ABAS.painel), desemp = lerAba(P2.ABAS.desemp), estr = lerAba(P2.ABAS.estr), selec = lerAba(P2.ABAS.sel);
  const ativos = ativosUniverso_().sort(function (a, b) { return a.ordem - b.ordem; });
  const ontem = dataStr_(new Date(ontemUtcMs_()));
  const linhaPainel = {}; painel.forEach(function (r, i) { if (i >= 4 && r[1]) linhaPainel[String(r[1]).replace('/BTC', '')] = r; });
  const linhaDesemp = {}; desemp.forEach(function (r, i) { if (i >= 4 && r[0] && r[1] !== '') linhaDesemp[String(r[0]).replace('/BTC', '')] = r; });
  const estrPorAtivo = {}; estr.forEach(function (r, i) { if (i >= 1 && r[0] && r[1] !== '' && r[6] !== undefined) (estrPorAtivo[r[0]] = estrPorAtivo[r[0]] || []).push(r); });
  const selPorAtivo = {}; selec.forEach(function (r, i) { if (i >= 1 && r[0] && r[1] !== '' && r[2] !== '(resumo)') (selPorAtivo[r[0]] = selPorAtivo[r[0]] || []).push(r[2]); });

  // 1. Cobertura entre abas
  ativos.forEach(function (u) {
    const rp = linhaPainel[u.sym], re = estrPorAtivo[u.sym] || [], rd = linhaDesemp[u.sym], baseSh = ss.getSheetByName('BASE_' + u.sym);
    const faltam = []; if (!rp) faltam.push('PAINEL_ALTS_BTC'); if (!re.length) faltam.push('ESTRATEGIAS_ALTS_BTC');
    const estadoOk = rp && String(rp[15]) === 'OK'; if (estadoOk && !rd) faltam.push('DESEMPENHO_ALTS_BTC'); if (!baseSh) faltam.push('BASE_' + u.sym);
    add('Cobertura', u.sym, 'presente em PAINEL, ESTRATEGIAS, DESEMPENHO (se OK) e BASE', faltam.length ? 'falta em: ' + faltam.join(', ') : 'presente' + (estadoOk ? '' : ' (estado ' + (rp ? rp[15] : '?') + ': sem DESEMPENHO, por desenho)'), !faltam.length);
  });

  // 2. Dados base: integridade, atualização e conciliação com PAINEL e UNIVERSO
  const bases = {};
  ativos.forEach(function (u) {
    const bruto = lerBase_(u.sym), o = aparaInicio_(lerBase_(u.sym)), n = o.closes.length; bases[u.sym] = o;
    if (!n) { add('Dados', u.sym, 'série diária carregada', 'aba BASE vazia', false); return; }
    let lac = 0, dup = 0, inc = 0, plano = 0, salto = 0, extremos = 0;
    for (let i = 0; i < n; i++) {
      if (i) { const d = (o.dates[i] - o.dates[i - 1]) / 86400000; if (d > 1.5) lac++; if (d < 0.5) dup++; const r = o.closes[i] / o.closes[i - 1]; if (r > 20 || r < 0.05) salto++; if (Math.abs(r - 1) > 0.4) extremos++; }
      if (o.lows[i] > Math.min(o.opens[i], o.closes[i]) * 1.000001 || o.highs[i] < Math.max(o.opens[i], o.closes[i]) * 0.999999) inc++;
      if (o.highs[i] === o.lows[i]) plano++;
    }
    add('Dados', u.sym + ' continuidade', '0 lacunas e 0 datas repetidas', lac + ' lacunas, ' + dup + ' repetidas', !lac && !dup);
    add('Dados', u.sym + ' consistência OHLC', '0 velas com máxima/mínima incoerentes', inc + ' velas', !inc);
    add('Dados', u.sym + ' saltos de preço > 20x em um dia', '0 depois do corte automático do começo', salto + (bruto.closes.length !== n ? ' (começo aparado: ' + (bruto.closes.length - n) + ' velas descartadas)' : ''), !salto);
    add('Dados', u.sym + ' velas planas (máxima = mínima) e quedas/altas > 40% em um dia', 'informativo', plano + ' planas; ' + extremos + ' variações > 40%', plano < n * 0.05, 'ATENCAO');
    const ultima = dataStr_(o.dates[n - 1]);
    add('Dados', u.sym + ' atualização', 'última vela = ' + ontem + ' (ontem UTC)', ultima, ultima >= ontem);
    const rp = linhaPainel[u.sym];
    if (rp) {
      const p = num(rp[2]), c = o.closes[n - 1];
      add('Conciliação', u.sym + ' preço PAINEL x BASE', 'último fechamento ' + c, rp[2], p !== null && Math.abs(p - c) / c < 0.002);
      add('Conciliação', u.sym + ' última vela PAINEL x BASE', ultima, rp[14], String(rp[14]).slice(0, 10) === ultima);
    }
    add('Conciliação', u.sym + ' N_Velas da UNIVERSO x BASE', n, u.nVelas, parseInt(u.nVelas, 10) === n);
  });

  // 3. Estratégias: recálculo independente x ESTRATEGIAS_ALTS_BTC, PAINEL e DESEMPENHO
  let totCmp = 0, okCmp = 0;
  ativos.forEach(function (u) {
    const re = estrPorAtivo[u.sym] || [], rp = linhaPainel[u.sym], rd = linhaDesemp[u.sym], o = bases[u.sym];
    const reais = re.filter(function (r) { return r[2] !== '—' && r[6] !== 'VAGA'; });
    if (!reais.length || !o || !o.closes.length) return;
    const n = o.closes.length; if (true) o.btcC = alinharBtc_(o, lerBase_('BTC'));
    const ids = reais.map(function (r) { return r[2]; }), defs = false ? FIXAS_BTC.concat(defsPorId_(ids.filter(function (id) { return !FIXAS_BTC.some(function (f) { return f.id === id; }); }))) : defsPorId_(ids);
    const res = rodarLista_(o, defs).filter(function (r) { return ids.indexOf(r.id) >= 0; });
    const dif = [];
    reais.forEach(function (r) {
      const c = res.filter(function (x) { return x.id === r[2]; })[0]; if (!c || !c.eqCurve) { dif.push(r[2] + ' (não recalculável)'); return; }
      const nv = nivelSharpe_(c.eqCurve, n), pares = [['histórico', num(r[15]), nv.full, 0.011], ['24m', num(r[16]), nv.s24, 0.011], ['12m', num(r[17]), nv.s12, 0.011], ['3 anos', num(r[18]), c.sharpe, 0.011], ['trades', num(r[12]), c.nTrades, 0.1], ['posição', num(r[5]), c.posAtual, 0.1]];
      pares.forEach(function (p) { totCmp++; if (p[1] !== null && p[2] !== null && Math.abs(p[1] - p[2]) <= p[3]) okCmp++; else dif.push(r[2] + ' ' + p[0] + ': aba ' + p[1] + ' x recálculo ' + (p[2] === null ? 'n/d' : r_(p[2], 2))); });
      // nível coerente com os mínimos atuais
      const esperado = nv.full >= cfgNum_('SELECAO_SHARPE_MIN') ? (nv.s24 >= cfgNum_('SELECAO_SHARPE_MIN_24M') && nv.s12 >= cfgNum_('SELECAO_SHARPE_MIN_12M') ? 'PLENA' : 'RECENTE FRACA') : 'PROVISORIA';
      if (true && String(r[14]) !== esperado && !(String(r[14]) === 'FORA' )) dif.push(r[2] + ' nível ' + r[14] + ' x esperado ' + esperado + ' pelos mínimos atuais');
    });
    add('Recálculo', u.sym + ' estratégias (Sharpe, trades, posição)', reais.length * 6 + ' valores conferem', dif.length ? dif.slice(0, 4).join('; ') + (dif.length > 4 ? ' (+' + (dif.length - 4) + ')' : '') : 'todos conferem', !dif.length);
    // PAINEL: compradas e índice
    if (rp) {
      const comp = reais.filter(function (r) { return r[5] === 1 && r[6] !== 'FORA DA REGRA (Sharpe)'; }).length, ativas = reais.filter(function (r) { return r[6] !== 'FORA DA REGRA (Sharpe)'; }).length;
      add('Conciliação', u.sym + ' estratégias compradas PAINEL x ESTRATEGIAS', comp + '/' + ativas, rp[9], String(rp[9]) === comp + '/' + ativas);
      res.forEach(function (r) { const f = reais.filter(function (x) { return x[2] === r.id; })[0]; r.ativa = !(f && f[6] === 'FORA DA REGRA (Sharpe)'); });
      const cons = consenso_(res), idxP = num(String(rp[7]).split('%')[0]);
      add('Recálculo', u.sym + ' Índice de Exposição Tática', r_(cons.pct, 1) + '%', rp[7], idxP !== null && Math.abs(idxP - cons.pct) <= 1.0);
    }
    if (rd) {
      const plenas = reais.filter(function (r) { return r[14] === 'PLENA'; }).length;
      add('Conciliação', u.sym + ' estratégias PLENAS DESEMPENHO x ESTRATEGIAS', plenas, rd[16], parseInt(rd[16], 10) === plenas);
      const ini = Math.min(n - 91, cfgNum_('JANELA_INICIO_BARRAS')), pt = metricasPainel_(res.filter(function (r) { return r.ativa !== false; }), ini), bh = metricasJanela_(o.closes, ini);
      add('Recálculo', u.sym + ' Calmar do painel e do buy and hold (DESEMPENHO)', (pt ? pt.calmar : 'n/d') + ' e ' + (bh ? bh.calmar : 'n/d'), rd[18] + ' e ' + rd[20], !!pt && !!bh && Math.abs(num(rd[18]) - pt.calmar) <= 0.06 && Math.abs(num(rd[20]) - bh.calmar) <= 0.06);
    }
    // SELECAO_CANDIDATAS x ESTRATEGIAS
    if (true) {
      const a = (selPorAtivo[u.sym] || []).slice().sort().join(','), b = ids.slice().sort().join(',');
      add('Conciliação', u.sym + ' IDs escolhidos SELECAO_CANDIDATAS x ESTRATEGIAS', b, a || '(sem linhas)', a === b);
    }
  });
  add('Recálculo', 'Total de valores de estratégias recalculados', totCmp, okCmp + ' conferem', okCmp === totCmp);

  // 3B. Regra de diversificação: no máximo 1 da mesma classe de indicador a cada 5 (2 em 10)
  ativos.forEach(function (u) {
    const re = (estrPorAtivo[u.sym] || []).filter(function (r) { return r[2] !== '—' && r[6] !== 'VAGA' && r[6] !== 'FORA DA REGRA (Sharpe)'; });
    if (!re.length) return;
    const cap = Math.max(1, Math.round(re.length / 5 * cfgNum_('SELECAO_MAX_MESMA_CLASSE_POR_5'))), cont = {};
    re.forEach(function (r) { const c = classeInd_(r[4]); cont[c] = (cont[c] || 0) + 1; });
    const exc = Object.keys(cont).filter(function (c) { return cont[c] > cap; }).map(function (c) { return c + ' x' + cont[c]; });
    add('Diversificação', u.sym + ' classes de indicador', 'no máximo ' + cap + ' da mesma classe em ' + re.length, exc.length ? 'excede: ' + exc.join(', ') : 'respeitada (' + Object.keys(cont).length + ' classes)', !exc.length);
  });

  // 4. Mínimos de Sharpe e estratégias abaixo da régua
  const abaixo = []; Object.keys(estrPorAtivo).forEach(function (s) { estrPorAtivo[s].forEach(function (r) {
    if (r[2] === '—' || r[6] === 'VAGA' || r[6] === 'FORA DA REGRA (Sharpe)') return;
    if (r[14] !== 'PLENA') abaixo.push(s + ' ' + r[2] + ' (' + r[14] + ')');
  }); });
  add('Régua de Sharpe', 'estratégias ativas fora do nível PLENA', '0 (histórico >= ' + cfgNum_('SELECAO_SHARPE_MIN') + ', 24m >= ' + cfgNum_('SELECAO_SHARPE_MIN_24M') + ', 12m >= ' + cfgNum_('SELECAO_SHARPE_MIN_12M') + ')', abaixo.length ? abaixo.join('; ') : 'nenhuma', !abaixo.length, 'ATENCAO');
  ativos.forEach(function (u) {
    const re = (estrPorAtivo[u.sym] || []), vagas = re.filter(function (r) { return r[6] === 'VAGA'; }).length;
    if (vagas) { const rp = linhaPainel[u.sym]; add('Régua de Sharpe', u.sym + ' vagas abertas (moeda não analisada por regra: só é medida com todas as ' + cfgNum_('SELECAO_N_ESTRATEGIAS') + ' estratégias aceitas)', 0, vagas + ' vagas' + (rp ? ' · estado ' + rp[15] : ''), false, 'INFO'); }
  });

  // 5. Operação: gatilhos, configuração, log
  const gat = ScriptApp.getProjectTriggers().map(function (t) { return t.getHandlerFunction(); });
  ['motorDiarioPrincipal', 'motorDiarioRedundancia', 'motorSemanal', 'backupDiario', 'atualizarRanking'].forEach(function (h) { add('Operação', 'gatilho ' + h, 'instalado', gat.indexOf(h) >= 0 ? 'instalado' : 'ausente (menu G)', gat.indexOf(h) >= 0, 'ATENCAO'); });
  const cfgSh = ss.getSheetByName(P2.ABAS.cfg), chaves = {}; if (cfgSh && cfgSh.getLastRow() > 1) cfgSh.getRange(2, 1, cfgSh.getLastRow() - 1, 1).getValues().forEach(function (r) { chaves[r[0]] = true; });
  const semChave = CFG_PADRAO.filter(function (r) { return !chaves[r[0]]; }).map(function (r) { return r[0]; }), codigo = {}; CFG_PADRAO.forEach(function (r) { codigo[r[0]] = true; });
  const obsoletas = Object.keys(chaves).filter(function (k) { return k && !codigo[k]; });
  add('Operação', 'CONFIG_SISTEMA x código', 'sem parâmetros faltando nem obsoletos', (semChave.length ? 'faltam (usam o padrão do código): ' + semChave.join(', ') : '') + (obsoletas.length ? ' obsoletos: ' + obsoletas.join(', ') : '') || 'em dia', !semChave.length && !obsoletas.length, 'ATENCAO');
  const log = lerAba(P2.ABAS.log), recentes = log.slice(1).filter(function (r) { const t = r[0] instanceof Date ? r[0].getTime() : Date.parse(r[0]); return t >= Date.now() - 48 * 3600000 && /^FALHA|^TEMPO_ALTO/.test(String(r[1]) + String(r[5])); });
  const ult = recentes.length ? recentes[recentes.length - 1] : null;
  add('Operação', 'falhas registradas no LOG_DISPAROS nas últimas 48 horas', 0, recentes.length + (ult ? ' (última: ' + (ult[0] instanceof Date ? Utilities.formatDate(ult[0], P2.TZ_BRT, 'dd/MM HH:mm') : ult[0]) + ' ' + ult[1] + ')' : ''), !recentes.length, 'ATENCAO');
  L.push(['Resumo', 'Auditoria executada em ' + Utilities.formatDate(new Date(), P2.TZ_BRT, 'dd/MM/yyyy HH:mm') + ' BRT (' + Math.round((Date.now() - t0) / 1000) + 's)', '', L.filter(function (l) { return l[4] === 'OK'; }).length + ' OK, ' + L.filter(function (l) { return l[4] === 'INFO'; }).length + ' informativos, ' + L.filter(function (l) { return l[4] === 'ATENCAO'; }).length + ' atenção, ' + L.filter(function (l) { return l[4] === 'ERRO'; }).length + ' erro', L.some(function (l) { return l[4] === 'ERRO'; }) ? 'ERRO' : (L.some(function (l) { return l[4] === 'ATENCAO'; }) ? 'ATENCAO' : 'OK')]);

  let sh = ss.getSheetByName(P2.ABAS.audit); if (!sh) sh = ss.insertSheet(P2.ABAS.audit);
  sh.clear();
  sh.getRange(1, 1, 1, 5).setValues([['Grupo', 'Escopo', 'Esperado', 'Encontrado', 'Status']]).setFontWeight('bold').setBackground('#0b1f3a').setFontColor('#ffffff');
  const ordem = L.slice(-1).concat(L.slice(0, -1));
  sh.getRange(2, 3, ordem.length, 2).setNumberFormat('@');   // evita que a planilha reinterprete textos como números/moeda
  sh.getRange(2, 1, ordem.length, 5).setValues(ordem);
  ordem.forEach(function (l, i) { sh.getRange(i + 2, 5).setBackground(l[4] === 'OK' ? '#d9ead3' : l[4] === 'ATENCAO' ? '#fff2cc' : l[4] === 'INFO' ? '#eeeeee' : '#f4cccc').setFontWeight('bold'); });
  sh.setFrozenRows(1); sh.setColumnWidth(1, 110); sh.setColumnWidth(2, 360); sh.setColumnWidth(3, 330); sh.setColumnWidth(4, 520);
  safeToast_('Auditoria concluída: ' + ordem[0][3] + '. Veja a aba AUDITORIA.');
  return ordem;
}



/* =============================================================================
 * SEMENTES: estratégias já testadas offline (histórico completo, mesma régua, mesmo código de seleção).
 * aplicarSementes_ grava, por moeda ainda sem seleção, a escolha (propriedade SEL_<MOEDA>) e as linhas da aba SELECAO_CANDIDATAS.
 * Não sobrescreve seleção existente. A busca completa de candidatos roda sozinha a cada SELECAO_REFRESH_DIAS dias ou pelo menu S.
 * ===========================================================================*/
const SEMENTES_ALTBTC = {"ETH":{"sel":{"data":"2026-10-17","ids":["Z-E40","Z-N-CCI36","Z-K-FI21","Y-ADX10-30","Z-N-BB50-2"],"w0":"2016-12-14","corte":"2023-11-03","parcial":false,"vagas":0,"naoPlenas":0,"nElig":181,"nTest":3081,"rel":{},"sig":""},"linhas":[["ETH",1,"Z-E40","media","Preço x EMA40",127,1.08,1,0.99,0.2,"PLENA",1.29,0.34,51.1,"ESCOLHIDA #1 (PLENA)","2016-12-14 a 2023-11-03","2026-10-17"],["ETH",2,"Z-N-CCI36","momentum","CCI(36) > 100 (grade fina)",50,1.02,0.91,0.77,0.17,"PLENA",1.24,0.2,47.6,"ESCOLHIDA #2 (PLENA)","2016-12-14 a 2023-11-03","2026-10-17"],["ETH",3,"Z-K-FI21","novas","Índice de Força (21)",135,1.06,0.79,0.97,0.13,"PLENA",1.27,0.24,63.7,"ESCOLHIDA #3 (PLENA)","2016-12-14 a 2023-11-03","2026-10-17"],["ETH",4,"Y-ADX10-30","momentum","ADX(10) > 30 com +DI > -DI",33,0.98,0.88,1.3,0.88,"PLENA",1.12,0.53,42.3,"ESCOLHIDA #4 (PLENA)","2016-12-14 a 2023-11-03","2026-10-17"],["ETH",5,"Z-N-BB50-2","rompimento","Bollinger rompimento (50, 2, grade fina)",21,0.91,0.86,0.83,0.36,"PLENA",1.02,0.55,41.2,"ESCOLHIDA #5 (PLENA)","2016-12-14 a 2023-11-03","2026-10-17"],["ETH","","Z-RSI21-50-50","momentum","RSI(21) regime 50/50",120,1.08,0.99,1,0.24,"PLENA",1.28,0.38,51.5,"correlação 1 com Z-E40","2016-12-14 a 2023-11-03","2026-10-17"],["ETH","","X-EMA40","media","Preço x EMA40",127,1.08,1,0.99,0.2,"PLENA",1.29,0.34,51.1,"classe Preço x média já tem 1 (regra: no máximo 1 da mesma classe)","2016-12-14 a 2023-11-03","2026-10-17"],["ETH","","Z-FS50-RSI21-50","momentum","RSI(21) regime 50/50 + SMA50 (filtro e saída)",106,1,0.88,0.96,0.18,"PLENA",1.16,0.46,49.9,"correlação 0.98 com Z-E40","2016-12-14 a 2023-11-03","2026-10-17"],["ETH","","Z-RSI14-55-50","momentum","RSI(14) regime 55/50",81,1.06,0.84,0.92,0.16,"PLENA",1.24,0.38,55.6,"correlação 0.94 com Z-E40","2016-12-14 a 2023-11-03","2026-10-17"],["ETH","","Z-S40","media","Preço x SMA40",103,1.07,0.8,1.15,0.44,"PLENA",1.25,0.4,61.1,"classe Preço x média já tem 1 (regra: no máximo 1 da mesma classe)","2016-12-14 a 2023-11-03","2026-10-17"],["ETH","","Z-K-EL34","novas","Elder Ray bull power (EMA34)",137,1.05,0.84,0.99,0.16,"PLENA",1.24,0.35,57.6,"correlação 0.97 com Z-E40","2016-12-14 a 2023-11-03","2026-10-17"],["ETH","","X-SMA40","media","Preço x SMA40",103,1.07,0.8,1.15,0.44,"PLENA",1.25,0.4,61.1,"classe Preço x média já tem 1 (regra: no máximo 1 da mesma classe)","2016-12-14 a 2023-11-03","2026-10-17"],["ETH","","Z-F50-RSI21-50","momentum","RSI(21) regime 50/50 + SMA50 (filtro de entrada)",101,0.99,0.86,1.09,0.31,"PLENA",1.14,0.49,50.7,"correlação 0.98 com Z-E40","2016-12-14 a 2023-11-03","2026-10-17"],["ETH","","(resumo)","","3081 candidatos testados; 181 elegíveis (Sharpe do histórico >= 0.6, drawdown, trades); 2900 reprovados não listados; mostrados os 60 melhores. Vagas abertas: 0. Fora do nível PLENA: 0","","","","","","","","","","COMPLETA","2016-12-14 a 2023-11-03","2026-10-17"]]},"BNB":{"sel":{"data":"2026-10-17","ids":["Y-BTC100-emax10-30","Y-CMF20-0.1","Z-N-ST14-1","Z-K-SQ30-2-1.5","Z-RVCCI20-100-50-0"],"w0":"2020-01-15","corte":"2024-10-06","parcial":false,"vagas":0,"naoPlenas":0,"nElig":189,"nTest":3081,"rel":{},"sig":""},"linhas":[["BNB",1,"Y-BTC100-emax10-30","regimeBTC","EMA10 x EMA30 com BTC acima da SMA100",48,1.09,1.58,1.29,0.61,"PLENA",1.16,1.21,31.8,"ESCOLHIDA #1 (PLENA)","2020-01-15 a 2024-10-06","2026-10-17"],["BNB",2,"Y-CMF20-0.1","volume","Fluxo de Chaikin(20) > 0.1",48,1.02,1.14,1.06,0.22,"PLENA",1.07,1.05,42.6,"ESCOLHIDA #2 (PLENA)","2020-01-15 a 2024-10-06","2026-10-17"],["BNB",3,"Z-N-ST14-1","supertrend","Supertrend ATR14 x 1 (grade fina)",88,0.93,0.91,0.81,0.65,"PLENA",1.01,0.76,46.9,"ESCOLHIDA #3 (PLENA)","2020-01-15 a 2024-10-06","2026-10-17"],["BNB",4,"Z-K-SQ30-2-1.5","novas","Squeeze de volatilidade (BB dentro do canal ATR) 30/2/1.5",19,0.86,0.93,0.88,0.01,"PLENA",0.9,0.88,37,"ESCOLHIDA #4 (PLENA)","2020-01-15 a 2024-10-06","2026-10-17"],["BNB",5,"Z-RVCCI20-100-50-0","reversao","CCI(20) < -100 acima da SMA50, sai > SMA5",21,0.81,0.92,0.86,0.58,"PLENA",0.8,0.85,4.4,"ESCOLHIDA #5 (PLENA)","2020-01-15 a 2024-10-06","2026-10-17"],["BNB","","Y-BTC100-sma50","regimeBTC","Preço x SMA50 com BTC acima da SMA100",59,1.07,1.71,1.01,0.14,"PLENA",1.17,0.99,28.6,"correlação 0.98 com Y-BTC100-emax10-30","2020-01-15 a 2024-10-06","2026-10-17"],["BNB","","Z-CMema-0.5-0.5-B100","comite","Comitê ema (entra com 50% dos votos, sai abaixo de 50%) com BTC acima da SMA100",74,1.06,1.51,1.08,0.47,"PLENA",1.12,1.13,31.6,"correlação 0.97 com Y-BTC100-emax10-30","2020-01-15 a 2024-10-06","2026-10-17"],["BNB","","Z-CMema-0.6-0.4-B100","comite","Comitê ema (entra com 60% dos votos, sai abaixo de 40%) com BTC acima da SMA100",58,1.08,1.49,1.06,0.57,"PLENA",1.15,1.06,33.3,"correlação 0.98 com Y-BTC100-emax10-30","2020-01-15 a 2024-10-06","2026-10-17"],["BNB","","Z-CMcurto-0.4-0.2-B100","comite","Comitê curto (entra com 40% dos votos, sai abaixo de 20%) com BTC acima da SMA100",70,1.06,1.15,1.25,1.21,"PLENA",1.08,1.24,43.5,"correlação 0.93 com Y-BTC100-emax10-30","2020-01-15 a 2024-10-06","2026-10-17"],["BNB","","Z-CMcruz-0.5-0.5-B100","comite","Comitê cruz (entra com 50% dos votos, sai abaixo de 50%) com BTC acima da SMA100",42,1.01,1.27,1.1,0.48,"PLENA",1.08,1.08,35,"correlação 0.96 com Y-BTC100-emax10-30","2020-01-15 a 2024-10-06","2026-10-17"],["BNB","","Z-CMmix8-0.6-0.4-B100","comite","Comitê mix8 (entra com 60% dos votos, sai abaixo de 40%) com BTC acima da SMA100",39,1.01,1.49,1.07,0.01,"PLENA",1.09,0.99,29.1,"correlação 0.96 com Y-BTC100-emax10-30","2020-01-15 a 2024-10-06","2026-10-17"],["BNB","","Z-CMema-0.75-0.5-B100","comite","Comitê ema (entra com 75% dos votos, sai abaixo de 50%) com BTC acima da SMA100",52,1.04,1.14,1.19,0.56,"PLENA",1.09,1.24,40.2,"correlação 0.96 com Y-BTC100-emax10-30","2020-01-15 a 2024-10-06","2026-10-17"],["BNB","","Z-CMmix8-0.4-0.2-B100","comite","Comitê mix8 (entra com 40% dos votos, sai abaixo de 20%) com BTC acima da SMA100",41,1,1.15,0.95,0.44,"PLENA",1.08,0.94,38.3,"correlação 0.97 com Y-BTC100-emax10-30","2020-01-15 a 2024-10-06","2026-10-17"],["BNB","","(resumo)","","3081 candidatos testados; 189 elegíveis (Sharpe do histórico >= 0.6, drawdown, trades); 2892 reprovados não listados; mostrados os 60 melhores. Vagas abertas: 0. Fora do nível PLENA: 0","","","","","","","","","","COMPLETA","2020-01-15 a 2024-10-06","2026-10-17"]]},"XRP":{"sel":{"data":"2026-10-17","ids":["Y-BTC100-macd12","Z-RVCCI20-150-200-0","Z-N-KC12-1","Z-P-marubozu100-10"],"w0":"2019-07-02","corte":"2024-08-08","parcial":true,"vagas":1,"naoPlenas":0,"nElig":6,"nTest":3081,"rel":{"Z-P-marubozu100-10":"8 trades"},"sig":""},"linhas":[["XRP",1,"Y-BTC100-macd12","regimeBTC","MACD 12/26/9 com BTC acima da SMA100",67,1,0.97,1.68,0.15,"PLENA",0.84,1.61,58.2,"ESCOLHIDA #1 (PLENA)","2019-07-02 a 2024-08-08","2026-10-17"],["XRP",2,"Z-RVCCI20-150-200-0","reversao","CCI(20) < -150 acima da SMA200, sai > SMA5",22,0.64,0.61,0.69,0,"PLENA",0.51,0.93,10.6,"ESCOLHIDA #2 (PLENA)","2019-07-02 a 2024-08-08","2026-10-17"],["XRP",3,"Z-N-KC12-1","rompimento","Keltner EMA12 + 1 ATR10 (grade fina)",35,0.61,0.44,1.39,0.06,"PLENA",0.4,1.27,46.4,"ESCOLHIDA #3 (PLENA)","2019-07-02 a 2024-08-08","2026-10-17"],["XRP",4,"Z-P-marubozu100-10","padroes","Marubozu de alta acima da SMA100, sai após 10 barras",8,0.79,0.71,1.62,0,"PLENA",0.53,1.55,28.1,"ESCOLHIDA #4 (PLENA, critério relaxado: 8 trades)","2019-07-02 a 2024-08-08","2026-10-17"],["XRP","","Y-BTC200-macd12","regimeBTC","MACD 12/26/9 com BTC acima da SMA200",61,0.81,0.63,1.25,0.09,"PLENA",0.72,1.18,63.6,"classe MACD já tem 1 (regra: no máximo 1 da mesma classe)","2019-07-02 a 2024-08-08","2026-10-17"],["XRP","","Z-N-KC10-1","rompimento","Keltner EMA10 + 1 ATR10 (grade fina)",34,0.61,0.44,1.42,0.19,"PLENA",0.38,1.29,44.5,"classe Keltner já tem 1 (regra: no máximo 1 da mesma classe)","2019-07-02 a 2024-08-08","2026-10-17"],["XRP","","Z-KC10-1","rompimento","Keltner EMA10 + 1 ATR10",34,0.61,0.44,1.42,0.19,"PLENA",0.38,1.29,44.5,"classe Keltner já tem 1 (regra: no máximo 1 da mesma classe)","2019-07-02 a 2024-08-08","2026-10-17"],["XRP","","(resumo)","","3081 candidatos testados; 6 elegíveis (Sharpe do histórico >= 0.6, drawdown, trades); 3074 reprovados não listados; mostrados os 60 melhores. Vagas abertas: 1. Fora do nível PLENA: 0","","","","","","","","","","VAGAS ABERTAS","2019-07-02 a 2024-08-08","2026-10-17"]]},"SOL":{"sel":{"data":"2026-10-17","ids":["Z-N-MACD8-46-7","Y-LR30","Z-P-soldados50-10","Z-FS100-BB20-2"],"w0":"2021-01-21","corte":"2025-01-25","parcial":true,"vagas":1,"naoPlenas":0,"nElig":19,"nTest":3081,"rel":{"Z-FS100-BB20-2":"drawdown 73%"},"sig":""},"linhas":[["SOL",1,"Z-N-MACD8-46-7","momentum","MACD 8/46/7 (histograma, grade fina)",76,1.3,1.56,0.31,0.24,"PLENA",1.56,0.32,54.6,"ESCOLHIDA #1 (PLENA)","2021-01-21 a 2025-01-25","2026-10-17"],["SOL",2,"Y-LR30","media","Regressão linear 30",72,1.26,1.52,0.66,0.78,"PLENA",1.43,0.73,44.8,"ESCOLHIDA #2 (PLENA)","2021-01-21 a 2025-01-25","2026-10-17"],["SOL",3,"Z-P-soldados50-10","padroes","Três soldados brancos acima da SMA50, sai após 10 barras",16,0.87,0.74,0.42,0.77,"PLENA",0.99,0.48,31.3,"ESCOLHIDA #3 (PLENA)","2021-01-21 a 2025-01-25","2026-10-17"],["SOL",4,"Z-FS100-BB20-2","rompimento","Bollinger rompimento (20, 2) + SMA100 (filtro e saída)",35,0.83,0.49,0.34,0.72,"PLENA",0.95,0.47,72.5,"ESCOLHIDA #4 (PLENA, critério relaxado: drawdown 73%)","2021-01-21 a 2025-01-25","2026-10-17"],["SOL","","Z-N-MACD6-46-9","momentum","MACD 6/46/9 (histograma, grade fina)",78,1.3,1.5,0.32,0.24,"PLENA",1.56,0.32,56.9,"classe MACD já tem 1 (regra: no máximo 1 da mesma classe)","2021-01-21 a 2025-01-25","2026-10-17"],["SOL","","Z-N-MACD8-39-7","momentum","MACD 8/39/7 (histograma, grade fina)",76,1.31,1.45,0.33,0.15,"PLENA",1.57,0.34,59.4,"classe MACD já tem 1 (regra: no máximo 1 da mesma classe)","2021-01-21 a 2025-01-25","2026-10-17"],["SOL","","Z-N-MACD10-46-5","momentum","MACD 10/46/5 (histograma, grade fina)",80,1.3,1.55,0.34,0.2,"PLENA",1.55,0.35,54.5,"classe MACD já tem 1 (regra: no máximo 1 da mesma classe)","2021-01-21 a 2025-01-25","2026-10-17"],["SOL","","Z-N-MACD6-39-9","momentum","MACD 6/39/9 (histograma, grade fina)",80,1.28,1.41,0.34,0.14,"PLENA",1.52,0.36,58,"classe MACD já tem 1 (regra: no máximo 1 da mesma classe)","2021-01-21 a 2025-01-25","2026-10-17"],["SOL","","Z-N-MACD6-42-9","momentum","MACD 6/42/9 (histograma, grade fina)",79,1.28,1.38,0.36,0.15,"PLENA",1.53,0.38,60,"classe MACD já tem 1 (regra: no máximo 1 da mesma classe)","2021-01-21 a 2025-01-25","2026-10-17"],["SOL","","Z-N-MACD4-46-9","momentum","MACD 4/46/9 (histograma, grade fina)",92,1.27,1.33,0.33,0.35,"PLENA",1.52,0.29,60.9,"classe MACD já tem 1 (regra: no máximo 1 da mesma classe)","2021-01-21 a 2025-01-25","2026-10-17"],["SOL","","Z-MACD5-52-9","momentum","MACD 5/52/9 (histograma)",81,1.24,1.25,0.39,0.22,"PLENA",1.47,0.41,62.2,"classe MACD já tem 1 (regra: no máximo 1 da mesma classe)","2021-01-21 a 2025-01-25","2026-10-17"],["SOL","","Z-N-MACD5-50-9","momentum","MACD 5/50/9 (histograma, grade fina)",82,1.24,1.23,0.35,0.21,"PLENA",1.47,0.36,62.9,"classe MACD já tem 1 (regra: no máximo 1 da mesma classe)","2021-01-21 a 2025-01-25","2026-10-17"],["SOL","","(resumo)","","3081 candidatos testados; 19 elegíveis (Sharpe do histórico >= 0.6, drawdown, trades); 3061 reprovados não listados; mostrados os 60 melhores. Vagas abertas: 1. Fora do nível PLENA: 0","","","","","","","","","","VAGAS ABERTAS","2021-01-21 a 2025-01-25","2026-10-17"]]},"TRX":{"sel":{"data":"2026-10-17","ids":["Z-RVWR10-90-100-1","Z-RVRSI5-30-50-2","Z-K-KST1.5-9"],"w0":"2019-04-22","corte":"2024-07-17","parcial":true,"vagas":2,"naoPlenas":0,"nElig":3,"nTest":3081,"rel":{},"sig":""},"linhas":[["TRX",1,"Z-RVWR10-90-100-1","reversao","Williams %R(10) < -90 acima da SMA100, sai > SMA10",27,0.71,0.51,1.71,2.97,"PLENA",0.29,1.25,13.6,"ESCOLHIDA #1 (PLENA)","2019-04-22 a 2024-07-17","2026-10-17"],["TRX",2,"Z-RVRSI5-30-50-2","reversao","RSI(5) < 30 acima da SMA50, sai > máxima anterior",25,0.63,0.34,0.45,1.64,"PLENA",0.7,0.38,24.5,"ESCOLHIDA #2 (PLENA)","2019-04-22 a 2024-07-17","2026-10-17"],["TRX",3,"Z-K-KST1.5-9","novas","KST (escala 1.5, sinal 9)",57,0.62,0.5,0.46,0.03,"PLENA",0.75,0.42,49.8,"ESCOLHIDA #3 (PLENA)","2019-04-22 a 2024-07-17","2026-10-17"],["TRX","","(resumo)","","3081 candidatos testados; 3 elegíveis (Sharpe do histórico >= 0.6, drawdown, trades); 3078 reprovados não listados; mostrados os 60 melhores. Vagas abertas: 2. Fora do nível PLENA: 0","","","","","","","","","","VAGAS ABERTAS","2019-04-22 a 2024-07-17","2026-10-17"]]},"ZEC":{"sel":{"data":"2026-10-17","ids":["Z-F150-SMA20","Y-LR100","Z-F150-BB20-2","Z-N-CCI42","Z-FS150-KC20-2"],"w0":"2020-01-29","corte":"2024-10-10","parcial":false,"vagas":0,"naoPlenas":0,"nElig":264,"nTest":3081,"rel":{},"sig":""},"linhas":[["ZEC",1,"Z-F150-SMA20","media","Preço x SMA20 + SMA150 (filtro de entrada)",55,1.06,1.25,1.95,2.28,"PLENA",0.32,1.94,52.7,"ESCOLHIDA #1 (PLENA)","2020-01-29 a 2024-10-10","2026-10-17"],["ZEC",2,"Y-LR100","media","Regressão linear 100",26,1.17,1.09,2.14,2.43,"PLENA",0.37,2.12,64.2,"ESCOLHIDA #2 (PLENA)","2020-01-29 a 2024-10-10","2026-10-17"],["ZEC",3,"Z-F150-BB20-2","rompimento","Bollinger rompimento (20, 2) + SMA150 (filtro de entrada)",24,1.05,1.13,1.87,1.97,"PLENA",0.41,1.86,53.4,"ESCOLHIDA #3 (PLENA)","2020-01-29 a 2024-10-10","2026-10-17"],["ZEC",4,"Z-N-CCI42","momentum","CCI(42) > 100 (grade fina)",22,1.02,1.11,1.82,2.04,"PLENA",0.44,1.81,55.5,"ESCOLHIDA #4 (PLENA)","2020-01-29 a 2024-10-10","2026-10-17"],["ZEC",5,"Z-FS150-KC20-2","rompimento","Keltner EMA20 + 2 ATR + SMA150 (filtro e saída)",15,0.98,1.05,1.75,1.89,"PLENA",0.39,1.74,48.3,"ESCOLHIDA #5 (PLENA)","2020-01-29 a 2024-10-10","2026-10-17"],["ZEC","","Y-LR75","media","Regressão linear 75",33,1.05,1.21,1.73,1.88,"PLENA",0.55,1.72,48.7,"classe Regressão linear já tem 1 (regra: no máximo 1 da mesma classe)","2020-01-29 a 2024-10-10","2026-10-17"],["ZEC","","Z-FS100-BB20-2","rompimento","Bollinger rompimento (20, 2) + SMA100 (filtro e saída)",29,1.04,1.09,1.92,2.25,"PLENA",0.35,1.9,54.7,"classe Bollinger já tem 1 (regra: no máximo 1 da mesma classe)","2020-01-29 a 2024-10-10","2026-10-17"],["ZEC","","Z-F150-BB20-2.5","rompimento","Bollinger rompimento (20, 2.5) + SMA150 (filtro de entrada)",19,1.05,1.05,1.82,2.33,"PLENA",0.49,1.81,55.5,"classe Bollinger já tem 1 (regra: no máximo 1 da mesma classe)","2020-01-29 a 2024-10-10","2026-10-17"],["ZEC","","Z-FS100-SMA20","media","Preço x SMA20 + SMA100 (filtro e saída)",66,1.05,1.02,2.02,2.5,"PLENA",0.29,2.01,62.5,"classe Preço x média já tem 1 (regra: no máximo 1 da mesma classe)","2020-01-29 a 2024-10-10","2026-10-17"],["ZEC","","Z-N-BB18-3","rompimento","Bollinger rompimento (18, 3, grade fina)",15,1.08,0.98,2.25,2.45,"PLENA",0.06,2.24,58.9,"classe Bollinger já tem 1 (regra: no máximo 1 da mesma classe)","2020-01-29 a 2024-10-10","2026-10-17"],["ZEC","","Z-F100-BB20-2","rompimento","Bollinger rompimento (20, 2) + SMA100 (filtro de entrada)",28,1.03,1.04,1.97,2.25,"PLENA",0.26,1.96,56.5,"classe Bollinger já tem 1 (regra: no máximo 1 da mesma classe)","2020-01-29 a 2024-10-10","2026-10-17"],["ZEC","","Z-FS100-VWAP20","vwap","Preço x VWAP 20 + SMA100 (filtro e saída)",64,1.05,1,2.05,2.56,"PLENA",0.25,2.04,62.7,"correlação 0.93 com Z-F150-SMA20","2020-01-29 a 2024-10-10","2026-10-17"],["ZEC","","Z-N-CCI44","momentum","CCI(44) > 100 (grade fina)",22,1.01,1.06,1.8,2.02,"PLENA",0.47,1.77,58,"classe CCI já tem 1 (regra: no máximo 1 da mesma classe)","2020-01-29 a 2024-10-10","2026-10-17"],["ZEC","","(resumo)","","3081 candidatos testados; 264 elegíveis (Sharpe do histórico >= 0.6, drawdown, trades); 2817 reprovados não listados; mostrados os 60 melhores. Vagas abertas: 0. Fora do nível PLENA: 0","","","","","","","","","","COMPLETA","2020-01-29 a 2024-10-10","2026-10-17"]]},"HYPE":{"sel":{"data":"2026-10-17","ids":["Z-K-ZL20","Z-K-KST1-5","Z-N-ST14-1.5","Z-RSI14-55-45","Z-RVCCI20-150-150-2"],"w0":"2025-07-21","corte":"2026-06-02","parcial":false,"vagas":0,"naoPlenas":0,"nElig":1978,"nTest":3081,"rel":{},"sig":""},"linhas":[["HYPE",1,"Z-K-ZL20","novas","ZLEMA (20) inclinação",30,2.07,8,2.07,2.16,"PLENA",2.81,-0.09,22.4,"ESCOLHIDA #1 (PLENA)","2025-07-21 a 2026-06-02","2026-10-17"],["HYPE",2,"Z-K-KST1-5","novas","KST (escala 1, sinal 5)",11,2.16,6.98,2.16,2.21,"PLENA",2.71,0.39,31,"ESCOLHIDA #2 (PLENA)","2025-07-21 a 2026-06-02","2026-10-17"],["HYPE",3,"Z-N-ST14-1.5","supertrend","Supertrend ATR14 x 1.5 (grade fina)",8,2,6.39,2,2.37,"PLENA",2.71,-0.16,26.7,"ESCOLHIDA #3 (PLENA)","2025-07-21 a 2026-06-02","2026-10-17"],["HYPE",4,"Z-RSI14-55-45","momentum","RSI(14) regime 55/45",5,1.88,7.02,1.88,2.12,"PLENA",2.37,0.61,25.5,"ESCOLHIDA #4 (PLENA)","2025-07-21 a 2026-06-02","2026-10-17"],["HYPE",5,"Z-RVCCI20-150-150-2","reversao","CCI(20) < -150 acima da SMA150, sai > máxima anterior",7,1.88,8.91,1.88,1.59,"PLENA",1.86,2.05,5,"ESCOLHIDA #5 (PLENA)","2025-07-21 a 2026-06-02","2026-10-17"],["HYPE","","Z-ST14-1.5","supertrend","Supertrend ATR14 x 1.5",8,2,6.39,2,2.37,"PLENA",2.71,-0.16,26.7,"classe Supertrend já tem 1 (regra: no máximo 1 da mesma classe)","2025-07-21 a 2026-06-02","2026-10-17"],["HYPE","","Z-N-ST12-1.5","supertrend","Supertrend ATR12 x 1.5 (grade fina)",8,1.99,6.44,1.99,2.35,"PLENA",2.69,-0.16,26.7,"classe Supertrend já tem 1 (regra: no máximo 1 da mesma classe)","2025-07-21 a 2026-06-02","2026-10-17"],["HYPE","","X-ST14-1.5","supertrend","Supertrend ATR14 x 1.5",8,2,6.39,2,2.37,"PLENA",2.71,-0.16,26.7,"classe Supertrend já tem 1 (regra: no máximo 1 da mesma classe)","2025-07-21 a 2026-06-02","2026-10-17"],["HYPE","","Z-N-MACD5-42-5","momentum","MACD 5/42/5 (histograma, grade fina)",28,1.95,6.05,1.95,2.15,"PLENA",2.62,-0.03,28.2,"correlação 0.95 com Z-K-ZL20","2025-07-21 a 2026-06-02","2026-10-17"],["HYPE","","T-31","momentum","RSI(14) regime 55/45",5,1.88,7.02,1.88,2.12,"PLENA",2.37,0.61,25.5,"elegível (PLENA), não escolhida","2025-07-21 a 2026-06-02","2026-10-17"],["HYPE","","Z-RSI10-60-40","momentum","RSI(10) regime 60/40",5,1.88,7.02,1.88,2.12,"PLENA",2.37,0.61,25.5,"elegível (PLENA), não escolhida","2025-07-21 a 2026-06-02","2026-10-17"],["HYPE","","Z-N-MACD5-46-5","momentum","MACD 5/46/5 (histograma, grade fina)",28,1.9,5.72,1.9,2.08,"PLENA",2.56,-0.07,28.2,"elegível (PLENA), não escolhida","2025-07-21 a 2026-06-02","2026-10-17"],["HYPE","","Z-RVIBS0.2-150-2","reversao","IBS < 0.2 acima da SMA150, sai > máxima anterior",38,1.9,5.62,1.9,2.57,"PLENA",1.86,2,22.2,"elegível (PLENA), não escolhida","2025-07-21 a 2026-06-02","2026-10-17"],["HYPE","","(resumo)","","3081 candidatos testados; 1978 elegíveis (Sharpe do histórico >= 0.6, drawdown, trades); 1103 reprovados não listados; mostrados os 60 melhores. Vagas abertas: 0. Fora do nível PLENA: 0","","","","","","","","","","COMPLETA","2025-07-21 a 2026-06-02","2026-10-17"]]},"DOGE":{"sel":{"data":"2026-10-17","ids":["Z-P-engolfo200-m20","Z-P-inside200-3","Z-FS100-KC20-2","Z-F200-BB20-2"],"w0":"2018-05-21","corte":"2024-04-08","parcial":true,"vagas":1,"naoPlenas":0,"nElig":17,"nTest":3081,"rel":{"Z-F200-BB20-2":"correlação 0.96 com Z-FS100-KC20-2"},"sig":""},"linhas":[["DOGE",1,"Z-P-engolfo200-m20","padroes","Engolfo de alta acima da SMA200, sai abaixo da SMA20",39,0.7,0.58,0.9,0,"PLENA",0.75,0.73,56.5,"ESCOLHIDA #1 (PLENA)","2018-05-21 a 2024-04-08","2026-10-17"],["DOGE",2,"Z-P-inside200-3","padroes","Inside bar rompendo a máxima acima da SMA200, sai após 3 barras",16,0.62,0.67,0.66,0,"PLENA",0.71,0.75,36.4,"ESCOLHIDA #2 (PLENA)","2018-05-21 a 2024-04-08","2026-10-17"],["DOGE",3,"Z-FS100-KC20-2","rompimento","Keltner EMA20 + 2 ATR + SMA100 (filtro e saída)",19,0.63,0.42,0.75,0,"PLENA",0.68,0.67,63.4,"ESCOLHIDA #3 (PLENA)","2018-05-21 a 2024-04-08","2026-10-17"],["DOGE",4,"Z-F200-BB20-2","rompimento","Bollinger rompimento (20, 2) + SMA200 (filtro de entrada)",28,0.62,0.41,0.75,0,"PLENA",0.69,0.52,64.3,"ESCOLHIDA #4 (PLENA, critério relaxado: correlação 0.96 com Z-FS100-KC20-2)","2018-05-21 a 2024-04-08","2026-10-17"],["DOGE","","Z-P-inside100-5","padroes","Inside bar rompendo a máxima acima da SMA100, sai após 5 barras",19,0.62,0.67,1.13,0,"PLENA",0.7,0.77,36.2,"classe Inside bar já tem 1 (regra: no máximo 1 da mesma classe)","2018-05-21 a 2024-04-08","2026-10-17"],["DOGE","","Z-P-inside100-3","padroes","Inside bar rompendo a máxima acima da SMA100, sai após 3 barras",19,0.61,0.7,0.66,0,"PLENA",0.7,0.75,34,"classe Inside bar já tem 1 (regra: no máximo 1 da mesma classe)","2018-05-21 a 2024-04-08","2026-10-17"],["DOGE","","M2-03","rompimento","Bollinger Squeeze (20, 2.25) + SMA200",20,0.62,0.42,0.71,0,"PLENA",0.68,0.6,60.6,"correlação 0.98 com Z-FS100-KC20-2","2018-05-21 a 2024-04-08","2026-10-17"],["DOGE","","Z-FS150-KC20-2","rompimento","Keltner EMA20 + 2 ATR + SMA150 (filtro e saída)",19,0.62,0.39,0.96,0,"PLENA",0.64,0.85,67,"classe Keltner já tem 1 (regra: no máximo 1 da mesma classe)","2018-05-21 a 2024-04-08","2026-10-17"],["DOGE","","Z-FS150-BB20-2","rompimento","Bollinger rompimento (20, 2) + SMA150 (filtro e saída)",34,0.61,0.38,1.1,0,"PLENA",0.63,0.84,67,"correlação 0.96 com Z-FS100-KC20-2","2018-05-21 a 2024-04-08","2026-10-17"],["DOGE","","Z-F100-KC20-2","rompimento","Keltner EMA20 + 2 ATR + SMA100 (filtro de entrada)",19,0.61,0.38,0.72,0,"PLENA",0.66,0.64,67,"classe Keltner já tem 1 (regra: no máximo 1 da mesma classe)","2018-05-21 a 2024-04-08","2026-10-17"],["DOGE","","Z-P-inside100-10","padroes","Inside bar rompendo a máxima acima da SMA100, sai após 10 barras",17,0.6,0.46,0.96,0,"PLENA",0.68,0.74,52,"classe Inside bar já tem 1 (regra: no máximo 1 da mesma classe)","2018-05-21 a 2024-04-08","2026-10-17"],["DOGE","","Z-FS200-BB20-2","rompimento","Bollinger rompimento (20, 2) + SMA200 (filtro e saída)",30,0.61,0.4,0.61,0,"PLENA",0.69,0.39,62.6,"correlação 0.96 com Z-FS100-KC20-2","2018-05-21 a 2024-04-08","2026-10-17"],["DOGE","","(resumo)","","3081 candidatos testados; 17 elegíveis (Sharpe do histórico >= 0.6, drawdown, trades); 3064 reprovados não listados; mostrados os 60 melhores. Vagas abertas: 1. Fora do nível PLENA: 0","","","","","","","","","","VAGAS ABERTAS","2018-05-21 a 2024-04-08","2026-10-17"]]},"LINK":{"sel":{"data":"2026-10-17","ids":["Z-P-engolfo50-m10","Z-P-soldados50-10","Z-K-PV2-10","X-SMAX8-50","Z-ROC30-200"],"w0":"2018-06-08","corte":"2024-04-13","parcial":false,"vagas":0,"naoPlenas":0,"nElig":28,"nTest":3081,"rel":{},"sig":""},"linhas":[["LINK",1,"Z-P-engolfo50-m10","padroes","Engolfo de alta acima da SMA50, sai abaixo da SMA10",63,0.9,1.25,0.4,0.19,"PLENA",1.07,0.36,29.2,"ESCOLHIDA #1 (PLENA)","2018-06-08 a 2024-04-13","2026-10-17"],["LINK",2,"Z-P-soldados50-10","padroes","Três soldados brancos acima da SMA50, sai após 10 barras",13,0.98,1.09,0.97,1.2,"PLENA",1.03,0.86,21.3,"ESCOLHIDA #2 (PLENA)","2018-06-08 a 2024-04-13","2026-10-17"],["LINK",3,"Z-K-PV2-10","novas","Pico de volume 2x com preço acima da EMA10",70,0.74,0.56,0.41,0.83,"PLENA",0.83,0.48,52.9,"ESCOLHIDA #3 (PLENA)","2018-06-08 a 2024-04-13","2026-10-17"],["LINK",4,"X-SMAX8-50","cruzamento","Cruzamento SMA8 x SMA50",39,0.73,0.61,0.51,0.08,"PLENA",0.86,0.29,52.4,"ESCOLHIDA #4 (PLENA)","2018-06-08 a 2024-04-13","2026-10-17"],["LINK",5,"Z-ROC30-200","momentum","Retorno de 30d > 0 acima da SMA200",67,0.72,0.47,0.48,0.48,"PLENA",0.82,0.43,65.9,"ESCOLHIDA #5 (PLENA)","2018-06-08 a 2024-04-13","2026-10-17"],["LINK","","Z-P-engolfo100-m10","padroes","Engolfo de alta acima da SMA100, sai abaixo da SMA10",66,0.82,0.85,0.66,0.54,"PLENA",0.9,0.59,36.3,"classe Engolfo de alta já tem 1 (regra: no máximo 1 da mesma classe)","2018-06-08 a 2024-04-13","2026-10-17"],["LINK","","Z-P-engolfo200-m10","padroes","Engolfo de alta acima da SMA200, sai abaixo da SMA10",65,0.82,0.81,0.63,0.45,"PLENA",0.91,0.57,46.9,"classe Engolfo de alta já tem 1 (regra: no máximo 1 da mesma classe)","2018-06-08 a 2024-04-13","2026-10-17"],["LINK","","Z-P-engolfo50-5","padroes","Engolfo de alta acima da SMA50, sai após 5 barras",69,0.78,0.68,0.31,0.41,"PLENA",0.94,0.28,39.7,"classe Engolfo de alta já tem 1 (regra: no máximo 1 da mesma classe)","2018-06-08 a 2024-04-13","2026-10-17"],["LINK","","Z-P-engolfo50-2","padroes","Engolfo de alta acima da SMA50, sai após 2 barras",82,0.76,0.71,0.85,0.35,"PLENA",0.76,0.76,25.4,"classe Engolfo de alta já tem 1 (regra: no máximo 1 da mesma classe)","2018-06-08 a 2024-04-13","2026-10-17"],["LINK","","Z-K-AO8-50-0","novas","Awesome Oscillator 8/50",42,0.73,0.55,0.43,0.11,"PLENA",0.87,0.24,57.7,"correlação 0.99 com X-SMAX8-50","2018-06-08 a 2024-04-13","2026-10-17"],["LINK","","Z-P-engolfo50-3","padroes","Engolfo de alta acima da SMA50, sai após 3 barras",78,0.7,0.71,0.6,0.63,"PLENA",0.75,0.54,30.7,"classe Engolfo de alta já tem 1 (regra: no máximo 1 da mesma classe)","2018-06-08 a 2024-04-13","2026-10-17"],["LINK","","Z-F200-ROC30","momentum","ROC 30d + SMA200 (filtro de entrada)",67,0.72,0.47,0.48,0.48,"PLENA",0.82,0.43,65.9,"elegível (PLENA), não escolhida","2018-06-08 a 2024-04-13","2026-10-17"],["LINK","","Z-FS100-ROC30","momentum","ROC 30d + SMA100 (filtro e saída)",85,0.72,0.46,0.6,0.25,"PLENA",0.81,0.45,67.4,"elegível (PLENA), não escolhida","2018-06-08 a 2024-04-13","2026-10-17"],["LINK","","(resumo)","","3081 candidatos testados; 28 elegíveis (Sharpe do histórico >= 0.6, drawdown, trades); 3053 reprovados não listados; mostrados os 60 melhores. Vagas abertas: 0. Fora do nível PLENA: 0","","","","","","","","","","COMPLETA","2018-06-08 a 2024-04-13","2026-10-17"]]},"AAVE":{"sel":{"data":"2026-10-17","ids":["Z-RVQ3-50-1","Z-RVMIN10-150-2","Z-RVRSI2-10-150-2","Z-RVCCI20-150-150-2","Z-RVWR14-80-150-2"],"w0":"2021-05-05","corte":"2025-02-26","parcial":false,"vagas":0,"naoPlenas":0,"nElig":54,"nTest":3081,"rel":{},"sig":""},"linhas":[["AAVE",1,"Z-RVQ3-50-1","reversao","3 quedas seguidas acima da SMA50, sai > SMA10",43,0.89,1.09,0.84,0.14,"PLENA",1.1,0.17,22.2,"ESCOLHIDA #1 (PLENA)","2021-05-05 a 2025-02-26","2026-10-17"],["AAVE",2,"Z-RVMIN10-150-2","reversao","Fecha abaixo da mínima de 10d acima da SMA150, sai > máxima anterior",15,0.88,1.14,1.34,0.79,"PLENA",0.84,0.96,11.4,"ESCOLHIDA #2 (PLENA)","2021-05-05 a 2025-02-26","2026-10-17"],["AAVE",3,"Z-RVRSI2-10-150-2","reversao","RSI(2) < 10 acima da SMA150, sai > máxima anterior",31,0.92,1.02,0.91,1.13,"PLENA",0.98,0.82,26.1,"ESCOLHIDA #3 (PLENA)","2021-05-05 a 2025-02-26","2026-10-17"],["AAVE",4,"Z-RVCCI20-150-150-2","reversao","CCI(20) < -150 acima da SMA150, sai > máxima anterior",12,1.01,1.01,1.39,0.98,"PLENA",0.93,1.26,11.4,"ESCOLHIDA #4 (PLENA)","2021-05-05 a 2025-02-26","2026-10-17"],["AAVE",5,"Z-RVWR14-80-150-2","reversao","Williams %R(14) < -80 acima da SMA150, sai > máxima anterior",26,0.86,1.04,0.91,1.13,"PLENA",0.83,1.01,18.5,"ESCOLHIDA #5 (PLENA)","2021-05-05 a 2025-02-26","2026-10-17"],["AAVE","","Z-RVQ4-150-2","reversao","4 quedas seguidas acima da SMA150, sai > máxima anterior",25,0.88,0.9,0.8,1.07,"PLENA",0.9,0.81,21.2,"elegível (PLENA), não escolhida","2021-05-05 a 2025-02-26","2026-10-17"],["AAVE","","Z-RVRSI2-10-100-2","reversao","RSI(2) < 10 acima da SMA100, sai > máxima anterior",27,0.86,0.88,0.81,1.13,"PLENA",0.91,0.77,26.1,"elegível (PLENA), não escolhida","2021-05-05 a 2025-02-26","2026-10-17"],["AAVE","","Z-P-engolfo50-2","padroes","Engolfo de alta acima da SMA50, sai após 2 barras",55,0.81,0.95,1.08,0.96,"PLENA",0.81,0.83,19,"elegível (PLENA), não escolhida","2021-05-05 a 2025-02-26","2026-10-17"],["AAVE","","Z-RVRSI4-25-150-2","reversao","RSI(4) < 25 acima da SMA150, sai > máxima anterior",24,0.86,0.81,0.87,1.06,"PLENA",0.85,0.92,23.3,"elegível (PLENA), não escolhida","2021-05-05 a 2025-02-26","2026-10-17"],["AAVE","","Z-RVQ3-100-1","reversao","3 quedas seguidas acima da SMA100, sai > SMA10",42,0.89,0.72,1.13,1.18,"PLENA",0.91,0.87,37,"elegível (PLENA), não escolhida","2021-05-05 a 2025-02-26","2026-10-17"],["AAVE","","Z-RVWR14-90-150-2","reversao","Williams %R(14) < -90 acima da SMA150, sai > máxima anterior",12,0.76,1.06,1.15,0.71,"PLENA",0.67,0.92,9,"elegível (PLENA), não escolhida","2021-05-05 a 2025-02-26","2026-10-17"],["AAVE","","Z-RVCCI20-150-150-0","reversao","CCI(20) < -150 acima da SMA150, sai > SMA5",12,0.84,0.8,1.15,0.98,"PLENA",0.73,1.17,11.4,"elegível (PLENA), não escolhida","2021-05-05 a 2025-02-26","2026-10-17"],["AAVE","","Z-P-engolfo100-2","padroes","Engolfo de alta acima da SMA100, sai após 2 barras",46,0.77,1,1.03,0.93,"PLENA",0.79,0.73,16.5,"elegível (PLENA), não escolhida","2021-05-05 a 2025-02-26","2026-10-17"],["AAVE","","(resumo)","","3081 candidatos testados; 54 elegíveis (Sharpe do histórico >= 0.6, drawdown, trades); 3027 reprovados não listados; mostrados os 60 melhores. Vagas abertas: 0. Fora do nível PLENA: 0","","","","","","","","","","COMPLETA","2021-05-05 a 2025-02-26","2026-10-17"]]}};

function aplicarSementes_() {
  const props = PropertiesService.getScriptProperties(), sh = ss_().getSheetByName(P2.ABAS.sel); let k = 0, linhas = [];
  Object.keys(SEMENTES_ALTBTC).forEach(function (sym) {
    const s = SEMENTES_ALTBTC[sym]; if (props.getProperty('SEL_' + sym)) return;
    props.setProperty('SEL_' + sym, JSON.stringify(s.sel)); linhas = linhas.concat(s.linhas); k++;
  });
  if (!k || !sh) return k;
  const ja = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, COLS_SELECAO.length).getValues() : [], todas = ja.concat(linhas);
  sh.clear();
  sh.getRange(1, 1, 1, COLS_SELECAO.length).setValues([COLS_SELECAO]).setFontWeight('bold').setBackground('#0b1f3a').setFontColor('#ffffff').setWrap(true);
  sh.getRange(2, 16, todas.length, 2).setNumberFormat('@');
  sh.getRange(2, 1, todas.length, COLS_SELECAO.length).setValues(todas);
  todas.forEach(function (r, i) { if (r[1] !== '') sh.getRange(i + 2, 1, 1, COLS_SELECAO.length).setBackground('#e6f4ea'); });
  sh.setFrozenRows(1); sh.setColumnWidth(5, 330); sh.setColumnWidth(15, 280); sh.setColumnWidth(16, 170);
  return k;
}

function safeToast_(m) { try { ss_().toast(m, 'Alts/BTC', 6); } catch (e) {} Logger.log(m); }
function r_(v, d) { if (v === null || v === undefined || typeof v !== 'number' || !isFinite(v)) return ''; const f = Math.pow(10, d === undefined ? 2 : d); return Math.round(v * f) / f; }

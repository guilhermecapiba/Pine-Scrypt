/* =============================================================================
 * 5. FONTES DE DADOS — adaptadores por corretora (candles diários UTC)
 *    Cada adaptador devolve [{date, open, high, low, close, volume}]. o.dias = baixa só os últimos N dias
 *    (atualização incremental e diagnóstico); sem o.dias baixa todo o histórico disponível.
 * ===========================================================================*/
const MS_DIA = 86400000;

function candle_(ts, o, h, l, c, v) { return { date: new Date(ts), open: +o, high: +h, low: +l, close: +c, volume: +v || 0 }; }

function fetchBinance_(par, o, host) {
  const base = (host || 'https://data-api.binance.vision/api/v3/klines') + '?symbol=' + par + '&interval=1d&limit=1000';
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
function fetchMexc_(par, o) { return fetchBinance_(par, o, 'https://api.mexc.com/api/v3/klines'); }
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
function baixarSerieAtivo_(u, o, minVelas) {
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


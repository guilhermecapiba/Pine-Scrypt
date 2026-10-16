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

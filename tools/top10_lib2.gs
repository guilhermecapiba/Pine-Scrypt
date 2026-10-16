/* =============================================================================
 * 2C. BUSCA ESTENDIDA — famílias adicionais de candidatos (indicadores, filtro de regime do BTC, stops por ATR,
 *     reversão com filtro de tendência, volume). Só roda quando o conjunto base e a grade da seção 2 não completam as vagas.
 *     Todas são causais: o sinal da vela D usa só dados até o fechamento de D; a execução é na abertura de D+1.
 * ===========================================================================*/
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

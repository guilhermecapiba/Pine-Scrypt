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

const W = require('./wf.js'); const { SYMS, carregar, perf } = W;
// reimplementa seleção parametrizada com mais opções
const H = 90, W0 = 210;
function sharpe(r) { if (r.length < 30) return null; const mu = r.reduce((a, b) => a + b, 0) / r.length, sd = Math.sqrt(r.reduce((a, b) => a + (b - mu) ** 2, 0) / r.length); return sd > 0 ? mu / sd * Math.sqrt(365) : 0; }
function rets(eq, a, b) { const x = []; for (let i = Math.max(1, a); i < b; i++) x.push(eq[i] / eq[i - 1] - 1); return x; }
function corr(x, y) { const n = Math.min(x.length, y.length); let sx = 0, sy = 0; for (let i = 0; i < n; i++) { sx += x[i]; sy += y[i]; } const mx = sx / n, my = sy / n; let a = 0, b = 0, c = 0; for (let i = 0; i < n; i++) { a += (x[i] - mx) * (y[i] - my); b += (x[i] - mx) ** 2; c += (y[i] - my) ** 2; } return b > 0 && c > 0 ? a / Math.sqrt(b * c) : 0; }
function pct(v) { const idx = v.map((x, i) => i).sort((a, b) => v[a] - v[b]), o = new Array(v.length); idx.forEach((k, p) => o[k] = v.length > 1 ? p / (v.length - 1) : 1); return o; }
function ntr(c, a, b) { let k = 0; c.tr.forEach(t => { if (t[0] >= a && t[0] < b) k++; }); return k; }
let seed = 7; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
function cal(eq, a, b) { let peak = 1, dd = 0; const e0 = eq[a]; for (let i = a; i < b; i++) { const v = eq[i] / e0; if (v > peak) peak = v; dd = Math.max(dd, (peak - v) / peak * 100); } const y = (b - a) / 365.25, cg = (Math.pow(eq[b - 1] / e0, 1 / y) - 1) * 100; return dd > 0 ? cg / dd : 0; }
function sel(cands, T, p, btcOk) {
  const cut = W0 + Math.floor((T - W0) * p.isFrac), minTr = Math.max(5, Math.min(p.minTr || 12, Math.round((cut - W0) / 365.25 * 2)));
  if (p.random) { const a = cands.slice(); const pk = []; while (pk.length < p.n) pk.push({ c: a.splice(Math.floor(rnd() * a.length), 1)[0] }); return pk; }
  const rows = [];
  cands.forEach(c => {
    if (p.fams && p.fams.indexOf(c.fam) < 0) return;
    const sh = sharpe(rets(c.eq, W0 + 1, cut)); if (sh === null) return;
    if (ntr(c, W0, cut) < minTr) return; if (sh < (p.minIS === undefined ? -9 : p.minIS)) return;
    const s24 = sharpe(rets(c.eq, Math.max(W0 + 1, T - 730), T)), s12 = sharpe(rets(c.eq, Math.max(W0 + 1, T - 365), T));
    if (p.s24 !== undefined && s24 < p.s24) return; if (p.s12 !== undefined && s12 < p.s12) return;
    // robustez: Sharpe mínimo entre terços do treino
    const L = T - W0, t1 = W0 + L / 3 | 0, t2 = W0 + 2 * L / 3 | 0; const th = [sharpe(rets(c.eq, W0 + 1, t1)), sharpe(rets(c.eq, t1, t2)), sharpe(rets(c.eq, t2, T))];
    const minTerco = Math.min.apply(null, th.map(x => x === null ? 0 : x));
    rows.push({ c, sh, cal: cal(c.eq, W0, cut), s24, s12, shFull: sharpe(rets(c.eq, W0 + 1, T)), calFull: cal(c.eq, W0, T), minTerco, medTerco: th.reduce((a, b) => a + (b || 0), 0) / 3 });
  });
  if (!rows.length) return [];
  const R = { is: [r => r.sh, r => r.cal], full: [r => r.shFull, r => r.calFull], shOnly: [r => r.sh, r => r.sh], robust: [r => r.minTerco, r => r.medTerco], s24: [r => r.s24, r => r.sh], mix: [r => r.shFull, r => r.minTerco] }[p.rank];
  const a = pct(rows.map(R[0])), b = pct(rows.map(R[1])); rows.forEach((r, i) => r.nota = (a[i] + b[i]) / 2); rows.sort((x, y) => y.nota - x.nota);
  const pk = [], fam = {};
  for (const r of rows) { if (pk.length >= p.n) break; if ((fam[r.c.fam] || 0) >= p.fam) continue; r.rr = rets(r.c.eq, W0 + 1, cut); if (pk.some(q => corr(q.rr, r.rr) > p.corr)) continue; pk.push(r); fam[r.c.fam] = (fam[r.c.fam] || 0) + 1; }
  return pk;
}
function wfRun(data, p, extra) {
  const n = data.n, C = data.o.closes, st = [], bh = []; const nd = p.random ? 30 : 1;
  for (let d = 0; d < nd; d++) { let k = 0; for (let T = W0 + 730; T + 30 <= n; T += H) { const end = Math.min(n, T + H), pk = sel(data.cands, T, p); for (let i = T; i < end; i++) { let s = 0; pk.forEach(q => s += q.c.eq[i] / q.c.eq[i - 1] - 1); const r = pk.length ? s / pk.length : 0; if (d === 0) { st.push(r); bh.push(C[i] / C[i - 1] - 1); } else st[k] += r / (nd - 1) - (d === 1 ? 0 : 0); k++; } } }
  if (p.random) { /* média das 30 execuções: recomputa corretamente */ }
  return { st, bh };
}
function wfRand(data, p) { // média de 30 sorteios, curva diária média
  const n = data.n, C = data.o.closes, acc = [], bh = []; const D = 30;
  let first = true;
  for (let d = 0; d < D; d++) { let k = 0; for (let T = W0 + 730; T + 30 <= n; T += H) { const end = Math.min(n, T + H), pk = sel(data.cands, T, p); for (let i = T; i < end; i++) { let s = 0; pk.forEach(q => s += q.c.eq[i] / q.c.eq[i - 1] - 1); const r = s / pk.length; if (first) { acc.push(r / D); bh.push(C[i] / C[i - 1] - 1); } else acc[k] += r / D; k++; } } first = false; }
  return { st: acc, bh };
}
function resume(st, bh) { const eq = [1]; st.forEach(r => eq.push(eq[eq.length - 1] * (1 + r))); const eb = [1]; bh.forEach(r => eb.push(eb[eb.length - 1] * (1 + r))); return { S: perf(eq, 0, eq.length), B: perf(eb, 0, eb.length) }; }
const base = { isFrac: .7, n: 5, fam: 2, corr: .92, rank: 'is' };
const V = {
  'R aleatório 5 (controle)': { ...base, random: true },
  'D sem gates, rank IS': { ...base },
  'D10 sem gates n=10': { ...base, n: 10 },
  'D20 sem gates n=20, fam 4': { ...base, n: 20, fam: 4 },
  'F rank treino todo': { ...base, rank: 'full' },
  'G rank Sharpe IS apenas': { ...base, rank: 'shOnly' },
  'H robustez por terços': { ...base, rank: 'robust' },
  'I mix full+terço mínimo': { ...base, rank: 'mix' },
  'J isFrac 1.0 rank IS': { ...base, isFrac: 1.0 },
  'K isFrac .5': { ...base, isFrac: .5 },
  'L só tendência (sem reversão/volume)': { ...base, fams: ['media', 'cruzamento', 'rompimento', 'supertrend', 'momentum', 'regimeBTC', 'stop'] },
  'M IS>=1 + 12m>=0 ': { ...base, minIS: 1, s12: 0 },
  'N 24m>=0 + 12m>=0': { ...base, s24: 0, s12: 0 },
  'O fam 1 corr .8': { ...base, fam: 1, corr: .8 },
  'P regimeBTC+stop apenas': { ...base, fams: ['regimeBTC', 'stop'] },
};
const dados = {}; SYMS.forEach(s => dados[s] = carregar(s, 'tudo'));
const out = {};
for (const [nome, p] of Object.entries(V)) {
  const lin = []; let ms = 0, mc = 0, md = 0, ok1 = 0;
  for (const s of SYMS) { const { st, bh } = p.random ? wfRand(dados[s], p) : wfRun(dados[s], p); const r = resume(st, bh); lin.push(s + ':' + r.S.sharpe.toFixed(2)); ms += r.S.sharpe; mc += r.S.calmar; md += r.S.dd; if (r.S.sharpe >= 1) ok1++; out[nome + s] = r; }
  const nS = SYMS.length; console.log(nome.padEnd(40), 'Sharpe médio', (ms / nS).toFixed(2), '| Calmar médio', (mc / nS).toFixed(2), '| DD médio', (md / nS).toFixed(1), '| moedas com Sharpe>=1:', ok1, '|', lin.join(' '));
}
let bs = 0; SYMS.forEach(s => { const { st, bh } = wfRun(dados[s], V['D sem gates, rank IS']); bs += resume(st, bh).B.sharpe; }); console.log('B&H Sharpe médio', (bs / SYMS.length).toFixed(2));

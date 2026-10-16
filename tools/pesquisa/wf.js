// Walk-forward: a cada 90 dias reaplica o procedimento de seleção só com dados até a data T e mede os 90 dias seguintes.
const { ctx, run, loadO, withBtc } = require('./real.js');
const SYMS = (process.env.SYMS || 'ETH,BNB,XRP,SOL,TRX,ZEC,DOGE,LINK,AAVE').split(',');
const H = 90, W0 = 210;
function sharpe(r) { if (r.length < 30) return null; const mu = r.reduce((a, b) => a + b, 0) / r.length, sd = Math.sqrt(r.reduce((a, b) => a + (b - mu) ** 2, 0) / r.length); return sd > 0 ? mu / sd * Math.sqrt(365) : 0; }
function rets(eq, a, b) { const x = []; for (let i = Math.max(1, a); i < b; i++) x.push(eq[i] / eq[i - 1] - 1); return x; }
function perf(eq, a, b) { const e0 = eq[a]; let peak = 1, dd = 0; for (let i = a; i < b; i++) { const v = eq[i] / e0; if (v > peak) peak = v; dd = Math.max(dd, (peak - v) / peak * 100); } const yrs = (b - a - 1) / 365.25, cagr = (Math.pow(eq[b - 1] / e0, 1 / yrs) - 1) * 100; return { cagr, dd, calmar: dd > 0 ? cagr / dd : 0, sharpe: sharpe(rets(eq, a + 1, b)) }; }
function corr(x, y) { const n = Math.min(x.length, y.length); let sx = 0, sy = 0; for (let i = 0; i < n; i++) { sx += x[i]; sy += y[i]; } const mx = sx / n, my = sy / n; let a = 0, b = 0, c = 0; for (let i = 0; i < n; i++) { a += (x[i] - mx) * (y[i] - my); b += (x[i] - mx) ** 2; c += (y[i] - my) ** 2; } return b > 0 && c > 0 ? a / Math.sqrt(b * c) : 0; }
function pct(v) { const idx = v.map((x, i) => i).sort((a, b) => v[a] - v[b]), o = new Array(v.length); idx.forEach((k, p) => o[k] = v.length > 1 ? p / (v.length - 1) : 1); return o; }
function trades(c, a, b) { let k = 0; c.tr.forEach(t => { if (t[0] >= a && t[0] < b) k++; }); return k; }

// procedimento: opts {gates:{is,s24,s12}, rank:'is'|'full'|'s24', n:5, fam:2, corr:.92, isFrac:.7}
function selecionar(cands, T, o) {
  const w0 = W0, cut = w0 + Math.floor((T - w0) * o.isFrac), minTr = Math.max(5, Math.min(12, Math.round((cut - w0) / 365.25 * 2)));
  const rows = [];
  cands.forEach(c => {
    const isr = rets(c.eq, w0 + 1, cut), shIS = sharpe(isr); if (shIS === null) return;
    const s24 = sharpe(rets(c.eq, Math.max(W0 + 1, T - 730), T)), s12 = sharpe(rets(c.eq, Math.max(W0 + 1, T - 365), T));
    if (s24 === null || s12 === null) return;
    const pIS = perf(c.eq, w0, cut);
    if (o.gates.is !== null && shIS < o.gates.is) return; if (o.gates.s24 !== null && s24 < o.gates.s24) return; if (o.gates.s12 !== null && s12 < o.gates.s12) return;
    if (pIS.dd > 70 || trades(c, w0, cut) < minTr) return;
    const full = perf(c.eq, w0, T);
    rows.push({ c, shIS, calIS: pIS.calmar, s24, s12, shFull: full.sharpe, calFull: full.calmar, ret: isr });
  });
  if (!rows.length) return [];
  const key = { is: [r => r.shIS, r => r.calIS], full: [r => r.shFull, r => r.calFull], s24: [r => r.s24, r => r.shIS] }[o.rank];
  const p1 = pct(rows.map(key[0])), p2 = pct(rows.map(key[1])); rows.forEach((r, i) => r.nota = (p1[i] + p2[i]) / 2);
  rows.sort((a, b) => b.nota - a.nota);
  const pick = [], fam = {};
  for (const r of rows) { if (pick.length >= o.n) break; if ((fam[r.c.fam] || 0) >= o.fam) continue; if (pick.some(p => corr(p.rr, r.rr || (r.rr = rets(r.c.eq, w0 + 1, cut))) > o.corr)) continue; r.rr = r.rr || rets(r.c.eq, w0 + 1, cut); pick.push(r); fam[r.c.fam] = (fam[r.c.fam] || 0) + 1; }
  return pick;
}
function carregar(sym, nivel) {
  const o = withBtc(loadO(sym)); ctx.__o = o;
  const lista = run(`(function(){ let L = POOL.concat(gerarPoolAmpliado_()); if ('${nivel}' === 'tudo') L = L.concat(gerarPoolEstendido_()); const res = rodarLista_(__o, L); return res.map(function(r){ return r.erro ? null : { id: r.id, fam: r.fam, eq: r.eqCurve, tr: r.tradeIdx }; }); })()`).filter(Boolean);
  return { o, cands: lista, n: o.closes.length };
}
function wf(sym, data, opts) {
  const n = data.n, C = data.o.closes, stitched = [], bh = [], picksN = []; let sem = 0, tot = 0;
  const eqC = C.map(x => x);
  for (let T = W0 + 730; T + 30 <= n; T += H) {
    const end = Math.min(n, T + H), pk = selecionar(data.cands, T, opts); picksN.push(pk.length); tot++; if (!pk.length) sem++;
    for (let i = T; i < end; i++) { let s = 0; pk.forEach(p => s += p.c.eq[i] / p.c.eq[i - 1] - 1); stitched.push(pk.length ? s / pk.length : 0); bh.push(C[i] / C[i - 1] - 1); }
  }
  const eq = [1]; stitched.forEach(r => eq.push(eq[eq.length - 1] * (1 + r))); const eb = [1]; bh.forEach(r => eb.push(eb[eb.length - 1] * (1 + r)));
  return { dias: stitched.length, S: perf(eq, 0, eq.length), B: perf(eb, 0, eb.length), picks: picksN.reduce((a, b) => a + b, 0) / picksN.length, semPick: sem / tot };
}
module.exports = { SYMS, selecionar, carregar, wf, perf };
if (require.main === module) {
  const variantes = {
    'A base+grade, gates 1/.8965/.3983, rank IS': { nivel: 'base', o: { gates: { is: 1, s24: .8965, s12: .3983 }, rank: 'is', n: 5, fam: 2, corr: .92, isFrac: .7 } },
    'B tudo, gates 1/.8965/.3983, rank IS': { nivel: 'tudo', o: { gates: { is: 1, s24: .8965, s12: .3983 }, rank: 'is', n: 5, fam: 2, corr: .92, isFrac: .7 } },
    'C tudo, so IS>=1, rank IS': { nivel: 'tudo', o: { gates: { is: 1, s24: null, s12: null }, rank: 'is', n: 5, fam: 2, corr: .92, isFrac: .7 } },
    'D tudo, sem gates, rank IS': { nivel: 'tudo', o: { gates: { is: null, s24: null, s12: null }, rank: 'is', n: 5, fam: 2, corr: .92, isFrac: .7 } },
    'E tudo, gates, rank full': { nivel: 'tudo', o: { gates: { is: 1, s24: .8965, s12: .3983 }, rank: 'full', n: 5, fam: 2, corr: .92, isFrac: .7 } },
  };
  const dados = {}; SYMS.forEach(s => { dados[s + 'base'] = carregar(s, 'base'); dados[s + 'tudo'] = carregar(s, 'tudo'); });
  console.log('moeda | variante | dias | WF Sharpe | WF CAGR | WF DD | WF Calmar | B&H Sharpe | B&H CAGR | B&H DD | picks medios | % sem pick');
  const agg = {};
  for (const [nome, v] of Object.entries(variantes)) for (const s of SYMS) {
    const r = wf(s, dados[s + v.nivel], v.o); (agg[nome] = agg[nome] || []).push(r);
    console.log([s, nome.slice(0, 2), r.dias, r.S.sharpe.toFixed(2), r.S.cagr.toFixed(1), r.S.dd.toFixed(1), r.S.calmar.toFixed(2), r.B.sharpe.toFixed(2), r.B.cagr.toFixed(1), r.B.dd.toFixed(1), r.picks.toFixed(1), (r.semPick * 100).toFixed(0)].join(' | '));
  }
  console.log('\nMÉDIAS ENTRE MOEDAS'); for (const [nome, a] of Object.entries(agg)) { const m = k => a.reduce((x, r) => x + (typeof k === 'function' ? k(r) : r[k]), 0) / a.length; console.log(nome, '| WF Sharpe', m(r => r.S.sharpe).toFixed(2), '| CAGR', m(r => r.S.cagr).toFixed(1), '| DD', m(r => r.S.dd).toFixed(1), '| Calmar', m(r => r.S.calmar).toFixed(2), '| B&H Sharpe', m(r => r.B.sharpe).toFixed(2), '| picks', m('picks').toFixed(1), '| sem pick', (m('semPick') * 100).toFixed(0) + '%'); }
}

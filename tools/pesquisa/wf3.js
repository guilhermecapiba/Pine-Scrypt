// Walk-forward do procedimento FINAL (níveis PLENA > RECENTE FRACA > PROVISORIA, base no histórico todo até T, reseleção a cada 90 dias).
const W = require('./wf.js'); const { SYMS, carregar, perf } = W;
const H = 90, W0 = 210;
const sharpe = r => { if (r.length < 30) return null; const mu = r.reduce((a, b) => a + b, 0) / r.length, sd = Math.sqrt(r.reduce((a, b) => a + (b - mu) ** 2, 0) / r.length); return sd > 0 ? mu / sd * Math.sqrt(365) : 0; };
const rets = (eq, a, b) => { const x = []; for (let i = Math.max(1, a); i < b; i++) x.push(eq[i] / eq[i - 1] - 1); return x; };
const corr = (x, y) => { const n = Math.min(x.length, y.length); let sx = 0, sy = 0; for (let i = 0; i < n; i++) { sx += x[i]; sy += y[i]; } const mx = sx / n, my = sy / n; let a = 0, b = 0, c = 0; for (let i = 0; i < n; i++) { a += (x[i] - mx) * (y[i] - my); b += (x[i] - mx) ** 2; c += (y[i] - my) ** 2; } return b > 0 && c > 0 ? a / Math.sqrt(b * c) : 0; };
const pct = v => { const idx = v.map((x, i) => i).sort((a, b) => v[a] - v[b]), o = new Array(v.length); idx.forEach((k, p) => o[k] = v.length > 1 ? p / (v.length - 1) : 1); return o; };
const ntr = (c, a, b) => c.tr.filter(t => t[0] >= a && t[0] < b).length;
const cal = (eq, a, b) => { let peak = 1, dd = 0; const e0 = eq[a]; for (let i = a; i < b; i++) { const v = eq[i] / e0; if (v > peak) peak = v; dd = Math.max(dd, (peak - v) / peak * 100); } const y = (b - a) / 365.25, cg = (Math.pow(eq[b - 1] / e0, 1 / y) - 1) * 100; return { dd, calmar: dd > 0 ? cg / dd : 0 }; };
function sel(cands, T, o) {
  const minTr = Math.max(5, Math.min(12, Math.round((T - W0) / 365.25 * 2))), rows = [];
  cands.forEach(c => { const f = sharpe(rets(c.eq, W0 + 1, T)); if (f === null || f < o.piso) return; const m = cal(c.eq, W0, T); if (m.dd > 70 || ntr(c, W0, T) < minTr) return;
    const s24 = sharpe(rets(c.eq, Math.max(W0 + 1, T - 730), T)), s12 = sharpe(rets(c.eq, Math.max(W0 + 1, T - 365), T));
    const nivel = f >= 1 ? ((s24 !== null && s12 !== null && s24 >= .8965 && s12 >= .3983) ? 0 : 1) : 2; if (o.soPlena && nivel !== 0) return; rows.push({ c, f, calmar: m.calmar, nivel }); });
  const a = pct(rows.map(r => r.f)), b = pct(rows.map(r => r.calmar)); rows.forEach((r, i) => r.nota = (a[i] + b[i]) / 2);
  rows.sort((x, y) => x.nivel - y.nivel || y.nota - x.nota); const pk = [], fam = {};
  for (const r of rows) { if (pk.length >= 5) break; if ((fam[r.c.fam] || 0) >= 2) continue; r.rr = rets(r.c.eq, W0 + 1, T); if (pk.some(q => corr(q.rr, r.rr) > .92)) continue; pk.push(r); fam[r.c.fam] = (fam[r.c.fam] || 0) + 1; }
  return pk;
}
let seed = 11; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const out = []; 
for (const s of SYMS) {
  const d = carregar(s, process.env.NIVEL || 'tudo'), n = d.n, C = d.o.closes, st = [], bh = [], rd = [], N = 20; let sem = 0, tot = 0, nivP = [0, 0, 0];
  const rdAcc = [];
  for (let T = W0 + 730; T + 30 <= n; T += H) {
    const end = Math.min(n, T + H), pk = sel(d.cands, T, { piso: +(process.env.PISO || .8), soPlena: process.env.PLENA === '1' }); tot++; if (!pk.length) sem++; pk.forEach(p => nivP[p.nivel]++);
    for (let i = T; i < end; i++) { let x = 0; pk.forEach(p => x += p.c.eq[i] / p.c.eq[i - 1] - 1); st.push(pk.length ? x / pk.length : 0); bh.push(C[i] / C[i - 1] - 1); }
    // controle: 5 aleatórios do conjunto (média de N sorteios) — cobre os mesmos dias
    const base = rdAcc.length; for (let i = T; i < end; i++) rdAcc.push(0);
    for (let k = 0; k < N; k++) { const a = d.cands.slice(), pick = []; for (let j = 0; j < 5; j++) pick.push(a.splice(Math.floor(rnd() * a.length), 1)[0]); for (let i = T; i < end; i++) { let x = 0; pick.forEach(p => x += p.eq[i] / p.eq[i - 1] - 1); rdAcc[base + i - T] += x / 5 / N; } }
  }
  const mk = r => { const eq = [1]; r.forEach(x => eq.push(eq[eq.length - 1] * (1 + x))); return perf(eq, 0, eq.length); };
  const S = mk(st), B = mk(bh), R = mk(rdAcc);
  out.push({ s, dias: st.length, S, B, R, sem: sem / tot, nivP });
  console.log([s, st.length + 'd', 'FINAL Sh', S.sharpe.toFixed(2), 'CAGR', S.cagr.toFixed(0), 'DD', S.dd.toFixed(0), '| ALEAT Sh', R.sharpe.toFixed(2), 'DD', R.dd.toFixed(0), '| B&H Sh', B.sharpe.toFixed(2), 'CAGR', B.cagr.toFixed(0), 'DD', B.dd.toFixed(0), '| sem pick', (sem / tot * 100).toFixed(0) + '%', 'níveis P/RF/PV', nivP.join('/')].join(' '));
}
const m = f => (out.reduce((a, r) => a + f(r), 0) / out.length).toFixed(2);
console.log('MÉDIA FINAL Sh', m(r => r.S.sharpe), 'DD', m(r => r.S.dd), 'Calmar', m(r => r.S.calmar), '| ALEAT Sh', m(r => r.R.sharpe), 'DD', m(r => r.R.dd), '| B&H Sh', m(r => r.B.sharpe), 'DD', m(r => r.B.dd), 'Calmar', m(r => r.B.calmar));

// Walk-forward do procedimento de PRODUÇÃO (selecionar_ do script, com relaxamento) com dados truncados em T.
const { ctx, run, loadO, withBtc } = require('./real.js');
const SYMS = (process.env.SYMS || 'ETH,BNB,XRP,SOL,ZEC,LINK,AAVE').split(','), H = 90, W0 = 210;
const sharpe = r => { if (r.length < 30) return null; const mu = r.reduce((a, b) => a + b, 0) / r.length, sd = Math.sqrt(r.reduce((a, b) => a + (b - mu) ** 2, 0) / r.length); return sd > 0 ? mu / sd * Math.sqrt(365) : 0; };
const perf = r => { const eq = [1]; r.forEach(x => eq.push(eq[eq.length - 1] * (1 + x))); let peak = 1, dd = 0; eq.forEach(v => { if (v > peak) peak = v; dd = Math.max(dd, (peak - v) / peak * 100); }); const y = r.length / 365.25, cg = (Math.pow(eq[eq.length - 1], 1 / y) - 1) * 100; return { sharpe: sharpe(r), dd, cagr: cg, calmar: dd > 0 ? cg / dd : 0 }; };
const out = [];
for (const s of SYMS) {
  const full = withBtc(loadO(s)); ctx.__f = full; const n = full.closes.length, st = [], bh = []; let sem = 0, tot = 0, rel = 0, pk = 0;
  for (let T = W0 + 730; T + 30 <= n; T += H) {
    ctx.__T = T;
    const ids = run(`(function(){ const t = { dates: __f.dates.slice(0,__T), opens: __f.opens.slice(0,__T), highs: __f.highs.slice(0,__T), lows: __f.lows.slice(0,__T), closes: __f.closes.slice(0,__T), volumes: __f.volumes.slice(0,__T), btcC: __f.btcC.slice(0,__T) };
      const r = selecionar_(t, POOL.concat(gerarPoolAmpliado_(), gerarPoolEstendido_(), gerarPoolMassivo_(), gerarPoolReversao_())); return {ids: r.ids, nRel: r.nRelax}; })()`);
    tot++; pk += ids.ids.length; rel += ids.nRel; if (!ids.ids.length) sem++;
    const end = Math.min(n, T + H); ctx.__ids = ids.ids;
    const eqs = ids.ids.length ? run(`rodarLista_(__f, defsPorId_(__ids)).map(function(r){return r.eqCurve})`) : [];
    for (let i = T; i < end; i++) { let x = 0; eqs.forEach(e => x += e[i] / e[i - 1] - 1); st.push(eqs.length ? x / eqs.length : 0); bh.push(full.closes[i] / full.closes[i - 1] - 1); }
  }
  const S = perf(st), B = perf(bh); out.push({ s, S, B });
  console.log(s, st.length + 'd', 'PROD Sh', S.sharpe.toFixed(2), 'CAGR', S.cagr.toFixed(0), 'DD', S.dd.toFixed(0), '| B&H Sh', B.sharpe.toFixed(2), 'CAGR', B.cagr.toFixed(0), 'DD', B.dd.toFixed(0), '| picks médios', (pk / tot).toFixed(1), 'relaxadas', (rel / tot).toFixed(1), 'sem pick', (sem / tot * 100).toFixed(0) + '%');
}
const m = f => (out.reduce((a, r) => a + f(r), 0) / out.length).toFixed(2);
console.log('MÉDIA PROD Sh', m(r => r.S.sharpe), 'DD', m(r => r.S.dd), '| B&H Sh', m(r => r.B.sharpe), 'DD', m(r => r.B.dd));

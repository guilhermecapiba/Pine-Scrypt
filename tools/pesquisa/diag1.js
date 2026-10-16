const { ctx, run, loadO } = require('./real.js');
const syms = ['ETH','BNB','XRP','SOL','TRX','ZEC','HYPE','DOGE','LINK','AAVE'];
for (const sym of syms) {
  const o = loadO(sym); ctx.__o = o; const n = o.closes.length;
  const t0 = Date.now();
  const out = run(`(function(){ const o=__o, n=o.closes.length; const pool=rodarLista_(o,POOL).concat(rodarLista_(o,gerarPoolAmpliado_()));
    const w0=Math.min(210,n-150), cut=w0+Math.floor((n-w0)*0.7); const st={tot:pool.length, isOk:0, p24:0, p12:0, todos:0, trades:0};
    const bh = (function(){const C=o.closes; return [metricasFaixa_(C,w0,cut), metricasFaixa_(C,cut,n)]})();
    pool.forEach(function(r){ if(r.erro||!r.eqCurve) return; const m=metricasFaixa_(r.eqCurve,w0,cut); const p=cumprePermanencia_(r.eqCurve,n); const a=m&&m.sharpe>=1; const nt=contarTrades_(r,w0,cut)>=5; if(a)st.isOk++; if(p.s24>=0.8965)st.p24++; if(p.s12>=0.3983)st.p12++; if(a&&p.ok&&nt)st.todos++; });
    return {n:n, st:st, bh:bh, w0:o.dates[w0].toISOString().slice(0,10), cut:o.dates[cut].toISOString().slice(0,10)}; })()`);
  console.log(sym, 'n=' + out.n, 'IS ' + out.w0 + '→' + out.cut, JSON.stringify(out.st), 'B&H IS Sh', out.bh[0] && out.bh[0].sharpe, 'OOS Sh', out.bh[1] && out.bh[1].sharpe, (Date.now()-t0)+'ms');
}

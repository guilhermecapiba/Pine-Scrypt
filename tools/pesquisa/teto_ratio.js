process.env.SRC = require('path').join(__dirname, '../../apps_script/Alts_BTC_v1.gs');
const { ratio, ctx, run, loadO } = require('./ratio.js');
run("CFG_PADRAO.forEach(function(c){ if (c[0]==='SELECAO_ORCAMENTO_SEG') c[1]=3000; if (c[0]==='SELECAO_PISO_PROVISORIO') c[1]=0.3; })");
for (const s of ['ETH','BNB','XRP','SOL','TRX','ZEC','HYPE','DOGE','LINK','AAVE']) {
  const o = ratio(s); ctx.__o = o; ctx.__b = loadO('BTC'); run('__o.btcC = alinharBtc_(__o, __b); aparaInicio_(__o)');
  const r = run(`(function(){ const sel = selecionar_(__o, todosDefs_()); const v = sel.detalhe.filter(function(d){return d.sFull!==undefined&&d.sFull!==null}).map(function(d){return d.sFull}).sort(function(a,b){return b-a});
    const bh = (function(){ const C=__o.closes, n=C.length, r=[]; for (let i=211;i<n;i++) r.push(C[i]/C[i-1]-1); const mu=r.reduce(function(a,b){return a+b},0)/r.length, sd=Math.sqrt(r.reduce(function(a,b){return a+(b-mu)*(b-mu)},0)/r.length); return mu/sd*Math.sqrt(365); })();
    return { max: v[0], p99: v[Math.floor(v.length*0.01)], ge1: v.filter(function(x){return x>=1}).length, ge08: v.filter(function(x){return x>=0.8}).length, ge05: v.filter(function(x){return x>=0.5}).length, n: v.length, bh: bh }; })()`);
  console.log(s, 'Sharpe max', r.max.toFixed(2), '| >=1:', r.ge1, '>=0,8:', r.ge08, '>=0,5:', r.ge05, 'de', r.n, '| segurar a ALT (Sharpe em BTC):', r.bh.toFixed(2));
}

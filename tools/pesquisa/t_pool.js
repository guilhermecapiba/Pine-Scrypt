const { ctx, run, loadO, withBtc } = require('./real.js');
const o = withBtc(loadO('ETH')); ctx.__o = o;
const t0 = Date.now();
const out = run(`(function(){ const L = gerarPoolEstendido_(); const res = rodarLista_(__o, L); let erros = res.filter(function(r){return r.erro}).map(function(r){return r.id+':'+r.erro}); const nt = res.filter(function(r){return !r.erro && r.nTrades>0}).length;
  const ex = res.filter(function(r){return !r.erro}).slice(0,0); return {n:L.length, erros:erros.slice(0,10), comTrades:nt}; })()`);
console.log(JSON.stringify(out), Date.now() - t0, 'ms');

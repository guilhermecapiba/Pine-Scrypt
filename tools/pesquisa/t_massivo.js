const { ctx, run, loadO, withBtc } = require('./real.js');
const o = withBtc(loadO('ETH')); ctx.__o = o; const t0 = Date.now();
const out = run(`(function(){ const L = gerarPoolMassivo_(); const res = rodarLista_(__o, L); return {n:L.length, erros: res.filter(function(r){return r.erro}).map(function(r){return r.id+':'+r.erro}).slice(0,10), semTrades: res.filter(function(r){return !r.erro && !r.nTrades}).map(function(r){return r.id}).slice(0,15), ids: new Set(L.map(function(e){return e.id})).size}; })()`);
console.log(JSON.stringify(out), (Date.now() - t0) + 'ms');

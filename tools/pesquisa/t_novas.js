const { ctx, run, loadO, withBtc } = require('./real.js');
const o = withBtc(loadO('XRP')); ctx.__o = o; const t0 = Date.now();
const out = run(`(function(){ const L = gerarPoolPadroes_(); const res = rodarLista_(__o, L); const cl = {}; L.forEach(function(e){ const c = classeInd_(e.nome); cl[c] = (cl[c]||0)+1; });
  return {n: L.length, ids: new Set(L.map(function(e){return e.id})).size, erros: res.filter(function(r){return r.erro}).map(function(r){return r.id+':'+r.erro}).slice(0,10), semTrades: res.filter(function(r){return !r.erro && !r.nTrades}).length, classes: cl, outras: Object.keys(cl).filter(function(c){return c.indexOf('Outra')===0}) }; })()`);
console.log(JSON.stringify(out), (Date.now() - t0) + 'ms');

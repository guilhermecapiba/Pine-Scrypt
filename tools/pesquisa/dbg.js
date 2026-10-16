const { ctx, run, loadO, withBtc } = require('./real.js');
const o = withBtc(loadO(process.argv[2] || 'TRX')); ctx.__o = o;
const out = run(`(function(){ const s = selecionar_(__o, POOL.concat(gerarPoolAmpliado_(), gerarPoolEstendido_())); const cont = {}; s.detalhe.forEach(function(d){ const k = d.situacao.replace(/[0-9.\\-]+/g,'#').slice(0,40); cont[k]=(cont[k]||0)+1; });
  const top = s.detalhe.filter(function(d){return d.sFull!==undefined}).sort(function(a,b){return b.sFull-a.sFull}).slice(0,8).map(function(d){return d.id+' H'+r_(d.sFull,2)+' dd'+d.dd+' tr'+d.nTr+' '+d.nivel+' | '+d.situacao}); return {cont:cont, top:top, ids:s.ids, minTr:s.minTr}; })()`);
console.log(JSON.stringify(out, null, 1));

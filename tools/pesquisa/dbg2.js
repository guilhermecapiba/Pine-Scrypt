const { ctx, run, loadO, withBtc } = require('./real.js');
const s = process.argv[2]; const o = withBtc(loadO(s)); ctx.__o = o;
const out = run(`(function(){ const r = selecionar_(__o, POOL.concat(gerarPoolAmpliado_(), gerarPoolEstendido_(), gerarPoolMassivo_(), gerarPoolReversao_()));
  return r.detalhe.filter(function(d){return d.nivel==='PLENA'}).sort(function(a,b){return (b.slot?1:0)-(a.slot?1:0)||b.sFull-a.sFull}).slice(0,40).map(function(d){return [d.id, 'H'+r_(d.sFull,2), '24m'+r_(d.s24,2), '12m'+r_(d.s12,2), 'dd'+r_(d.dd,0), 'tr'+d.nTr, d.situacao].join(' ')}); })()`);
console.log(out.join('\n'));

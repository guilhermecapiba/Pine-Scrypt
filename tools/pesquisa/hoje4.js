// Com a régua cheia (só PLENA): quantas elegíveis por moeda e por que as demais não entraram
const { ctx, run, loadO, withBtc } = require('./real.js');
const syms = (process.env.SYMS || 'ETH,BNB,XRP,SOL,TRX,ZEC,HYPE,DOGE,LINK,AAVE').split(',');
for (const s of syms) {
  const o = withBtc(loadO(s)); ctx.__o = o; ctx.__s = s;
  const out = run(`(function(){ const r = selecionar_(__o, POOL.concat(gerarPoolAmpliado_(), gerarPoolEstendido_(), gerarPoolMassivo_(), gerarPoolReversao_())); const pl = r.detalhe.filter(function(d){return d.nivel==='PLENA'}); const motivos = {};
    pl.forEach(function(d){ const k = d.situacao.replace(/[0-9.]+/g,'#').replace(/ com .*$/,'').slice(0,40); motivos[k]=(motivos[k]||0)+1; });
    return {n: __o.closes.length, plena: pl.length, esc: r.ids.length, motivos: motivos, ids: r.ids, maxFull: Math.max.apply(null, r.detalhe.filter(function(d){return d.sFull!==undefined}).map(function(d){return d.sFull})) }; })()`);
  console.log(s, 'n=' + out.n, 'PLENA(nível)=' + out.plena, 'escolhidas=' + out.esc, 'maxSharpe=' + out.maxFull.toFixed(2), JSON.stringify(out.motivos), out.ids.join(','));
}

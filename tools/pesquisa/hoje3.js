// quantas estratégias PLENA (régua cheia) cada moeda consegue com o conjunto completo, e quais
const { ctx, run, loadO, withBtc } = require('./real.js');
const syms = (process.env.SYMS || 'ETH,BNB,XRP,SOL,TRX,ZEC,HYPE,DOGE,LINK,AAVE').split(',');
for (const s of syms) {
  const o = withBtc(loadO(s)); ctx.__o = o; const n = o.closes.length;
  const out = run(`(function(){ const r = selecionar_(__o, POOL.concat(gerarPoolAmpliado_(), gerarPoolEstendido_(), gerarPoolMassivo_())); const nv = {PLENA:0,'RECENTE FRACA':0,PROVISORIA:0,FORA:0};
    r.detalhe.forEach(function(d){ if(d.nivel) nv[d.nivel]++; });
    const el = r.detalhe.filter(function(d){return d.elegivel && d.nivel==='PLENA'});
    return {ids:r.ids, nv:nv, plenaElegiveis: el.length, esc: r.detalhe.filter(function(d){return d.slot}).map(function(d){return d.id+' '+d.nivel+' H'+r_(d.sFull,2)+' 24m'+r_(d.s24,2)+' 12m'+r_(d.s12,2)}) }; })()`);
  console.log(s, 'n=' + n, JSON.stringify(out.nv), 'PLENAS elegíveis (dd/trades):', out.plenaElegiveis, '| escolhidas:', out.esc.length); out.esc.forEach(x => console.log('    ', x));
}

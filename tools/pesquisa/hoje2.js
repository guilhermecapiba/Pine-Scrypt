const W = require('./wf.js'); const { SYMS, carregar, selecionar } = W;
const p2 = { gates: { is: 1, s24: null, s12: null }, rank: 'full', n: 5, fam: 2, corr: .92, isFrac: 1.0 };
const p3 = { gates: { is: .8, s24: null, s12: null }, rank: 'full', n: 5, fam: 2, corr: .92, isFrac: 1.0 };
for (const s of SYMS) {
  const d = carregar(s, 'tudo'), n = d.n;
  for (const [nome, p] of [['IS>=1.0', p2], ['IS>=0.8', p3]]) { const pk = selecionar(d.cands, n, p); console.log(s, nome, pk.length, pk.map(r => r.c.id + '(full ' + r.shFull.toFixed(2) + ' 24m ' + r.s24.toFixed(2) + ' 12m ' + r.s12.toFixed(2) + ')').join(' ')); }
}

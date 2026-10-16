const W = require('./wf.js'); const { SYMS, carregar, selecionar } = W;
const syms = SYMS.concat(['HYPE']);
const G = { is: 1, s24: .8965, s12: .3983 };
const procs = {
  'atual (IS 70%, gates 1/.8965/.3983)': { gates: G, rank: 'is', n: 5, fam: 2, corr: .92, isFrac: .7 },
  'histórico todo (IS 100%, gates 1/.8965/.3983)': { gates: G, rank: 'full', n: 5, fam: 2, corr: .92, isFrac: 1.0 },
  'histórico todo, família 3': { gates: G, rank: 'full', n: 5, fam: 3, corr: .95, isFrac: 1.0 },
};
for (const s of syms) {
  const d = carregar(s, 'tudo'); const n = d.n; const line = [s, 'n=' + n];
  if (n < 600) { console.log(s, 'n=' + n, 'histórico curto'); }
  for (const [nome, p] of Object.entries(procs)) { const pk = n < 600 ? [] : selecionar(d.cands, n, p); line.push(nome.slice(0, 8) + '→' + pk.length); }
  console.log(line.join(' | '));
}

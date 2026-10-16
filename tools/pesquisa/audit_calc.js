// Recalcula do zero, a partir das abas BASE, as métricas de cada estratégia listada em ESTRATEGIAS_TOP10.
const fs = require('fs');
const { ctx, run, loadO, withBtc } = require('./real.js');
const est = JSON.parse(fs.readFileSync('/tmp/est_sheet.json', 'utf8')), out = [];
const porAtivo = {}; est.forEach(e => (porAtivo[e.Ativo] = porAtivo[e.Ativo] || []).push(e));
for (const sym of Object.keys(porAtivo)) {
  const o = sym === 'BTC' ? loadO('BTC') : withBtc(loadO(sym)); ctx.__o = o; ctx.__ids = porAtivo[sym].map(e => e.ID); ctx.__fix = sym === 'BTC';
  const r = run(`(function(){ const n = __o.closes.length; const defs = __fix ? FIXAS_BTC : defsPorId_(__ids); const rs = rodarLista_(__o, defs); const w0 = Math.min(210, n-150);
    return rs.map(function(r){ const nv = nivelSharpe_(r.eqCurve, n); return { id: r.id, full: nv.full, s24: nv.s24, s12: nv.s12, s3a: r.sharpe, nt: r.nTrades, pos: r.posAtual, lacum: r.lucroAcumPct, win: r.winRate, evento: r.evento, peso: r.peso }; }); })()`);
  r.forEach(x => out.push({ sym, ...x, n: o.closes.length }));
}
fs.writeFileSync('/tmp/est_calc.json', JSON.stringify(out));
console.log(out.length, 'estratégias recalculadas');

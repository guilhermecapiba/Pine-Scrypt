const fs = require('fs');
const { ctx, run, loadO, withBtc } = require('./real.js');
const est = JSON.parse(fs.readFileSync('/tmp/est_sheet.json', 'utf8')), out = {};
const porAtivo = {}; est.forEach(e => (porAtivo[e.Ativo] = porAtivo[e.Ativo] || []).push(e));
for (const sym of Object.keys(porAtivo)) {
  const o = sym === 'BTC' ? loadO('BTC') : withBtc(loadO(sym)); ctx.__o = o; ctx.__ids = porAtivo[sym].map(e => e.ID); ctx.__fix = sym === 'BTC';
  out[sym] = run(`(function(){ const defs = __fix ? FIXAS_BTC : defsPorId_(__ids); const res = rodarLista_(__o, defs); const n = __o.closes.length, C = __o.closes;
    res.forEach(function(r){ r.perm = cumprePermanencia_(r.eqCurve, n); if (__fix && !cumprePermanencia_(r.eqCurve, n, cfgNum_('SELECAO_HISTERESE')).ok) r.ativa = false; });
    const I = calcularIndicadores_(__o), cons = consenso_(res), termo = termometro_(__o, I, null);
    const ini = Math.min(n - 91, cfgNum_('JANELA_INICIO_BARRAS'));
    return { idx: cons.pct, leitura: cons.leitura, comprados: cons.comprados, n: cons.n, estic: termo.valor, faixa: termo.faixa, preco: C[n-1], ultima: __o.dates[n-1].toISOString().slice(0,10), nVelas: n, inicio: __o.dates[0].toISOString().slice(0,10),
      painel: metricasPainel_(res, ini), bh: metricasJanela_(C, ini), v1: (C[n-1]/C[n-2]-1)*100, v7: (C[n-1]/C[n-8]-1)*100, v30: (C[n-1]/C[n-31]-1)*100, acima200: C[n-1] > I.SMA200[n-1] }; })()`);
}
fs.writeFileSync('/tmp/cons_calc.json', JSON.stringify(out));
console.log(Object.keys(out).length, 'ativos recalculados (consenso/esticamento/painel)');

// Gera as sementes (estratégias já testadas) da planilha ALT/BTC: roda o selecionar_ do próprio script (Alts_BTC_v1.gs) sobre as séries ALT/BTC
// e grava tools/altbtc_seeds.json (para o build) e pesquisa/altbtc_resultados.json (para o resumo da planilha).
process.env.SRC = process.env.SRC || require('path').join(__dirname, '../../apps_script/Alts_BTC_v1.gs');
const fs = require('fs'), path = require('path');
const { ratio, ctx, run, loadO } = require('./ratio.js');
const { sheets, props } = require('../testes/harness.js');
run("CFG_PADRAO.forEach(function(c){ if (c[0]==='SELECAO_ORCAMENTO_SEG') c[1]=3000; })");
const DATA = process.env.DATA_SEL || '2026-10-17';
if (!sheets.find(s => s.name === 'SELECAO_CANDIDATAS')) run("ss_().insertSheet(P2.ABAS.sel)");
const SYMS = ['ETH', 'BNB', 'XRP', 'SOL', 'TRX', 'ZEC', 'HYPE', 'DOGE', 'LINK', 'AAVE'];
const seeds = {}, resumo = [];
for (const s of SYMS) {
  const o = ratio(s); ctx.__o = o; ctx.__b = loadO('BTC'); run('__o.btcC = alinharBtc_(__o, __b); aparaInicio_(__o)');
  ctx.__s = s; ctx.__d = DATA;
  const r = run(`(function(){ const sel = selecionar_(__o, todosDefs_()); guardarSel_(__s, sel, __d); gravarSelecaoCandidatos_(__s, sel, __d);
    const det = sel.detalhe, niv = { PLENA: 0, 'RECENTE FRACA': 0, PROVISORIA: 0, FORA: 0 }; det.forEach(function (d) { if (d.nivel) niv[d.nivel]++; });
    const esc = det.filter(function (d) { return d.slot; }).sort(function (a, b) { return a.slot - b.slot; }).map(function (d) { return { slot: d.slot, id: d.id, nome: d.nome, ind: d.ind, nivel: d.nivel, trades: d.nTr, shH: d.sFull, sh24: d.s24, sh12: d.s12, calmar: d.calmar, dd: d.dd, isSh: d.isM ? d.isM.sharpe : null, oosSh: d.oosM ? d.oosM.sharpe : null, situacao: d.situacao }; });
    return { n: __o.closes.length, ini: dataStr_(__o.dates[0]), fim: dataStr_(__o.dates[__o.dates.length - 1]), testados: sel.nTestados, elegiveis: sel.nElegiveis, niv: niv, esc: esc, vagas: sel.vagas, interrompida: sel.interrompida, w0: sel.w0Data, corte: sel.corteData }; })()`);
  const sh = sheets.find(x => x.name === 'SELECAO_CANDIDATAS');
  const rows = []; for (let i = 2; i <= sh.getLastRow(); i++) { const row = []; for (let j = 1; j <= 17; j++) { const v = sh.cells[i + ',' + j]; row.push(v === undefined ? '' : v); } if (row[0] === s) rows.push(row); }
  const escolhidas = rows.filter(x => x[1] !== ''), resu = rows.filter(x => x[2] === '(resumo)'), outras = rows.filter(x => x[1] === '' && x[2] !== '(resumo)').slice(0, 8);
  seeds[s] = { sel: JSON.parse(props['SEL_' + s]), linhas: escolhidas.concat(outras, resu) };
  resumo.push(Object.assign({ sym: s }, r));
  console.log(s, 'velas', r.n, r.ini, '->', r.fim, 'escolhidas', r.esc.length, 'vagas', r.vagas, 'PLENA', r.niv.PLENA, 'REC.FRACA', r.niv['RECENTE FRACA'], 'elegiveis', r.elegiveis, r.interrompida ? 'INTERROMPIDA' : '');
}
fs.writeFileSync(path.join(__dirname, '../altbtc_seeds.json'), JSON.stringify(seeds));
fs.writeFileSync(path.join(__dirname, 'altbtc_resultados.json'), JSON.stringify(resumo, null, 1));
console.log('seeds', fs.statSync(path.join(__dirname, '../altbtc_seeds.json')).size, 'bytes');

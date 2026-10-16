const { ctx, vm, sheets, props, mails, dados } = require('./harness.js');
const run = c => vm.runInContext(c, ctx), sh = n => sheets.find(s => s.name === n);
run('setupPlanilha()'); run('motorTop10(true)');
const snap = JSON.stringify(Object.keys(props).filter(k => /^RES_/.test(k)).map(k => [k, JSON.parse(props[k]).idx, (JSON.parse(props[k]).estr || []).map(e => e.id).join(',')]));
// 2) rodada normal: tudo em dia => pula
console.log('normal:', JSON.stringify(run('motorTop10(false)')));
// 3) incremental: remove últimas 3 velas de ETH na BASE
const b = sh('BASE_ETH'); let last = b.getLastRow(); for (let k = 0; k < 3; k++) { for (let c = 1; c <= 7; c++) delete b.cells[(last - k) + ',' + c]; }
run("PropertiesService.getScriptProperties().setProperty('RES_ETH','{}')");
const before = b.getLastRow(); run('motorTop10(false)'); console.log('ETH base', before, '->', b.getLastRow());
// 4) forçado mantém seleção congelada
run('motorTop10(true)');
const snap2 = JSON.stringify(Object.keys(props).filter(k => /^RES_/.test(k)).map(k => [k, JSON.parse(props[k]).idx, (JSON.parse(props[k]).estr || []).map(e => e.id).join(',')]));
console.log('seleção congelada e resultado estável:', snap === snap2);
// 5) ESTRATEGIAS_TOP10 / SELECAO
const e = sh('ESTRATEGIAS_TOP10'); console.log('ESTR linhas', e.getLastRow()); for (const r of [1, 2, 3, 12, 13, 14, 20, 21, 22, 40]) { const row = []; for (let c = 1; c <= 26; c++) row.push(e.cells[r + ',' + c] === undefined ? '' : e.cells[r + ',' + c]); console.log(row.join(' | ')); }
const s = sh('SELECAO_CANDIDATAS'); console.log('SELECAO linhas', s.getLastRow());
for (let r = 2; r <= 14; r++) { const row = []; for (let c = 1; c <= 17; c++) row.push(s.cells[r + ',' + c] === undefined ? '' : s.cells[r + ',' + c]); console.log(row.join(' | ')); }
// 6) e-mails
run('motorSemanal()'); console.log('emails', mails.length, mails.map(m => m.subject).join(' // '));
const html = mails.map(m => m.htmlBody).join('');
console.log('vaza nome de estratégia/indicador?', /ROC|MACD|Supertrend|Donchian|SMA|EMA|Bollinger|M1-|M2-|T-\d|X-/.test(html));
// 7) reselecionar
run('reselecionarTodas()'); console.log('pendentes', props.SEL_PENDENTES);

const { ctx, vm, sheets, props, mails } = require('./harness.js');
const run = c => vm.runInContext(c, ctx);
console.log('POOL', run('POOL.length'), 'FIXAS', run('FIXAS_BTC.length'));
let t = Date.now(); run('setupPlanilha()'); console.log('setup', sheets.map(s => s.name).join(','));
// carga: repete até todos OK
for (let k = 0; k < 6; k++) { const t0 = Date.now(); const r = run('motorTop10(true)'); console.log('rodada', k, JSON.stringify(r), (Date.now() - t0) + 'ms'); if (!r.restantes) break; }
Object.keys(props).filter(k => /^(RES|SEL)_/.test(k)).forEach(k => console.log(k, props[k].length));
const sh = n => sheets.find(s => s.name === n);
const dump = (n, rows, cols) => { const s = sh(n); for (let r = 1; r <= Math.min(rows, s.getLastRow()); r++) { const row = []; for (let c = 1; c <= cols; c++) row.push(s.cells[r + ',' + c] === undefined ? '' : s.cells[r + ',' + c]); console.log(row.join(' | ')); } };
dump('PAINEL_TOP10', 16, 12); console.log('---'); dump('DESEMPENHO_10', 16, 22);

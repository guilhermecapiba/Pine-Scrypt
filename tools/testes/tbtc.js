const { ctx, vm, props } = require('./harness.js');
const run = c => vm.runInContext(c, ctx);
run('setupPlanilha()'); run('motorTop10(true)');
const r = JSON.parse(props.RES_BTC);
console.log('ID | Sharpe IS | Sharpe 3a | Sharpe 24m | Sharpe 12m | Sharpe OOS | trades');
r.estr.forEach(e => console.log([e.id, e.isSh, e.sh3, e.sh24, e.sh12, e.oosSh, e.nt].join(' | ')));

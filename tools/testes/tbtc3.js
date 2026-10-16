const { ctx, vm, props, sheets } = require('./harness.js');
const run = c => vm.runInContext(c, ctx);
run('setupPlanilha()');
const cfg = sheets.find(s => s.name === 'CONFIG_SISTEMA');
for (let r = 2; r <= cfg.getLastRow(); r++) if (cfg.cells[r + ',1'] === 'SELECAO_HISTERESE') cfg.cells[r + ',2'] = 0.1;
run('_CFG_CACHE_ = null'); run('motorTop10(true)');
const r = JSON.parse(props.RES_BTC); console.log('histerese 0,1 -> BTC consenso', r.idx, r.comprados + '/' + r.nEstr, r.estr.filter(e => e.fora).map(e => e.id));

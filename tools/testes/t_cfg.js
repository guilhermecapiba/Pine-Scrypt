const { ctx, vm, sheets } = require('./harness.js'); const run = c => vm.runInContext(c, ctx);
run('setupPlanilha()'); const cfg = sheets.find(s => s.name === 'CONFIG_SISTEMA');
cfg.cells[(cfg.getLastRow() + 1) + ',1'] = 'SELECAO_ALERTA_SHARPE_12M'; cfg.cells[cfg.getLastRow() + ',2'] = 0.5; cfg.cells[cfg.getLastRow() + ',3'] = 'obsoleto';
const antes = cfg.getLastRow(); run('setupPlanilha()'); const chaves = []; for (let r = 2; r <= cfg.getLastRow(); r++) chaves.push(cfg.cells[r + ',1']);
console.log('linhas antes', antes, 'depois', cfg.getLastRow(), 'obsoleta presente?', chaves.includes('SELECAO_ALERTA_SHARPE_12M'), 'duplicadas?', chaves.length !== new Set(chaves).size);

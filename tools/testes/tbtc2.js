const { ctx, vm, props } = require('./harness.js');
const run = c => vm.runInContext(c, ctx);
run('setupPlanilha()'); if (process.env.H) run("PropertiesService.getScriptProperties()"); run('motorTop10(true)');
const o = run("lerBase_('BTC')"); const n = o.closes.length;
run("globalThis.__o = lerBase_('BTC')");
const rs = run("rodarLista_(__o, FIXAS_BTC).map(function (r) { return [r.id, sharpeUlt_(r.eqCurve, __o.closes.length, 730), sharpeUlt_(r.eqCurve, __o.closes.length, 365)]; })");
rs.forEach(x => console.log(x[0], 'S24=' + x[1].toFixed(6), 'S12=' + x[2].toFixed(6), x[1] >= 0.9 && x[2] >= 0.4 ? 'OK' : 'FORA'));
const r = JSON.parse(props.RES_BTC); console.log('BTC consenso', r.idx, r.comprados + '/' + r.nEstr);

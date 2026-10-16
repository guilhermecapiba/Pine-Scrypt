// Teste de causalidade: a curva de equity até a barra T não pode mudar quando se acrescentam barras futuras.
const { ctx, run, loadO, withBtc } = require('./real.js');
const full = withBtc(loadO('ETH')); const cutN = full.closes.length - 400;
ctx.__f = full;
ctx.__t = { dates: full.dates.slice(0, cutN), opens: full.opens.slice(0, cutN), highs: full.highs.slice(0, cutN), lows: full.lows.slice(0, cutN), closes: full.closes.slice(0, cutN), volumes: full.volumes.slice(0, cutN), btcC: full.btcC.slice(0, cutN) };
const bad = run(`(function(){ const lista = POOL.concat(gerarPoolAmpliado_(), gerarPoolEstendido_(), gerarPoolMassivo_(), gerarPoolReversao_(), gerarPoolFino_(), gerarPoolNovasClasses_(), gerarPoolPadroes_()); const a = rodarLista_(__f, lista), b = rodarLista_(__t, lista), ruins = [];
  for (let k = 0; k < lista.length; k++) { if (a[k].erro || b[k].erro) { ruins.push(lista[k].id + ' ERRO ' + (a[k].erro || b[k].erro)); continue; }
    // compara a equity até cutN-2 (a última barra do truncado pode ter posição aberta marcada a mercado)
    let dif = 0; for (let i = 0; i < __t.closes.length - 1; i++) if (Math.abs(a[k].eqCurve[i] - b[k].eqCurve[i]) > 1e-6 * a[k].eqCurve[i]) { dif = i; break; }
    if (dif) ruins.push(lista[k].id + ' difere na barra ' + dif + ' de ' + __t.closes.length); }
  return {total: lista.length, ruins: ruins}; })()`);
console.log(JSON.stringify(bad, null, 1));

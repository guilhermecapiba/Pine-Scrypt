// Pesquisa com dados reais (BASE_*.csv exportadas da planilha). Usa o mesmo motor do script.
const fs = require('fs'), path = require('path');
const { ctx, vm } = require('../testes/harness.js');
const run = c => vm.runInContext(c, ctx);
function loadO(sym) {
  const rows = fs.readFileSync(path.join(__dirname, 'BASE_' + sym + '.csv'), 'utf8').trim().split('\n').map(l => l.split(','));
  const o = { dates: [], opens: [], highs: [], lows: [], closes: [], volumes: [] };
  rows.forEach(r => { if (!(+r[4] > 0)) return; o.dates.push(new Date(r[0] + 'T00:00:00Z')); o.opens.push(+r[1]); o.highs.push(+r[2]); o.lows.push(+r[3]); o.closes.push(+r[4]); o.volumes.push(+r[5] || 0); });
  return o;
}
function withBtc(o) { ctx.__o = o; ctx.__b = loadO('BTC'); run('__o.btcC = alinharBtc_(__o, __b)'); return o; }
module.exports = { withBtc, ctx, vm, run, loadO };

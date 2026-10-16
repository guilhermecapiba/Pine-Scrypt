// Fluxo completo com os dados REAIS exportados da planilha (tools/pesquisa/BASE_*.csv).
const { ctx, vm, sheets, props, mails } = require('./harness.js');
const fs = require('fs'), path = require('path');
const run = c => vm.runInContext(c, ctx), sh = n => sheets.find(s => s.name === n);
const dir = path.join(__dirname, '../pesquisa');
const real = {};
['BTC','ETH','BNB','XRP','SOL','TRX','ZEC','HYPE','DOGE','LINK','AAVE'].forEach(sym => { real[sym] = fs.readFileSync(path.join(dir, 'BASE_' + sym + '.csv'), 'utf8').trim().split('\n').map(l => { const p = l.split(','); return { date: new Date(p[0] + 'T00:00:00Z'), open: +p[1], high: +p[2], low: +p[3], close: +p[4], volume: +p[5] || 0 }; }).filter(c => c.close > 0); });
const symDe = par => { const m = String(par).toUpperCase().match(/^(BTC|XBT|ETH|BNB|XRP|SOL|TRX|ZEC|HYPE|DOGE|XDG|LINK|AAVE)/); return m ? (m[1] === 'XBT' ? 'BTC' : m[1] === 'XDG' ? 'DOGE' : m[1]) : null; };
const curto = process.env.CURTO ? process.env.CURTO.split(',') : [];   // moedas cuja 1ª fonte devolve histórico curto
['binance','okx','bybit','kucoin','coinbase','kraken','bitfinex','mexc','gate'].forEach(k => {
  ctx.__ad = (par, o) => { const sym = symDe(par); let s = real[sym]; if (!s) return []; if (k === 'binance' && curto.indexOf(sym) >= 0) s = s.slice(-500); if (o && o.dias) s = s.slice(-o.dias); return s.map(c => ({ ...c })); };
  vm.runInContext('ADAPTADORES.' + k + ' = __ad', ctx);
});
run('setupPlanilha()');
for (let k = 0; k < 8; k++) { const r = run('motorTop10(true)'); console.log('rodada', k, JSON.stringify(r)); if (!r.restantes) break; }
const dump = (n, rows, cols) => { const s = sh(n); for (let r = 1; r <= Math.min(rows, s.getLastRow()); r++) { const row = []; for (let c = 1; c <= cols; c++) row.push(s.cells[r + ',' + c] === undefined ? '' : s.cells[r + ',' + c]); console.log(row.join(' | ')); } };
dump('PAINEL_TOP10', 16, 16);
console.log('--- ESTRATEGIAS'); const e = sh('ESTRATEGIAS_TOP10'); for (let r = 2; r <= e.getLastRow(); r++) { const g = c => e.cells[r + ',' + c] === undefined ? '' : e.cells[r + ',' + c]; if (g(1) && g(2) !== undefined) console.log([g(1), g(2), g(3), g(5).toString().slice(0, 38), g(7), g(15), 'H', g(16), '24m', g(17), '12m', g(18)].join(' | ')); }
if (process.env.AUD) { run('auditoria()'); console.log('--- AUDITORIA'); dump('AUDITORIA', 400, 5); }
console.log('props bytes', Object.keys(props).filter(k => /^(RES|SEL)_/.test(k)).map(k => k + ':' + props[k].length).join(' '));
Object.keys(props).filter(k => /^BASE|HIST/.test(k)).forEach(k => console.log(k, props[k]));
for (const s of ['XRP']) console.log('BASE_XRP linhas', sh('BASE_XRP').getLastRow());

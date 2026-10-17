// Fluxo completo da planilha ALT/BTC com os dados REAIS (BASE_*.csv, em dólar): setup, sementes, carga, painéis e auditoria.
process.env.SRC = process.env.SRC || require('path').join(__dirname, '../../apps_script/Alts_BTC_v1.gs');
const { ctx, vm, sheets, props, mails } = require('./harness.js');
const fs = require('fs'), path = require('path');
const run = c => vm.runInContext(c, ctx), sh = n => sheets.find(s => s.name === n);
const dir = path.join(__dirname, '../pesquisa');
const real = {};
['BTC','ETH','BNB','XRP','SOL','TRX','ZEC','HYPE','DOGE','LINK','AAVE'].forEach(sym => { real[sym] = fs.readFileSync(path.join(dir, 'BASE_' + sym + '.csv'), 'utf8').trim().split('\n').map(l => { const p = l.split(','); return { date: new Date(p[0] + 'T00:00:00Z'), open: +p[1], high: +p[2], low: +p[3], close: +p[4], volume: +p[5] || 0 }; }).filter(c => c.close > 0); });
const symDe = par => { const m = String(par).toUpperCase().match(/^(BTC|XBT|ETH|BNB|XRP|SOL|TRX|ZEC|HYPE|DOGE|XDG|LINK|AAVE)/); return m ? (m[1] === 'XBT' ? 'BTC' : m[1] === 'XDG' ? 'DOGE' : m[1]) : null; };
['binance','okx','bybit','kucoin','coinbase','kraken','bitfinex','mexc','gate'].forEach(k => {
  ctx.__ad = (par, o) => { const sym = symDe(par); let s = real[sym]; if (!s) return []; if (o && o.dias) s = s.slice(-o.dias); return s.map(c => ({ ...c })); };
  vm.runInContext('ADAPTADORES.' + k + ' = __ad', ctx);
});
// o "hoje" do teste: o dia seguinte à última vela dos CSVs, para sanearSerie_ não descartar a última vela
const hoje = new Date('2026-10-16T12:00:00Z'), RealDate = Date;
global.Date = class extends RealDate { constructor(...a) { if (a.length) super(...a); else super(hoje.getTime()); } static now() { return hoje.getTime(); } };
ctx.Date = global.Date;
run('setupPlanilha()');
console.log('universo', run("universo_().map(function(u){return u.sym+':'+u.status}).join(' ')"));
console.log('sementes gravadas:', Object.keys(props).filter(k => /^SEL_/.test(k)).join(','), '| linhas SELECAO_CANDIDATAS', sh('SELECAO_CANDIDATAS').getLastRow() - 1);
for (let k = 0; k < 10; k++) { const r = run('motorTop10(true)'); console.log('rodada', k, JSON.stringify(r)); if (!r.restantes) break; }
const dump = (n, rows, cols) => { const s = sh(n); for (let r = 1; r <= Math.min(rows, s.getLastRow()); r++) { const row = []; for (let c = 1; c <= cols; c++) row.push(s.cells[r + ',' + c] === undefined ? '' : String(s.cells[r + ',' + c]).slice(0, 60)); console.log(row.join(' | ')); } };
dump('PAINEL_ALTS_BTC', 16, 16);
console.log('--- ESTRATEGIAS'); const e = sh('ESTRATEGIAS_ALTS_BTC'); for (let r = 2; r <= e.getLastRow(); r++) { const g = c => e.cells[r + ',' + c] === undefined ? '' : e.cells[r + ',' + c]; if (g(1) && g(2) !== undefined) console.log([g(1), g(2), g(3), String(g(5)).slice(0, 44), g(7), g(15), 'H', g(16), '24m', g(17), '12m', g(18)].join(' | ')); }
console.log('--- DESEMPENHO'); dump('DESEMPENHO_ALTS_BTC', 16, 22);
if (process.env.AUD) { run('auditoria()'); console.log('--- AUDITORIA'); dump('AUDITORIA', 400, 5); }
console.log('BASE_BTC linhas', sh('BASE_BTC').getLastRow(), '| BASE_ETH linhas', sh('BASE_ETH').getLastRow(), '| 1ª linha ETH', [1,2,3,4,5].map(c => sh('BASE_ETH').cells['2,' + c]).join(','));
console.log('emails', mails.length);
// ---- gatilhos e redundância ----
console.log('--- redundância');
run('motorDiarioRedundancia()');
console.log('LOG_DISPAROS:', [2,3,4].map(r => { const s = sh('LOG_DISPAROS'); return [1,2,3,6].map(c => String(s.cells[r + ',' + c] === undefined ? '' : s.cells[r + ',' + c]).slice(0, 60)).join('/'); }).join(' || '), '| e-mails', mails.length);
ctx.__x = JSON.stringify(Object.assign(JSON.parse(props['RES_ETH']), { ultimaVela: '2026-10-13' })); run("PropertiesService.getScriptProperties().setProperty('RES_ETH', __x)");
const atr = run('verificarAtualizacao_()'); console.log('desatualizadas (esperado ETH):', JSON.stringify(atr), '| e-mails', mails.length, '| assunto', mails.length ? mails[mails.length - 1].subject : '');
run('verificarAtualizacao_()'); console.log('segunda chamada no mesmo dia não reenvia: e-mails', mails.length);
const trig = []; ctx.__t = trig;
run('instalarGatilhosAutomaticos()'); console.log('gatilhos instalados sem erro');

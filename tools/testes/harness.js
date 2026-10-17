const fs = require('fs'), vm = require('vm');
const SRC = process.env.SRC || require('path').join(__dirname, '../../apps_script/Crypto_Top10_v1.gs');
// ---------- mocks ----------
class Range {
  constructor(sh, r, c, nr, nc) { this.sh = sh; this.r = r; this.c = c; this.nr = nr || 1; this.nc = nc || 1; }
  getValues() { const o = []; for (let i = 0; i < this.nr; i++) { const row = []; for (let j = 0; j < this.nc; j++) { const v = this.sh.cells[(this.r + i) + ',' + (this.c + j)]; row.push(v === undefined ? '' : v); } o.push(row); } return o; }
  setValues(v) { if (v.length !== this.nr || v.some(r => r.length !== this.nc)) throw new Error('O número de colunas nos dados não corresponde ao intervalo: dados ' + v.length + 'x' + (v[0] || []).length + ' vs intervalo ' + this.nr + 'x' + this.nc + ' (' + this.sh.name + ')'); for (let i = 0; i < v.length; i++) for (let j = 0; j < v[i].length; j++) { this.sh.cells[(this.r + i) + ',' + (this.c + j)] = v[i][j]; this.sh.maxRow = Math.max(this.sh.maxRow, this.r + i); } return this; }
  setValue(v) { return this.setValues([[v]]); }
  clearContent() { for (let i = 0; i < this.nr; i++) for (let j = 0; j < this.nc; j++) delete this.sh.cells[(this.r + i) + ',' + (this.c + j)]; return this; }
}
['setNumberFormat','setBackground','setFontWeight','setFontColor','setFontSize','setWrap','setVerticalAlignment','setHorizontalAlignment'].forEach(m => Range.prototype[m] = function () { return this; });
class Sheet {
  constructor(name) { this.name = name; this.cells = {}; this.maxRow = 0; }
  getLastColumn() { let m = 1; for (const k in this.cells) { if (this.cells[k] !== '') m = Math.max(m, +k.split(',')[1]); } return m; }
  getLastRow() { let m = 0; for (const k in this.cells) { if (this.cells[k] !== '' ) m = Math.max(m, +k.split(',')[0]); } return m; }
  getRange(r, c, nr, nc) { return new Range(this, r, c, nr, nc); }
  clear() { this.cells = {}; return this; }
  appendRow(a) { const r = this.getLastRow() + 1; a.forEach((v, j) => this.cells[r + ',' + (j + 1)] = v); }
  setName(n) { this.name = n; } getName() { return this.name; } setFrozenRows() {} setFrozenColumns() {} setColumnWidth() {}
}
const sheets = [];
const SS = { getId: () => '1WubiUb2K9s8J_a9AGfqphKYFFYi6ezAWCVBqn21A0jk',
  getSheets: () => sheets,
  getSheetByName: n => sheets.find(s => s.name === n) || null,
  insertSheet: n => { const s = new Sheet(n); sheets.push(s); return s; },
  setActiveSheet() {}, moveActiveSheet() {}, setSpreadsheetTimeZone() {}, toast: m => {}, };
sheets.push(new Sheet('Página1'));
const props = {}, mails = [];
const ctx = vm.createContext({
  console, Math, JSON, Date, Object, Array, String, Number, parseInt, parseFloat, isNaN, isFinite, Infinity, NaN, Error,
  Logger: { log: m => { if (process.env.V) console.log('[log]', m); } },
  SpreadsheetApp: { getActiveSpreadsheet: () => SS, getUi: () => ({ alert: () => {}, createMenu: () => ({ addItem() { return this; }, addSeparator() { return this; }, addToUi() {} }), ButtonSet: { OK: 1 } }), openById: () => SS },
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] === undefined ? null : props[k], setProperty: (k, v) => { if (String(v).length > 9000) throw new Error('Propriedade > 9KB: ' + k + ' (' + String(v).length + ')'); props[k] = String(v); } }) },
  CacheService: { getScriptCache: () => ({ get: () => null, put: () => {} }) },
  LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
  MailApp: { sendEmail: m => mails.push(m) },
  ScriptApp: { getProjectTriggers: () => [], newTrigger: () => { const t = { timeBased() { return t; }, everyDays() { return t; }, atHour() { return t; }, nearMinute() { return t; }, inTimezone() { return t; }, onWeekDay() { return t; }, everyHours() { return t; }, create() {} }; return t; }, WeekDay: {} },
  Utilities: {
    formatDate: (d, tz, f) => { const p = x => String(x).padStart(2, '0'); const Y = d.getUTCFullYear(), M = p(d.getUTCMonth() + 1), D = p(d.getUTCDate()); return f === 'yyyy-MM-dd' ? Y + '-' + M + '-' + D : f.replace('yyyy', Y).replace('MM', M).replace('dd', D).replace('HH', p(d.getUTCHours())).replace('mm', p(d.getUTCMinutes())).replace('ss', p(d.getUTCSeconds())); },
    computeDigest: (a, s) => Array.from(require('crypto').createHash('md5').update(s).digest()).map(b => b > 127 ? b - 256 : b), DigestAlgorithm: { MD5: 1 }, Charset: { UTF_8: 1 }, sleep() {},
  },
  UrlFetchApp: { fetch: () => { throw new Error('rede indisponível no teste'); } }, DriveApp: {},
});
vm.runInContext(fs.readFileSync(SRC, 'utf8'), ctx, { filename: 'Crypto_Top10_v1.gs' });
// ---------- dados sintéticos derivados do BTC ----------
const csv = fs.readFileSync(require('path').join(__dirname, '../../data/btc_1d_ohlcv.csv'), 'utf8').trim().split('\n').slice(1).map(l => { const p = l.split(','); return { t: Date.parse(p[0] + 'T00:00:00Z'), o: +p[1], h: +p[2], l: +p[3], c: +p[4], v: +p[5] }; });
let seed = 42; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
const dados = {};
const cfgs = { ETH: [2300, 1.2], BNB: [1900, 0.9], XRP: [1700, 1.1], SOL: [1900, 1.5], TRX: [2000, 0.7], ZEC: [3300, 1.0], HYPE: [690, 1.6], DOGE: [2600, 1.3], LINK: [2200, 1.3], AAVE: [2000, 1.5] };
Object.keys(cfgs).forEach(sym => {
  const [len, beta] = cfgs[sym], base = csv.slice(-len); let c = 10 + rnd() * 90; const out = [];
  base.forEach((b, i) => { const r0 = i ? b.c / base[i - 1].c - 1 : 0; const r = beta * r0 + 0.02 * gauss(); const o = c * (1 + 0.004 * gauss()); c = Math.max(0.001, c * (1 + r)); const h = Math.max(o, c) * (1 + Math.abs(0.01 * gauss())), l = Math.min(o, c) * (1 - Math.abs(0.01 * gauss())); out.push({ date: new Date(b.t), open: o, high: h, low: l, close: c, volume: b.v }); });
  dados[sym] = out;
});
dados.BTC = csv.map(b => ({ date: new Date(b.t), open: b.o, high: b.h, low: b.l, close: b.c, volume: b.v }));
const symDe = par => { const m = String(par).toUpperCase().match(/^(BTC|XBT|ETH|BNB|XRP|SOL|TRX|ZEC|HYPE|DOGE|XDG|LINK|AAVE)/); return m ? (m[1] === 'XBT' ? 'BTC' : m[1] === 'XDG' ? 'DOGE' : m[1]) : null; };
const mkAd = nome => (par, o) => { const s = dados[symDe(par)]; if (!s) return []; const lim = o && o.dias ? s.slice(-o.dias) : s; return lim.map(c => ({ ...c })); };
['binance','okx','bybit','kucoin','coinbase','kraken','bitfinex'].forEach(k => { ctx.__ad = mkAd(k); vm.runInContext('ADAPTADORES.' + k + ' = __ad', ctx); });
module.exports = { ctx, vm, sheets, props, mails, dados, SS };

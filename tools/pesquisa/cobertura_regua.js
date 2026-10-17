process.env.SRC = require('path').join(__dirname, '../../apps_script/Alts_BTC_v1.gs');
const { ratio, setCfg, ctx, run, loadO } = require('./ratio.js');
const V = { atual: [1.0, 0.8, 0.4], v3: [0.6, 0.3, 0.0], v4: [0.4, 0.0, 0.0] };
const [h, a, b] = V[process.env.VAR];
setCfg('SELECAO_SHARPE_MIN', h); setCfg('SELECAO_SHARPE_MIN_24M', a); setCfg('SELECAO_SHARPE_MIN_12M', b); setCfg('SELECAO_PISO_PROVISORIO', h); setCfg('SELECAO_ORCAMENTO_SEG', 3000);
const res = [];
for (const s of ['ETH','BNB','XRP','SOL','TRX','ZEC','HYPE','DOGE','LINK','AAVE']) {
  const o = ratio(s); ctx.__o = o; ctx.__b = loadO('BTC'); run('__o.btcC = alinharBtc_(__o, __b); aparaInicio_(__o)');
  const r = run('(function(){ const x = selecionar_(__o, todosDefs_()); return { e: x.ids.length, n: x.nTestados }; })()');
  res.push(s + ':' + r.e);
}
console.log(process.env.VAR, h + '/' + a + '/' + b, res.join(' '));

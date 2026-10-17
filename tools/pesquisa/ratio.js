// Séries ALT/BTC a partir das BASE_*.csv (USD). Mesma construção do script Alts_BTC_v1.gs (ratioSerie_).
const { ctx, vm, run, loadO } = require('./real.js');
function ratio(sym) {
  const a = loadO(sym), b = loadO('BTC'), m = {}; b.dates.forEach((d, i) => m[+d] = i);
  const o = { dates: [], opens: [], highs: [], lows: [], closes: [], volumes: [] };
  a.dates.forEach((d, i) => {
    const j = m[+d]; if (j === undefined) return;
    const op = a.opens[i] / b.opens[j], cl = a.closes[i] / b.closes[j];
    o.dates.push(d); o.opens.push(op); o.closes.push(cl);
    o.highs.push(Math.max(op, cl, a.highs[i] / b.closes[j])); o.lows.push(Math.min(op, cl, a.lows[i] / b.closes[j])); o.volumes.push(a.volumes[i]);
  });
  return o;
}
function setCfg(k, v) { run(`CFG_PADRAO.forEach(function(c){ if (c[0]==='${k}') c[1]=${JSON.stringify(v)}; })`); }
module.exports = { ratio, setCfg, ctx, run, loadO };
if (require.main === module) {
  setCfg('SELECAO_SHARPE_MIN_24M', 0.8); setCfg('SELECAO_SHARPE_MIN_12M', 0.4); setCfg('SELECAO_SHARPE_MIN', 1.0);
  const SYMS = (process.env.SYMS || 'ETH,BNB,XRP,SOL,TRX,ZEC,HYPE,DOGE,LINK,AAVE').split(',');
  for (const s of SYMS) {
    const o = ratio(s); ctx.__o = o; ctx.__b = loadO('BTC'); run('__o.btcC = alinharBtc_(__o, __b); aparaInicio_(__o)');
    const t0 = Date.now();
    const r = run(`(function(){ const s = selecionar_(__o, todosDefs_()); const c = {PLENA:0,'RECENTE FRACA':0,PROVISORIA:0,FORA:0}; s.detalhe.forEach(function(d){ if(d.nivel) c[d.nivel]++; });
      return { n: __o.closes.length, ids: s.ids, vagas: s.vagas, test: s.nTestados, eleg: s.nElegiveis, niv: c, inter: s.interrompida }; })()`);
    console.log(s, 'velas', r.n, 'escolhidas', r.ids.length, 'vagas', r.vagas, 'testados', r.test, 'elegiveis', r.eleg, JSON.stringify(r.niv), r.inter ? 'INTERROMPIDA' : '', ((Date.now() - t0) / 1000).toFixed(0) + 's');
  }
}

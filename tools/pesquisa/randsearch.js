// Quantos candidatos aleatórios (famílias clássicas, parâmetros sorteados) cruzam Sharpe >= 1 no histórico? Mede o efeito do tamanho da busca.
const { ctx, run, loadO, withBtc } = require('./real.js');
const syms = (process.env.SYMS || 'TRX,DOGE,LINK').split(','), N = +(process.env.N || 3000);
for (const s of syms) {
  const o = withBtc(loadO(s)); ctx.__o = o; ctx.__N = N;
  const out = run(`(function(){ let seed = 12345; const rnd = function(){ return (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296; }; const pick = function(a){ return a[Math.floor(rnd()*a.length)]; }; const ri = function(a,b){ return a + Math.floor(rnd()*(b-a+1)); };
    const defs = []; for (let k = 0; k < __N; k++) { const t = ri(0, 9); let d;
      if (t===0) { const f = ri(3,60), sl = ri(f+5, 250); d = {id:'R-EX'+f+'-'+sl, fam:'cruzamento', fn: candCruzamento_('ema', f, sl)}; }
      else if (t===1) { const f = ri(3,60), sl = ri(f+5, 250); d = {id:'R-SX'+f+'-'+sl, fam:'cruzamento', fn: candCruzamento_('sma', f, sl)}; }
      else if (t===2) { const n = ri(5,200), m = ri(3, Math.max(4,n-1)); d = {id:'R-DON'+n+'-'+m, fam:'rompimento', fn: candDonchian_(n, m)}; }
      else if (t===3) { const a = ri(5,40), m = ri(10,60)/10; d = {id:'R-ST'+a+'-'+m, fam:'supertrend', fn: candSupertrend_(a, m)}; }
      else if (t===4) { const f = ri(4,30), sl = ri(f+6, 60), g = ri(3,20); d = {id:'R-MACD'+f+'-'+sl+'-'+g, fam:'momentum', fn: candMacd_(f, sl, g)}; }
      else if (t===5) { const n = ri(5,250), f = pick([0,50,100,200]); d = {id:'R-ROC'+n+'-'+f, fam:'momentum', fn: candMomCurto_(n, f)}; }
      else if (t===6) { const n = ri(10,60); d = {id:'R-CCI'+n, fam:'momentum', fn: candCci_(n)}; }
      else if (t===7) { const p = ri(10,100), k = ri(10,35)/10; d = {id:'R-BB'+p+'-'+k, fam:'rompimento', fn: candBollRompe_(p, k)}; }
      else if (t===8) { const p = ri(10,100), m = ri(10,40)/10; d = {id:'R-KC'+p+'-'+m, fam:'rompimento', fn: candKeltner_(p, m)}; }
      else { const p = ri(2,6), c = ri(5,30), sa = ri(40,75), tr = pick([100,150,200]); d = {id:'R-RSIP'+p+'-'+c+'-'+sa+'-'+tr, fam:'reversao', fn: candRsiPullback_(p, c, sa, tr)}; }
      d.nome = d.id; defs.push(d); }
    const w0 = Math.min(210, __o.closes.length-150), n = __o.closes.length; let ge1 = 0, plena = 0, max = -9; const top = [], plist = [];
    defs.forEach(function(e){ const r = rodarLista_(__o,[e])[0]; if (r.erro||!r.eqCurve) return; const nv = nivelSharpe_(r.eqCurve, n); if (nv.full>max) max = nv.full; if (nv.full>=1) { ge1++; } if (nv.nivel==='PLENA') { plena++; plist.push(e.id+':'+r_(nv.full,2)+'/'+r_(nv.s24,2)+'/'+r_(nv.s12,2)); } top.push([nv.full, e.id]); });
    top.sort(function(a,b){return b[0]-a[0]}); return {ge1:ge1, plena:plena, plist: plist.slice(0,12), max:r_(max,2), top:top.slice(0,4).map(function(x){return x[1]+':'+r_(x[0],2)})}; })()`);
  console.log(s, 'N=' + N, JSON.stringify(out));
}

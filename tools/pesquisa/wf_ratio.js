// Walk-forward da régua de Sharpe nas séries ALT/BTC: a cada 90 dias reseleciona (só com dados até T) e mede os 90 dias seguintes.
// VAR = nome da variante (h/24m/12m). Quando a moeda não fecha estratégias, a posição é BTC (retorno 0 na razão).
process.env.SRC = require('path').join(__dirname, '../../apps_script/Alts_BTC_v1.gs');
const { ratio, setCfg, ctx, run, loadO } = require('./ratio.js');
const V = { atual: [1.0, 0.8, 0.4, 'SIM'], v2: [0.8, 0.5, 0.2, 'SIM'], v3: [0.6, 0.3, 0.0, 'SIM'], v4: [0.4, 0.0, 0.0, 'SIM'], livre: [-9, -9, -9, 'NAO'] };
const [h, a, b, ex] = V[process.env.VAR || 'atual'];
setCfg('SELECAO_SHARPE_MIN', h); setCfg('SELECAO_SHARPE_MIN_24M', a); setCfg('SELECAO_SHARPE_MIN_12M', b); setCfg('SELECAO_EXIGE_PLENA', ex);
setCfg('SELECAO_PISO_PROVISORIO', h); setCfg('SELECAO_ORCAMENTO_SEG', 3000);
const SYMS = (process.env.SYMS || 'ETH,BNB,XRP,SOL,TRX,ZEC,DOGE,LINK,AAVE').split(','), H = 90, W0 = 210, STEP = +(process.env.STEP || 1);
const sharpe = r => { if (r.length < 30) return null; const mu = r.reduce((x, y) => x + y, 0) / r.length, sd = Math.sqrt(r.reduce((x, y) => x + (y - mu) ** 2, 0) / r.length); return sd > 0 ? mu / sd * Math.sqrt(365) : 0; };
const out = [];
for (const s of SYMS) {
  const full = ratio(s); ctx.__f = full; ctx.__b = loadO('BTC'); run('__f.btcC = alinharBtc_(__f, __b); aparaInicio_(__f)');
  const n = full.closes.length, st = [], bh = []; let tot = 0, cheias = 0, algum = 0, picks = 0, k = 0;
  for (let T = W0 + 730; T + 30 <= n; T += H) {
    if ((k++) % STEP) continue;
    ctx.__T = T;
    const ids = run(`(function(){ const t = { dates: __f.dates.slice(0,__T), opens: __f.opens.slice(0,__T), highs: __f.highs.slice(0,__T), lows: __f.lows.slice(0,__T), closes: __f.closes.slice(0,__T), volumes: __f.volumes.slice(0,__T), btcC: __f.btcC.slice(0,__T) };
      const r = selecionar_(t, POOL.concat(gerarPoolAmpliado_(), gerarPoolEstendido_(), gerarPoolMassivo_())); return r.ids; })()`);
    tot++; picks += ids.length; if (ids.length >= 5) cheias++; if (ids.length) algum++;
    const end = Math.min(n, T + H); ctx.__ids = ids;
    const eqs = ids.length ? run(`rodarLista_(__f, defsPorId_(__ids)).map(function(r){return r.eqCurve})`) : [];
    for (let i = T; i < end; i++) { let x = 0; eqs.forEach(e => x += e[i] / e[i - 1] - 1); st.push(eqs.length ? x / eqs.length : 0); bh.push(full.closes[i] / full.closes[i - 1] - 1); }
  }
  out.push({ s, S: sharpe(st), B: sharpe(bh), m: st.reduce((x, y) => x + y, 0) / st.length * 365 * 100, mb: bh.reduce((x, y) => x + y, 0) / bh.length * 365 * 100, d: st.length, picks: picks / tot, cheias: cheias / tot, algum: algum / tot, st, bh });
  console.log(process.env.VAR, s, st.length + 'd', 'Sharpe', (out[out.length - 1].S ?? NaN).toFixed(2), 'retorno a.a. %', out[out.length - 1].m.toFixed(0), '| segurar ALT Sharpe', out[out.length - 1].B.toFixed(2), 'ret %', out[out.length - 1].mb.toFixed(0), '| picks/rodada', (picks / tot).toFixed(1), 'rodadas com 5:', (cheias / tot * 100).toFixed(0) + '%', 'com algum:', (algum / tot * 100).toFixed(0) + '%');
}
const m = f => (out.reduce((x, r) => x + f(r), 0) / out.length).toFixed(2);
// painel agregado: média diária entre moedas (peso igual) nas mesmas datas relativas
console.log(process.env.VAR, 'MÉDIA Sharpe', m(r => r.S), 'ret a.a.%', m(r => r.m), '| segurar ALT Sharpe', m(r => r.B), 'ret a.a.%', m(r => r.mb), '| picks', m(r => r.picks), '| rodadas c/5', m(r => r.cheias * 100), '| c/algum', m(r => r.algum * 100));

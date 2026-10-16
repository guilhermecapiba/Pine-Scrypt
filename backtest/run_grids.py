"""Robustez por vizinhanca (platô) + correlacao/valor incremental vs painel de producao.
Uso: python3 backtest/run_grids.py"""
import sys, os; sys.path.insert(0, os.path.dirname(__file__))
import pandas as pd, numpy as np
from engine import backtest, metrics, sma, ema
from strategies import *
df = pd.read_csv('data/btc_1d_ohlcv.csv', parse_dates=['date'], index_col='date'); cut = df.index[int(len(df) * 0.7)]

def ev(fn, **kw):
    e, x, s, r = fn(df, **kw); eq, tr = backtest(df, e.fillna(False).values, x.fillna(False).values, stop_atr=s, tp_r=r)
    f = metrics(eq, tr, df); f['pf_oos'] = metrics(eq, tr, df, start=cut)['pf']; return f, eq
ok = lambda f: f['trades'] >= 30 and f['pf'] >= 1.3 and f['sharpe'] >= 1.05 and f['calmar'] >= 0.98 and f['maxdd'] <= 60 and f['cagr'] >= 29.5 and f['pf_oos'] >= 1.2
grids = {
 'DONCHIAN_N_M': (S_donchian, [dict(n=n, m=m) for n in (15, 20, 25, 30, 40) for m in (7, 10, 14, 20)]),
 'DONCHIAN_N_M_SMA200': (S_donchian, [dict(n=n, m=m, macro=200) for n in (20, 30, 40, 50) for m in (10, 14, 20)]),
 'BOLL_SQZ_K_BW': (S_boll_squeeze, [dict(k=k, bwl=b) for k in (1.75, 2.0, 2.25, 2.5) for b in (20, 50, 100)]),
 'BOLL_SQZ_K_BW_SMA200': (S_boll_squeeze, [dict(k=k, bwl=b, macro=200) for k in (1.75, 2.0, 2.25, 2.5) for b in (20, 50, 100)]),
 'STORMER_FAST_SLOW': (S_stormer_ema21, [dict(f=f, s=s) for f in (13, 17, 21, 26) for s in (40, 50, 60, 80)]),
 'COWEN_N_MACRO': (S_cowen20, [dict(n=n, l=l) for n in (15, 20, 25, 30) for l in (100, 150, 200)]),
 'BOLL_BREAKOUT_K_SMA': (S_boll_break50, [dict(k=k, l=l) for k in (1.75, 2.0, 2.25) for l in (30, 50, 100)]),
}
res = [dict(grid=g, params=str(kw), passa_regua=ok(f), **f) for g, (fn, ks) in grids.items() for kw in ks for f in [ev(fn, **kw)[0]]]
G = pd.DataFrame(res); G.to_csv('results/robustez_vizinhanca.csv', index=False)
print(G.groupby('grid').agg(n=('passa_regua', 'size'), passam=('passa_regua', 'sum'), calmar_mediano=('calmar', 'median')))

# correlacao e valor incremental no painel de producao (peso igual)
def eqof(fn, **kw): return ev(fn, **kw)[1]
e, x, _, _ = S_template(df, 10, 76, None, None)
prod = {'G-01 SMA90': eqof(lambda d: ((d.Close > sma(d.Close, 90)), (d.Close < sma(d.Close, 90)), None, None)),
        'G-05 EMA6x55': eqof(lambda d: ((ema(d.Close, 6) > ema(d.Close, 55)), (ema(d.Close, 6) < ema(d.Close, 55)), None, None)),
        'G-06 EMA200': eqof(lambda d: ((d.Close > ema(d.Close, 200)), (d.Close < ema(d.Close, 200)), None, None)),
        'M2-03 BollSqz v2': eqof(S_boll_squeeze, n=20, k=2.25, bwl=50, macro=200), 'Keltner 20/1.5/SMA200': eqof(S_keltner),
        'M2-02 EMA10x+SMA76': backtest(df, e.fillna(False).values, x.fillna(False).values)[0]}
cand = {'DONCHIAN_20_10': eqof(S_donchian, n=20, m=10), 'BOLL_SQZ_20_2.0': eqof(S_boll_squeeze, n=20, k=2.0, bwl=50),
        'STORMER_21_60': eqof(S_stormer_ema21, f=21, s=60), 'COWEN_20_150': eqof(S_cowen20, n=20, l=150),
        'EMA10_SMA90_ATR3_RR2.5': eqof(S_template, curto=10, longo=90, stop=3.0, rr=2.5)}
R = lambda s: s.pct_change().fillna(0)
P = pd.DataFrame({k: R(v) for k, v in prod.items()}); C = pd.DataFrame({k: R(v) for k, v in cand.items()})
corr = pd.concat([C, P], axis=1).corr().loc[C.columns, P.columns].round(2); corr.to_csv('results/correlacao_vs_producao.csv')
def st(r):
    q = (1 + r).cumprod(); y = len(r) / 365.25; cg = (q.iloc[-1] ** (1 / y) - 1) * 100; dd = (q / q.cummax() - 1).min() * -100
    return dict(cagr=round(cg, 1), maxdd=round(dd, 1), sharpe=round(r.mean() / r.std() * np.sqrt(365), 2), calmar=round(cg / dd, 2))
rows = [dict(painel='producao (6 estrategias, peso igual)', **st(P.mean(axis=1)))]
for k in C.columns: rows.append(dict(painel='producao + ' + k, corr_max=corr.loc[k].max(), **st(pd.concat([P, C[k]], axis=1).mean(axis=1))))
pd.DataFrame(rows).to_csv('results/valor_incremental_painel.csv', index=False); print(pd.DataFrame(rows).to_string())

"""Backtest padronizado BTC 1D (long-only, 100% equity, comissao 0.125%/lado, sinal no fechamento e
execucao na abertura seguinte). Reproduz G-01/G-06/Keltner da planilha MVP com ~1% de diferenca.
Uso (a partir da raiz do repo): python3 backtest/run_all.py"""
import sys, os; sys.path.insert(0, os.path.dirname(__file__))
import pandas as pd, numpy as np
from engine import backtest, metrics, sma, ema
from strategies import *

df = pd.read_csv('data/btc_1d_ohlcv.csv', parse_dates=['date'], index_col='date')
c = df.Close; cut = df.index[int(len(df) * 0.7)]          # IS 70% / OOS 30% (config IS_PERCENT)
yrs = (df.index[-1] - df.index[0]).days / 365.25
BH_CAGR = ((c.iloc[-1] / c.iloc[0]) ** (1 / yrs) - 1) * 100

def run(fn, **kw):
    e, x, s, r = fn(df, **kw)
    eq, tr = backtest(df, e.fillna(False).values, x.fillna(False).values, stop_atr=s, tp_r=r)
    f = metrics(eq, tr, df); o = metrics(eq, tr, df, start=cut)
    f.update(pf_oos=o['pf'], n_oos=o['trades'], cagr_oos=o['cagr'], sharpe_oos=o['sharpe'], maxdd_oos=o['maxdd'])
    f['alfa_vs_bh'] = round(f['cagr'] - BH_CAGR, 2)
    return f, eq

def regua(f):   # regua minima = BENCHMARK_* da 08_CONFIG + MIN_OOS_PROFIT_FACTOR
    return (f['trades'] >= 30 and f['pf'] >= 1.3 and f['sharpe'] >= 1.05 and f['calmar'] >= 0.98
            and f['maxdd'] <= 60 and f['cagr'] >= 29.5 and f['pf_oos'] >= 1.2)

CANDS = {  # nome canonico: (funcao, parametros)
 'SUPERTREND_10_EMA200': (S_supertrend_ema200, {}), 'SUPERTREND_MACD': (S_supertrend_macd, {}),
 'SUPERTREND_QQE': (S_supertrend_qqe, {}), 'STORMER_SWING_EMA21 (21,50 original)': (S_stormer_ema21, {}),
 'STORMER_SWING_EMA21 (21,60 refinada)': (S_stormer_ema21, dict(f=21, s=60)),
 'OLIVER_VELEZ_20SMA_PULLBACK': (S_velez_20sma, {}), 'LARRY_WILLIAMS_9.1': (S_larry91, {}),
 'MACD_EMA200': (S_macd_ema200, {}), 'BOLLINGER_SQUEEZE_20_2 (sem SMA200)': (S_boll_squeeze, {}),
 'BOLLINGER_BREAKOUT_50SMA': (S_boll_break50, {}), 'DONCHIAN_50_200': (S_donchian, dict(n=50, m=20, macro=200)),
 'DONCHIAN_20_10': (S_donchian, dict(n=20, m=10)), 'DONCHIAN_55_20': (S_donchian, dict(n=55, m=20)),
 'VWAP_30_SMA200': (S_vwap30_sma200, {}), 'COWEN_20D_SMA (20,200 original)': (S_cowen20, {}),
 'COWEN_20D_SMA (20,150 refinada)': (S_cowen20, dict(n=20, l=150)), 'CPR_PIVOT_BREAKOUT': (S_cpr, {}),
 'MARKET_CIPHER_B_PROXY': (S_mcb_proxy, {}),
 'EMA10_SMA90_ATR3_RR2.5 (template do pipeline)': (S_template, dict(curto=10, longo=90, stop=3.0, rr=2.5)),
 'REF producao: KELTNER_20_1.5_SMA200': (S_keltner, {}),
 'REF producao: BOLL_SQZ_SMA200_V2 (campea M2)': (S_boll_squeeze, dict(n=20, k=2.25, bwl=50, macro=200)),
 'REF producao: M2-02 EMA10 cross + SMA76': (lambda d: (lambda e, x, a, b: (e, x, None, None))(*S_template(d, 10, 76, None, None)), {}),
 'REF benchmark: KELTNER_12_2.5_SMA90': (S_keltner, dict(n=12, k=2.5, l=90)),
}
rows = []
for name, (fn, kw) in CANDS.items():
    f, _ = run(fn, **kw); rows.append(dict(estrategia=name, passa_regua=regua(f), **f))
R = pd.DataFrame(rows); R.to_csv('results/candidatos_vs_producao_btc1d.csv', index=False)
print(f'B&H CAGR {BH_CAGR:.1f}%  corte IS/OOS {cut.date()}'); print(R.to_string())

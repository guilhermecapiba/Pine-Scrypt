"""Classifica as linhas de 05_RESERVADAS com o backtest padronizado.
Uso: python3 backtest/classify_reservadas.py <export_xlsx_da_planilha_de_videos>"""
import sys, os, re; sys.path.insert(0, os.path.dirname(__file__))
import pandas as pd, numpy as np
from engine import backtest, metrics
from strategies import S_template

df = pd.read_csv('data/btc_1d_ohlcv.csv', parse_dates=['date'], index_col='date'); cut = df.index[int(len(df) * 0.7)]
yrs = (df.index[-1] - df.index[0]).days / 365.25; BH = ((df.Close.iloc[-1] / df.Close.iloc[0]) ** (1 / yrs) - 1) * 100
C = pd.read_csv('results/candidatos_vs_producao_btc1d.csv').set_index('estrategia')
NAME = {'SUPERTREND_10_EMA200_1D': 'SUPERTREND_10_EMA200', 'SUPERTREND_MACD_1D': 'SUPERTREND_MACD', 'SUPERTREND_QQE_1D': 'SUPERTREND_QQE',
 'STORMER_SWING_EMA21_1D': 'STORMER_SWING_EMA21 (21,60 refinada)', 'OLIVER_VELEZ_20SMA_PULLBACK_1D': 'OLIVER_VELEZ_20SMA_PULLBACK',
 'LARRY_WILLIAMS_9.1_1D': 'LARRY_WILLIAMS_9.1', 'MACD_EMA200_1D': 'MACD_EMA200', 'BOLLINGER_SQUEEZE_1D': 'BOLLINGER_SQUEEZE_20_2 (sem SMA200)',
 'BOLLINGER_BREAKOUT_50SMA_1D': 'BOLLINGER_BREAKOUT_50SMA', 'DONCHIAN_50_200_1D': 'DONCHIAN_50_200', 'DONCHIAN_20_10_1D': 'DONCHIAN_20_10',
 'DONCHIAN_55_20_1D': 'DONCHIAN_55_20', 'VWAP_30_SMA200_1D': 'VWAP_30_SMA200', 'KELTNER_20_1.5_SMA200_1D': 'REF producao: KELTNER_20_1.5_SMA200',
 'COWEN_20D_SMA_1D': 'COWEN_20D_SMA (20,150 refinada)', 'CPR_PIVOT_BREAKOUT_1D': 'CPR_PIVOT_BREAKOUT', 'MARKET_CIPHER_B_PROXY_1D': 'MARKET_CIPHER_B_PROXY',
 'BOLLINGER_SQUEEZE_SMA200_V2': 'REF producao: BOLL_SQZ_SMA200_V2 (campea M2)'}

def motivos(m):
    f = []
    if m.trades < 30: f.append(f'trades {int(m.trades)}<30')
    if m.pf < 1.3: f.append('PF<1.3')
    if m.sharpe < 1.05: f.append(f'Sharpe {m.sharpe}<1.05')
    if m.calmar < 0.98: f.append(f'Calmar {m.calmar}<0.98')
    if m.maxdd > 60: f.append(f'MaxDD {m.maxdd}>60')
    if m.cagr < 29.5: f.append(f'CAGR {m.cagr}<29.5')
    if m.pf_oos < 1.2: f.append(f'PF_OOS {m.pf_oos}<1.2')
    return '; '.join(f)

def tpl(cu, lo, st, rr):
    e, x, a, b = S_template(df, int(cu), int(lo), st, rr); eq, t = backtest(df, e.fillna(False).values, x.fillna(False).values, stop_atr=a, tp_r=b)
    f = metrics(eq, t, df); o = metrics(eq, t, df, start=cut)
    return pd.Series(dict(trades=f['trades'], pf=f['pf'], sharpe=f['sharpe'], maxdd=f['maxdd'], cagr=f['cagr'], calmar=f['calmar'], pf_oos=o['pf']))

r = pd.read_excel(sys.argv[1], sheet_name='05_RESERVADAS'); out = []; seen = {}; tcache = {}
for i, x in r.iterrows():
    sid, nome, st0 = str(x.Strategy_ID), str(x.Nome_Setup), str(x.Status_Refino)
    key = m = None; status = ''; obs = ''
    p = re.match(r'Curto=(\d+), Longo=(\d+), Stop=([\d.]+)ATR, TP=([\d.]+)R', str(x.Parametros))
    if st0.startswith(('REPROVADA', 'APROVADA_REFINO_DD')) and sid.startswith('STRAT'):
        status, obs = 'DUPLICATA_LINHA_REAVALIACAO', 'Segunda linha do mesmo STRAT (reavaliacao com regua 42%/PF 2.40, divergente da 08_CONFIG)'
    elif p:
        t = tuple(float(v) for v in p.groups()); key = 'TPL' + str(t)
        if t not in tcache: tcache[t] = tpl(*t)
        m = tcache[t]
    elif nome in NAME:
        key = NAME[nome]; m = C.loc[key]
    elif sid.startswith('HYP-') and not sid.startswith('HYP-Q'):
        status, obs = 'DESCARTADA_REGRA_NAO_FORMALIZADA', 'Rotulo de indicador sem regra testavel; origem "Deducao propria" ou URL invalida; metricas do simulador JS nao reproduziveis'
    if m is not None:
        if key in seen: status, obs = 'DUPLICATA_DE_' + seen[key], 'Mesma regra e parametros ja avaliados'
        else:
            seen[key] = sid
            if key.startswith('REF producao'): status = 'EM_PRODUCAO'
            elif not motivos(m): status = 'PROMISSORA_PINE_GERADO' if key in ('DONCHIAN_20_10', 'BOLLINGER_SQUEEZE_20_2 (sem SMA200)', 'TPL(10.0, 90.0, 3.0, 2.5)') else (
                'PROMISSORA_VARIANTE_COBERTA_PELO_PINE_EMA10_SMA90' if key.startswith('TPL') else 'REFINADA_PROMISSORA_PINE_GERADO')
            else: status, obs = 'REPROVADA_REGUA_PADRONIZADA', motivos(m)
    row = dict(Linha_Planilha=i + 2, Strategy_ID=sid, Nome_Setup=nome, Status_Atual=st0[:60], Status_Proposto=status, Chave_Canonica=key or '', Observacao=obs)
    if m is not None: row.update(Trades=m.trades, PF=m.pf, Sharpe=m.sharpe, MaxDD=m.maxdd, CAGR=m.cagr, Calmar=m.calmar, PF_OOS=m.pf_oos,
                                  **{'CAGR_BuyHold_BTC_%': round(BH, 2), 'Alfa_vs_BTC_%': round(m.cagr - BH, 2)})
    out.append(row)
O = pd.DataFrame(out); O.to_csv('results/status_reservadas_proposto.csv', index=False)
print(O.Status_Proposto.value_counts().to_string())
print(O[O.Status_Proposto.str.startswith(('PROMISS', 'REFINADA', 'EM_PROD'))][['Strategy_ID', 'Nome_Setup', 'Status_Proposto', 'Trades', 'PF', 'Sharpe', 'MaxDD', 'CAGR', 'Calmar']].to_string())

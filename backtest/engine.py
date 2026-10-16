import numpy as np, pandas as pd

def load_btc(path):
    d=pd.read_excel(path,sheet_name='BASE_DADOS_BTC_1D')
    d=d.rename(columns={'Data':'date'})[['date','Open','High','Low','Close','Volume']]
    d['date']=pd.to_datetime(d['date']); d=d.dropna(subset=['Close']).set_index('date').sort_index()
    return d.astype(float)

def sma(x,n): return x.rolling(n).mean()
def ema(x,n): return x.ewm(span=n,adjust=False,min_periods=n).mean()
def rma(x,n): return x.ewm(alpha=1/n,adjust=False,min_periods=n).mean()
def atr(df,n=14):
    pc=df.Close.shift(); tr=pd.concat([df.High-df.Low,(df.High-pc).abs(),(df.Low-pc).abs()],axis=1).max(axis=1)
    return rma(tr,n)

def backtest(df, entry, exit_, fee=0.00125, stop_atr=None, atr_n=14, tp_r=None, allow_reentry=True):
    """Long-only, 100% equity. Signals evaluated at close of bar t, fills at open of t+1 (TradingView default).
    stop_atr/tp_r: ATR stop & R-multiple target fixed at entry (intrabar via high/low, stop first if both)."""
    o,h,l,c=df.Open.values,df.High.values,df.Low.values,df.Close.values
    e=np.asarray(entry,bool); x=np.asarray(exit_,bool); a=atr(df,atr_n).values
    n=len(df); eq=np.empty(n); cash=1.0; qty=0.0; pos=False; ep=0.0; sl=tp=np.nan
    trades=[]; eq_cur=1.0
    pend_e=pend_x=False; sl_sig=tp_sig=np.nan
    for i in range(n):
        # execute pending orders at open
        if pend_x and pos:
            px=o[i]; cash=qty*px*(1-fee); trades.append((ep_i,i,ep,px,cash/cost-1)); qty=0; pos=False
        if pend_e and not pos:
            px=o[i]; cost=cash; qty=cash*(1-fee)/px; ep=px; ep_i=i; pos=True; cash=0
            sl,tp=sl_sig,tp_sig
        pend_e=pend_x=False
        # intrabar stop / target
        if pos and not np.isnan(sl):
            hit=None
            if l[i]<=sl: hit=min(sl,o[i])
            elif not np.isnan(tp) and h[i]>=tp: hit=max(tp,o[i])
            if hit is not None:
                cash=qty*hit*(1-fee); trades.append((ep_i,i,ep,hit,cash/cost-1)); qty=0; pos=False
        eq[i]=cash+qty*c[i]
        # signals at close for next bar
        if pos and x[i]: pend_x=True
        if (not pos) and e[i]:
            pend_e=True
            if stop_atr is not None and not np.isnan(a[i]):
                sl_sig=c[i]-stop_atr*a[i]; tp_sig=c[i]+(c[i]-sl_sig)*tp_r if tp_r else np.nan
            else: sl_sig=tp_sig=np.nan
    if pos:  # mark open trade
        trades.append((ep_i,n-1,ep,c[-1],qty*c[-1]*(1-fee)/cost-1))
    return pd.Series(eq,index=df.index), pd.DataFrame(trades,columns=['i0','i1','p0','p1','ret'])

def metrics(eq, tr, df, start=None):
    if start is not None: eq=eq[eq.index>=start]; eq=eq/eq.iloc[0]
    r=eq.pct_change().dropna(); yrs=(eq.index[-1]-eq.index[0]).days/365.25
    cagr=(eq.iloc[-1]**(1/yrs)-1)*100 if eq.iloc[-1]>0 else -100
    dd=(eq/eq.cummax()-1).min()*-100
    sharpe=r.mean()/r.std()*np.sqrt(365) if r.std()>0 else 0
    dn=r[r<0].std(); sortino=r.mean()/dn*np.sqrt(365) if dn and dn>0 else 0
    if start is not None: tr=tr[tr.i0.map(lambda i: df.index[i]>=start)]
    w=tr.ret[tr.ret>0].sum(); lo=-tr.ret[tr.ret<=0].sum()
    pf=w/lo if lo>0 else np.inf
    return dict(trades=len(tr),win=round((tr.ret>0).mean()*100,2) if len(tr) else 0,pf=round(pf,2),sharpe=round(sharpe,2),
        sortino=round(sortino,2),maxdd=round(dd,2),cagr=round(cagr,2),calmar=round(cagr/dd,2) if dd>0 else 0,
        net=round((eq.iloc[-1]-1)*100,1),expect=round(tr.ret.mean()*100,2) if len(tr) else 0)

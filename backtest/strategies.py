import numpy as np, pandas as pd
from engine import sma, ema, rma, atr

def cross_up(a,b): return (a>b)&(a.shift()<=b.shift())
def cross_dn(a,b): return (a<b)&(a.shift()>=b.shift())

def supertrend(df,n=10,m=3.0):
    a=atr(df,n); hl2=(df.High+df.Low)/2
    ub=(hl2+m*a).values.copy(); lb=(hl2-m*a).values.copy(); c=df.Close.values
    fu=ub.copy(); fl=lb.copy(); d=np.ones(len(df)); 
    for i in range(1,len(df)):
        if np.isnan(ub[i]) or np.isnan(fu[i-1]): continue
        fu[i]=ub[i] if (ub[i]<fu[i-1] or c[i-1]>fu[i-1]) else fu[i-1]
        fl[i]=lb[i] if (lb[i]>fl[i-1] or c[i-1]<fl[i-1]) else fl[i-1]
        if d[i-1]==-1 and c[i]>fu[i-1]: d[i]=1
        elif d[i-1]==1 and c[i]<fl[i-1]: d[i]=-1
        else: d[i]=d[i-1]
    return pd.Series(d,index=df.index)   # 1 = bullish

def macd(c,f=12,s=26,g=9):
    m=ema(c,f)-ema(c,s); sg=ema(m,g); return m,sg,m-sg

def qqe(c,rsi_n=14,sf=5,fac=4.236):
    d=c.diff(); up=rma(d.clip(lower=0),rsi_n); dn=rma((-d).clip(lower=0),rsi_n); rsi=100-100/(1+up/dn)
    rs=ema(rsi,sf); ar=(rs.shift()-rs).abs(); dar=ema(ema(ar,2*rsi_n-1),2*rsi_n-1)*fac
    tl=np.full(len(c),np.nan); r=rs.values; da=dar.values
    for i in range(1,len(c)):
        if np.isnan(da[i]) or np.isnan(r[i]): continue
        nl=r[i]-da[i]; ns=r[i]+da[i]; p=tl[i-1] if not np.isnan(tl[i-1]) else nl
        tl[i]=max(p,nl) if (r[i]>p and r[i-1]>p) else (min(p,ns) if (r[i]<p and r[i-1]<p) else (nl if r[i]>p else ns))
    return rs,pd.Series(tl,index=c.index)

def rolling_vwap(df,n):
    tp=(df.High+df.Low+df.Close)/3; return (tp*df.Volume).rolling(n).sum()/df.Volume.rolling(n).sum()

def wavetrend(df,n1=10,n2=21):
    ap=(df.High+df.Low+df.Close)/3; esa=ema(ap,n1); d=ema((ap-esa).abs(),n1); ci=(ap-esa)/(0.015*d)
    wt1=ema(ci,n2); wt2=sma(wt1,4); return wt1,wt2

# ---- canonical rule sets for the video-derived (Q-series) candidates. each returns (entry, exit, stop_atr, tp_r)
def S_supertrend_ema200(df,n=10,m=3.0,l=200):
    st=supertrend(df,n,m); e=(st==1)&(st.shift()==-1)&(df.Close>ema(df.Close,l)); return e,(st==-1),None,None
def S_supertrend_macd(df,n=10,m=3.0):
    st=supertrend(df,n,m); mm,sg,h=macd(df.Close); return (st==1)&cross_up(mm,sg),(st==-1),None,None
def S_supertrend_qqe(df,n=10,m=3.0,q=14):
    st=supertrend(df,n,m); rs,tl=qqe(df.Close,q); return (st==1)&cross_up(rs,tl),(st==-1),None,None
def S_stormer_ema21(df,f=21,s=50):
    c=df.Close; ef,es=ema(c,f),ema(c,s); return (ef>es)&cross_up(c,ef),(c<es),None,None
def S_velez_20sma(df,n=20,l=200):
    c=df.Close; m=sma(c,n); return (c>sma(c,l))&(df.Low<=m)&(c>m)&(c.shift()>m.shift()),(c<m),None,None
def S_larry91(df,n=9,l=200):
    c=df.Close; e9=ema(c,n); return (e9>e9.shift())&(e9.shift()<=e9.shift(2))&(c>sma(c,l)),(e9<e9.shift()),None,None
def S_macd_ema200(df,l=200):
    c=df.Close; m,sg,_=macd(c); return (c>ema(c,l))&cross_up(m,sg)&(m<0),(cross_dn(m,sg))|(c<ema(c,l)),None,None
def S_boll_squeeze(df,n=20,k=2.0,bwl=50,macro=None):
    c=df.Close; b=sma(c,n); d=k*c.rolling(n).std(ddof=0); up=b+d; bw=(2*d)/b
    e=(c>up)&(bw>sma(bw,bwl)); 
    if macro: e=e&(c>sma(c,macro))
    return e,(c<b),None,None
def S_boll_break50(df,n=20,k=2.0,l=50):
    c=df.Close; b=sma(c,n); up=b+k*c.rolling(n).std(ddof=0); return (c>up)&(c>sma(c,l)),(c<b),None,None
def S_donchian(df,n=20,m=10,macro=None):
    c=df.Close; e=c>df.High.rolling(n).max().shift(); 
    if macro: e=e&(c>sma(c,macro))
    return e,(c<df.Low.rolling(m).min().shift()),None,None
def S_vwap30_sma200(df,n=30,l=200):
    c=df.Close; v=rolling_vwap(df,n); return cross_up(c,v)&(c>sma(c,l)),cross_dn(c,v),None,None
def S_keltner(df,n=20,k=1.5,l=200):
    c=df.Close; b=ema(c,n); up=b+k*atr(df,14); return (c>up)&(c>sma(c,l)),(c<b),None,None
def S_cowen20(df,n=20,l=200):
    c=df.Close; m=sma(c,n); return cross_up(c,m)&(c>sma(c,l)),(c<m),None,None
def S_cpr(df,n=7,l=20):
    p=(df.High+df.Low+df.Close)/3; bc=(df.High+df.Low)/2; tc=2*p-bc
    top=pd.concat([tc,bc],axis=1).max(axis=1).shift(); piv=p.shift(); c=df.Close
    return (c>top)&(c>sma(c,l))&(c.shift()<=top.shift()),(c<piv),None,None
def S_mcb_proxy(df,n=7,l=50):
    c=df.Close; w1,w2=wavetrend(df); return cross_up(w1,w2)&(w1<0)&(c>sma(c,l)),cross_dn(w1,w2),None,None

def S_template(df,curto,longo,stop,rr):
    """the generic template that the pipeline used for every 'SUPERTREND/RSI/DONCHIAN/...' label"""
    c=df.Close; e=ema(c,curto); return cross_up(c,e)&(c>sma(c,longo)),cross_dn(c,e),stop,rr

import yfinance as yf
import pandas as pd
import numpy as np

def get_yfinance_data(symbol="BTC-USD", start_time="2019-09-23"):
    df = yf.download(symbol, start=start_time, interval="1d")
    df.columns = df.columns.droplevel(1)
    df.index = df.index.tz_localize(None)
    df.rename(columns={"Close": "close", "Open": "open", "High": "high", "Low": "low", "Volume": "volume"}, inplace=True)
    return df

df = get_yfinance_data()
print(f"Loaded {len(df)} rows")

# Calc MACD
fast = 20
slow = 50
signal = 12

df['ema_fast'] = df['close'].ewm(span=fast, adjust=False).mean()
df['ema_slow'] = df['close'].ewm(span=slow, adjust=False).mean()
df['macd'] = df['ema_fast'] - df['ema_slow']
df['signal'] = df['macd'].ewm(span=signal, adjust=False).mean()

# Signals
df['cross_up'] = (df['macd'] > df['signal']) & (df['macd'].shift(1) <= df['signal'].shift(1))
df['cross_down'] = (df['macd'] < df['signal']) & (df['macd'].shift(1) >= df['signal'].shift(1))

df['position'] = 0
for i in range(1, len(df)):
    if df['cross_up'].iloc[i-1]:
        df.iloc[i, df.columns.get_loc('position')] = 1
    elif df['cross_down'].iloc[i-1]:
        df.iloc[i, df.columns.get_loc('position')] = 0
    else:
        df.iloc[i, df.columns.get_loc('position')] = df.iloc[i-1]['position']

cost = 0.00125 # 0.125%

# Calculate returns
df['returns'] = df['close'].pct_change()
df['strat_returns'] = df['returns'] * df['position'].shift(1)
df['strat_returns'] = df['strat_returns'].fillna(0)

# Apply costs
trade_entry = (df['position'] == 1) & (df['position'].shift(1) == 0)
trade_exit = (df['position'] == 0) & (df['position'].shift(1) == 1)
df.loc[trade_entry, 'strat_returns'] -= cost
df.loc[trade_exit, 'strat_returns'] -= cost

# Metrics function
def calc_metrics(df_window):
    if len(df_window) == 0:
        return
    bh_ret = df_window['close'].iloc[-1] / df_window['close'].iloc[0] - 1

    # Strat equity
    df_window['equity'] = (1 + df_window['strat_returns']).cumprod()
    strat_ret = df_window['equity'].iloc[-1] - 1

    alpha = strat_ret - bh_ret

    roll_max = df_window['equity'].cummax()
    dd = df_window['equity'] / roll_max - 1
    max_dd = dd.min()

    sharpe = np.sqrt(365) * df_window['strat_returns'].mean() / df_window['strat_returns'].std()

    # Trades
    trades = df_window['position'].diff().abs().sum() / 2

    print(f"Strat Ret: {strat_ret*100:.2f}%, B&H: {bh_ret*100:.2f}%, Alpha: {alpha*100:.2f}%, MaxDD: {max_dd*100:.2f}%, Sharpe: {sharpe:.2f}, Trades: {trades}")

print("All time:")
calc_metrics(df.copy())

end_date = df.index[-1]
for years in [1, 2, 3]:
    start = end_date - pd.DateOffset(years=years)
    print(f"{years}Y:")
    calc_metrics(df.loc[start:].copy())

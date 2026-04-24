import re

with open('capiba_trend_lite_v2.pine', 'r') as f:
    content = f.read()

# Fix updateTrend
old_updateTrend = """// Function to update Trend Bias based on Breakouts
updateTrend(bool internal) =>
    pivot p_ivotHigh = internal ? internalHigh : swingHigh
    pivot p_ivotLow  = internal ? internalLow : swingLow
    trend t_rend     = internal ? internalTrend : swingTrend

    // Check for Bullish Break (Price crosses above High Pivot)
    if ta.crossover(close, p_ivotHigh.currentLevel) and not p_ivotHigh.crossed
        p_ivotHigh.crossed := true
        t_rend.bosCount := t_rend.bias == BULLISH ? t_rend.bosCount + 1 : 1
        t_rend.bias        := BULLISH

    // Check for Bearish Break (Price crosses below Low Pivot)
    if ta.crossunder(close, p_ivotLow.currentLevel) and not p_ivotLow.crossed
        p_ivotLow.crossed := true
        t_rend.bosCount := t_rend.bias == BEARISH ? t_rend.bosCount + 1 : 1
        t_rend.bias       := BEARISH """

new_updateTrend = """// Function to update Trend Bias based on Breakouts
updateTrend(bool internal) =>
    pivot p_ivotHigh = internal ? internalHigh : swingHigh
    pivot p_ivotLow  = internal ? internalLow : swingLow
    trend t_rend     = internal ? internalTrend : swingTrend

    float currHigh = p_ivotHigh.currentLevel
    float currLow = p_ivotLow.currentLevel

    // Check for Bullish Break (Price crosses above High Pivot)
    if ta.crossover(close, currHigh) and not p_ivotHigh.crossed
        p_ivotHigh.crossed := true
        t_rend.bosCount := t_rend.bias == BULLISH ? t_rend.bosCount + 1 : 1
        t_rend.bias        := BULLISH

    // Check for Bearish Break (Price crosses below Low Pivot)
    if ta.crossunder(close, currLow) and not p_ivotLow.crossed
        p_ivotLow.crossed := true
        t_rend.bosCount := t_rend.bias == BEARISH ? t_rend.bosCount + 1 : 1
        t_rend.bias       := BEARISH """

content = content.replace(old_updateTrend, new_updateTrend)

with open('capiba_trend_lite_v2.pine', 'w') as f:
    f.write(content)

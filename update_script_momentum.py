import re

with open('capiba_trend_lite_v2.pine', 'r') as f:
    content = f.read()

old_momentum_logic = """// Signals for Confluence Start
bool validBullConfl = isBullConfluence and not isBullConfluence[1] and strongClose
bool validBearConfl = isBearConfluence and not isBearConfluence[1] and strongClose

plotshape(validBullConfl and swingTrend.bosCount >= 2, "Bullish Confluence Start (Strong)", shape.labelup, location.belowbar, colorBull, 0, "STRONG BULL", color.white, size=size.large)
plotshape(validBullConfl and swingTrend.bosCount < 2, "Bullish Confluence Start (Normal)", shape.labelup, location.belowbar, colorBull, 0, "STRONG BULL", color.white, size=size.small)

plotshape(validBearConfl and swingTrend.bosCount >= 2, "Bearish Confluence Start (Strong)", shape.labeldown, location.abovebar, colorBear, 0, "STRONG BEAR", color.white, size=size.large)
plotshape(validBearConfl and swingTrend.bosCount < 2, "Bearish Confluence Start (Normal)", shape.labeldown, location.abovebar, colorBear, 0, "STRONG BEAR", color.white, size=size.small) """

new_momentum_logic = """// Signals for Confluence Start
bool bullConflStart = isBullConfluence and not isBullConfluence[1]
bool bearConflStart = isBearConfluence and not isBearConfluence[1]

// Momentum check can occur on the onset bar, or the bar immediately following
bool validBullConfl = (bullConflStart and strongClose) or (isBullConfluence and isBullConfluence[1] and not isBullConfluence[2] and strongClose and not strongClose[1])
bool validBearConfl = (bearConflStart and strongClose) or (isBearConfluence and isBearConfluence[1] and not isBearConfluence[2] and strongClose and not strongClose[1])

plotshape(validBullConfl and swingTrend.bosCount >= 2, "Bullish Confluence Start (Strong)", shape.labelup, location.belowbar, colorBull, 0, "STRONG BULL", color.white, size=size.large)
plotshape(validBullConfl and swingTrend.bosCount < 2, "Bullish Confluence Start (Normal)", shape.labelup, location.belowbar, colorBull, 0, "STRONG BULL", color.white, size=size.small)

plotshape(validBearConfl and swingTrend.bosCount >= 2, "Bearish Confluence Start (Strong)", shape.labeldown, location.abovebar, colorBear, 0, "STRONG BEAR", color.white, size=size.large)
plotshape(validBearConfl and swingTrend.bosCount < 2, "Bearish Confluence Start (Normal)", shape.labeldown, location.abovebar, colorBear, 0, "STRONG BEAR", color.white, size=size.small) """

content = content.replace(old_momentum_logic, new_momentum_logic)

with open('capiba_trend_lite_v2.pine', 'w') as f:
    f.write(content)

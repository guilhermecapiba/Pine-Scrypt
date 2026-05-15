import re

with open('capiba_trend_lite_v2.pine', 'r') as f:
    content = f.read()

old_degradation_logic = """// Degradation Warnings
bool bullDegradation = swingTrend.bias == BEARISH and internalTrend.bias == BULLISH
bool bearDegradation = swingTrend.bias == BULLISH and internalTrend.bias == BEARISH

plotshape(bullDegradation, "Bullish Degradation Warning", shape.circle, location.belowbar, color.yellow, 0, "", na, size=size.tiny)
plotshape(bearDegradation, "Bearish Degradation Warning", shape.circle, location.abovebar, color.yellow, 0, "", na, size=size.tiny)"""

content = content.replace(old_degradation_logic, "")

with open('capiba_trend_lite_v2.pine', 'w') as f:
    f.write(content)

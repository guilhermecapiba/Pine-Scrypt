import re

with open('capiba_trend_lite_v2.pine', 'r') as f:
    content = f.read()

# Fix bosCount for Bullish
old_bull_logic = """        if t_rend.bias == BULLISH
            t_rend.bosCount += 1
        else
            t_rend.bosCount := 0
        t_rend.bias        := BULLISH """

new_bull_logic = """        t_rend.bosCount := t_rend.bias == BULLISH ? t_rend.bosCount + 1 : 1
        t_rend.bias        := BULLISH """

content = content.replace(old_bull_logic, new_bull_logic)

# Fix bosCount for Bearish
old_bear_logic = """        if t_rend.bias == BEARISH
            t_rend.bosCount += 1
        else
            t_rend.bosCount := 0
        t_rend.bias       := BEARISH """

new_bear_logic = """        t_rend.bosCount := t_rend.bias == BEARISH ? t_rend.bosCount + 1 : 1
        t_rend.bias       := BEARISH """

content = content.replace(old_bear_logic, new_bear_logic)

with open('capiba_trend_lite_v2.pine', 'w') as f:
    f.write(content)

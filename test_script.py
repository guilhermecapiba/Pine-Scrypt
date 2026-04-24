with open('capiba_trend_lite_v2.pine', 'r') as f:
    content = f.read()
import re

print("All '[1]' occurrences:")
for i, line in enumerate(content.split('\n')):
    if '[1]' in line:
        print(f"{i+1}: {line}")

import re

with open('capiba_trend_lite_v2.pine', 'r') as f:
    content = f.read()

# Replace block
old_block = """// Safe History References for Types
int currentSwingBias = swingTrend.bias
int prevSwingBias = (swingTrend[1]).bias
float prevIntLow1 = (internalLow[1]).currentLevel
float prevIntLow2 = (internalLow[2]).currentLevel
float prevIntHigh1 = (internalHigh[1]).currentLevel
float prevIntHigh2 = (internalHigh[2]).currentLevel"""

new_block = """// Safe History References for Types
int currentSwingBias = swingTrend.bias
int prevSwingBias = currentSwingBias[1]

float currentIntLowLevel = internalLow.currentLevel
float prevIntLow1 = currentIntLowLevel[1]
float prevIntLow2 = currentIntLowLevel[2]

float currentIntHighLevel = internalHigh.currentLevel
float prevIntHigh1 = currentIntHighLevel[1]
float prevIntHigh2 = currentIntHighLevel[2]"""

content = content.replace(old_block, new_block)

with open('capiba_trend_lite_v2.pine', 'w') as f:
    f.write(content)

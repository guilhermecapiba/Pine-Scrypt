with open('capiba_trend_lite_v2.pine', 'w') as f:
    f.write('''//@version=6
indicator("Capiba Trend Lite v2", shorttitle="Trend Lite v2", overlay=true)

//---------------------------------------------------------------------------------------------------------------------}
// INPUTS
//---------------------------------------------------------------------------------------------------------------------{

grp_struct = "Structure Settings"
swingsLengthInput = input.int(32, "Swing Structure Length", group = grp_struct, minval = 10)
internalLengthInput = input.int(10, "Internal Structure Length", group = grp_struct, minval = 1)

// Colors
colorBull = input.color(color.green, "Bullish Color", group = "Visuals")
colorBear = input.color(color.red, "Bearish Color", group = "Visuals")
volMultiplier = input.float(1.5, "Volume Spike Multiplier", group="Visuals")

// Constants
BULLISH_LEG = 1
BEARISH_LEG = 0
BULLISH = 1
BEARISH = -1
BOS = "BOS"
CHOCH = "CHoCH"

//---------------------------------------------------------------------------------------------------------------------}
// TYPES
//---------------------------------------------------------------------------------------------------------------------{

type trend
    int bias
    int bosCount

type pivot
    float currentLevel
    float lastLevel
    bool crossed

//---------------------------------------------------------------------------------------------------------------------}
// GLOBAL VARIABLES
//---------------------------------------------------------------------------------------------------------------------{

var pivot swingHigh     = pivot.new(na,na,false)
var pivot swingLow      = pivot.new(na,na,false)
var pivot internalHigh  = pivot.new(na,na,false)
var pivot internalLow   = pivot.new(na,na,false)

var trend swingTrend    = trend.new(0, 0)
var trend internalTrend = trend.new(0, 0)

var int swingLegState = 0
var int internalLegState = 0

var bool hadBullishSweep = false
var bool hadBearishSweep = false

var float idmLowLevel = na
var float idmHighLevel = na
var bool idmLowSet = false
var bool idmHighSet = false

//---------------------------------------------------------------------------------------------------------------------}
// HELPER FUNCTIONS
//---------------------------------------------------------------------------------------------------------------------{

calculateLeg(int size, int prevState) =>
    int nextState = prevState
    newLegHigh  = high[size] > ta.highest(size)
    newLegLow   = low[size]  < ta.lowest(size)
    if newLegHigh
        nextState := BEARISH_LEG
    else if newLegLow
        nextState := BULLISH_LEG
    nextState

startOfNewLeg(int leg)      => ta.change(leg) != 0
startOfBearishLeg(int leg)  => ta.change(leg) == -1
startOfBullishLeg(int leg)  => ta.change(leg) == +1

//---------------------------------------------------------------------------------------------------------------------}
// CORE LOGIC
//---------------------------------------------------------------------------------------------------------------------{

// Function to calculate structure points (Highs/Lows)
getCurrentStructure(int size, bool internal) =>
    int prevState = internal ? internalLegState : swingLegState
    int currentLeg = calculateLeg(size, prevState)

    newPivot   = startOfNewLeg(currentLeg)
    pivotLow   = startOfBullishLeg(currentLeg)

    if newPivot
        if pivotLow
            pivot p_ivot = internal ? internalLow : swingLow
            p_ivot.lastLevel    := p_ivot.currentLevel
            p_ivot.currentLevel := low[size]
            p_ivot.crossed      := false
        else
            pivot p_ivot = internal ? internalHigh : swingHigh
            p_ivot.lastLevel    := p_ivot.currentLevel
            p_ivot.currentLevel := high[size]
            p_ivot.crossed      := false

    currentLeg

// Function to update Trend Bias based on Breakouts
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
        t_rend.bias       := BEARISH

// Execution
swingLegState := getCurrentStructure(swingsLengthInput, false) // Calculate Swing Pts
internalLegState := getCurrentStructure(internalLengthInput, true) // Calculate Internal Pts

updateTrend(false) // Update Swing Trend
updateTrend(true)  // Update Internal Trend

// Safe History References for Types
int currentSwingBias = swingTrend.bias
int prevSwingBias = (swingTrend[1]).bias
float prevIntLow1 = (internalLow[1]).currentLevel
float prevIntLow2 = (internalLow[2]).currentLevel
float prevIntHigh1 = (internalHigh[1]).currentLevel
float prevIntHigh2 = (internalHigh[2]).currentLevel

// Sweep Logic update (Inducement tracking)
bool swingJustChanged = currentSwingBias != prevSwingBias

if swingJustChanged
    hadBullishSweep := false
    hadBearishSweep := false
    idmLowSet := false
    idmHighSet := false

bool intLowChangedLastBar = prevIntLow1 != prevIntLow2
bool intHighChangedLastBar = prevIntHigh1 != prevIntHigh2

if currentSwingBias == BULLISH and not idmLowSet and intLowChangedLastBar and not swingJustChanged
    idmLowLevel := prevIntLow1
    idmLowSet := true

if idmLowSet and low < idmLowLevel and currentSwingBias == BULLISH
    hadBullishSweep := true

if currentSwingBias == BEARISH and not idmHighSet and intHighChangedLastBar and not swingJustChanged
    idmHighLevel := prevIntHigh1
    idmHighSet := true

if idmHighSet and high > idmHighLevel and currentSwingBias == BEARISH
    hadBearishSweep := true


//---------------------------------------------------------------------------------------------------------------------}
// VISUALIZATION (COLORING & SIGNALS)
//---------------------------------------------------------------------------------------------------------------------{

bool isBullConfluence = swingTrend.bias == BULLISH and internalTrend.bias == BULLISH
bool isBearConfluence = swingTrend.bias == BEARISH and internalTrend.bias == BEARISH

color finalColor = na

if isBullConfluence
    finalColor := colorBull
else if isBearConfluence
    finalColor := colorBear

barcolor(finalColor)

// Momentum Filter
atr14 = ta.atr(14)
minBody = atr14 * 0.3
strongClose = math.abs(close - open) > minBody

// Volume Filter
volMA20 = ta.sma(volume, 20)
highVolume = volume > volMA20 * volMultiplier

// Signals for Confluence Start
bool bullConflStart = isBullConfluence and not isBullConfluence[1]
bool bearConflStart = isBearConfluence and not isBearConfluence[1]

// Momentum check can occur on the onset bar, or the bar immediately following
bool validBullConfl = (bullConflStart and strongClose) or (isBullConfluence and isBullConfluence[1] and not isBullConfluence[2] and strongClose and not strongClose[1])
bool validBearConfl = (bearConflStart and strongClose) or (isBearConfluence and isBearConfluence[1] and not isBearConfluence[2] and strongClose and not strongClose[1])

bool bullLvl3 = validBullConfl and swingTrend.bosCount >= 2 and hadBullishSweep and highVolume
bool bullLvl2 = validBullConfl and swingTrend.bosCount >= 2 and not hadBullishSweep and highVolume
bool bullLvl1_sweep = validBullConfl and swingTrend.bosCount >= 2 and hadBullishSweep and not highVolume
bool bullLvl1_nosweep = validBullConfl and swingTrend.bosCount >= 2 and not hadBullishSweep and not highVolume
bool bullLvl0 = validBullConfl and swingTrend.bosCount < 2

plotshape(bullLvl3, "Bullish Confl (Vol+Sweep)", shape.labelup, location.belowbar, colorBull, 0, "STRONG BULL\n(+Vol & Sweep)", color.white, size=size.large)
plotshape(bullLvl2, "Bullish Confl (Vol)", shape.labelup, location.belowbar, colorBull, 0, "STRONG BULL\n(+Vol)", color.white, size=size.normal)
plotshape(bullLvl1_sweep, "Bullish Confl (Sweep)", shape.labelup, location.belowbar, color.blue, 0, "STRONG BULL\n(+Sweep)", color.white, size=size.small)
plotshape(bullLvl1_nosweep, "Bullish Confl (No Vol/Sweep)", shape.labelup, location.belowbar, colorBull, 0, "STRONG BULL", color.white, size=size.small)
plotshape(bullLvl0, "Bullish Confl (Normal)", shape.labelup, location.belowbar, colorBull, 0, "BULL", color.white, size=size.tiny)

bool bearLvl3 = validBearConfl and swingTrend.bosCount >= 2 and hadBearishSweep and highVolume
bool bearLvl2 = validBearConfl and swingTrend.bosCount >= 2 and not hadBearishSweep and highVolume
bool bearLvl1_sweep = validBearConfl and swingTrend.bosCount >= 2 and hadBearishSweep and not highVolume
bool bearLvl1_nosweep = validBearConfl and swingTrend.bosCount >= 2 and not hadBearishSweep and not highVolume
bool bearLvl0 = validBearConfl and swingTrend.bosCount < 2

plotshape(bearLvl3, "Bearish Confl (Vol+Sweep)", shape.labeldown, location.abovebar, colorBear, 0, "STRONG BEAR\n(+Vol & Sweep)", color.white, size=size.large)
plotshape(bearLvl2, "Bearish Confl (Vol)", shape.labeldown, location.abovebar, colorBear, 0, "STRONG BEAR\n(+Vol)", color.white, size=size.normal)
plotshape(bearLvl1_sweep, "Bearish Confl (Sweep)", shape.labeldown, location.abovebar, color.orange, 0, "STRONG BEAR\n(+Sweep)", color.white, size=size.small)
plotshape(bearLvl1_nosweep, "Bearish Confl (No Vol/Sweep)", shape.labeldown, location.abovebar, colorBear, 0, "STRONG BEAR", color.white, size=size.small)
plotshape(bearLvl0, "Bearish Confl (Normal)", shape.labeldown, location.abovebar, colorBear, 0, "BEAR", color.white, size=size.tiny)

// Individual Pre-Confluence Swing Signals
bool swingBullStart = currentSwingBias == BULLISH and prevSwingBias != BULLISH
bool swingBearStart = currentSwingBias == BEARISH and prevSwingBias != BEARISH

plotshape(swingBullStart, "Swing Bullish Start", shape.triangleup, location.belowbar, color.blue, 0, "SWING BULL", color.white)
plotshape(swingBearStart, "Swing Bearish Start", shape.triangledown, location.abovebar, color.yellow, 0, "SWING BEAR", color.white)

''')

const code = `
macdLine = ema(close, 20) - ema(close, 50);
signalLine = ema(macdLine, 12);
opMode = "Long / Flat (Verde/Neutro)";
candleColor = macdLine > signalLine ? "green" : (opMode == "Long / Short (Verde/Vermelho)" ? "red" : null);
console.log("Syntax is sound in JS context");
`;
eval(code);

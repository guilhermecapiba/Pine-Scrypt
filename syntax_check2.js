const code = `
let macdLine1D = 10;
let signalLine1D = 5;
let candleColor = macdLine1D > signalLine1D ? "green" : "red";
console.log("Syntax is sound in JS context");
`;
eval(code);

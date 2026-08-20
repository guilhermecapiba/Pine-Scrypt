// Just a dummy to test JS logic
function calculateEMA(closes, period) {
  if (closes.length < period) return Array(closes.length).fill(null);
  let k = 2 / (period + 1);
  let ema = Array(closes.length).fill(null);
  let sum = 0;
  for (let i = 0; i < period; i++) sum += closes[i];
  ema[period - 1] = sum / period; // Start with SMA
  for (let i = period; i < closes.length; i++) {
    ema[i] = (closes[i] - ema[i - 1]) * k + ema[i - 1];
  }
  return ema;
}
console.log(calculateEMA([1,2,3,4,5], 3));

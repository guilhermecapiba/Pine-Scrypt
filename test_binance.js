const https = require('https');
function get(url) {
  return new Promise((resolve) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
  });
}
async function test() {
  const data = await get('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1d&limit=5');
  console.log(data);
}
test();

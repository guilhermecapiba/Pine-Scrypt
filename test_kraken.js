const https = require('https');
function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}
async function test() {
  const data = await get('https://api.kraken.com/0/public/OHLC?pair=XBTUSD&interval=1440');
  console.log(data.result.XXBTZUSD.length); // XBTUSD can be XXBTZUSD in result
  const ethbtc = await get('https://api.kraken.com/0/public/OHLC?pair=ETHXBT&interval=240');
  console.log(Object.keys(ethbtc.result)[0]);
}
test();

/**
 * IngestionEngine.gs
 * Módulo de ingestão de dados e cálculo de indicadores para BTC Backtest Machine.
 */

const CONFIG = {
  SPREADSHEET_ID: '13RyXbvMGYppWPmWAPpFxUJ1bz17_oz6G-dAUAWZxhzQ',
  SYMBOL: 'BTCUSDT',
  INTERVALS: [
    { binance: '4h', sheet: 'BTC_4H' },
    { binance: '1d', sheet: 'BTC_1D' },
    { binance: '1w', sheet: 'BTC_1W' }
  ],
  TIMEZONE: 'America/Sao_Paulo',
  START_MS: Date.UTC(2017, 0, 1), // 1 Jan 2017
  LOOKBACK_ROWS: 250 // Rows to keep for accurate indicator calculation
};

/**
 * Função principal a ser acionada por gatilho temporal (Time-driven trigger).
 */
function updateAllIntervals() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);

  for (const intervalObj of CONFIG.INTERVALS) {
    try {
      Logger.log(`Iniciando atualização para a aba: ${intervalObj.sheet}`);
      processInterval(ss, intervalObj);
      Utilities.sleep(1000); // Respeitar limites gerais
    } catch (e) {
      Logger.log(`Erro ao processar aba ${intervalObj.sheet}: ${e.message}`);
    }
  }
}

function processInterval(ss, intervalObj) {
  const sheet = ss.getSheetByName(intervalObj.sheet);
  if (!sheet) {
    Logger.log(`Aba ${intervalObj.sheet} não encontrada.`);
    return;
  }

  const lastRow = sheet.getLastRow();
  let startMs = CONFIG.START_MS;
  let existingData = [];

  if (lastRow > 1) {
    // Buscar o último timestamp_UTC na primeira coluna
    const lastTimestampStr = sheet.getRange(lastRow, 1).getValue();
    if (lastTimestampStr) {
      // Formato: YYYY-MM-DD HH:mm:ss.000 (UTC)
      const parsedDate = new Date(lastTimestampStr.replace(" ", "T") + "Z");
      if (!isNaN(parsedDate.getTime())) {
        startMs = parsedDate.getTime();
      }
    }

    // Obter dados históricos recentes para recálculo de EMA/RSI (seed)
    // Garantir que não vamos pegar o cabeçalho (linha 1)
    const startRow = Math.max(2, lastRow - CONFIG.LOOKBACK_ROWS + 1);
    const numRows = lastRow - startRow + 1;
    if (numRows > 0) {
      existingData = sheet.getRange(startRow, 1, numRows, 24).getValues();
    }
  }

  // Obter novos candles a partir do startMs (inclusivo)
  const newKlines = fetchBinanceData(intervalObj.binance, startMs);

  if (newKlines.length === 0) {
    Logger.log(`Nenhum dado novo para ${intervalObj.sheet}.`);
    return;
  }

  // Filtrar candles que já temos para evitar sobreposição total
  const mergedData = mergeAndCalculateIndicators(existingData, newKlines);

  const firstNewKstartTimestamp = newKlines[0][0];
  let writeStartRow = lastRow + 1;

  if (lastRow > 1) {
    let offset = 0;
    for (let i = 0; i < existingData.length; i++) {
      const dtStr = String(existingData[i][0]);
      let dt = 0;
      if (dtStr) {
        dt = new Date(dtStr.replace(" ", "T") + "Z").getTime();
      }
      if (dt < firstNewKstartTimestamp) {
        offset++;
      } else {
        break;
      }
    }
    const startRowOfSeed = Math.max(2, lastRow - existingData.length + 1);
    writeStartRow = startRowOfSeed + offset;
  }

  let finalOffset = 0;
  for(let i = 0; i < mergedData.length; i++){
      const dt = new Date(mergedData[i][0].replace(" ", "T") + "Z").getTime();
      if(dt < firstNewKstartTimestamp) {
          finalOffset++;
      } else {
          break;
      }
  }

  const dataToWrite = mergedData.slice(finalOffset);

  if (dataToWrite.length > 0) {
    const numRows = dataToWrite.length;
    const numCols = dataToWrite[0].length;
    sheet.getRange(writeStartRow, 1, numRows, numCols).setValues(dataToWrite);
    Logger.log(`Gravadas ${numRows} linhas na aba ${intervalObj.sheet} a partir da linha ${writeStartRow}.`);
  }
}

/**
 * Busca dados da Binance a partir de um timestamp inicial de forma paginada
 */
function fetchBinanceData(interval, startTime) {
  const urlBase = `https://api.binance.com/api/v3/klines?symbol=${CONFIG.SYMBOL}&interval=${interval}&limit=1000`;
  let allKlines = [];
  let currentStartTime = startTime;
  const now = Date.now();

  while (currentStartTime < now) {
    const url = `${urlBase}&startTime=${currentStartTime}`;
    try {
      const response = UrlFetchApp.fetch(url);
      const data = JSON.parse(response.getContentText());

      if (data.length === 0) break;

      allKlines = allKlines.concat(data);

      const lastKleine = data[data.length - 1];
      const nextStartTime = lastKleine[6] + 1; // close time + 1

      if (nextStartTime <= currentStartTime || data.length < 1000) {
        break;
      }

      currentStartTime = nextStartTime;
      Utilities.sleep(100);

    } catch (e) {
      Logger.log(`Erro ao buscar dados da Binance: ${e.message}`);
      break;
    }
  }
  return allKlines;
}

/**
 * Une os dados existentes (seed) com os novos candles e recalcula indicadores
 */
function mergeAndCalculateIndicators(existingData, newKlines) {
  let baseData = [];

  for (let i = 0; i < existingData.length; i++) {
    const row = existingData[i];
    const timestampMs = new Date(String(row[0]).replace(" ", "T") + "Z").getTime();
    baseData.push({
      time: timestampMs,
      open: parseFloat(row[2]),
      high: parseFloat(row[3]),
      low: parseFloat(row[4]),
      close: parseFloat(row[5]),
      volume: parseFloat(row[6]),
    });
  }

  for (let i = 0; i < newKlines.length; i++) {
    const kline = newKlines[i];
    const timestampMs = kline[0];

    let existingIdx = baseData.length - 1;
    while (existingIdx >= 0 && baseData[existingIdx].time > timestampMs) {
      existingIdx--;
    }

    const kdata = {
      time: timestampMs,
      open: parseFloat(kline[1]),
      high: parseFloat(kline[2]),
      low: parseFloat(kline[3]),
      close: parseFloat(kline[4]),
      volume: parseFloat(kline[5])
    };

    if (existingIdx >= 0 && baseData[existingIdx].time === timestampMs) {
      baseData[existingIdx] = kdata;
    } else {
      baseData.push(kdata);
    }
  }

  const closes = baseData.map(d => d.close);
  const highs = baseData.map(d => d.high);
  const lows = baseData.map(d => d.low);
  const hlcs = baseData.map(d => (d.high + d.low + d.close) / 3);

  const sma8 = calcSMA(closes, 8);
  const sma20 = calcSMA(closes, 20);
  const sma200 = calcSMA(closes, 200);
  const ema8 = calcEMA(closes, 8);
  const ema20 = calcEMA(closes, 20);
  const ema200 = calcEMA(closes, 200);
  const rsi = calcRSI(closes, 14);
  const atr = calcATR(highs, lows, closes, 14);
  const macdData = calcMACD(closes, 12, 26, 9);

  let pos = "FLAT";
  const finalRows = [];

  for (let i = 0; i < baseData.length; i++) {
    const d = baseData[i];
    const e8 = ema8[i];
    const e20 = ema20[i];
    const e200 = ema200[i];

    let tendencia = "LATERAL";
    if (e8 !== null && e20 !== null && e200 !== null) {
      if (e8 > e20 && e20 > e200) tendencia = "ALTA";
      else if (e8 < e20 && e20 < e200) tendencia = "BAIXA";
    }

    let alinhamento = "MISTA";
    if (e8 > e20 && e20 > e200) alinhamento = "8>20>200";
    else if (e8 < e20 && e20 < e200) alinhamento = "8<20<200";

    let sinal = "";
    if (i > 0) {
      const prevE8 = ema8[i-1];
      const prevE20 = ema20[i-1];

      if (prevE8 <= prevE20 && e8 > e20 && e8 > e200) {
         sinal = "COMPRA";
      } else if (prevE8 >= prevE20 && e8 < e20 && e8 < e200) {
         sinal = "VENDA";
      } else if (prevE8 >= prevE20 && e8 < e20 && pos === "LONG") {
         sinal = "SAIDA_LONG";
      } else if (prevE8 <= prevE20 && e8 > e20 && pos === "SHORT") {
         sinal = "SAIDA_SHORT";
      }
    }

    if (sinal === "COMPRA") pos = "LONG";
    else if (sinal === "VENDA") pos = "SHORT";
    else if (sinal === "SAIDA_LONG" || sinal === "SAIDA_SHORT") pos = "FLAT";

    let score = 0;
    if (tendencia === "ALTA") score += 50;
    if (tendencia === "BAIXA") score -= 50;
    if (rsi[i] !== null) {
      if (rsi[i] > 60) score += 20;
      else if (rsi[i] < 40) score -= 20;
    }
    if (macdData.hist[i] !== null) {
      if (macdData.hist[i] > 0) score += 30;
      else score -= 30;
    }
    score = Math.max(-100, Math.min(100, score));

    const dateUtc = new Date(d.time);
    const tsUTC = formatUtcDate(dateUtc);
    const tsBRT = formatBrtDate(dateUtc);

    finalRows.push([
      tsUTC,
      tsBRT,
      fmtN(d.open, 2),
      fmtN(d.high, 2),
      fmtN(d.low, 2),
      fmtN(d.close, 2),
      fmtN(d.volume, 4),
      fmtN(hlcs[i], 2),
      fmtN(rsi[i], 2),
      fmtN(sma8[i], 2),
      fmtN(sma20[i], 2),
      fmtN(sma200[i], 2),
      fmtN(ema8[i], 2),
      fmtN(ema20[i], 2),
      fmtN(ema200[i], 2),
      fmtN(atr[i], 2),
      fmtN(macdData.macd[i], 2),
      fmtN(macdData.signal[i], 2),
      fmtN(macdData.hist[i], 2),
      tendencia,
      alinhamento,
      sinal,
      pos,
      fmtN(score, 1)
    ]);
  }

  return finalRows;
}

// ========================
// FORMATTERS
// ========================

function formatUtcDate(date) {
  const pad = (n) => (n < 10 ? '0' + n : n);
  const pad3 = (n) => (n < 10 ? '00' + n : n < 100 ? '0' + n : n);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}.${pad3(date.getUTCMilliseconds())}`;
}

function formatBrtDate(date) {
  const brtDate = new Date(date.getTime() - (3 * 60 * 60 * 1000));
  const pad = (n) => (n < 10 ? '0' + n : n);
  return `${brtDate.getUTCFullYear()}-${pad(brtDate.getUTCMonth() + 1)}-${pad(brtDate.getUTCDate())} ${pad(brtDate.getUTCHours())}:${pad(brtDate.getUTCMinutes())}:${pad(brtDate.getUTCSeconds())}`;
}

function fmtN(val, decimals) {
  if (val === null || val === undefined || isNaN(val)) return "";
  return parseFloat(val.toFixed(decimals));
}

// ========================
// MATH & INDICATORS
// ========================

function calcSMA(data, period) {
  let result = new Array(data.length).fill(null);
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum += data[i];
    if (i >= period) {
      sum -= data[i - period];
      result[i] = sum / period;
    } else if (i === period - 1) {
      result[i] = sum / period;
    }
  }
  return result;
}

function calcEMA(data, period) {
  let result = new Array(data.length).fill(null);
  const k = 2 / (period + 1);
  let ema = null;
  for (let i = 0; i < data.length; i++) {
    if (i === 0) {
      ema = data[i];
    } else {
      ema = data[i] * k + ema * (1 - k);
    }
    result[i] = ema;
  }
  return result;
}

function calcRSI(closes, period) {
  let result = new Array(closes.length).fill(null);
  let gains = 0;
  let losses = 0;

  if (closes.length < period) return result;

  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  result[period] = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    let gain = 0, loss = 0;
    if (diff > 0) gain = diff;
    else loss = -diff;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    if (avgLoss === 0) result[i] = 100;
    else result[i] = 100 - (100 / (1 + avgGain / avgLoss));
  }
  return result;
}

function calcATR(highs, lows, closes, period) {
  let result = new Array(closes.length).fill(null);
  let trs = new Array(closes.length).fill(0);

  for (let i = 0; i < closes.length; i++) {
    if (i === 0) {
      trs[i] = highs[i] - lows[i];
    } else {
      const hl = highs[i] - lows[i];
      const hc = Math.abs(highs[i] - closes[i - 1]);
      const lc = Math.abs(lows[i] - closes[i - 1]);
      trs[i] = Math.max(hl, hc, lc);
    }
  }

  let atr = 0;
  for(let i=0; i<period; i++){
     atr += trs[i];
  }
  atr = atr / period;
  result[period-1] = atr;

  for (let i = period; i < closes.length; i++) {
    atr = (atr * (period - 1) + trs[i]) / period;
    result[i] = atr;
  }

  return result;
}

function calcMACD(data, fastPeriod, slowPeriod, signalPeriod) {
  const fastEMA = calcEMA(data, fastPeriod);
  const slowEMA = calcEMA(data, slowPeriod);
  let macdLine = new Array(data.length).fill(null);

  for (let i = 0; i < data.length; i++) {
    if (fastEMA[i] !== null && slowEMA[i] !== null) {
      macdLine[i] = fastEMA[i] - slowEMA[i];
    }
  }

  let signalLine = new Array(data.length).fill(null);
  const k = 2 / (signalPeriod + 1);
  let signalEMA = null;

  for (let i = 0; i < data.length; i++) {
    if (macdLine[i] !== null) {
      if (signalEMA === null) {
         signalEMA = macdLine[i];
      } else {
         signalEMA = macdLine[i] * k + signalEMA * (1 - k);
      }
      signalLine[i] = signalEMA;
    }
  }

  let hist = new Array(data.length).fill(null);
  for (let i = 0; i < data.length; i++) {
    if (macdLine[i] !== null && signalLine[i] !== null) {
      hist[i] = macdLine[i] - signalLine[i];
    }
  }

  return { macd: macdLine, signal: signalLine, hist: hist };
}

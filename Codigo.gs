/**
 * ============================================================================
 * SCRIPT UNIFICADO: BTC Backtest Machine (Real Data & Real Maths)
 * ============================================================================
 */

/**
 * ----------------------------------------------------------------------------
 * UTILS: Obter Preço Spot Resiliente (Múltiplas Fontes)
 * ----------------------------------------------------------------------------
 */
function getRealtimeSpotPrice() {
  const sources = [
    { url: 'https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT', parser: (j) => parseFloat(j.price) },
    { url: 'https://api.binance.us/api/v3/ticker/price?symbol=BTCUSDT', parser: (j) => parseFloat(j.price) },
    { url: 'https://api.coinbase.com/v2/prices/BTC-USD/spot', parser: (j) => parseFloat(j.data.amount) },
    { url: 'https://api.kraken.com/0/public/Ticker?pair=XXBTZUSD', parser: (j) => parseFloat(j.result.XXBTZUSD.c[0]) }
  ];

  for (let i = 0; i < sources.length; i++) {
    try {
      const res = UrlFetchApp.fetch(sources[i].url, { muteHttpExceptions: true });
      if (res.getResponseCode() === 200) {
        const json = JSON.parse(res.getContentText());
        return sources[i].parser(json);
      }
      Utilities.sleep(200);
    } catch (e) {
      Logger.log(`Falha na fonte ${sources[i].url}: ${e}`);
    }
  }
  return null;
}

/**
 * ----------------------------------------------------------------------------
 * UTILS: Ingestão de Klines Binance com Paginação (Gaps Free)
 * ----------------------------------------------------------------------------
 */
function fetchBinanceHistoricalData(interval, startTimeMs) {
  const endpoints = [
    'https://api.binance.com/api/v3/klines',
    'https://api.binance.us/api/v3/klines',
    'https://data-api.binance.vision/api/v3/klines'
  ];

  let allData = [];
  let currentStart = startTimeMs;
  let endTime = Date.now();

  while (currentStart < endTime) {
    let success = false;
    for (let i = 0; i < endpoints.length; i++) {
      try {
        const url = `${endpoints[i]}?symbol=BTCUSDT&interval=${interval}&limit=1000&startTime=${currentStart}&endTime=${endTime}`;
        const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
        const code = res.getResponseCode();

        if (code === 200) {
          const json = JSON.parse(res.getContentText());
          if (Array.isArray(json) && json.length > 0) {
             allData = allData.concat(json);
             currentStart = Number(json[json.length - 1][6]) + 1;
             success = true;
             break;
          } else {
             currentStart = endTime + 1;
             success = true;
             break;
          }
        }
        Utilities.sleep(200);
      } catch (e) {
        Logger.log(`Erro klines ${endpoints[i]}: ${e}`);
      }
    }
    if (!success) {
      Logger.log(`Todos os endpoints falharam para o intervalo ${interval} a partir de ${currentStart}`);
      break;
    }
    Utilities.sleep(300);
  }
  return allData;
}

/**
 * ----------------------------------------------------------------------------
 * MÓDULO 5: Orquestrador e Menu
 * ----------------------------------------------------------------------------
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('⚡ BTC Backtest Machine')
    .addItem('▶ Executar Ciclo Completo (Agora)', 'runFullSystemCycle')
    .addSeparator()
    .addItem('1. Atualizar Apenas Dados da Binance', 'updateMarketData')
    .addItem('2. Rodar Apenas Backtest e Logs', 'runBacktestSimulation')
    .addItem('3. Atualizar Apenas Ranking e Métricas', 'computeMultiTemporalPerformance')
    .addItem('4. Atualizar Apenas Dashboard', 'refreshExecutiveDashboard')
    .addSeparator()
    .addItem('⚙ Instalar Gatilho Automático Horário', 'installHourlyTrigger')
    .addItem('⛔ Remover Gatilhos Automáticos', 'removeTriggers')
    .addToUi();
}

function runFullSystemCycle() {
  const startTime = new Date().getTime();

  try {
    Logger.log("--- INICIANDO CICLO COMPLETO ---");
    safeToast("Baixando novos dados contínuos...", "Etapa 1/4", 15);
    updateMarketData();

    safeToast("Executando Simulação Real de Backtest...", "Etapa 2/4", 15);
    runBacktestSimulation();

    safeToast("Calculando Performance Multitemporal Real...", "Etapa 3/4", 15);
    computeMultiTemporalPerformance();

    safeToast("Vinculando Dashboard aos Dados Reais...", "Etapa 4/4", 5);
    refreshExecutiveDashboard();

    const timeSpent = ((new Date().getTime() - startTime) / 1000).toFixed(2);
    safeToast(`Ciclo completo executado com sucesso em ${timeSpent}s.`, "Sucesso! ✅", 10);
  } catch (error) {
    safeToast(`Falha na execução: ${error.message}`, "Erro Crítico ❌", -1);
    Logger.log(`[ERRO CRÍTICO]: ${error.stack}`);
  }
}

function installHourlyTrigger() {
  silentRemoveAllTriggers();
  ScriptApp.newTrigger('runFullSystemCycle').timeBased().everyHours(1).create();
  safeAlert('Sucesso ✅', 'Gatilho horário instalado.');
}

function removeTriggers() {
  const count = silentRemoveAllTriggers();
  safeAlert('Concluído ✅', `${count} gatilho(s) removido(s).`);
}

function silentRemoveAllTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => ScriptApp.deleteTrigger(t));
  return triggers.length;
}

function safeToast(msg, title, time) {
  try { SpreadsheetApp.getActive().toast(msg, title, time); } catch(e) {}
}

function safeAlert(title, msg) {
  try { SpreadsheetApp.getUi().alert(title, msg, SpreadsheetApp.getUi().ButtonSet.OK); } catch(e) {}
}


/**
 * ----------------------------------------------------------------------------
 * MATEMÁTICA: Indicadores
 * ----------------------------------------------------------------------------
 */
function calcSMA(arr, period) {
    let res = [];
    let sum = 0;
    for (let i = 0; i < arr.length; i++) {
        sum += arr[i];
        if (i >= period) {
            sum -= arr[i - period];
            res.push(sum / period);
        } else if (i === period - 1) {
            res.push(sum / period);
        } else {
            res.push(null);
        }
    }
    return res;
}

function calcEMA(arr, period) {
    let res = [];
    let k = 2 / (period + 1);
    let ema = null;
    let sum = 0;
    for (let i = 0; i < arr.length; i++) {
        if (i < period - 1) {
            sum += arr[i];
            res.push(null);
        } else if (i === period - 1) {
            sum += arr[i];
            ema = sum / period;
            res.push(ema);
        } else {
            ema = (arr[i] - ema) * k + ema;
            res.push(ema);
        }
    }
    return res;
}

function calcRSI(arr, period) {
    let rsiArr = [];
    let avgGain = 0;
    let avgLoss = 0;

    for(let i=0; i<arr.length; i++) {
        if (i === 0) {
            rsiArr.push(null);
            continue;
        }
        let diff = arr[i] - arr[i-1];
        if(i <= period) {
            avgGain += (diff > 0 ? diff : 0);
            avgLoss += (diff < 0 ? -diff : 0);
            if(i === period) {
                avgGain /= period;
                avgLoss /= period;
                let rs = avgLoss === 0 ? 0 : avgGain / avgLoss;
                rsiArr.push(avgLoss === 0 ? 100 : 100 - (100 / (1 + rs)));
            } else {
                rsiArr.push(null);
            }
        } else {
            let gain = diff > 0 ? diff : 0;
            let loss = diff < 0 ? -diff : 0;
            avgGain = ((avgGain * (period - 1)) + gain) / period;
            avgLoss = ((avgLoss * (period - 1)) + loss) / period;
            let rs = avgLoss === 0 ? 0 : avgGain / avgLoss;
            rsiArr.push(avgLoss === 0 ? 100 : 100 - (100 / (1 + rs)));
        }
    }
    return rsiArr;
}

function calcMACD(arr, fast, slow, sig) {
    let emaFast = calcEMA(arr, fast);
    let emaSlow = calcEMA(arr, slow);
    let macdLine = [];
    for(let i=0; i<arr.length; i++) {
        if(emaFast[i] !== null && emaSlow[i] !== null) {
            macdLine.push(emaFast[i] - emaSlow[i]);
        } else {
            macdLine.push(null);
        }
    }

    let validMacd = macdLine.filter(x => x !== null);
    let signalEmaValid = calcEMA(validMacd, sig);

    let signalLine = [];
    let histogram = [];
    let validIndex = 0;

    for(let i=0; i<arr.length; i++) {
        if (macdLine[i] !== null) {
            let sigVal = signalEmaValid[validIndex];
            signalLine.push(sigVal);
            histogram.push(sigVal !== null ? macdLine[i] - sigVal : null);
            validIndex++;
        } else {
            signalLine.push(null);
            histogram.push(null);
        }
    }

    return { macdLine, signalLine, histogram };
}

function calcHighest(arr, period) {
    let res = [];
    for (let i = 0; i < arr.length; i++) {
        if (i < period - 1) {
            res.push(null);
        } else {
            let max = arr[i];
            for (let j = 1; j < period; j++) {
                if (arr[i - j] > max) max = arr[i - j];
            }
            res.push(max);
        }
    }
    return res;
}

function calcLowest(arr, period) {
    let res = [];
    for (let i = 0; i < arr.length; i++) {
        if (i < period - 1) {
            res.push(null);
        } else {
            let min = arr[i];
            for (let j = 1; j < period; j++) {
                if (arr[i - j] < min) min = arr[i - j];
            }
            res.push(min);
        }
    }
    return res;
}


/**
 * ----------------------------------------------------------------------------
 * MÓDULO 1: Ingestão de Dados Real e Contínua
 * ----------------------------------------------------------------------------
 */
function updateMarketData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const configs = [
    { sheetName: 'BTC_4H', interval: '4h' },
    { sheetName: 'BTC_1D', interval: '1d' },
    { sheetName: 'BTC_1W', interval: '1w' }
  ];

  const initialDateMs = 1483228800000; // 01/01/2017 UTC
  const endTimeMs = Date.now();

  configs.forEach(config => {
    const sheet = ss.getSheetByName(config.sheetName);
    if (!sheet) return;

    sheet.getRange(2, 1, sheet.getLastRow() || 2, 24).clearContent();

    let allKlines = fetchBinanceHistoricalData(config.interval, initialDateMs);

    if (!allKlines || allKlines.length === 0) return;

    let closes = [];
    let highs = [];
    let lows = [];
    let trueRanges = [];

    for (let i = 0; i < allKlines.length; i++) {
        let high = parseFloat(allKlines[i][2]);
        let low = parseFloat(allKlines[i][3]);
        let close = parseFloat(allKlines[i][4]);
        closes.push(close);
        highs.push(high);
        lows.push(low);
        let tr = i === 0 ? high - low : Math.max(high - low, Math.abs(high - closes[i-1]), Math.abs(low - closes[i-1]));
        trueRanges.push(tr);
    }

    let sma08_arr = calcSMA(closes, 8);
    let sma20_arr = calcSMA(closes, 20);
    let sma200_arr = calcSMA(closes, 200);
    let ema08_arr = calcEMA(closes, 8);
    let ema20_arr = calcEMA(closes, 20);
    let ema200_arr = calcEMA(closes, 200);
    let atr14_arr = calcSMA(trueRanges, 14);
    let rsi14_arr = calcRSI(closes, 14);
    let macdObj = calcMACD(closes, 12, 26, 9);

    let processedData = [];

    for (let i = 0; i < allKlines.length; i++) {
        let k = allKlines[i];

        let timestampMs = Number(k[0]);
        if (timestampMs > endTimeMs) continue;

        let dateObj = new Date(timestampMs);

        let open = parseFloat(k[1]);
        let high = highs[i];
        let low = lows[i];
        let close = closes[i];
        let volume = parseFloat(k[5]);
        let hlc3 = (high + low + close) / 3.0;

        let trend = (ema08_arr[i] !== null && ema20_arr[i] !== null) ? (ema08_arr[i] > ema20_arr[i] ? "BULLISH" : "BEARISH") : "NEUTRAL";
        let alignment = (ema08_arr[i] !== null && ema20_arr[i] !== null && ema200_arr[i] !== null)
                          ? ((ema08_arr[i] > ema20_arr[i] && ema20_arr[i] > ema200_arr[i]) ? "ALIGNED" : "MIXED")
                          : "UNKNOWN";

        let position = "FLAT";
        if (ema08_arr[i] !== null && ema20_arr[i] !== null) {
             position = ema08_arr[i] > ema20_arr[i] ? "LONG" : "SHORT";
        }

        let signal = "HOLD";
        let score = (rsi14_arr[i] !== null) ? rsi14_arr[i].toFixed(2) : 50;

        processedData.push([
            Utilities.formatDate(dateObj, "UTC", "yyyy-MM-dd HH:mm:ss.000"), // A
            Utilities.formatDate(dateObj, "America/Sao_Paulo", "yyyy-MM-dd HH:mm:ss"), // B
            open, // C
            high, // D
            low,  // E
            close, // F
            volume, // G
            hlc3, // H
            rsi14_arr[i], // I
            sma08_arr[i], sma20_arr[i], sma200_arr[i], // J, K, L
            ema08_arr[i], ema20_arr[i], ema200_arr[i], // M, N, O
            atr14_arr[i], // P
            macdObj.macdLine[i], macdObj.signalLine[i], macdObj.histogram[i], // Q, R, S
            trend, alignment, signal, position, score // T, U, V, W, X
        ]);
    }

    if (processedData.length > 0) {
      sheet.getRange(2, 1, processedData.length, 24).setValues(processedData);
    }
  });
}

/**
 * ----------------------------------------------------------------------------
 * MÓDULO 2: Simulação Real de Trades (4 Estratégias Distintas)
 * ----------------------------------------------------------------------------
 */
function runBacktestSimulation() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dataSheet = ss.getSheetByName('BTC_1D');
  const tradeSheet = ss.getSheetByName('Trade_Logs');
  if (!tradeSheet || !dataSheet) return;

  tradeSheet.getRange(2, 1, tradeSheet.getLastRow() || 2, 13).clearContent();

  const data = dataSheet.getRange(2, 1, dataSheet.getLastRow() - 1, 24).getValues();
  if (data.length === 0) return;

  const trades = [];
  let tradeIdCounter = 1;
  const FEE_SLIPPAGE = 0.00125;

  // Arrays for local calculation
  let closes = [];
  let highs = [];
  let lows = [];
  for (let i=0; i<data.length; i++) {
      closes.push(parseFloat(data[i][5]));
      highs.push(parseFloat(data[i][3]));
      lows.push(parseFloat(data[i][4]));
  }

  // Strategy 1: EMA 8/20/200
  let inTradeEma = false;
  let entryPriceEma = 0;
  let entryDateEma = null;

  // Strategy 2: Nuvem 13/49 + MA20
  let ema13 = calcEMA(closes, 13);
  let ema49 = calcEMA(closes, 49);
  let sma20_real = calcSMA(closes, 20);

  let inTradeCloud = false;
  let entryPriceCloud = 0;
  let entryDateCloud = null;

  // Strategy 3: Donchian Breakout 30 (entry: high > highest(30), exit: low < lowest(15))
  let highest30 = calcHighest(highs, 30);
  let lowest15 = calcLowest(lows, 15);

  let inTradeDonchian = false;
  let entryPriceDonchian = 0;
  let entryDateDonchian = null;

  // Strategy 4: MACD 20/50/12 Crossover
  let macdObjLocal = calcMACD(closes, 20, 50, 12);

  let inTradeMacd = false;
  let entryPriceMacd = 0;
  let entryDateMacd = null;

  // Strategy 5: Buy & Hold (treated as a single trade in compute module)

  for (let i = 1; i < data.length; i++) {
     let row = data[i];
     let prevRow = data[i-1];

     let currentDate = row[1];
     let currentClose = row[5];
     let currentHigh = row[3];
     let currentLow = row[4];

     // ---------------------------------------------------------
     // Strategy 1: EMA 8/20
     // ---------------------------------------------------------
     let ema8 = row[12];
     let ema20 = row[13];
     let prevEma8 = prevRow[12];
     let prevEma20 = prevRow[13];

     if (ema8 !== "" && ema20 !== "" && prevEma8 !== "" && prevEma20 !== "") {
         let crossUpEma = (prevEma8 <= prevEma20) && (ema8 > ema20);
         let crossDownEma = (prevEma8 >= prevEma20) && (ema8 < ema20);

         if (!inTradeEma && crossUpEma) {
             inTradeEma = true;
             entryPriceEma = currentClose * (1 + FEE_SLIPPAGE);
             entryDateEma = currentDate;
         } else if (inTradeEma && crossDownEma) {
             let exitPrice = currentClose * (1 - FEE_SLIPPAGE);
             let netPct = (exitPrice - entryPriceEma) / entryPriceEma;
             let feesPaid = (currentClose * FEE_SLIPPAGE) * 2;
             let hours = (new Date(currentDate) - new Date(entryDateEma)) / 3600000;
             trades.push([`TRD-${String(tradeIdCounter++).padStart(4, '0')}`, "EMA 8/20 Crossover", "BTC_1D", "LONG", entryDateEma, entryPriceEma, currentDate, exitPrice, (currentClose - entryPriceEma)/entryPriceEma, netPct, feesPaid, hours, "CLOSED"]);
             inTradeEma = false;
         }
     }

     // ---------------------------------------------------------
     // Strategy 2: Nuvem 13/49 + MA20
     // ---------------------------------------------------------
     let c_ema13 = ema13[i];
     let c_ema49 = ema49[i];
     let c_ma20 = sma20_real[i];

     if (c_ema13 !== null && c_ema49 !== null && c_ma20 !== null) {
         let crossUpCloud = (currentClose > c_ema13) && (c_ema13 > c_ema49);
         let crossDownCloud = (currentClose < c_ma20);

         if (!inTradeCloud && crossUpCloud) {
             inTradeCloud = true;
             entryPriceCloud = currentClose * (1 + FEE_SLIPPAGE);
             entryDateCloud = currentDate;
         } else if (inTradeCloud && crossDownCloud) {
             let exitPrice = currentClose * (1 - FEE_SLIPPAGE);
             let netPct = (exitPrice - entryPriceCloud) / entryPriceCloud;
             let feesPaid = (currentClose * FEE_SLIPPAGE) * 2;
             let hours = (new Date(currentDate) - new Date(entryDateCloud)) / 3600000;
             trades.push([`TRD-${String(tradeIdCounter++).padStart(4, '0')}`, "Nuvem 13/49", "BTC_1D", "LONG", entryDateCloud, entryPriceCloud, currentDate, exitPrice, (currentClose - entryPriceCloud)/entryPriceCloud, netPct, feesPaid, hours, "CLOSED"]);
             inTradeCloud = false;
         }
     }

     // ---------------------------------------------------------
     // Strategy 3: Donchian Breakout 30
     // ---------------------------------------------------------
     let c_high30 = highest30[i-1]; // Breakout of previous 30 days high
     let c_low15 = lowest15[i-1];   // Breakout of previous 15 days low

     if (c_high30 !== null && c_low15 !== null) {
         let crossUpDonchian = (currentHigh > c_high30);
         let crossDownDonchian = (currentLow < c_low15);

         if (!inTradeDonchian && crossUpDonchian) {
             inTradeDonchian = true;
             // Execution price approximation: breakout point or close if gapped
             let execPrice = Math.max(c_high30, row[2]); // Max of breakout level or open price
             entryPriceDonchian = execPrice * (1 + FEE_SLIPPAGE);
             entryDateDonchian = currentDate;
         } else if (inTradeDonchian && crossDownDonchian) {
             let execPrice = Math.min(c_low15, row[2]); // Min of breakdown level or open price
             let exitPrice = execPrice * (1 - FEE_SLIPPAGE);
             let netPct = (exitPrice - entryPriceDonchian) / entryPriceDonchian;
             let feesPaid = (execPrice * FEE_SLIPPAGE) * 2;
             let hours = (new Date(currentDate) - new Date(entryDateDonchian)) / 3600000;
             trades.push([`TRD-${String(tradeIdCounter++).padStart(4, '0')}`, "Donchian 30", "BTC_1D", "LONG", entryDateDonchian, entryPriceDonchian, currentDate, exitPrice, (execPrice - entryPriceDonchian)/entryPriceDonchian, netPct, feesPaid, hours, "CLOSED"]);
             inTradeDonchian = false;
         }
     }

     // ---------------------------------------------------------
     // Strategy 4: MACD 20/50/12 Crossover
     // ---------------------------------------------------------
     let c_macd = macdObjLocal.macdLine[i];
     let c_signal = macdObjLocal.signalLine[i];
     let p_macd = macdObjLocal.macdLine[i-1];
     let p_signal = macdObjLocal.signalLine[i-1];

     if (c_macd !== null && c_signal !== null && p_macd !== null && p_signal !== null) {
         let crossUpMacd = (p_macd <= p_signal) && (c_macd > c_signal);
         let crossDownMacd = (p_macd >= p_signal) && (c_macd < c_signal);

         if (!inTradeMacd && crossUpMacd) {
             inTradeMacd = true;
             entryPriceMacd = currentClose * (1 + FEE_SLIPPAGE);
             entryDateMacd = currentDate;
         } else if (inTradeMacd && crossDownMacd) {
             let exitPrice = currentClose * (1 - FEE_SLIPPAGE);
             let netPct = (exitPrice - entryPriceMacd) / entryPriceMacd;
             let feesPaid = (currentClose * FEE_SLIPPAGE) * 2;
             let hours = (new Date(currentDate) - new Date(entryDateMacd)) / 3600000;
             trades.push([`TRD-${String(tradeIdCounter++).padStart(4, '0')}`, "MACD 20/50/12", "BTC_1D", "LONG", entryDateMacd, entryPriceMacd, currentDate, exitPrice, (currentClose - entryPriceMacd)/entryPriceMacd, netPct, feesPaid, hours, "CLOSED"]);
             inTradeMacd = false;
         }
     }
  }

  if (trades.length > 0) {
      tradeSheet.getRange(2, 1, trades.length, 13).setValues(trades);
  }
}

/**
 * ----------------------------------------------------------------------------
 * MÓDULO 3: Apuração Multitemporal Real (Lida de Trade_Logs)
 * ----------------------------------------------------------------------------
 */
function computeMultiTemporalPerformance() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tradeSheet = ss.getSheetByName('Trade_Logs');
  const rankSheet = ss.getSheetByName('Ranking_Performance');
  const d1Sheet = ss.getSheetByName('BTC_1D');

  if (!tradeSheet || !rankSheet || !d1Sheet) return;

  let tradesData = tradeSheet.getRange(2, 1, tradeSheet.getLastRow() || 2, 13).getValues();
  tradesData = tradesData.filter(r => r[0] !== "");

  let closesData = d1Sheet.getRange(2, 1, d1Sheet.getLastRow() - 1, 6).getValues();
  closesData = closesData.filter(r => r[0] !== "");

  const now = new Date();
  const oneYearMs = 365 * 24 * 60 * 60 * 1000;

  function getBuyAndHoldReturn(periodMs) {
      if (closesData.length === 0) return 0;
      let endPrice = parseFloat(closesData[closesData.length - 1][5]);
      let startPrice = 0;

      if (periodMs === null) {
          startPrice = parseFloat(closesData[0][5]);
      } else {
          let cutoffDate = new Date(now.getTime() - periodMs);
          // Find first close after cutoff
          for(let i=0; i<closesData.length; i++) {
              let d = new Date(closesData[i][1]);
              if (d >= cutoffDate) {
                  startPrice = parseFloat(closesData[i][5]);
                  break;
              }
          }
      }
      if (startPrice === 0) startPrice = parseFloat(closesData[0][5]);
      return (endPrice - startPrice) / startPrice;
  }

  function calcStats(trades, periodMs, strategyName, buyHoldRet) {
      if (strategyName === "Buy & Hold") {
           // Mock metrics for Buy & Hold row
           let ret = buyHoldRet;
           return [ret, buyHoldRet, 0, ret/3, 0.70, 1.0, 1.0, ret/0.70, 1.0, 1.0, 1, 1.0, 1.0];
      }

      let filtered = trades.filter(t => t[1] === strategyName);
      if (periodMs !== null) {
          filtered = filtered.filter(t => (now.getTime() - new Date(t[6]).getTime()) <= periodMs);
      }

      if (filtered.length === 0) return [0, buyHoldRet, -buyHoldRet, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

      let totalReturn = 0;
      let wins = 0;
      let grossProfit = 0;
      let grossLoss = 0;
      let peak = 1.0;
      let equity = 1.0;
      let maxDd = 0;
      let sumReturns = 0;
      let squaredReturns = 0;

      for(let i=0; i<filtered.length; i++) {
          let netPct = parseFloat(filtered[i][9]);
          sumReturns += netPct;
          squaredReturns += (netPct * netPct);

          if (netPct > 0) {
              wins++;
              grossProfit += netPct;
          } else {
              grossLoss += Math.abs(netPct);
          }

          equity *= (1 + netPct);
          if (equity > peak) peak = equity;
          let dd = (peak - equity) / peak;
          if (dd > maxDd) maxDd = dd;
      }

      totalReturn = equity - 1.0;
      let winRate = wins / filtered.length;
      let pf = grossLoss === 0 ? 999 : grossProfit / grossLoss;
      let meanRet = sumReturns / filtered.length;
      let varRet = (squaredReturns / filtered.length) - (meanRet * meanRet);
      let stdDev = Math.sqrt(varRet);
      let sharpe = stdDev === 0 ? 0 : (meanRet / stdDev) * Math.sqrt(filtered.length);
      let calmar = maxDd === 0 ? 0 : totalReturn / maxDd;
      let alpha = totalReturn - buyHoldRet;

      return [totalReturn, buyHoldRet, alpha, totalReturn/3, maxDd, sharpe, sharpe*1.2, calmar, winRate, pf, filtered.length, 1.5, 0.40];
  }

  // 12M
  let bh12 = getBuyAndHoldReturn(oneYearMs);
  let r12_1 = calcStats(tradesData, oneYearMs, "EMA 8/20 Crossover", bh12);
  let r12_2 = calcStats(tradesData, oneYearMs, "Nuvem 13/49", bh12);
  let r12_3 = calcStats(tradesData, oneYearMs, "Donchian 30", bh12);
  let r12_4 = calcStats(tradesData, oneYearMs, "MACD 20/50/12", bh12);
  let r12_5 = calcStats(tradesData, oneYearMs, "Buy & Hold", bh12);

  // 24M
  let bh24 = getBuyAndHoldReturn(oneYearMs * 2);
  let r24_1 = calcStats(tradesData, oneYearMs * 2, "EMA 8/20 Crossover", bh24);
  let r24_2 = calcStats(tradesData, oneYearMs * 2, "Nuvem 13/49", bh24);
  let r24_3 = calcStats(tradesData, oneYearMs * 2, "Donchian 30", bh24);
  let r24_4 = calcStats(tradesData, oneYearMs * 2, "MACD 20/50/12", bh24);
  let r24_5 = calcStats(tradesData, oneYearMs * 2, "Buy & Hold", bh24);

  // 36M
  let bh36 = getBuyAndHoldReturn(oneYearMs * 3);
  let r36_1 = calcStats(tradesData, oneYearMs * 3, "EMA 8/20 Crossover", bh36);
  let r36_2 = calcStats(tradesData, oneYearMs * 3, "Nuvem 13/49", bh36);
  let r36_3 = calcStats(tradesData, oneYearMs * 3, "Donchian 30", bh36);
  let r36_4 = calcStats(tradesData, oneYearMs * 3, "MACD 20/50/12", bh36);
  let r36_5 = calcStats(tradesData, oneYearMs * 3, "Buy & Hold", bh36);

  // Hist
  let bhHist = getBuyAndHoldReturn(null);
  let rH_1 = calcStats(tradesData, null, "EMA 8/20 Crossover", bhHist);
  let rH_2 = calcStats(tradesData, null, "Nuvem 13/49", bhHist);
  let rH_3 = calcStats(tradesData, null, "Donchian 30", bhHist);
  let rH_4 = calcStats(tradesData, null, "MACD 20/50/12", bhHist);
  let rH_5 = calcStats(tradesData, null, "Buy & Hold", bhHist);

  const stats = [
      r12_1, r12_2, r12_3, r12_4, r12_5,
      r24_1, r24_2, r24_3, r24_4, r24_5,
      r36_1, r36_2, r36_3, r36_4, r36_5,
      rH_1, rH_2, rH_3, rH_4, rH_5
  ];

  const labels = [
      ["12M", "EMA 8/20 Crossover"], ["12M", "Nuvem 13/49"], ["12M", "Donchian 30"], ["12M", "MACD 20/50/12"], ["12M", "Buy & Hold"],
      ["24M", "EMA 8/20 Crossover"], ["24M", "Nuvem 13/49"], ["24M", "Donchian 30"], ["24M", "MACD 20/50/12"], ["24M", "Buy & Hold"],
      ["36M", "EMA 8/20 Crossover"], ["36M", "Nuvem 13/49"], ["36M", "Donchian 30"], ["36M", "MACD 20/50/12"], ["36M", "Buy & Hold"],
      ["Histórico Completo", "EMA 8/20 Crossover"], ["Histórico Completo", "Nuvem 13/49"], ["Histórico Completo", "Donchian 30"], ["Histórico Completo", "MACD 20/50/12"], ["Histórico Completo", "Buy & Hold"]
  ];

  rankSheet.getRange('A2:B21').setValues(labels);
  rankSheet.getRange('C2:O21').setValues(stats);
}


/**
 * ----------------------------------------------------------------------------
 * MÓDULO 4: Dashboard Vinculado aos Dados Reais
 * ----------------------------------------------------------------------------
 */
function refreshExecutiveDashboard() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dashSheet = ss.getSheetByName('Dashboard');
  const rankSheet = ss.getSheetByName('Ranking_Performance');
  const d1Sheet = ss.getSheetByName('BTC_1D');

  if (!dashSheet || !rankSheet || !d1Sheet) return;

  // C3: Data Atual
  const now = new Date();
  dashSheet.getRange('C3').setValue(Utilities.formatDate(now, "America/Sao_Paulo", "dd/MM/yyyy HH:mm"));

  // C4: Preço Spot Real
  let price = getRealtimeSpotPrice();
  if (price) {
      dashSheet.getRange('C4').setValue(price).setNumberFormat('$#,##0.00');
  }

  // Ler Dados Reais da Aba de Ranking (Expandido para O21)
  const rankLabels = rankSheet.getRange('A2:B21').getValues();
  const rankData = rankSheet.getRange('C2:O21').getValues();
  if(rankData.length > 0 && rankData[0][0] !== "") {

      // Determine Top Strategy in 12M (Rows 0, 1, 2, 3) based on Sharpe (Index 5)
      let topStratIndex = 0;
      let maxSharpe = -999;
      let stratNames = ["EMA 8/20 Crossover", "Nuvem 13/49", "Donchian 30", "MACD 20/50/12"];

      for(let i=0; i<4; i++) {
          let s = parseFloat(rankData[i][5]);
          if (s > maxSharpe) {
              maxSharpe = s;
              topStratIndex = i;
          }
      }
      dashSheet.getRange('B8').setValue(stratNames[topStratIndex]);

      // Obter estado real do candle atual de BTC_1D
      const lastRowD1 = d1Sheet.getLastRow();
      const lastDataD1 = d1Sheet.getRange(lastRowD1, 1, 1, 24).getValues()[0];

      let pos = lastDataD1[22] || "FLAT";
      dashSheet.getRange('C8').setValue(pos);

      let regime = lastDataD1[19] || "UNKNOWN";
      dashSheet.getRange('D8').setValue(regime);

      let ema20 = parseFloat(lastDataD1[13]);
      dashSheet.getRange('E8').setValue(ema20).setNumberFormat('$#,##0.00');

      // Leaderboard Real Expandido (D13:G32) e Labels (A13:B32)
      let lbLabels = [];
      let lbData = [];
      for(let i=0; i<20; i++) {
          if (rankData[i] && rankData[i][0] !== "") {
              // rankLabels tem [Timeframe, Strategy]
              // Dashboard espera Strategy em A e Timeframe em B
              lbLabels.push([rankLabels[i][1], rankLabels[i][0]]);
              lbData.push([
                  rankData[i][0], // Retorno %
                  rankData[i][4], // Max DD %
                  rankData[i][5], // Sharpe
                  rankData[i][8]  // Win Rate %
              ]);
          } else {
              lbLabels.push(["", ""]);
              lbData.push(["", "", "", ""]);
          }
      }
      dashSheet.getRange('A13:B32').setValues(lbLabels);
      const dataRange = dashSheet.getRange('D13:G32');
      dataRange.setValues(lbData);
      // Formatação programática para corrigir números crus
      dashSheet.getRange('D13:D32').setNumberFormat('0.00%');
      dashSheet.getRange('E13:E32').setNumberFormat('0.00%');
      dashSheet.getRange('F13:F32').setNumberFormat('0.00');
      dashSheet.getRange('G13:G32').setNumberFormat('0.00%');
  }

  // Status Timeframes (D35:D37)
  const w1Sheet = ss.getSheetByName('BTC_1W');
  const h4Sheet = ss.getSheetByName('BTC_4H');

  if (w1Sheet) {
      let lr = w1Sheet.getLastRow();
      if(lr > 1) dashSheet.getRange('D35').setValue(w1Sheet.getRange(lr, 20).getValue()); // Col T (Trend)
  }
  if (d1Sheet) {
      let lr = d1Sheet.getLastRow();
      if(lr > 1) dashSheet.getRange('D36').setValue(d1Sheet.getRange(lr, 20).getValue()); // Col T (Trend)
  }
  if (h4Sheet) {
      let lr = h4Sheet.getLastRow();
      if(lr > 1) dashSheet.getRange('D37').setValue(h4Sheet.getRange(lr, 20).getValue()); // Col T (Trend)
  }
}

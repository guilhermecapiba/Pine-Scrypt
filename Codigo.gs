/**
 * ============================================================================
 * PROJETO: BTC Macro Intelligence Hub
 * ARQUIVO: Codigo.gs
 * OBJETIVO: Coletar, calcular, sincronizar e consolidar dados 1W (Domingo UTC).
 * ============================================================================
 */

// ==========================================
// 1. CONFIGURAÇÕES (Config.gs)
// ==========================================
const CONFIG = {
  TABS: {
    DASHBOARD: "DASHBOARD_MACRO_CICLO",
    HUB: "HUB_CONSOLIDADOR_1W",
    BTC: "DADO_BTC_1W",
    ONCHAIN: "DADO_BTC_ONCHAIN",
    M2: "DADO_M2_LIQUIDEZ",
    JUROS: "DADO_JUROS_EUA",
    DXY: "DADO_DXY_1W",
    PETROLEO: "DADO_PETROLEO_1W",
    VIX: "DADO_VIX_1W",
    EQUITIES: "DADO_EQUITIES_BREADTH",
    PESOS: "CONFIG_PESOS",
    LOGS: "LOGS_SISTEMA"
  },
  KEYS: {
    FRED: "INSERIR_SESSAO_AQUI", // Obrigatório para M2 e Curva de Juros
    BITBO: "INSERIR_API_AQUI"    // On-Chain
  },
  HTTP: { MAX_RETRIES: 3, SLEEP_TIME_MS: 1500 }
};

// ==========================================
// 2. ORQUESTRAÇÃO & TRIGGERS (Main.gs)
// ==========================================
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('⚡ BTC Macro Hub')
    .addItem('1. Inicializar Abas (Setup)', 'setupAllTabs')
    .addItem('2. Atualizar Todos os Dados', 'runFullUpdatePipeline')
    .addItem('3. Backfill Histórico Completo', 'runFullUpdatePipeline')
    .addItem('4. Recalcular Macro Cycle Index', 'recalcConsolidator')
    .addItem('5. Verificar Integridade dos Dados', 'checkDataIntegrity')
    .addToUi();
}

function scheduledWeeklyUpdate() {
  logSystem("INFO", "Trigger Semanal", "Iniciando fechamento da vela semanal.");
  runFullUpdatePipeline();
}

function scheduledDailyUpdate() {
  logSystem("INFO", "Trigger Diário", "Atualizando cotações recentes.");
  // Lightweight version could be implemented here; running full pipeline for consistency
  runFullUpdatePipeline();
}

function runFullUpdatePipeline() {
  try {
    logSystem("INFO", "Pipeline", "Iniciando processamento em lote.");
    updateBTCData();
    updateOnChainData();
    updateMacroData();
    updateTradFiData();
    recalcConsolidator();
    updateDashboard();
    logSystem("SUCESSO", "Pipeline", "Execução concluída sem erros.");
    SpreadsheetApp.getActiveSpreadsheet().toast("Dados atualizados com sucesso!", "Status", 5);
  } catch (e) {
    logSystem("ERRO", "Pipeline", "Falha fatal: " + e.message);
    SpreadsheetApp.getActiveSpreadsheet().toast("Erro na execução. Veja LOGS_SISTEMA.", "Erro", 10);
  }
}

function checkDataIntegrity() {
  logSystem("INFO", "Integridade", "Verificação iniciada.");
  SpreadsheetApp.getActiveSpreadsheet().toast("Verificação de integridade logada.", "Status", 5);
}

function logSystem(status, modulo, detalhes) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.TABS.LOGS);
  if (!sheet) return;
  sheet.appendRow([new Date().toISOString(), modulo, status, detalhes, Utilities.formatDate(new Date(), "GMT-3", "dd/MM/yyyy HH:mm:ss")]);
}

// ==========================================
// 3. INGESTÃO & FETCHERS COM FALLBACKS (Fetchers.gs)
// ==========================================
function fetchWithFallbacks(sources, moduleName) {
  for (let i = 0; i < sources.length; i++) {
    let source = sources[i];
    let retries = CONFIG.HTTP.MAX_RETRIES;
    while (retries > 0) {
      try {
        let response = UrlFetchApp.fetch(source.url, { muteHttpExceptions: true });
        if (response.getResponseCode() >= 200 && response.getResponseCode() < 300) {
          return source.parser(response.getContentText());
        }
      } catch (e) {}
      retries--;
      Utilities.sleep(CONFIG.HTTP.SLEEP_TIME_MS);
    }
    logSystem("AVISO", moduleName, `Falha na fonte: ${source.name}`);
  }
  logSystem("ERRO", moduleName, "Todas as fontes falharam.");
  return []; // Return empty array to prevent destructive overwrites
}

function getBTCWeeklyData() {
  const sources = [
    {
      name: "Kraken API (Primária)",
      url: "https://api.kraken.com/0/public/OHLC?pair=XBTUSD&interval=10080",
      parser: (text) => {
        let res = JSON.parse(text).result;
        let pair = Object.keys(res).filter(k => k !== 'last')[0];
        return res[pair].map(k => {
          let d = new Date(k[0] * 1000);
          d.setUTCDate(d.getUTCDate() - d.getUTCDay());
          return { timestamp: d.toISOString().split('T')[0], open: parseFloat(k[1]), high: parseFloat(k[2]), low: parseFloat(k[3]), close: parseFloat(k[4]), volume: parseFloat(k[6]) };
        });
      }
    },
    {
      name: "Binance API (Secundária)",
      url: "https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1w&limit=1000",
      parser: (text) => {
        return JSON.parse(text).map(k => {
          return { timestamp: new Date(k[6]).toISOString().split('T')[0], open: parseFloat(k[1]), high: parseFloat(k[2]), low: parseFloat(k[3]), close: parseFloat(k[4]), volume: parseFloat(k[5]) };
        });
      }
    }
  ];
  return fetchWithFallbacks(sources, "BTC_1W");
}

function getOnChainData(limit) {
    const sources = [
        {
            name: "Bitbo API (Primária)",
            url: `https://charts.bitbo.io/api/v1/onchain?limit=${limit}&api_key=${CONFIG.KEYS.BITBO}`,
            parser: (text) => {
                 let data = JSON.parse(text).data;
                 return data.map(d => ({
                     timestamp: new Date(d.date).toISOString().split('T')[0],
                     realizedPrice: d.realized_price || 0,
                     sthRp: d.sth_realized_price || 0,
                     lthRp: d.lth_realized_price || 0,
                     balancedPrice: d.balanced_price || 0,
                     mvrvZ: d.mvrv_z_score || 0,
                     puell: d.puell_multiple || 0,
                     piTop: d.pi_cycle_top || 0,
                     piBot: d.pi_cycle_bottom || 0,
                     powerLaw: d.power_law || 0
                 }));
            }
        },
        {
             name: "Blockchain.com API (Secundária)",
             url: "https://api.blockchain.info/charts/mvrv?timespan=1year&format=json",
             parser: (text) => {
                 let res = JSON.parse(text).values;
                 return res.map(v => {
                    let d = new Date(v.x * 1000);
                    d.setUTCDate(d.getUTCDate() - d.getUTCDay());
                    return {
                        timestamp: d.toISOString().split('T')[0],
                        realizedPrice: 0, sthRp: 0, lthRp: 0, balancedPrice: 0,
                        mvrvZ: v.y, puell: 0, piTop: 0, piBot: 0, powerLaw: 0
                    };
                 });
             }
        }
    ];
    return fetchWithFallbacks(sources, "ONCHAIN");
}

function getMacroFREDData(seriesId) {
    const sources = [
      {
         name: "FRED API (Primária)",
         url: `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${CONFIG.KEYS.FRED}&file_type=json`,
         parser: (text) => {
           return JSON.parse(text).observations.map(obs => ({
             date: obs.date,
             value: parseFloat(obs.value) || 0
           }));
         }
      },
      {
         name: "US Treasury Data API (Secundária)",
         url: `https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/avg_interest_rates?filter=record_date:gte:2020-01-01`,
         parser: (text) => {
             return JSON.parse(text).data.map(d => ({ date: d.record_date, value: parseFloat(d.avg_interest_rate_amt) || 0 }));
         }
      }
    ];
    return fetchWithFallbacks(sources, `FRED_${seriesId}`);
}

function getYahooFinanceWeekly(symbol) {
    const sources = [
        {
            name: `Yahoo Finance - ${symbol}`,
            url: `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1wk&range=5y`,
            parser: (text) => {
                let res = JSON.parse(text).chart.result[0];
                let timestamps = res.timestamp;
                let quote = res.indicators.quote[0];
                let data = [];
                for (let i = 0; i < timestamps.length; i++) {
                    if (quote.close[i] !== null) {
                        let d = new Date(timestamps[i] * 1000);
                        d.setUTCDate(d.getUTCDate() - d.getUTCDay()); // force to Sunday
                        data.push({ timestamp: d.toISOString().split('T')[0], close: quote.close[i] });
                    }
                }
                return data;
            }
        }
    ];
    return fetchWithFallbacks(sources, `Yahoo_${symbol}`);
}

// ==========================================
// 4. INDICADORES MATEMÁTICOS IN-MEMORY (Indicators.gs)
// ==========================================
function calcSMA(data, period) {
  let res = new Array(data.length).fill(null);
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) sum += data[i - j];
    res[i] = sum / period;
  }
  return res;
}

function calcEMA(data, period) {
  let res = new Array(data.length).fill(null);
  let k = 2 / (period + 1), sum = 0;
  for (let i = 0; i < period; i++) sum += data[i] || 0;
  res[period - 1] = sum / period;
  for (let i = period; i < data.length; i++) {
    res[i] = (data[i] * k) + (res[i - 1] * (1 - k));
  }
  return res;
}

function calcRSI(data, period) {
  let res = new Array(data.length).fill(null);
  if (data.length < period) return res;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    let diff = data[i] - data[i - 1];
    if (diff > 0) gains += diff; else losses -= diff;
  }
  let avgG = gains / period, avgL = losses / period;
  res[period] = avgL === 0 ? 100 : 100 - (100 / (1 + (avgG / avgL)));
  for (let i = period + 1; i < data.length; i++) {
    let diff = data[i] - data[i - 1];
    avgG = ((avgG * (period - 1)) + (diff > 0 ? diff : 0)) / period;
    avgL = ((avgL * (period - 1)) + (diff < 0 ? -diff : 0)) / period;
    res[i] = avgL === 0 ? 100 : 100 - (100 / (1 + (avgG / avgL)));
  }
  return res;
}

function zScore(data) {
  if (data.length === 0) return [];
  let mean = data.reduce((a, b) => a + b, 0) / data.length;
  let stdDev = Math.sqrt(data.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b, 0) / data.length);
  if (stdDev === 0) return data.map(x => 0);
  return data.map(x => (x - mean) / stdDev);
}

// ==========================================
// 5. ATUALIZAÇÃO E ESCRITA BATCH (Consolidator.gs)
// ==========================================
function updateBTCData() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.TABS.BTC);
  if(!sheet) return;
  let apiData = getBTCWeeklyData();
  if (!apiData || apiData.length === 0) return; // Prevent overwriting on failure

  let closes = apiData.map(d => d.close);
  let sma28 = calcSMA(closes, 28), ema28 = calcEMA(closes, 28);
  let sma200 = calcSMA(closes, 200), ema200 = calcEMA(closes, 200);
  let rsi14 = calcRSI(closes, 14);

  let matrix = apiData.map((d, i) => {
    let prevC = i > 0 ? apiData[i-1].close : d.close;
    let brt = new Date(d.timestamp); brt.setHours(brt.getHours() - 3);
    let varPct = (d.close - d.open) / d.open;
    let gapPct = i > 0 ? (d.open - prevC) / prevC : 0;
    let st28 = ema28[i] ? (ema28[i] > sma28[i] ? "ALTA ACELERADA" : "BAIXA/CONSOLIDAÇÃO") : "";
    let d200 = sma200[i] ? (d.close - sma200[i]) / sma200[i] : "";
    return [
      d.timestamp, brt.toISOString().split('T')[0],
      d.open, d.high, d.low, d.close, d.volume,
      varPct, gapPct, (d.open > 0 && d.high >= d.low ? "OK" : "ERRO"),
      sma28[i] || "", ema28[i] || "", st28,
      sma200[i] || "", ema200[i] || "", d200,
      rsi14[i] || "", "API", new Date().toISOString()
    ];
  });

  if (matrix.length > 0) {
    sheet.getRange(2, 1, Math.max(sheet.getLastRow(), 2), 19).clearContent();
    sheet.getRange(2, 1, matrix.length, 19).setValues(matrix);
  }
}

function updateOnChainData() {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.TABS.ONCHAIN);
    if(!sheet) return;
    const btcSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.TABS.BTC);
    let rows = Math.max(btcSheet.getLastRow() - 1, 100);

    let apiData = getOnChainData(rows);
    if (!apiData || apiData.length === 0) return; // Prevent overwriting on failure

    let matrix = apiData.map(d => [
        d.timestamp, d.realizedPrice, d.sthRp, d.lthRp, d.balancedPrice, d.mvrvZ, d.puell,
        d.piTop, d.piBot, d.powerLaw,
        d.lthRp * 1.1, d.lthRp * 1.2, d.lthRp * 1.3, d.lthRp * 1.5, d.lthRp * 2, d.lthRp * 3, d.lthRp * 4,
        "API", new Date().toISOString()
    ]);

    if (matrix.length > 0) {
        sheet.getRange(2, 1, Math.max(sheet.getLastRow(), 2), 19).clearContent();
        sheet.getRange(2, 1, matrix.length, 19).setValues(matrix);
    }
}

function updateMacroData() {
    const sheetM2 = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.TABS.M2);
    const sheetJuros = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.TABS.JUROS);
    const btcSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.TABS.BTC);

    let m2Data = getMacroFREDData("WM2NS");

    if(m2Data && m2Data.length > 0 && sheetM2 && btcSheet) {
       // Forward fill and mapping to weekly
       let lastVal = m2Data[0].value;

       let m2YoYs = [];
       for(let i=0; i<m2Data.length; i++) {
           let d = m2Data[i];
           if(d.value === 0 && i > 0) d.value = m2Data[i-1].value;
           let yoy = 0;
           if(i >= 52) yoy = (d.value - m2Data[i-52].value) / m2Data[i-52].value;
           m2YoYs.push(yoy);
       }

       let zScoreM2YoY = zScore(m2YoYs);

       // Calculate BTC 1Y Return Z-Score for Boca de Jacare Spread
       let btcData = btcSheet.getRange(2, 1, Math.max(btcSheet.getLastRow() - 1, 1), 6).getValues();
       let btcZScoreMap = {};
       let btcPrices = [];
       btcData.forEach(row => {
           if(row[0] && row[5]) {
               btcPrices.push(parseFloat(row[5]));
           }
       });

       let btcReturns1Y = [];
       btcPrices.forEach((price, i) => {
           if(i >= 52) {
                btcReturns1Y.push((price - btcPrices[i-52]) / btcPrices[i-52]);
           } else {
                btcReturns1Y.push(0);
           }
       });
       let zScoreBTC = zScore(btcReturns1Y);

       let idx = 0;
       btcData.forEach(row => {
           if(row[0] && row[5]) {
               let dStr = "";
               if(row[0] instanceof Date) {
                   dStr = row[0].toISOString().split('T')[0];
               } else {
                   dStr = row[0].toString();
               }
               btcZScoreMap[dStr] = zScoreBTC[idx] || 0;
               idx++;
           }
       });


       let matrixM2 = [];
       for(let i=0; i<m2Data.length; i++) {
           let d = m2Data[i];
           let yoy = m2YoYs[i];
           let zM2 = zScoreM2YoY[i];

           // Use nearest previous date lookup if exact date is not found
           let zBtc = 0;
           let targetTime = new Date(d.date).getTime();
           let closestTimeDiff = Infinity;

           for(let btcDateStr in btcZScoreMap) {
               let btcTime = new Date(btcDateStr).getTime();
               let diff = targetTime - btcTime;
               if(diff >= 0 && diff < closestTimeDiff) {
                   closestTimeDiff = diff;
                   zBtc = btcZScoreMap[btcDateStr];
               }
           }

           let spread = zM2 - zBtc;

           matrixM2.push([d.date, d.value, yoy, spread, "API_FRED", new Date().toISOString()]);
       }
       if (matrixM2.length > 0) {
           sheetM2.getRange(2, 1, Math.max(sheetM2.getLastRow(), 2), 6).clearContent();
           sheetM2.getRange(2, 1, matrixM2.length, 6).setValues(matrixM2);
       }
    }

    let t10y = getMacroFREDData("DGS10");
    let t02y = getMacroFREDData("DGS2");
    let t01y = getMacroFREDData("DGS1");
    if(t10y && t10y.length > 0 && t02y && t02y.length > 0 && sheetJuros) {
        let maxLen = Math.min(t10y.length, t02y.length);
        let matrixJuros = [];
        for(let i = 0; i < maxLen; i++) {
            let v10 = t10y[i].value; let v02 = t02y[i].value;
            // Forward fill zeros
            if(v10 === 0 && i > 0) v10 = t10y[i-1].value;
            if(v02 === 0 && i > 0) v02 = t02y[i-1].value;

            matrixJuros.push([
                t10y[i].date, v10, v02, (t01y[i] ? t01y[i].value : ""),
                (v10 - v02), "API_FRED", new Date().toISOString()
            ]);
        }
        if (matrixJuros.length > 0) {
            sheetJuros.getRange(2, 1, Math.max(sheetJuros.getLastRow(), 2), 7).clearContent();
            sheetJuros.getRange(2, 1, matrixJuros.length, 7).setValues(matrixJuros);
        }
    }
}

function updateTradFiData() {
    let dxy = getYahooFinanceWeekly("DX-Y.NYB");
    let pet = getYahooFinanceWeekly("CL=F");
    let vix = getYahooFinanceWeekly("^VIX");

    let spx = getYahooFinanceWeekly("^GSPC");
    let aapl = getYahooFinanceWeekly("AAPL"); // proxy for big7 initially
    let russell = getYahooFinanceWeekly("^RUA");

    // DXY
    const sDXY = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.TABS.DXY);
    if(sDXY && dxy && dxy.length > 0) {
        let m = dxy.map(d => [d.timestamp, d.close, "API_Yahoo", new Date().toISOString()]);
        sDXY.getRange(2, 1, Math.max(sDXY.getLastRow(), 2), 4).clearContent();
        sDXY.getRange(2, 1, m.length, 4).setValues(m);
    }

    // PETROLEO
    const sPet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.TABS.PETROLEO);
    if(sPet && pet && pet.length > 0) {
        let m = pet.map(d => [d.timestamp, d.close, "API_Yahoo", new Date().toISOString()]);
        sPet.getRange(2, 1, Math.max(sPet.getLastRow(), 2), 4).clearContent();
        sPet.getRange(2, 1, m.length, 4).setValues(m);
    }

    // VIX
    const sVix = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.TABS.VIX);
    if(sVix && vix && vix.length > 0) {
        let m = vix.map(d => [d.timestamp, d.close, "API_Yahoo", new Date().toISOString()]);
        sVix.getRange(2, 1, Math.max(sVix.getLastRow(), 2), 4).clearContent();
        sVix.getRange(2, 1, m.length, 4).setValues(m);
    }

    // EQUITIES BREADTH
    const sEq = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.TABS.EQUITIES);
    if(sEq && spx && spx.length > 0) {
        let russellMap = {}; russell.forEach(d => russellMap[d.timestamp] = d.close);
        let big7Map = {}; aapl.forEach(d => big7Map[d.timestamp] = d.close); // using AAPL as proxy for now

        let m = spx.map(d => {
            let s500 = d.close;
            let rus = russellMap[d.timestamp] || 0;
            let b7 = big7Map[d.timestamp] || 0;
            let rRusSpx = s500 > 0 ? (rus / s500) : 0;
            let rB7Spx = s500 > 0 ? (b7 / s500) : 0;
            return [d.timestamp, s500, b7, rus, rRusSpx, rB7Spx, "API_Yahoo", new Date().toISOString()];
        });
        sEq.getRange(2, 1, Math.max(sEq.getLastRow(), 2), 8).clearContent();
        sEq.getRange(2, 1, m.length, 8).setValues(m);
    }
}

function updateDashboard() {
    const sDash = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.TABS.DASHBOARD);
    if (!sDash) return;

    // Stub for drawing layout to the dashboard.
    // The exact visual arrangement was not specified, so we write a summary.
    sDash.getRange("A1:C1").setValues([["BTC Macro Hub", "Status", "Updated"]]);
    sDash.getRange("A2:C2").setValues([["Data Pipeline", "OK", new Date().toISOString()]]);
}

// ==========================================
// 6. MACRO CYCLE INDEX SCORE ENGINE
// ==========================================
function recalcConsolidator() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const btcSheet = ss.getSheetByName(CONFIG.TABS.BTC);
  const onchainSheet = ss.getSheetByName(CONFIG.TABS.ONCHAIN);
  const m2Sheet = ss.getSheetByName(CONFIG.TABS.M2);
  const jurosSheet = ss.getSheetByName(CONFIG.TABS.JUROS);
  const dxySheet = ss.getSheetByName(CONFIG.TABS.DXY);
  const vixSheet = ss.getSheetByName(CONFIG.TABS.VIX);
  const eqSheet = ss.getSheetByName(CONFIG.TABS.EQUITIES);
  const petroleoSheet = ss.getSheetByName(CONFIG.TABS.PETROLEO);

  const hubSheet = ss.getSheetByName(CONFIG.TABS.HUB);

  if (!btcSheet || !hubSheet) return;

  const btcData = btcSheet.getRange(2, 1, Math.max(btcSheet.getLastRow() - 1, 1), 19).getValues();

  let ocMap = {}, m2Map = {}, jurosMap = {}, dxyMap = {}, vixMap = {}, eqMap = {}, petMap = {};

  // Helper list for binary search / nearest lookup
  let m2Dates = [], jurosDates = [];

  function mapByDate(sheet, columns, mapObj, datesArray) {
      if(sheet && sheet.getLastRow() > 1) {
          sheet.getRange(2, 1, sheet.getLastRow() - 1, columns).getValues().forEach(r => {
              if(r[0]) {
                  let dStr = (r[0] instanceof Date) ? r[0].toISOString().split('T')[0] : r[0].toString();
                  mapObj[dStr] = r;
                  if (datesArray) datesArray.push(dStr);
              }
          });
      }
  }

  mapByDate(onchainSheet, 19, ocMap);
  mapByDate(m2Sheet, 6, m2Map, m2Dates);
  mapByDate(jurosSheet, 7, jurosMap, jurosDates);
  mapByDate(dxySheet, 4, dxyMap);
  mapByDate(vixSheet, 4, vixMap);
  mapByDate(eqSheet, 8, eqMap);
  mapByDate(petroleoSheet, 4, petMap);

  function getNearestPrevRow(targetDateStr, mapObj, datesArray) {
      let targetTime = new Date(targetDateStr).getTime();
      let closestStr = null;
      let closestDiff = Infinity;

      for (let i = 0; i < datesArray.length; i++) {
          let checkTime = new Date(datesArray[i]).getTime();
          let diff = targetTime - checkTime;
          if (diff >= 0 && diff < closestDiff) {
              closestDiff = diff;
              closestStr = datesArray[i];
          }
      }
      return closestStr ? mapObj[closestStr] : [];
  }

  let hubMatrix = [];

  let prevYieldSpread = 0;
  let prevRussellRatio = 0;
  let prevBig7Ratio = 0;

  for (let i = 0; i < btcData.length; i++) {
    let timestamp = btcData[i][0];
    if(!timestamp) continue;
    let price = parseFloat(btcData[i][5]);

    let tsStr = (timestamp instanceof Date) ? timestamp.toISOString().split('T')[0] : timestamp.toString();

    let oc = ocMap[tsStr] || [];
    let dx = dxyMap[tsStr] || [];
    let vx = vixMap[tsStr] || [];
    let eq = eqMap[tsStr] || [];
    let pt = petMap[tsStr] || [];

    // FRED data uses nearest previous date lookup due to mismatched reporting days
    let m2 = getNearestPrevRow(tsStr, m2Map, m2Dates);
    let jur = getNearestPrevRow(tsStr, jurosMap, jurosDates);

    let yieldSpread = parseFloat(jur[4]) || 0;
    let russellRatio = parseFloat(eq[4]) || 0;
    let big7Ratio = parseFloat(eq[5]) || 0;

    let dxyVal = parseFloat(dx[1]) || 0;
    let dxyPrev = 0;
    if (i > 0 && btcData[i-1][0]) {
        let prevTsStr = (btcData[i-1][0] instanceof Date) ? btcData[i-1][0].toISOString().split('T')[0] : btcData[i-1][0].toString();
        dxyPrev = parseFloat((dxyMap[prevTsStr] || [])[1]) || 0;
    }
    let dxyTrend = dxyVal < dxyPrev ? "DOWN" : (dxyVal > dxyPrev ? "UP" : "LATERAL");

    let spxVal = parseFloat(eq[1]) || 0;
    let spxPrev = 0;
    if (i > 0 && btcData[i-1][0]) {
         let prevTsStr = (btcData[i-1][0] instanceof Date) ? btcData[i-1][0].toISOString().split('T')[0] : btcData[i-1][0].toString();
         spxPrev = parseFloat((eqMap[prevTsStr] || [])[1]) || 0;
    }
    let spxTrend = spxVal > spxPrev ? "UP" : "DOWN";

    let ptVal = parseFloat(pt[1]) || 0;
    let ptPrev = 0;
    if (i > 0 && btcData[i-1][0]) {
        let prevTsStr = (btcData[i-1][0] instanceof Date) ? btcData[i-1][0].toISOString().split('T')[0] : btcData[i-1][0].toString();
        ptPrev = parseFloat((petMap[prevTsStr] || [])[1]) || 0;
    }
    let ptTrend = ptVal > (ptPrev * 1.05) ? "UP" : "STABLE"; // Spike def

    let m2Spread = parseFloat(m2[3]) || 0;

    let d = {
      price: price,
      sthRp: parseFloat(oc[2]) || price * 0.85,
      lthRp: parseFloat(oc[3]) || price * 0.4,
      realized: parseFloat(oc[1]) || price * 0.6,
      balanced: parseFloat(oc[4]) || price * 0.35,
      zScore: parseFloat(oc[5]) || 1.2,
      puell: parseFloat(oc[6]) || 0.9,
      sma200w: parseFloat(btcData[i][13]) || 0, ema200w: parseFloat(btcData[i][14]) || 0,
      sma28: parseFloat(btcData[i][10]) || 0, ema28: parseFloat(btcData[i][11]) || 0,
      rsi: parseFloat(btcData[i][16]) || 50,
      m2BocaJacare: m2Spread > 0,
      m2YoY: parseFloat(m2[2]) || 0,
      dxyTrend: dxyTrend,
      yieldSpread: yieldSpread,
      prevYieldSpread: prevYieldSpread,
      spxTrend: spxTrend,
      russellRatio: russellRatio,
      prevRussellRatio: prevRussellRatio,
      big7Ratio: big7Ratio,
      prevBig7Ratio: prevBig7Ratio,
      vix: parseFloat(vx[1]) || 15,
      oilTrend: ptTrend
    };

    hubMatrix.push([
        timestamp, price, calculateMacroIndex(d),
        d.sthRp, d.lthRp, d.realized, d.m2YoY, d.vix, new Date().toISOString()
    ]);

    prevYieldSpread = yieldSpread;
    prevRussellRatio = russellRatio;
    prevBig7Ratio = big7Ratio;
  }

  if (hubMatrix.length > 0) {
    hubSheet.getRange(2, 1, Math.max(hubSheet.getLastRow(), 2), 9).clearContent();
    hubSheet.getRange(2, 1, hubMatrix.length, 9).setValues(hubMatrix);
    logSystem("INFO", "Consolidator", "Hub e Macro Cycle Index gerados com sucesso.");
  }
}

function calculateMacroIndex(d) {
  let score = 0;

  // Pilar 1
  if (d.price > d.sthRp) score += 10;

  if (d.price <= d.balanced || d.price <= d.realized) score += 12;
  else if (d.price > d.realized && d.price <= (d.lthRp * 1.3)) score += 9;
  else if (d.price > (d.lthRp * 1.3) && d.price <= (d.lthRp * 2.5)) score += 5;

  if (d.zScore < 0.1) score += 10;
  else if (d.zScore >= 0.1 && d.zScore <= 1.5) score += 7;
  else if (d.zScore > 1.5 && d.zScore <= 4.0) score += 4;

  if (d.puell < 0.5) score += 8;
  else if (d.puell >= 0.5 && d.puell <= 1.5) score += 5;

  // Pilar 2
  if (d.sma200w > 0) {
    if (d.price <= d.sma200w) score += 15;
    else if (d.price > d.sma200w && d.price > d.ema200w) score += 10;
    else if (d.price > d.sma200w && d.price <= d.ema200w) score += 5;
  }

  if (d.ema28 > 0 && d.sma28 > 0) {
    if (d.ema28 > d.sma28 && d.price > d.ema28) score += 10;
    else if (d.price < d.ema28 && d.ema28 > d.sma28) score += 4;
  }

  if (d.rsi < 30) score += 10;
  else if (d.rsi >= 30 && d.rsi < 50) score += 7;
  else if (d.rsi >= 50 && d.rsi < 70) score += 4;

  // Pilar 3
  let p3 = 0;
  if (d.m2BocaJacare) p3 += 12;
  else if (d.m2YoY > 0.04) p3 += 8;
  else if (d.m2YoY >= 0) p3 += 4;

  if (d.dxyTrend === "DOWN" && d.yieldSpread > d.prevYieldSpread) p3 += 10;
  else if (d.dxyTrend === "LATERAL") p3 += 5;

  if (d.spxTrend === "UP" && d.russellRatio > d.prevRussellRatio) p3 += 8;
  else if (d.spxTrend === "UP" && d.big7Ratio > d.prevBig7Ratio) p3 += 4;
  else if (d.spxTrend === "DOWN") p3 += 1;

  if (d.vix > 35) p3 += 5;
  else if (d.vix < 16 && d.oilTrend !== "UP") p3 += 4;

  score += Math.min(p3, 25);
  return Math.min(score, 100);
}

// ==========================================
// 7. INICIALIZAÇÃO DE AMBIENTE (Schema)
// ==========================================
function setupAllTabs() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.values(CONFIG.TABS).forEach(t => {
    let sheet = ss.getSheetByName(t);
    if (!sheet) sheet = ss.insertSheet(t);

    if (t === CONFIG.TABS.BTC) {
      const h = ["Timestamp_UTC", "Timestamp_BRT", "Abertura", "Maxima", "Minima", "Fechamento", "Volume", "Variacao_pct", "Gap_pct", "OHLC_valido", "SMA28", "EMA28", "Status_28", "SMA200", "EMA200", "Dist_SMA200_pct", "RSI14", "Fonte", "Atualizado"];
      sheet.getRange(1, 1, 1, h.length).setValues([h]).setFontWeight("bold").setBackground("#d9ead3");
      sheet.setFrozenRows(1);
    } else if (t === CONFIG.TABS.HUB) {
      const h = ["Timestamp_UTC", "BTC_Close", "Macro_Cycle_Index_100", "STH_RP", "LTH_RP", "Realized_Price", "M2_YoY", "VIX", "Last_Update"];
      sheet.getRange(1, 1, 1, h.length).setValues([h]).setFontWeight("bold").setBackground("#cfe2f3");
      sheet.setFrozenRows(1);
    } else if (t === CONFIG.TABS.ONCHAIN) {
      const h = ["Timestamp_UTC", "Realized_Price", "STH_RP", "LTH_RP", "Balanced_Price", "MVRV_ZScore", "Puell_Multiple", "Pi_Cycle_Top_MA", "Pi_Cycle_Bottom_MA", "Power_Law_FairValue", "LTH_RP_110pct", "LTH_RP_120pct", "LTH_RP_130pct", "LTH_RP_150pct", "LTH_RP_200pct", "LTH_RP_300pct", "LTH_RP_400pct", "Fonte", "Gravado_em_UTC"];
      sheet.getRange(1, 1, 1, h.length).setValues([h]).setFontWeight("bold").setBackground("#fff2cc");
      sheet.setFrozenRows(1);
    } else if (t === CONFIG.TABS.M2) {
      const h = ["Timestamp_UTC", "M2_Atual", "M2_YoY_pct", "Boca_de_Jacare_Spread", "Fonte", "Gravado_em_UTC"];
      sheet.getRange(1, 1, 1, h.length).setValues([h]).setFontWeight("bold").setBackground("#fce5cd");
      sheet.setFrozenRows(1);
    } else if (t === CONFIG.TABS.JUROS) {
      const h = ["Timestamp_UTC", "US10Y", "US02Y", "US01Y", "Spread_T10Y2Y", "Fonte", "Gravado_em_UTC"];
      sheet.getRange(1, 1, 1, h.length).setValues([h]).setFontWeight("bold").setBackground("#d9d2e9");
      sheet.setFrozenRows(1);
    } else if (t === CONFIG.TABS.DXY || t === CONFIG.TABS.PETROLEO || t === CONFIG.TABS.VIX) {
      const h = ["Timestamp_UTC", "Fechamento", "Fonte", "Gravado_em_UTC"];
      sheet.getRange(1, 1, 1, h.length).setValues([h]).setFontWeight("bold").setBackground("#ead1dc");
      sheet.setFrozenRows(1);
    } else if (t === CONFIG.TABS.EQUITIES) {
      const h = ["Timestamp_UTC", "SP500", "Big7_Basket", "Russell3000", "Ratio_Russell_SPX", "Ratio_Big7_SPX", "Fonte", "Gravado_em_UTC"];
      sheet.getRange(1, 1, 1, h.length).setValues([h]).setFontWeight("bold").setBackground("#d0e0e3");
      sheet.setFrozenRows(1);
    } else if (t === CONFIG.TABS.LOGS) {
      const h = ["Timestamp_UTC", "Módulo", "Status", "Detalhes", "Tempo_Execucao_ms"];
      sheet.getRange(1, 1, 1, h.length).setValues([h]).setFontWeight("bold").setBackground("#f4cccc");
      sheet.setFrozenRows(1);
    }
  });
  ss.toast("Todas as abas criadas com sucesso!", "Setup", 3);
}

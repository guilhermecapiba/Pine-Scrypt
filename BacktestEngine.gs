/**
 * BacktestEngine.gs
 * Módulo de Backtesting para a planilha "BTC Backtest Machine"
 */

function runBacktests() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. LER CONFIGURAÇÕES
  const configSheet = ss.getSheetByName("Config");
  const configData = configSheet.getDataRange().getValues();

  let feePct = 0.00075; // 0.075% default
  let slippagePct = 0.00050; // 0.050% default
  let initialCapital = 10000;

  for (let i = 0; i < configData.length; i++) {
    const key = String(configData[i][0]).toLowerCase();
    const value = Number(configData[i][1]);
    if (!isNaN(value)) {
      if (key.includes("corretagem") || key.includes("fee")) feePct = value;
      else if (key.includes("slippage")) slippagePct = value;
      else if (key.includes("capital")) initialCapital = value;
    }
  }

  // Timeframes e planilhas de dados
  const timeframes = ["4H", "1D", "1W"];
  const strategies = ["EMA 8/20/200", "Nuvem 13/49 + MA20", "Donchian 30"];
  const allTradeLogs = [];
  let tradeCounter = 1;

  for (const tf of timeframes) {
    const sheetName = `BTC_${tf}`;
    const dataSheet = ss.getSheetByName(sheetName);
    if (!dataSheet) continue;

    // Assumimos que o cabeçalho está na linha 1: Date, Open, High, Low, Close, Volume
    const rawData = dataSheet.getDataRange().getValues();
    if (rawData.length < 2) continue;

    const headers = rawData[0];
    const data = rawData.slice(1);

    // Identificando colunas
    let dateIdx = 0, openIdx = 1, highIdx = 2, lowIdx = 3, closeIdx = 4;
    headers.forEach((h, idx) => {
      const hStr = String(h).toLowerCase();
      if (hStr.includes("date") || hStr.includes("tempo") || hStr.includes("data")) dateIdx = idx;
      else if (hStr === "open" || hStr.includes("abertura")) openIdx = idx;
      else if (hStr === "high" || hStr.includes("máxima") || hStr.includes("maxima")) highIdx = idx;
      else if (hStr === "low" || hStr.includes("mínima") || hStr.includes("minima")) lowIdx = idx;
      else if (hStr === "close" || hStr.includes("fechamento")) closeIdx = idx;
    });

    // Função auxiliar para média móvel
    const calcSMA = (dataArr, period, index, priceIdx) => {
      if (index < period - 1) return null;
      let sum = 0;
      for (let i = 0; i < period; i++) {
        sum += Number(dataArr[index - i][priceIdx]);
      }
      return sum / period;
    };

    // Pre-cálculo de indicadores
    const indicators = [];
    let ema8 = null, ema20 = null, ema200 = null;
    let avgGain = 0, avgLoss = 0;

    for (let i = 0; i < data.length; i++) {
      const close = Number(data[i][closeIdx]);
      const high = Number(data[i][highIdx]);
      const low = Number(data[i][lowIdx]);

      // EMA 8
      if (i === 0) ema8 = close;
      else ema8 = (close - ema8) * (2 / (8 + 1)) + ema8;

      // EMA 20
      if (i === 0) ema20 = close;
      else ema20 = (close - ema20) * (2 / (20 + 1)) + ema20;

      // EMA 200
      if (i === 0) ema200 = close;
      else ema200 = (close - ema200) * (2 / (200 + 1)) + ema200;

      // Nuvem 13/49 + MA20 (SMAs)
      const sma13 = calcSMA(data, 13, i, closeIdx);
      const sma49 = calcSMA(data, 49, i, closeIdx);
      const sma20 = calcSMA(data, 20, i, closeIdx);

      // RSI 20
      let rsi20 = null;
      if (i > 0) {
        const change = close - Number(data[i - 1][closeIdx]);
        const gain = change > 0 ? change : 0;
        const loss = change < 0 ? -change : 0;
        if (i === 1) {
          avgGain = gain;
          avgLoss = loss;
        } else {
          avgGain = (avgGain * 19 + gain) / 20;
          avgLoss = (avgLoss * 19 + loss) / 20;
        }
        if (i >= 20) {
          const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
          rsi20 = avgLoss === 0 ? 100 : 100 - (100 / (1 + rs));
        }
      }

      // Donchian 30 & 15
      let highest30 = null, lowest30 = null, lowest15 = null;
      if (i >= 29) {
        highest30 = -Infinity;
        lowest30 = Infinity;
        for (let j = 0; j < 30; j++) {
          const h = Number(data[i - j][highIdx]);
          const l = Number(data[i - j][lowIdx]);
          if (h > highest30) highest30 = h;
          if (l < lowest30) lowest30 = l;
        }
      }
      if (i >= 14) {
        lowest15 = Infinity;
        for (let j = 0; j < 15; j++) {
          const l = Number(data[i - j][lowIdx]);
          if (l < lowest15) lowest15 = l;
        }
      }
      const sma50 = calcSMA(data, 50, i, closeIdx);
      const prevSma50 = i > 0 ? calcSMA(data, 50, i - 1, closeIdx) : null;

      indicators.push({
        ema8, ema20, ema200,
        sma13, sma49, sma20, rsi20,
        highest30, lowest30, lowest15,
        sma50, prevSma50
      });
    }

    // Variáveis de estado das estratégias
    let posS1 = null; // { type: 'LONG'|'SHORT', entryPrice, entryDate, entryIndex }
    let posS2 = null;
    let posS3 = null;

    const formatTrade = (stratName, pos, exitPrice, exitDate, exitIndex, status) => {
      const isLong = pos.type === 'LONG';
      const grossRet = isLong ? (exitPrice / pos.entryPrice) - 1 : 1 - (exitPrice / pos.entryPrice);
      const netRet = grossRet - (feePct * 2) - (slippagePct * 2);
      const feesUSD = initialCapital * (feePct * 2 + slippagePct * 2); // Aproximação das taxas sobre capital base

      let durationHours = 0;
      if (pos.entryDate && exitDate) {
        const diffMs = new Date(exitDate).getTime() - new Date(pos.entryDate).getTime();
        durationHours = diffMs / (1000 * 60 * 60);
      }

      const tId = `T-${stratName.split(' ')[0]}-${tf}-${String(tradeCounter).padStart(3, '0')}`;
      tradeCounter++;

      return [
        tId, stratName, tf, pos.type,
        pos.entryDate, pos.entryPrice,
        exitDate, exitPrice,
        grossRet, netRet, feesUSD,
        durationHours, status
      ];
    };

    // Loop de simulação
    for (let i = 1; i < data.length; i++) {
      const close = Number(data[i][closeIdx]);
      const date = data[i][dateIdx];
      const ind = indicators[i];
      const prevInd = indicators[i - 1];

      if (!ind || !prevInd) continue;

      // --- ESTRATÉGIA 1: EMA 8 / 20 / 200 ---
      if (i >= 200) {
        const ema8x20_up = prevInd.ema8 <= prevInd.ema20 && ind.ema8 > ind.ema20;
        const ema8x20_down = prevInd.ema8 >= prevInd.ema20 && ind.ema8 < ind.ema20;

        if (!posS1) {
          if (ema8x20_up && ind.ema20 > ind.ema200) {
            posS1 = { type: 'LONG', entryPrice: close, entryDate: date, entryIndex: i };
          } else if (ema8x20_down && ind.ema20 < ind.ema200) {
            posS1 = { type: 'SHORT', entryPrice: close, entryDate: date, entryIndex: i };
          }
        } else {
          if (posS1.type === 'LONG' && (ind.ema8 <= ind.ema20 || ind.ema20 <= ind.ema200)) {
            allTradeLogs.push(formatTrade(strategies[0], posS1, close, date, i, "FECHADO"));
            posS1 = null;
          } else if (posS1.type === 'SHORT' && (ind.ema8 >= ind.ema20 || ind.ema20 >= ind.ema200)) {
            allTradeLogs.push(formatTrade(strategies[0], posS1, close, date, i, "FECHADO"));
            posS1 = null;
          }
        }
      }

      // --- ESTRATÉGIA 2: Nuvem 13/49 + MA20 ---
      if (ind.sma49 !== null && ind.rsi20 !== null) {
        const isBullish = close > ind.sma13 && close > ind.sma49 && close > ind.sma20 && ind.rsi20 >= 60;
        const isBearish = close < ind.sma13 && close < ind.sma49 && close < ind.sma20 && ind.rsi20 <= 40;

        if (!posS2) {
          if (isBullish) {
            posS2 = { type: 'LONG', entryPrice: close, entryDate: date, entryIndex: i };
          } else if (isBearish) {
            posS2 = { type: 'SHORT', entryPrice: close, entryDate: date, entryIndex: i };
          }
        } else {
          if (posS2.type === 'LONG' && ind.rsi20 < 60) {
            allTradeLogs.push(formatTrade(strategies[1], posS2, close, date, i, "FECHADO"));
            posS2 = null;
          } else if (posS2.type === 'SHORT' && ind.rsi20 > 40) {
            allTradeLogs.push(formatTrade(strategies[1], posS2, close, date, i, "FECHADO"));
            posS2 = null;
          }
        }
      }

      // --- ESTRATÉGIA 3: Donchian 30 + Filtro ---
      if (prevInd.highest30 !== null && ind.sma50 !== null && ind.prevSma50 !== null) {
        const high = Number(data[i][highIdx]);
        const low = Number(data[i][lowIdx]);
        const donchianCenter = (prevInd.highest30 + prevInd.lowest30) / 2;

        if (!posS3) {
          if (high > prevInd.highest30 && ind.sma50 > ind.prevSma50) {
            // Assume entrada no breakout do Donchian 30
            const fillPrice = Math.max(Number(data[i][openIdx]), prevInd.highest30);
            posS3 = { type: 'LONG', entryPrice: fillPrice, entryDate: date, entryIndex: i };
          }
        } else {
          if (posS3.type === 'LONG') {
            if (low < prevInd.lowest15 || close < donchianCenter) {
              const fillPrice = close; // Simplificação de saída no fechamento
              allTradeLogs.push(formatTrade(strategies[2], posS3, fillPrice, date, i, "FECHADO"));
              posS3 = null;
            }
          }
        }
      }
    } // fim simulação candle a candle

    // Fechar posições em aberto no final com preço atual
    const lastIdx = data.length - 1;
    const lastClose = Number(data[lastIdx][closeIdx]);
    const lastDate = data[lastIdx][dateIdx];

    if (posS1) allTradeLogs.push(formatTrade(strategies[0], posS1, lastClose, lastDate, lastIdx, "ABERTO"));
    if (posS2) allTradeLogs.push(formatTrade(strategies[1], posS2, lastClose, lastDate, lastIdx, "ABERTO"));
    if (posS3) allTradeLogs.push(formatTrade(strategies[2], posS3, lastClose, lastDate, lastIdx, "ABERTO"));
  }

  // 4. GRAVAR NA ABA Trade_Logs
  const outSheet = ss.getSheetByName("Trade_Logs");
  if (!outSheet) return;

  // Limpar logs antigos (mantendo cabeçalho)
  const lastRow = outSheet.getLastRow();
  if (lastRow > 1) {
    outSheet.getRange(2, 1, lastRow - 1, 13).clearContent();
  }

  if (allTradeLogs.length > 0) {
    outSheet.getRange(2, 1, allTradeLogs.length, 13).setValues(allTradeLogs);
  }
}

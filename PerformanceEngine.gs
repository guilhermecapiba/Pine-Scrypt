/**
 * Motor de Performance Quantitativa - BTC Backtest Machine
 * File: PerformanceEngine.gs
 */

const SPREADSHEET_ID = '13RyXbvMGYppWPmWAPpFxUJ1bz17_oz6G-dAUAWZxhzQ';

function computeMultiTemporalPerformance() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // 1. Bulk read data from input sheets
  const tradeLogsSheet = ss.getSheetByName('Trade_Logs');
  const btc1DSheet = ss.getSheetByName('BTC_1D');
  const rankingSheet = ss.getSheetByName('Ranking_Performance');

  if (!tradeLogsSheet || !btc1DSheet || !rankingSheet) {
    throw new Error('Abas obrigatórias (Trade_Logs, BTC_1D, Ranking_Performance) não encontradas.');
  }

  const tradesData = tradeLogsSheet.getDataRange().getValues();
  const btcData = btc1DSheet.getDataRange().getValues();

  if (tradesData.length < 2) {
    throw new Error('Nenhum dado encontrado na aba Trade_Logs.');
  }
  if (btcData.length < 2) {
    throw new Error('Nenhum dado encontrado na aba BTC_1D.');
  }

  // Identify columns in Trade_Logs robustly
  const tradeHeaders = tradesData[0].map(h => h.toString().toLowerCase().trim());
  const colStrategy = tradeHeaders.findIndex(h => h.includes('estrat') || h.includes('strat') || h.includes('nome'));
  const colEntryDate = tradeHeaders.findIndex(h => h.includes('entrad') || h.includes('entry'));
  const colExitDate = tradeHeaders.findIndex(h => h.includes('saída') || h.includes('saida') || h.includes('exit'));

  // Try to find Return % and Return $ columns
  let colReturnPct = tradeHeaders.findIndex(h => (h.includes('retorno') || h.includes('pnl') || h.includes('lucro')) && h.includes('%'));
  let colReturnAbs = tradeHeaders.findIndex(h => (h.includes('retorno') || h.includes('pnl') || h.includes('lucro')) && (h.includes('$') || h.includes('abs')));

  // Fallbacks if distinct % and $ columns aren't clear
  if (colReturnPct === -1) {
      colReturnPct = tradeHeaders.findIndex(h => h.includes('retorno') || h.includes('pnl'));
  }
  if (colReturnAbs === -1) {
      colReturnAbs = colReturnPct; // Use same if only one exists
  }

  if (colStrategy === -1 || colEntryDate === -1 || colExitDate === -1 || colReturnPct === -1) {
    throw new Error('Colunas essenciais (Estratégia, Entrada, Saída, Retorno) não encontradas em Trade_Logs.');
  }

  // Identify columns in BTC_1D
  const btcHeaders = btcData[0].map(h => h.toString().toLowerCase().trim());
  const colBtcDate = btcHeaders.findIndex(h => h.includes('date') || h.includes('data'));
  const colBtcClose = btcHeaders.findIndex(h => h.includes('close') || h.includes('fechamento'));

  if (colBtcDate === -1 || colBtcClose === -1) {
    throw new Error('Colunas de Data ou Fechamento não encontradas em BTC_1D.');
  }

  // Parse BTC History
  const btcHistory = [];
  for (let i = 1; i < btcData.length; i++) {
    const row = btcData[i];
    if (row[colBtcDate] && row[colBtcClose]) {
      btcHistory.push({
        date: new Date(row[colBtcDate]),
        close: parseFloat(row[colBtcClose])
      });
    }
  }
  btcHistory.sort((a, b) => a.date.getTime() - b.date.getTime());

  // Parse Trade Logs
  const trades = [];
  for (let i = 1; i < tradesData.length; i++) {
    const row = tradesData[i];
    if (row[colStrategy] && row[colExitDate]) {
      const rawPct = parseFloat(row[colReturnPct]);
      // Use the raw percent. Google Sheets naturally handles formatted percentages
      // as decimals (e.g., 5% -> 0.05).
      const returnPct = isNaN(rawPct) ? 0 : rawPct;
      const returnAbs = parseFloat(row[colReturnAbs]) || 0;

      trades.push({
        strategy: row[colStrategy].toString().trim(),
        entryDate: row[colEntryDate] ? new Date(row[colEntryDate]) : new Date(row[colExitDate]),
        exitDate: new Date(row[colExitDate]),
        returnPct: returnPct,
        returnAbs: returnAbs
      });
    }
  }
  trades.sort((a, b) => a.exitDate.getTime() - b.exitDate.getTime());

  // Define Time Windows
  const now = new Date();
  const date1Y = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
  const date2Y = new Date(now.getTime() - 730 * 24 * 60 * 60 * 1000);
  const date3Y = new Date(now.getTime() - 1095 * 24 * 60 * 60 * 1000);
  const dateAllTime = btcHistory.length > 0 ? btcHistory[0].date : new Date(2017, 0, 1);

  const allTimeDays = Math.max(1, Math.floor((now.getTime() - dateAllTime.getTime()) / (1000 * 60 * 60 * 24)));

  const windows = [
    { name: '12 Meses', startDate: date1Y, days: 365 },
    { name: '24 Meses', startDate: date2Y, days: 730 },
    { name: '36 Meses', startDate: date3Y, days: 1095 },
    { name: 'Histórico Completo', startDate: dateAllTime, days: allTimeDays }
  ];

  const strategyNames = ['EMA 8/20/200', 'Nuvem 13/49 + MA20', 'Donchian Breakout', 'Buy & Hold'];

  // Result matrix: 16 rows x 13 columns (C:O)
  const resultsMatrix = [];

  for (const win of windows) {
    const winTrades = trades.filter(t => t.exitDate >= win.startDate && t.exitDate <= now);
    const winBtc = btcHistory.filter(b => b.date >= win.startDate && b.date <= now);

    let btcStartClose = 1;
    let btcEndClose = 1;
    let btcReturn = 0;
    let btcCagr = 0;
    let btcMaxDrawdown = 0;
    let btcSharpe = 0;
    let btcSortino = 0;
    let btcCalmar = 0;

    if (winBtc.length > 1) {
      btcStartClose = winBtc[0].close;
      btcEndClose = winBtc[winBtc.length - 1].close;
      btcReturn = (btcEndClose - btcStartClose) / btcStartClose;
      btcCagr = Math.pow(1 + btcReturn, 365 / Math.max(1, win.days)) - 1;

      // Calculate B&H metrics
      let btcPeak = btcStartClose;
      const btcDailyReturns = [];
      let sumSqNegBtcRet = 0;

      for (let i = 1; i < winBtc.length; i++) {
        const pClose = winBtc[i-1].close;
        const cClose = winBtc[i].close;
        const ret = (cClose - pClose) / pClose;
        btcDailyReturns.push(ret);

        if (ret < 0) {
            sumSqNegBtcRet += ret * ret;
        }

        if (cClose > btcPeak) {
          btcPeak = cClose;
        }
        const dd = (btcPeak - cClose) / btcPeak;
        if (dd > btcMaxDrawdown) {
          btcMaxDrawdown = dd;
        }
      }

      const btcN = btcDailyReturns.length;
      const btcMeanRet = btcDailyReturns.reduce((a, b) => a + b, 0) / Math.max(1, btcN);
      const btcVar = btcDailyReturns.reduce((a, b) => a + Math.pow(b - btcMeanRet, 2), 0) / Math.max(1, btcN);
      const btcStd = Math.sqrt(btcVar);
      const btcAnnVol = btcStd * Math.sqrt(365);

      const btcDownsideVar = btcN > 0 ? sumSqNegBtcRet / btcN : 0;
      const btcDownsideStd = Math.sqrt(btcDownsideVar);
      const btcAnnDownVol = btcDownsideStd * Math.sqrt(365);

      btcSharpe = btcAnnVol === 0 ? 0 : btcCagr / btcAnnVol;
      btcSortino = btcAnnDownVol === 0 ? 0 : btcCagr / btcAnnDownVol;
      btcCalmar = btcMaxDrawdown === 0 ? (btcCagr > 0 ? 99.99 : 0) : btcCagr / btcMaxDrawdown;
    }

    // Group trades by strategy, map to predefined names as best effort
    const strategyMap = {
        'EMA 8/20/200': [],
        'Nuvem 13/49 + MA20': [],
        'Donchian Breakout': []
    };

    for (const t of winTrades) {
      const lowerName = t.strategy.toLowerCase();
      if (lowerName.includes('ema')) {
          strategyMap['EMA 8/20/200'].push(t);
      } else if (lowerName.includes('nuvem') || lowerName.includes('cloud')) {
          strategyMap['Nuvem 13/49 + MA20'].push(t);
      } else if (lowerName.includes('donchian') || lowerName.includes('breakout')) {
          strategyMap['Donchian Breakout'].push(t);
      } else {
          // Attempt fuzzy match or fallback
          if (t.strategy.includes('8') || t.strategy.includes('200')) strategyMap['EMA 8/20/200'].push(t);
          else if (t.strategy.includes('13') || t.strategy.includes('49')) strategyMap['Nuvem 13/49 + MA20'].push(t);
          else if (t.strategy.includes('30')) strategyMap['Donchian Breakout'].push(t);
      }
    }

    for (const stratName of strategyNames) {
      if (stratName === 'Buy & Hold') {
        resultsMatrix.push([
          btcReturn,        // C: Total Return
          btcReturn,        // D: B&H Return
          0,                // E: Alpha
          btcCagr,          // F: CAGR
          btcMaxDrawdown,   // G: Max Drawdown
          btcSharpe,        // H: Sharpe
          btcSortino,       // I: Sortino
          btcCalmar,        // J: Calmar
          1.00,             // K: Win Rate (100% for B&H)
          99.99,            // L: Profit Factor
          1,                // M: Qtd Trades
          0,                // N: Payoff
          1.00              // O: Time in Market
        ]);
        continue;
      }

      const sTrades = strategyMap[stratName];

      if (!sTrades || sTrades.length === 0) {
        resultsMatrix.push([0, btcReturn, 0 - btcReturn, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
        continue;
      }

      let totalReturnCompound = 1;
      let grossProfit = 0;
      let grossLoss = 0;
      let wins = 0;
      let losses = 0;
      let sumWinPct = 0;
      let sumLossPct = 0;

      const dailyReturnsMap = new Map();
      const intervals = [];

      for (const t of sTrades) {
        totalReturnCompound *= (1 + t.returnPct);

        if (t.returnPct > 0 || (t.returnPct === 0 && t.returnAbs >= 0)) {
          grossProfit += Math.abs(t.returnAbs !== 0 ? t.returnAbs : t.returnPct);
          wins++;
          sumWinPct += t.returnPct;
        } else {
          grossLoss += Math.abs(t.returnAbs !== 0 ? t.returnAbs : t.returnPct);
          losses++;
          sumLossPct += t.returnPct;
        }

        const dTime = new Date(t.exitDate.getFullYear(), t.exitDate.getMonth(), t.exitDate.getDate()).getTime();
        dailyReturnsMap.set(dTime, (dailyReturnsMap.get(dTime) || 0) + t.returnPct);

        intervals.push({ start: t.entryDate.getTime(), end: t.exitDate.getTime() });
      }

      const totalReturn = totalReturnCompound - 1;
      const alpha = totalReturn - btcReturn;

      const cagr = Math.pow(1 + totalReturn, 365 / Math.max(1, win.days)) - 1;

      const winRate = wins / sTrades.length;
      const profitFactor = grossLoss === 0 ? (grossProfit > 0 ? 99.99 : 0) : grossProfit / grossLoss;

      const avgWin = wins > 0 ? sumWinPct / wins : 0;
      const avgLoss = losses > 0 ? Math.abs(sumLossPct / losses) : 0;
      const payoff = avgLoss === 0 ? (avgWin > 0 ? 99.99 : 0) : avgWin / avgLoss;

      // Calculate Time in Market
      intervals.sort((a, b) => a.start - b.start);
      const merged = [];
      if (intervals.length > 0) {
        let current = intervals[0];
        for (let i = 1; i < intervals.length; i++) {
          if (intervals[i].start <= current.end) {
            current.end = Math.max(current.end, intervals[i].end);
          } else {
            merged.push(current);
            current = intervals[i];
          }
        }
        merged.push(current);
      }
      const timeInMarketMs = merged.reduce((acc, val) => acc + (val.end - val.start), 0);
      const pctTimeInMarket = (timeInMarketMs / (1000 * 60 * 60 * 24)) / Math.max(1, win.days);

      let equity = 1;
      let peak = 1;
      let maxDrawdown = 0;
      const dailyReturnsArr = [];

      const currentDay = new Date(win.startDate.getFullYear(), win.startDate.getMonth(), win.startDate.getDate());
      const endDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      while (currentDay <= endDay) {
        const currentDayTime = currentDay.getTime();
        const dayRet = dailyReturnsMap.get(currentDayTime) || 0;
        dailyReturnsArr.push(dayRet);

        equity *= (1 + dayRet);
        if (equity > peak) {
          peak = equity;
        }
        const dd = (peak - equity) / peak;
        if (dd > maxDrawdown) {
          maxDrawdown = dd;
        }

        currentDay.setDate(currentDay.getDate() + 1);
      }

      const n = dailyReturnsArr.length;
      const meanDailyReturn = dailyReturnsArr.reduce((a, b) => a + b, 0) / Math.max(1, n);
      const varianceDaily = dailyReturnsArr.reduce((a, b) => a + Math.pow(b - meanDailyReturn, 2), 0) / Math.max(1, n);
      const stdDaily = Math.sqrt(varianceDaily);
      const annualizedVol = stdDaily * Math.sqrt(365);

      let sumSquaredNegativeReturns = 0;
      for (const r of dailyReturnsArr) {
        if (r < 0) {
          sumSquaredNegativeReturns += r * r;
        }
      }
      const downsideVariance = n > 0 ? sumSquaredNegativeReturns / n : 0;
      const stdNeg = Math.sqrt(downsideVariance);
      const annualizedDownsideVol = stdNeg * Math.sqrt(365);

      const sharpe = annualizedVol === 0 ? 0 : cagr / annualizedVol;
      const sortino = annualizedDownsideVol === 0 ? 0 : cagr / annualizedDownsideVol;
      const calmar = maxDrawdown === 0 ? (cagr > 0 ? 99.99 : 0) : cagr / maxDrawdown;

      resultsMatrix.push([
        totalReturn,
        btcReturn,
        alpha,
        cagr,
        maxDrawdown,
        sharpe,
        sortino,
        calmar,
        winRate,
        profitFactor,
        sTrades.length,
        payoff,
        pctTimeInMarket
      ]);
    }
  }

  // Write output
  if (resultsMatrix.length === 16) {
    const dataRange = rankingSheet.getRange(2, 3, 16, 13); // C2:O17
    dataRange.setValues(resultsMatrix);

    // Formatting C, D, E, F, G (Cols 3, 4, 5, 6, 7) - indices 0, 1, 2, 3, 4 -> 0.00%
    rankingSheet.getRange(2, 3, 16, 5).setNumberFormat('0.00%');
    // Formatting K, O (Cols 11, 15) - indices 8, 12 -> 0.00%
    rankingSheet.getRange(2, 11, 16, 1).setNumberFormat('0.00%');
    rankingSheet.getRange(2, 15, 16, 1).setNumberFormat('0.00%');

    // Formatting H, I, J (Cols 8, 9, 10) - indices 5, 6, 7 -> 0.00
    rankingSheet.getRange(2, 8, 16, 3).setNumberFormat('0.00');
    // Formatting L, M, N (Cols 12, 13, 14) - indices 9, 10, 11 -> 0.00
    rankingSheet.getRange(2, 12, 16, 3).setNumberFormat('0.00');
  } else {
      throw new Error(`Expected 16 rows of results, got ${resultsMatrix.length}.`);
  }
}

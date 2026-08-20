/**
 * Motor de Performance Quantitativa - BTC Backtest Machine
 * File: PerformanceEngine.gs
 */

const SPREADSHEET_ID = '13RyXbvMGYppWPmWAPpFxUJ1bz17_oz6G-dAUAWZxhzQ';

function runPerformanceEngine() {
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
      // Attempt to normalize % if it's entered as e.g. 5 instead of 0.05
      // Use the raw percent. Google Sheets naturally handles formatted percentages
      // as decimals (e.g., 5% -> 0.05). Remove flawed heuristic.
      const returnPct = isNaN(rawPct) ? 0 : rawPct;
      const returnAbs = parseFloat(row[colReturnAbs]) || 0;

      trades.push({
        strategy: row[colStrategy].toString(),
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
    { name: '1Y', startDate: date1Y, days: 365 },
    { name: '2Y', startDate: date2Y, days: 730 },
    { name: '3Y', startDate: date3Y, days: 1095 },
    { name: 'All-Time', startDate: dateAllTime, days: allTimeDays }
  ];

  // Calculate metrics
  const resultsByWindow = {};
  for (const win of windows) {
    resultsByWindow[win.name] = calculateMetricsForWindow(trades, btcHistory, win, now);
  }

  // Output to Ranking_Performance
  writeResultsToRankingSheet(rankingSheet, resultsByWindow, windows);
}

function calculateMetricsForWindow(trades, btcHistory, win, now) {
  // Filter for the specific time window
  const winTrades = trades.filter(t => t.exitDate >= win.startDate && t.exitDate <= now);
  const winBtc = btcHistory.filter(b => b.date >= win.startDate && b.date <= now);

  if (winBtc.length < 2) return [];

  const btcStartClose = winBtc[0].close;
  const btcEndClose = winBtc[winBtc.length - 1].close;
  const btcReturn = (btcEndClose - btcStartClose) / btcStartClose;

  // Group trades by strategy
  const strategyMap = {};
  for (const t of winTrades) {
    if (!strategyMap[t.strategy]) {
      strategyMap[t.strategy] = [];
    }
    strategyMap[t.strategy].push(t);
  }

  const results = [];

  for (const strat in strategyMap) {
    const sTrades = strategyMap[strat];

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

    // CAGR: ((1 + TotalReturn) ^ (365 / Days)) - 1
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

    // Daily Equity Curve to calculate Max Drawdown and Volatilities
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

    // Volatility Calculations
    const n = dailyReturnsArr.length;
    const meanDailyReturn = dailyReturnsArr.reduce((a, b) => a + b, 0) / Math.max(1, n);
    const varianceDaily = dailyReturnsArr.reduce((a, b) => a + Math.pow(b - meanDailyReturn, 2), 0) / Math.max(1, n);
    const stdDaily = Math.sqrt(varianceDaily);
    const annualizedVol = stdDaily * Math.sqrt(365); // Annualized Volatility

    // Downside Deviation for Sortino Ratio
    // Target return = 0%. Standard deviation of negative returns relative to 0
    let sumSquaredNegativeReturns = 0;
    for (const r of dailyReturnsArr) {
      if (r < 0) {
        sumSquaredNegativeReturns += r * r;
      }
    }
    const downsideVariance = n > 0 ? sumSquaredNegativeReturns / n : 0;
    const stdNeg = Math.sqrt(downsideVariance);
    const annualizedDownsideVol = stdNeg * Math.sqrt(365);

    // Sharpe Ratio: Annualized Return / Annualized Volatility (Risk-Free = 0%)
    const sharpe = annualizedVol === 0 ? 0 : cagr / annualizedVol;

    // Sortino Ratio: Annualized Return / Downside Deviation
    const sortino = annualizedDownsideVol === 0 ? 0 : cagr / annualizedDownsideVol;

    // Calmar Ratio: CAGR / Max Drawdown
    const calmar = maxDrawdown === 0 ? (cagr > 0 ? 99.99 : 0) : cagr / maxDrawdown;

    results.push({
      strategy: strat,
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
      qtdTrades: sTrades.length,
      payoff,
      pctTimeInMarket
    });
  }

  // Sort descending by Calmar Ratio (or Sharpe if Calmar is tied)
  results.sort((a, b) => {
    if (b.calmar !== a.calmar) return b.calmar - a.calmar;
    return b.sharpe - a.sharpe;
  });

  return results;
}

function writeResultsToRankingSheet(sheet, resultsByWindow, windows) {
  // Clear the entire sheet to rewrite the 4 blocks cleanly
  sheet.clear();

  const headers = [
    'Estratégia', 'Retorno Total (%)', 'B&H BTC (%)', 'Alpha (%)', 'CAGR (%)',
    'Max Drawdown (%)', 'Sharpe Ratio', 'Sortino Ratio', 'Calmar Ratio',
    'Win Rate (%)', 'Profit Factor', 'Qtd Trades', 'Payoff', '% Tempo Posicionado'
  ];

  const windowTitles = {
    '1Y': 'Performance - Últimos 12 Meses (1Y)',
    '2Y': 'Performance - Últimos 24 Meses (2Y)',
    '3Y': 'Performance - Últimos 36 Meses (3Y)',
    'All-Time': 'Performance - Histórico Completo (All-Time)'
  };

  let currentRow = 2; // Start a bit below top

  for (const win of windows) {
    const winName = win.name;
    const results = resultsByWindow[winName];

    // Title
    sheet.getRange(currentRow, 2).setValue(windowTitles[winName])
         .setFontWeight('bold')
         .setFontSize(14)
         .setBackground('#1E293B')
         .setFontColor('#FFFFFF');
    // Merge title cells
    sheet.getRange(currentRow, 2, 1, headers.length).merge();
    currentRow += 2;

    // Headers
    const headerRange = sheet.getRange(currentRow, 2, 1, headers.length);
    headerRange.setValues([headers])
               .setFontWeight('bold')
               .setBackground('#f3f3f3')
               .setBorder(true, true, true, true, null, null);
    currentRow++;

    if (results && results.length > 0) {
      const outData = results.map(r => [
        r.strategy,
        r.totalReturn,
        r.btcReturn,
        r.alpha,
        r.cagr,
        r.maxDrawdown,
        r.sharpe,
        r.sortino,
        r.calmar,
        r.winRate,
        r.profitFactor,
        r.qtdTrades,
        r.payoff,
        r.pctTimeInMarket
      ]);

      const dataRange = sheet.getRange(currentRow, 2, outData.length, headers.length);
      dataRange.setValues(outData);

      // Formatting
      // Percentages: Retorno Total, B&H, Alpha, CAGR, Max Drawdown, Win Rate, % Tempo Posicionado
      // Indices relative to outData array (0-based): 1, 2, 3, 4, 5, 9, 13
      // Spreadsheet ranges are 1-based and we start at column 2.
      // So columns to format as %: 3, 4, 5, 6, 7, 11, 15

      // Batch set formats where possible
      sheet.getRange(currentRow, 3, outData.length, 5).setNumberFormat('0.00%'); // Ret Total to Max DD
      sheet.getRange(currentRow, 11, outData.length, 1).setNumberFormat('0.00%'); // Win Rate
      sheet.getRange(currentRow, 15, outData.length, 1).setNumberFormat('0.00%'); // % Tempo

      // Ratios & Decimals: Sharpe, Sortino, Calmar, Profit Factor, Payoff
      // Spreadsheet columns: 8, 9, 10, 12, 14
      sheet.getRange(currentRow, 8, outData.length, 3).setNumberFormat('0.00');
      sheet.getRange(currentRow, 12, outData.length, 1).setNumberFormat('0.00');
      sheet.getRange(currentRow, 14, outData.length, 1).setNumberFormat('0.00');

      // Add borders
      dataRange.setBorder(true, true, true, true, true, true);

      currentRow += outData.length;
    } else {
      sheet.getRange(currentRow, 2).setValue('Sem dados para esta janela.');
      currentRow++;
    }

    currentRow += 4; // Space before next block
  }

  // Auto resize columns for better visibility
  sheet.autoResizeColumns(2, headers.length);
}

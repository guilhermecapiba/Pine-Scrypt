/**
 * BacktestEngine.gs
 * Módulo de Backtesting para a planilha "BTC Backtest Machine"
 * Refatorado com base nos novos mapeamentos e estratégias.
 */

function runBacktestSimulation() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. Configurações de Custos (fixadas conforme instrução, mas preparadas para leitura se necessário)
  const feePct = 0.00075; // 0.075% por ordem
  const slippagePct = 0.00050; // 0.050% por ordem
  const initialCapital = 10000;
  const totalCostPct = feePct * 2 + slippagePct * 2; // ~0.25% (0.0025) ida e volta

  // Mapeamentos de Coluna Exatos da Planilha de Dados
  const IDX_DATE_UTC = 0;   // A
  const IDX_DATE_BRT = 1;   // B
  const IDX_OPEN = 2;       // C
  const IDX_HIGH = 3;       // D
  const IDX_LOW = 4;        // E
  const IDX_CLOSE = 5;      // F
  const IDX_RSI = 8;        // I
  const IDX_SMA08 = 9;      // J
  const IDX_SMA20 = 10;     // K
  const IDX_SMA200 = 11;    // L
  const IDX_EMA08 = 12;     // M
  const IDX_EMA20 = 13;     // N
  const IDX_EMA200 = 14;    // O
  const IDX_ATR = 15;       // P
  const IDX_SINAL = 21;     // V
  const IDX_POSICAO = 22;   // W

  const timeframes = ["4H", "1D", "1W"];
  const strategies = ["EMA 8/20/200", "Nuvem 13/49 + MA20", "Donchian Breakout 30"];
  const allTradeLogs = [];
  let tradeCounter = 1;

  for (const tf of timeframes) {
    const sheetName = `BTC_${tf}`;
    const dataSheet = ss.getSheetByName(sheetName);
    if (!dataSheet) continue;

    // Leitura a partir da linha 2 (ignorando cabeçalho na linha 1)
    const rawData = dataSheet.getDataRange().getValues();
    if (rawData.length < 2) continue;

    const data = rawData.slice(1);

    // Função auxiliar para calcular SMA dinamicamente
    const calcSMA = (dataArr, period, index, priceIdx) => {
      if (index < period - 1) return null;
      let sum = 0;
      for (let i = 0; i < period; i++) {
        sum += Number(dataArr[index - i][priceIdx]);
      }
      return sum / period;
    };

    // Pre-cálculo de indicadores dinâmicos faltantes nas colunas
    // Nuvem 13 e Nuvem 49 não estão mapeadas nativamente, então calculamos como SMAs de 13 e 49.
    const customIndicators = [];
    for (let i = 0; i < data.length; i++) {
      const sma13 = calcSMA(data, 13, i, IDX_CLOSE);
      const sma49 = calcSMA(data, 49, i, IDX_CLOSE);

      let highest30 = null, lowest15 = null;
      if (i >= 29) {
        highest30 = -Infinity;
        for (let j = 0; j < 30; j++) {
          const h = Number(data[i - j][IDX_HIGH]);
          if (h > highest30) highest30 = h;
        }
      }
      if (i >= 14) {
        lowest15 = Infinity;
        for (let j = 0; j < 15; j++) {
          const l = Number(data[i - j][IDX_LOW]);
          if (l < lowest15) lowest15 = l;
        }
      }
      customIndicators.push({ sma13, sma49, highest30, lowest15 });
    }

    // Variáveis de estado das posições
    let posS1 = null;
    let posS2 = null;
    let posS3 = null;

    const formatTrade = (stratName, pos, exitPrice, exitDate, status) => {
      const isLong = pos.type === 'LONG';
      const grossRet = isLong ? (exitPrice / pos.entryPrice) - 1 : 1 - (exitPrice / pos.entryPrice);
      const netRet = grossRet - totalCostPct;
      const feesUSD = initialCapital * totalCostPct;

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

    // Loop de simulação candle a candle
    for (let i = 1; i < data.length; i++) {
      const close = Number(data[i][IDX_CLOSE]);
      const date = data[i][IDX_DATE_UTC]; // Usando UTC como base de data

      const ema8 = Number(data[i][IDX_EMA08]);
      const ema20 = Number(data[i][IDX_EMA20]);
      const ema200 = Number(data[i][IDX_EMA200]);
      const prevEma8 = Number(data[i - 1][IDX_EMA08]);
      const prevEma20 = Number(data[i - 1][IDX_EMA20]);

      const sma20 = Number(data[i][IDX_SMA20]);
      const ind = customIndicators[i];
      const prevInd = customIndicators[i - 1];

      // Validação de dados de linha
      if (!close || isNaN(ema8) || isNaN(ema20) || isNaN(ema200) || !ind || !prevInd) continue;

      // --- ESTRATÉGIA 1: EMA 8/20/200 ---
      const ema8x20_up = prevEma8 <= prevEma20 && ema8 > ema20;
      const ema8x20_down = prevEma8 >= prevEma20 && ema8 < ema20;

      if (!posS1) {
        if (ema8x20_up && ema20 > ema200) {
          posS1 = { type: 'LONG', entryPrice: close, entryDate: date };
        } else if (ema8x20_down && ema20 < ema200) {
          posS1 = { type: 'SHORT', entryPrice: close, entryDate: date };
        }
      } else {
        if (posS1.type === 'LONG' && (ema8 <= ema20 || ema20 <= ema200)) {
          allTradeLogs.push(formatTrade(strategies[0], posS1, close, date, "FECHADO"));
          posS1 = null;
        } else if (posS1.type === 'SHORT' && (ema8 >= ema20 || ema20 >= ema200)) {
          allTradeLogs.push(formatTrade(strategies[0], posS1, close, date, "FECHADO"));
          posS1 = null;
        }
      }

      // --- ESTRATÉGIA 2: Nuvem 13/49 + MA20 ---
      if (ind.sma13 !== null && ind.sma49 !== null && !isNaN(sma20)) {
        if (!posS2) {
          // Entra LONG quando Fechamento > Nuvem13 E Nuvem13 > Nuvem49 E Fechamento > SMA20
          if (close > ind.sma13 && ind.sma13 > ind.sma49 && close > sma20) {
            posS2 = { type: 'LONG', entryPrice: close, entryDate: date };
          }
        } else {
          // Sai do LONG quando Fechamento cruza abaixo da Nuvem13 ou SMA20
          if (posS2.type === 'LONG' && (close < ind.sma13 || close < sma20)) {
            allTradeLogs.push(formatTrade(strategies[1], posS2, close, date, "FECHADO"));
            posS2 = null;
          }
        }
      }

      // --- ESTRATÉGIA 3: Donchian Breakout 30 ---
      if (prevInd.highest30 !== null && ind.lowest15 !== null) {
        if (!posS3) {
          // Entra LONG quando Fechamento rompe a Máxima dos últimos 30 candles
          if (close > prevInd.highest30) {
            posS3 = { type: 'LONG', entryPrice: close, entryDate: date };
          }
        } else {
          // Sai do LONG quando Fechamento perde a Mínima dos últimos 15 candles
          if (posS3.type === 'LONG' && close < prevInd.lowest15) {
            allTradeLogs.push(formatTrade(strategies[2], posS3, close, date, "FECHADO"));
            posS3 = null;
          }
        }
      }
    } // fim loop candles

    // Fechar posições em aberto ao fim do array
    const lastRowData = data[data.length - 1];
    const lastClose = Number(lastRowData[IDX_CLOSE]);
    const lastDate = lastRowData[IDX_DATE_UTC];

    if (posS1) allTradeLogs.push(formatTrade(strategies[0], posS1, lastClose, lastDate, "ABERTO"));
    if (posS2) allTradeLogs.push(formatTrade(strategies[1], posS2, lastClose, lastDate, "ABERTO"));
    if (posS3) allTradeLogs.push(formatTrade(strategies[2], posS3, lastClose, lastDate, "ABERTO"));
  }

  // 4. Gravar na aba Trade_Logs
  const outSheet = ss.getSheetByName("Trade_Logs");
  if (!outSheet) return;

  // Limpar dados anteriores mantendo cabeçalho na linha 1
  const lastRow = outSheet.getLastRow();
  if (lastRow > 1) {
    outSheet.getRange(2, 1, lastRow - 1, 13).clearContent();
  }

  if (allTradeLogs.length > 0) {
    const range = outSheet.getRange(2, 1, allTradeLogs.length, 13);
    range.setValues(allTradeLogs);

    // Formatações
    // Preços nas colunas 6 e 8 (F e H)
    outSheet.getRange(2, 6, allTradeLogs.length, 1).setNumberFormat("$#,##0.00");
    outSheet.getRange(2, 8, allTradeLogs.length, 1).setNumberFormat("$#,##0.00");
    // Retornos nas colunas 9 e 10 (I e J)
    outSheet.getRange(2, 9, allTradeLogs.length, 2).setNumberFormat("0.00%");

    Logger.log("Total de trades gerados: " + allTradeLogs.length);
  } else {
    Logger.log("Nenhum trade gerado.");
  }
}

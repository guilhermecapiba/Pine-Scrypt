/**
 * DashboardUpdater.gs
 * Atualiza o Dashboard Executivo da "BTC Backtest Machine" nas coordenadas exatas solicitadas e corrige a formatação visual.
 */

function refreshExecutiveDashboard() {
  const SPREADSHEET_ID = "13RyXbvMGYppWPmWAPpFxUJ1bz17_oz6G-dAUAWZxhzQ";
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  const tabs = {
    ranking: ss.getSheetByName('Ranking_Performance'),
    btc4h: ss.getSheetByName('BTC_4H'),
    btc1d: ss.getSheetByName('BTC_1D'),
    btc1w: ss.getSheetByName('BTC_1W'),
    dashboard: ss.getSheetByName('Dashboard')
  };

  if (!tabs.ranking || !tabs.btc4h || !tabs.btc1d || !tabs.btc1w || !tabs.dashboard) {
    throw new Error('Erro: Abas base para o Dashboard não encontradas.');
  }

  Logger.log("Iniciando atualização do Dashboard...");

  // Busca de dados em bulk
  const rankingData = tabs.ranking.getDataRange().getValues();
  const btc4hData = tabs.btc4h.getDataRange().getValues();
  const btc1dData = tabs.btc1d.getDataRange().getValues();
  const btc1wData = tabs.btc1w.getDataRange().getValues();

  const last4H = btc4hData[btc4hData.length - 1];
  const last1D = btc1dData[btc1dData.length - 1];
  const last1W = btc1wData[btc1wData.length - 1];

  // 1. HEADER (C3 e C4)
  const now = new Date();
  const timeStr = Utilities.formatDate(now, "America/Sao_Paulo", "dd/MM/yyyy HH:mm");

  // Pegar Preço Spot BTC numérico (Coluna F da aba BTC_1D, índice 5)
  // Certificando de que F existe e é numérico
  let currentPrice = last1D[5] !== undefined && !isNaN(parseFloat(last1D[5])) ? parseFloat(last1D[5]) : 0;

  tabs.dashboard.getRange("C3").setValue(timeStr);
  let priceRange = tabs.dashboard.getRange("C4");
  priceRange.setValue(currentPrice);
  priceRange.setNumberFormat("$#,##0.00");

  Logger.log("Header atualizado: " + timeStr + " / " + currentPrice);

  // 2. ACTION CARD (Decisão Tática) — Linha 8
  // O usuário relatou que antes escreveu "Últimos 12 Meses". Isso ocorre porque a linha 1 do bloco 12M na coluna 0 ou 1 era um separador.
  // Vamos buscar ativamente pela primeira estratégia da aba Ranking na janela de 12M (linhas 2 a 5).
  // A estratégia normalmente está na coluna B (Index 1) da Ranking_Performance.
  let liderName = "N/A";
  if (rankingData.length > 2) {
      // Assumindo que a linha 0 é cabeçalho global, linha 1 é cabeçalho de bloco ou a própria 1ª strat.
      // O usuário pede para ler da linha 2 (index 1 se array base 0 ou linha 2 na UI é index 1 do array).
      // Array base 0: Linha 1 UI = Index 0. Linha 2 UI = Index 1.
      liderName = rankingData[1][1]; // Coluna B = index 1
  }

  // Encontrar o posicionamento atual baseado nos pesos (1W: 50%, 1D: 30%, 4H: 20%)
  let colIndex4H = btc4hData[0].indexOf(liderName);
  let colIndex1D = btc1dData[0].indexOf(liderName);
  let colIndex1W = btc1wData[0].indexOf(liderName);

  let signal4H = (colIndex4H !== -1 && !isNaN(last4H[colIndex4H])) ? last4H[colIndex4H] : 0;
  let signal1D = (colIndex1D !== -1 && !isNaN(last1D[colIndex1D])) ? last1D[colIndex1D] : 0;
  let signal1W = (colIndex1W !== -1 && !isNaN(last1W[colIndex1W])) ? last1W[colIndex1W] : 0;

  let exposure = (signal1W * 0.50) + (signal1D * 0.30) + (signal4H * 0.20);
  let exposurePercent = (exposure * 100).toFixed(0);

  let recomendacao = "";
  if (exposure >= 0.80) recomendacao = `LONG (${exposurePercent}% BTC / ${100 - exposurePercent}% Caixa)`;
  else if (exposure >= 0.30) recomendacao = `LONG PARCIAL (${exposurePercent}% BTC / ${100 - exposurePercent}% Caixa)`;
  else if (exposure > 0 && exposure < 0.30) recomendacao = `FLAT / LEVEMENTE COMPRADO (${exposurePercent}% BTC)`;
  else if (exposure === 0) recomendacao = "FLAT (100% Caixa)";
  else recomendacao = "SHORT (Proteção)";

  let regimeMercado = "TRANSIÇÃO/LATERAL";
  if(signal1W > 0 && signal1D > 0) regimeMercado = "TENDÊNCIA DE ALTA";
  if(signal1W <= 0 && signal1D <= 0) regimeMercado = "TENDÊNCIA DE BAIXA";

  let pontoInvalidacao = "N/A";
  let emaColIndex = btc1dData[0].findIndex(h => h.toString().toUpperCase().includes('EMA 20'));
  if(emaColIndex !== -1 && !isNaN(last1D[emaColIndex])) {
     pontoInvalidacao = "$" + parseFloat(last1D[emaColIndex]).toFixed(2);
  }

  tabs.dashboard.getRange("B8").setValue(liderName);
  tabs.dashboard.getRange("C8").setValue(recomendacao);
  tabs.dashboard.getRange("D8").setValue(regimeMercado);
  tabs.dashboard.getRange("E8").setValue(pontoInvalidacao);

  // 3. LEADERBOARD MULTITEMPORAL — Linhas 13 a 28 (Colunas D a G)
  // Coluna C = index 2 (Retorno)
  // Coluna G = index 6 (Max DD)
  // Coluna H = index 7 (Sharpe)
  // Coluna K = index 10 (Win Rate)

  function getLeaderBlock(rankingArray, startRowIndex, endRowIndex) {
      let block = [];
      for(let i = startRowIndex; i <= endRowIndex; i++) {
          if(i < rankingArray.length) {
              // Valores puros
              let ret = parseFloat(rankingArray[i][2]) || 0;
              let dd = parseFloat(rankingArray[i][6]) || 0;
              let sharpe = parseFloat(rankingArray[i][7]) || 0;
              let wr = parseFloat(rankingArray[i][10]) || 0;
              block.push([ret, dd, sharpe, wr]);
          } else {
              block.push(["", "", "", ""]);
          }
      }
      return block;
  }

  // Linhas da UI: 2 a 5 -> Array indices 1 a 4
  const leader12M = getLeaderBlock(rankingData, 1, 4);
  // Linhas da UI: 6 a 9 -> Array indices 5 a 8
  const leader24M = getLeaderBlock(rankingData, 5, 8);
  // Linhas da UI: 10 a 13 -> Array indices 9 a 12
  const leader36M = getLeaderBlock(rankingData, 9, 12);
  // Linhas da UI: 14 a 17 -> Array indices 13 a 16
  const leaderAT = getLeaderBlock(rankingData, 13, 16);

  // 12 Meses (D13:G16)
  let range12M = tabs.dashboard.getRange("D13:G16");
  range12M.setValues(leader12M);
  tabs.dashboard.getRange("D13:D16").setNumberFormat("0.00%");
  tabs.dashboard.getRange("E13:E16").setNumberFormat("0.00%");
  tabs.dashboard.getRange("F13:F16").setNumberFormat("0.00");
  tabs.dashboard.getRange("G13:G16").setNumberFormat("0.00%");

  // 24 Meses (D17:G20)
  let range24M = tabs.dashboard.getRange("D17:G20");
  range24M.setValues(leader24M);
  tabs.dashboard.getRange("D17:D20").setNumberFormat("0.00%");
  tabs.dashboard.getRange("E17:E20").setNumberFormat("0.00%");
  tabs.dashboard.getRange("F17:F20").setNumberFormat("0.00");
  tabs.dashboard.getRange("G17:G20").setNumberFormat("0.00%");

  // 36 Meses (D21:G24)
  let range36M = tabs.dashboard.getRange("D21:G24");
  range36M.setValues(leader36M);
  tabs.dashboard.getRange("D21:D24").setNumberFormat("0.00%");
  tabs.dashboard.getRange("E21:E24").setNumberFormat("0.00%");
  tabs.dashboard.getRange("F21:F24").setNumberFormat("0.00");
  tabs.dashboard.getRange("G21:G24").setNumberFormat("0.00%");

  // Histórico Completo (D25:G28)
  let rangeAT = tabs.dashboard.getRange("D25:G28");
  rangeAT.setValues(leaderAT);
  tabs.dashboard.getRange("D25:D28").setNumberFormat("0.00%");
  tabs.dashboard.getRange("E25:E28").setNumberFormat("0.00%");
  tabs.dashboard.getRange("F25:F28").setNumberFormat("0.00");
  tabs.dashboard.getRange("G25:G28").setNumberFormat("0.00%");

  // 4. STATUS ATUAL POR TIMEFRAME — Coluna D (Linhas 31 a 33)
  let status1W = signal1W > 0 ? "COMPRADO - " + liderName + " Alinhado" : "VENDIDO / CAIXA";
  let status1D = signal1D > 0 ? "COMPRADO - " + liderName + " Alinhado" : "VENDIDO / CAIXA";
  let status4H = signal4H > 0 ? "COMPRADO - " + liderName + " Alinhado" : "VENDIDO / CAIXA";

  tabs.dashboard.getRange("D31").setValue(status1W);
  tabs.dashboard.getRange("D32").setValue(status1D);
  tabs.dashboard.getRange("D33").setValue(status4H);

  Logger.log("Dashboard Executive (Coord Mapping e Formatação) finalizado com sucesso.");
}

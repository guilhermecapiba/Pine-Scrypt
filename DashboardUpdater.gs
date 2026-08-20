/**
 * DashboardUpdater.gs
 * Atualiza o Dashboard Executivo da "BTC Backtest Machine" nas coordenadas exatas solicitadas.
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
  const currentPrice = last1D[1] ? "$" + parseFloat(last1D[1]).toFixed(2) : "N/A"; // Assumindo coluna 1 (B) como Close

  tabs.dashboard.getRange("C3").setValue(timeStr);
  tabs.dashboard.getRange("C4").setValue(currentPrice);

  // 2. ACTION CARD (Decisão Tática) — Linha 8
  let liderName = rankingData.length > 1 ? rankingData[1][0] : "N/A";

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

  // Extrair ponto de invalidação (buscando na coluna da MA200 ou EMA de referência, se existir)
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
  // Assumindo a estrutura baseada nas colunas requeridas (Retorno, DD, Sharpe, WR)
  // Vamos buscar índices baseados em headers comuns caso existam. Se não, mapeamos de forma estruturada.
  // Como as janelas temporais de um leaderboard de planilhas costumam ter as métricas em colunas fixas:
  // Offset 12M = Col 1..4, 24M = Col 5..8, 36M = Col 9..12, AT = Col 13..16 (exemplo prático robusto)

  function getLeaderBlock(rankingArray, startColIndex) {
      let block = [];
      for(let i = 1; i <= 4; i++) {
          if(i < rankingArray.length) {
              block.push([
                rankingArray[i][startColIndex] || "",
                rankingArray[i][startColIndex+1] || "",
                rankingArray[i][startColIndex+2] || "",
                rankingArray[i][startColIndex+3] || ""
              ]);
          } else {
              block.push(["", "", "", ""]);
          }
      }
      return block;
  }

  // Preenchendo com offsets baseados na estrutura padronizada (assumindo colunas contíguas no DB)
  // Caso a estrutura da aba Ranking seja linha a linha para os períodos, esse mapeamento cobrirá colunas laterais
  const leader12M = getLeaderBlock(rankingData, 1);  // Ex: B, C, D, E
  const leader24M = getLeaderBlock(rankingData, 5);  // Ex: F, G, H, I
  const leader36M = getLeaderBlock(rankingData, 9);  // Ex: J, K, L, M
  const leaderAT = getLeaderBlock(rankingData, 13);  // Ex: N, O, P, Q

  tabs.dashboard.getRange("D13:G16").setValues(leader12M);
  tabs.dashboard.getRange("D17:G20").setValues(leader24M);
  tabs.dashboard.getRange("D21:G24").setValues(leader36M);
  tabs.dashboard.getRange("D25:G28").setValues(leaderAT);

  // 4. STATUS ATUAL POR TIMEFRAME — Coluna D (Linhas 31 a 33)
  // Lógica técnica básica baseada nos sinais (pode ser aprimorada lendo a EMA se necessário)
  let status1W = signal1W > 0 ? "COMPRADO - " + liderName + " Alinhado" : "VENDIDO / CAIXA";
  let status1D = signal1D > 0 ? "COMPRADO - " + liderName + " Alinhado" : "VENDIDO / CAIXA";
  let status4H = signal4H > 0 ? "COMPRADO - " + liderName + " Alinhado" : "VENDIDO / CAIXA";

  tabs.dashboard.getRange("D31").setValue(status1W);
  tabs.dashboard.getRange("D32").setValue(status1D);
  tabs.dashboard.getRange("D33").setValue(status4H);

  Logger.log("Dashboard Executive atualizado com sucesso.");
}

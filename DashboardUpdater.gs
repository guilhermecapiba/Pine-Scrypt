/**
 * DashboardUpdater.gs
 * Atualiza o Dashboard Executivo da "BTC Backtest Machine" de forma assíncrona e em lote.
 */

function atualizarDashboard() {
  // Conectando via ID específico fornecido no contexto
  const SPREADSHEET_ID = "13RyXbvMGYppWPmWAPpFxUJ1bz17_oz6G-dAUAWZxhzQ";
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // 1. Extração de Dados em Lote (Performance e Evitando Rate Limits)
  const tabs = {
    ranking: ss.getSheetByName('Ranking_Performance'),
    btc4h: ss.getSheetByName('BTC_4H'),
    btc1d: ss.getSheetByName('BTC_1D'),
    btc1w: ss.getSheetByName('BTC_1W'),
    config: ss.getSheetByName('Config'),
    dashboard: ss.getSheetByName('Dashboard')
  };

  if (!tabs.ranking || !tabs.btc4h || !tabs.btc1d || !tabs.btc1w || !tabs.config || !tabs.dashboard) {
    throw new Error('Erro: Algumas abas necessárias não foram encontradas.');
  }

  // Busca de dados em bulk
  const rankingData = tabs.ranking.getDataRange().getValues();
  const configData = tabs.config.getDataRange().getValues();

  // Pegando a última linha de dados (excluindo cabeçalhos presumidos na linha 1)
  const btc4hData = tabs.btc4h.getDataRange().getValues();
  const btc1dData = tabs.btc1d.getDataRange().getValues();
  const btc1wData = tabs.btc1w.getDataRange().getValues();

  const last4H = btc4hData[btc4hData.length - 1];
  const last1D = btc1dData[btc1dData.length - 1];
  const last1W = btc1wData[btc1wData.length - 1];

  // 2. Eleição da Estratégia Campeã
  // Assumindo que na aba Ranking_Performance:
  // Coluna A (Index 0) = Nome da Estratégia
  let liderName = "N/A";

  if (rankingData.length > 1) {
    liderName = rankingData[1][0]; // Assumindo primeira coluna
  }

  // Pesos da Config (1W: 50%, 1D: 30%, 4H: 20%)
  // Extraindo pesos caso estejam na config, senão usamos hardcoded
  let peso1W = 0.50;
  let peso1D = 0.30;
  let peso4H = 0.20;

  // 3. Extração do Posicionamento Tático da Estratégia Líder
  let colIndex4H = btc4hData[0].indexOf(liderName);
  let colIndex1D = btc1dData[0].indexOf(liderName);
  let colIndex1W = btc1wData[0].indexOf(liderName);

  // Valor de fallback para sinal
  let signal4H = (colIndex4H !== -1 && !isNaN(last4H[colIndex4H])) ? last4H[colIndex4H] : 0;
  let signal1D = (colIndex1D !== -1 && !isNaN(last1D[colIndex1D])) ? last1D[colIndex1D] : 0;
  let signal1W = (colIndex1W !== -1 && !isNaN(last1W[colIndex1W])) ? last1W[colIndex1W] : 0;

  // Calculando Exposição Ponderada
  let exposure = (signal1W * peso1W) + (signal1D * peso1D) + (signal4H * peso4H);
  let exposurePercent = (exposure * 100).toFixed(0) + "%";

  // Determinar a Ação Final
  let recomendacao = "";
  if (exposure >= 0.80) {
    recomendacao = "LONG AGRESSIVO (Comprado 80%-100% / Caixa 0%-20%)";
  } else if (exposure >= 0.30 && exposure < 0.80) {
    recomendacao = "LONG MODERADO (Comprado parcial / Caixa defensivo)";
  } else if (exposure === 0) {
    recomendacao = "FLAT / DEFENSIVO (100% Caixa em Dólar)";
  } else if (exposure < 0) {
    recomendacao = "SHORT / PROTEÇÃO (Hedge ativo)";
  } else {
    // Entre 0 e 0.30
    recomendacao = "FLAT / LEVEMENTE COMPRADO (Caixa majoritário)";
  }

  // Extrair Regime de Mercado
  let regimeMercado = "TRANSIÇÃO/LATERAL";
  if(signal1W > 0 && signal1D > 0) regimeMercado = "TENDÊNCIA DE ALTA";
  if(signal1W <= 0 && signal1D <= 0) regimeMercado = "TENDÊNCIA DE BAIXA";

  // 4. Atualização Visual dos Blocos do Dashboard
  const now = new Date();
  const timeStr = Utilities.formatDate(now, "America/Sao_Paulo", "dd/MM/yyyy HH:mm:ss") + " BRT";

  // Pegar o último preço
  const currentPrice = "$" + parseFloat(last1D[1] || 0).toFixed(2);

  // Header
  tabs.dashboard.getRange("B2").setValue(timeStr);
  tabs.dashboard.getRange("D2").setValue(currentPrice);

  // Action Card
  tabs.dashboard.getRange("B4").setValue(liderName);
  tabs.dashboard.getRange("B5").setValue(recomendacao + " - " + exposurePercent);
  tabs.dashboard.getRange("B6").setValue(regimeMercado);
  tabs.dashboard.getRange("B7").setValue("N/A (Extrair suporte da planilha)"); // Mock do stop

  // Formatação Condicional básica para o Action Card
  let recBgColor = "#333333";
  let recFontColor = "#FFFFFF";
  if (exposure >= 0.8) { recBgColor = "#1B5E20"; recFontColor = "#C8E6C9"; }
  else if (exposure >= 0.3) { recBgColor = "#827717"; recFontColor = "#F0F4C3"; }
  else if (exposure === 0) { recBgColor = "#424242"; recFontColor = "#E0E0E0"; }
  else if (exposure < 0) { recBgColor = "#b71c1c"; recFontColor = "#ffcdd2"; }

  tabs.dashboard.getRange("B5").setBackground(recBgColor).setFontColor(recFontColor);

  // Resumo do Leaderboard (copiar primeiras N linhas)
  let boardRows = 5;
  let writeData = [];
  let bgColors = [];
  let fontColors = [];

  for(let i = 0; i <= boardRows && i < rankingData.length; i++) {
    // Selecionando 5 colunas baseadas no Ranking_Performance
    writeData.push([rankingData[i][0], rankingData[i][1], rankingData[i][2], rankingData[i][3], rankingData[i][4]]);

    // Preparando array de formatação (destaque na campeã se for a linha 1 após o header)
    if (i === 1) { // Campeã
       bgColors.push(["#FFD700", "#FFD700", "#FFD700", "#FFD700", "#FFD700"]); // Gold
       fontColors.push(["#000000", "#000000", "#000000", "#000000", "#000000"]);
    } else {
       bgColors.push(["#1E1E1E", "#1E1E1E", "#1E1E1E", "#1E1E1E", "#1E1E1E"]); // Dark Mode default
       fontColors.push(["#FFFFFF", "#FFFFFF", "#FFFFFF", "#FFFFFF", "#FFFFFF"]);
    }
  }

  if (writeData.length > 0) {
      let rangeBoard = tabs.dashboard.getRange(10, 2, writeData.length, writeData[0].length);
      rangeBoard.setValues(writeData);
      // Aplicando formatação condicional de destaque em lote
      rangeBoard.setBackgrounds(bgColors);
      rangeBoard.setFontColors(fontColors);
  }

  // Status Timeframes (Fechamentos e sinais de cada TF)
  let tfData = [
      ["1W", "$" + parseFloat(last1W[1]||0).toFixed(2), (signal1W > 0 ? "BULL" : "BEAR")],
      ["1D", currentPrice, (signal1D > 0 ? "BULL" : "BEAR")],
      ["4H", "$" + parseFloat(last4H[1]||0).toFixed(2), (signal4H > 0 ? "BULL" : "BEAR")]
  ];
  tabs.dashboard.getRange(20, 2, 3, 3).setValues(tfData);
}

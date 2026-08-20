/**
 * INGESTÃO BTC + AAVE HEALTH FACTOR E MATRIZ DE DECISÃO EM 3 CAMADAS
 * Planilha BTC ID: 1y2MZIks6qPIvOq_rupKksGbh7nEQvsoQaZINGGc88Jc
 */

const CONFIG = {
  ABA_PAINEL: '1_PAINEL_DECISAO',
  ABA_DADOS_BTC: '2_DADOS_BTC_1D_1W',
  ABA_DADOS_ETH: '3_DADOS_ETHBTC_4H_1D',
  ABA_ONCHAIN: '4_HISTORICO_ONCHAIN_AAVE',
  ABA_CONFIG_LOGS: '5_CONFIG_LOGS',

  CARTEIRA: '0x1CFBA5C5949D6d7644f0175aA12ffA95C21575f9',
  FUSO_LOCAL: 'America/Sao_Paulo',

  MERCADOS: [
    {
      rede: 'Polygon',
      pool: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
      colateralSoBTC: true,
      rpcs: [
        'https://polygon-bor-rpc.publicnode.com',
        'https://polygon.drpc.org',
        'https://rpc.ankr.com/polygon'
      ]
    },
    {
      rede: 'Base',
      pool: '0xA238Dd80C259a72e81d7e4664a9801593F98d1c5',
      colateralSoBTC: false,
      rpcs: [
        'https://base-rpc.publicnode.com',
        'https://base.drpc.org',
        'https://mainnet.base.org'
      ]
    }
  ],
  SELECTOR_HF: '0xbf92857c'
};

const GATILHOS_APORTE = [
  { limiar: 1.55, acao: 'TRAVA DE EMERGÊNCIA - 100% AMORTIZAÇÃO (R$ 2.000)', wbtc: 0, usdc: 2000, status: 'PERIGO' },
  { limiar: 1.80, acao: 'TRAVA DE ATENÇÃO - PRIORIZAR AMORTIZAÇÃO', wbtc: 500, usdc: 1500, status: 'ATENÇÃO' }
];
const APORTE_PADRAO = { acao: 'APORTE PADRÃO (50/50)', wbtc: 1000, usdc: 1000, status: 'SAUDÁVEL' };

/* ============================ MENU E GATILHOS ============================ */

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('⚡ Painel Decisão BTC & Aave')
    .addItem('🔄 Atualizar Tudo Agora', 'atualizarTudo')
    .addSeparator()
    .addItem('⏰ Instalar Gatilho Horário', 'installHourlyTrigger')
    .addItem('🗑️ Remover Gatilhos', 'removeTriggers')
    .addToUi();
}

function installHourlyTrigger() {
  removeTriggers();
  ScriptApp.newTrigger('atualizarTudo')
    .timeBased()
    .everyHours(1)
    .create();
  SpreadsheetApp.getUi().alert('✅ Gatilho horário instalado com sucesso!');
}

function removeTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    ScriptApp.deleteTrigger(triggers[i]);
  }
}

/* ============================ FLUXO PRINCIPAL ============================ */

function atualizarTudo() {
  try {
    log('Sistema', 'INICIO_CICLO', 'Iniciando atualização...');

    // 1. Ingestão de Dados
    const dadosMkt = ingerirMercado();

    // 2. Monitoramento Aave
    const dadosAave = monitorarAave(dadosMkt.btcSpot);

    // 3. Matriz de Decisão
    const decisao = motorMatriz(dadosMkt, dadosAave);

    // 4. Atualizar Dashboard
    atualizarPainel(dadosMkt, dadosAave, decisao);

    log('Sistema', 'FIM_CICLO', 'Atualização concluída com sucesso.');
  } catch (e) {
    log('Sistema', 'ERRO', String(e));
  }
}

/* ===================== INGESTÃO DE MERCADO E INDICADORES ===================== */

function ingerirMercado() {
  const reqs = [
    { url: 'https://api.kraken.com/0/public/OHLC?pair=XBTUSD&interval=1440', muteHttpExceptions: true }, // BTC 1D
    { url: 'https://api.kraken.com/0/public/OHLC?pair=XBTUSD&interval=10080', muteHttpExceptions: true }, // BTC 1W
    { url: 'https://api.kraken.com/0/public/OHLC?pair=ETHXBT&interval=1440', muteHttpExceptions: true }, // ETH 1D
    { url: 'https://api.kraken.com/0/public/OHLC?pair=ETHXBT&interval=240', muteHttpExceptions: true } // ETH 4H
  ];
  const resps = UrlFetchApp.fetchAll(reqs);

  const btc1D = JSON.parse(resps[0].getContentText()).result.XXBTZUSD || [];
  const btc1W = JSON.parse(resps[1].getContentText()).result.XXBTZUSD || [];
  const eth1DKey = Object.keys(JSON.parse(resps[2].getContentText()).result)[0];
  const eth1D = JSON.parse(resps[2].getContentText()).result[eth1DKey] || [];
  const eth4HKey = Object.keys(JSON.parse(resps[3].getContentText()).result)[0];
  const eth4H = JSON.parse(resps[3].getContentText()).result[eth4HKey] || [];

  // Aumentado o slice para 250 para garantir cálculo correto do SMA200
  const procBtc1D = processarOHLC(btc1D.slice(-250));
  const procBtc1W = processarOHLC(btc1W.slice(-250));
  const procEth1D = processarOHLC(eth1D.slice(-250));
  const procEth4H = processarOHLC(eth4H.slice(-250));

  const btcSpot = procBtc1D.closes[procBtc1D.closes.length - 1];
  const ethSpot = procEth1D.closes[procEth1D.closes.length - 1];

  // Cálculos BTC
  const ema10_1D = calcEMA(procBtc1D.closes, 10).slice(-1)[0];
  const ema30_1D = calcEMA(procBtc1D.closes, 30).slice(-1)[0];
  const sma200_1D = calcSMA(procBtc1D.closes, 200).slice(-1)[0];
  const rsi_1D = calcRSI(procBtc1D.closes, 14).slice(-1)[0];

  const ema10_1W = calcEMA(procBtc1W.closes, 10).slice(-1)[0];
  const ema30_1W = calcEMA(procBtc1W.closes, 30).slice(-1)[0];

  // Cálculos ETH
  const ema21_1D = calcEMA(procEth1D.closes, 21).slice(-1)[0];
  const ema55_1D = calcEMA(procEth1D.closes, 55).slice(-1)[0];
  const rsi_4H = calcRSI(procEth4H.closes, 14).slice(-1)[0];

  // Salvar nas abas
  gravarAba(CONFIG.ABA_DADOS_BTC, ['Data','Close','EMA10','EMA30','SMA200','RSI'], [[agoraLocal(), btcSpot, ema10_1D, ema30_1D, sma200_1D, rsi_1D]]);
  gravarAba(CONFIG.ABA_DADOS_ETH, ['Data','Close','EMA21','EMA55','RSI_4H'], [[agoraLocal(), ethSpot, ema21_1D, ema55_1D, rsi_4H]]);

  return {
    btcSpot, ethSpot,
    btc: { ema10_1D, ema30_1D, sma200_1D, rsi_1D, ema10_1W, ema30_1W },
    eth: { ema21_1D, ema55_1D, rsi_4H }
  };
}

/* ============================== AAVE ON-CHAIN ============================== */

function monitorarAave(btcSpot) {
  const result = {};
  const agora = agoraLocal();
  const logRows = [];

  for (const m of CONFIG.MERCADOS) {
    let r = null;
    for (const rpc of m.rpcs) {
      r = lerAaveRPC(m.pool, rpc);
      if (r) break;
    }

    if (r) {
      const ltvAtual = r.colateral > 0 ? (r.divida / r.colateral * 100) : 0;
      let quedaTolerada = 0;
      let precoLiq = 0;

      if (r.hf > 0 && m.colateralSoBTC) {
        quedaTolerada = (1 - 1 / r.hf) * 100;
        precoLiq = btcSpot / r.hf;
      }

      let status = 'SAUDÁVEL';
      if (r.hf > 0) {
        for (const g of GATILHOS_APORTE) {
          if (r.hf < g.limiar) {
            status = g.status;
            break;
          }
        }
      }

      result[m.rede] = {
        colateral: r.colateral, divida: r.divida, disponivel: r.disponivel, ltvAtual: ltvAtual,
        hf: r.hf, quedaTolerada: quedaTolerada, precoLiq: precoLiq, status: status
      };

      logRows.push([
        agora, m.rede, r.colateral, r.divida, r.disponivel, ltvAtual, r.hf, quedaTolerada, precoLiq, status
      ]);
    } else {
      result[m.rede] = { colateral:0, divida:0, disponivel:0, ltvAtual:0, hf:0, quedaTolerada:0, precoLiq:0, status:'DESCONHECIDO' };
    }
  }

  if (logRows.length > 0) {
    gravarAba(CONFIG.ABA_ONCHAIN,
      ['Data','Rede','Colateral','Divida','Poder_Disponivel','LTV','HF','Queda_Tolerada','Preco_Liq_BTC','Status'],
      logRows);
  }

  return result;
}

function lerAaveRPC(pool, rpcUrl) {
  const dataField = CONFIG.SELECTOR_HF + CONFIG.CARTEIRA.toLowerCase().replace('0x', '').padStart(64, '0');
  const payload = JSON.stringify({
    jsonrpc: '2.0', id: 1, method: 'eth_call',
    params: [{ to: pool, data: dataField }, 'latest']
  });

  try {
    const res = UrlFetchApp.fetch(rpcUrl, {
      method: 'post', contentType: 'application/json', payload: payload, muteHttpExceptions: true
    });
    if (res.getResponseCode() === 200) {
      const j = JSON.parse(res.getContentText());
      if (j.result && j.result !== '0x') {
        const hex = j.result.slice(2);
        const p = (k) => parseInt(hex.substr(k * 64, 64), 16);
        const hfRaw = p(5);
        return {
          colateral: p(0) / 1e8,
          divida: p(1) / 1e8,
          disponivel: p(2) / 1e8,
          hf: (!isFinite(hfRaw) || hfRaw / 1e18 > 1e6) ? 0 : hfRaw / 1e18
        };
      }
    }
  } catch (e) { }
  return null;
}

/* ========================= MOTOR DE DECISÃO ========================= */

function motorMatriz(mkt, aave) {
  // CAMADA 1: Macro BTC
  let perCripto, perCaixa, macroStatus;
  if (mkt.btcSpot > mkt.btc.ema30_1D && mkt.btc.ema10_1W > mkt.btc.ema30_1W) {
    perCripto = 85; perCaixa = 15; macroStatus = "ALTA ESTRUTURAL";
  } else if (mkt.btcSpot < mkt.btc.ema30_1D && mkt.btc.ema10_1W < mkt.btc.ema30_1W) {
    perCripto = 50; perCaixa = 50; macroStatus = "BAIXA ESTRUTURAL";
  } else {
    perCripto = 75; perCaixa = 25; macroStatus = "TRANSIÇÃO / CONSOLIDAÇÃO";
  }

  // CAMADA 2: Relativo ETH
  let perWbtc, perEth, ethStatus;
  if (mkt.ethSpot > mkt.eth.ema21_1D && mkt.eth.ema21_1D > mkt.eth.ema55_1D && mkt.eth.rsi_4H > 45 && mkt.eth.rsi_4H < 70) {
    perWbtc = 70; perEth = 30; ethStatus = "TENDÊNCIA DE ALTA (RSI SAUDÁVEL)";
  } else {
    perWbtc = 100; perEth = 0; ethStatus = "BAIXA OU RESISTÊNCIA";
  }

  // CAMADA 3: Alocação Final
  const finalWbtc = (perCripto * perWbtc) / 100;
  const finalEth = (perCripto * perEth) / 100;

  // Aporte
  const hfPoly = aave['Polygon'] ? aave['Polygon'].hf : 0;
  let aporte = APORTE_PADRAO;
  for (const g of GATILHOS_APORTE) {
    if (hfPoly > 0 && hfPoly < g.limiar) { aporte = g; break; }
  }

  return {
    macro: { cripto: perCripto, caixa: perCaixa, status: macroStatus },
    relativo: { wbtc: perWbtc, eth: perEth, status: ethStatus },
    final: { wbtc: finalWbtc, eth: finalEth, caixa: perCaixa },
    aporte: aporte
  };
}

/* ========================= ATUALIZADOR DE PAINEL ========================= */

function atualizarPainel(mkt, aave, dec) {
  let aba = SpreadsheetApp.getActive().getSheetByName(CONFIG.ABA_PAINEL);
  if (!aba) {
    aba = SpreadsheetApp.getActive().insertSheet(CONFIG.ABA_PAINEL);
  }

  const p = aave['Polygon'];
  const b = aave['Base'];

  // Template preenchido
  const layout = [
    ['DASHBOARD DECISÃO', 'Data/Hora (BRT):', agoraLocal(), '', '', '', '', ''],
    ['Preço BTC/USD:', mkt.btcSpot, 'Preço ETH/BTC:', mkt.ethSpot, '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['==== 1. MATRIZ DE DECISÃO ====', '', '', '', '', '', '', ''],
    ['Macro (Cripto vs Caixa):', `${dec.macro.cripto}% / ${dec.macro.caixa}%`, dec.macro.status, '', '', '', '', ''],
    ['Relativo (BTC vs ETH):', `${dec.relativo.wbtc}% / ${dec.relativo.eth}%`, dec.relativo.status, '', '', '', '', ''],
    ['Alocação Patrimonial Final:', `WBTC: ${dec.final.wbtc}%`, `ETH: ${dec.final.eth}%`, `CAIXA: ${dec.final.caixa}%`, '', '', '', ''],
    ['Ação Recomendada:', dec.aporte.acao, `Aporte WBTC: R$ ${dec.aporte.wbtc}`, `Amortização: R$ ${dec.aporte.usdc}`, '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['==== 2. RADAR DE RISCO AAVE ====', '', '', '', '', '', '', ''],
    ['Rede', 'Colateral (USD)', 'Dívida (USD)', 'Poder Disponível', 'LTV Atual (%)', 'Health Factor', 'Margem (Queda %)', 'Preço Liq BTC', 'Status'],
    ['Polygon', p.colateral.toFixed(2), p.divida.toFixed(2), p.disponivel.toFixed(2), p.ltvAtual.toFixed(2), p.hf.toFixed(3), p.quedaTolerada.toFixed(2), p.precoLiq.toFixed(2), p.status],
    ['Base', b.colateral.toFixed(2), b.divida.toFixed(2), b.disponivel.toFixed(2), b.ltvAtual.toFixed(2), b.hf.toFixed(3), b.quedaTolerada.toFixed(2), b.precoLiq.toFixed(2), b.status],
    ['', '', '', '', '', '', '', ''],
    ['==== 3. SINAIS TÉCNICOS ====', '', '', '', '', '', '', ''],
    ['Ativo / TF', 'RSI', 'EMA Rápida', 'EMA Lenta', 'Status Cruzamento', '', '', ''],
    ['BTC 1D', mkt.btc.rsi_1D.toFixed(1), mkt.btc.ema10_1D.toFixed(0), mkt.btc.ema30_1D.toFixed(0), mkt.btc.ema10_1D > mkt.btc.ema30_1D ? 'BULL' : 'BEAR', '', '', ''],
    ['BTC 1W', 'N/A', mkt.btc.ema10_1W.toFixed(0), mkt.btc.ema30_1W.toFixed(0), mkt.btc.ema10_1W > mkt.btc.ema30_1W ? 'BULL' : 'BEAR', '', '', ''],
    ['ETH 1D', 'N/A', mkt.eth.ema21_1D.toFixed(4), mkt.eth.ema55_1D.toFixed(4), mkt.eth.ema21_1D > mkt.eth.ema55_1D ? 'BULL' : 'BEAR', '', '', ''],
    ['ETH 4H', mkt.eth.rsi_4H.toFixed(1), 'N/A', 'N/A', 'N/A', '', '', '']
  ];

  aba.getRange(1, 1, layout.length, layout[0].length).setValues(layout);
}

/* ========================= UTILITÁRIOS E MATEMÁTICA ========================= */

function processarOHLC(dadosArr) {
  const closes = dadosArr.map(c => parseFloat(c[4]));
  return { closes };
}

function calcEMA(closes, period) {
  if (closes.length < period) return Array(closes.length).fill(null);
  const k = 2 / (period + 1);
  const ema = Array(closes.length).fill(null);
  let sum = 0;
  for (let i = 0; i < period; i++) sum += closes[i];
  ema[period - 1] = sum / period;
  for (let i = period; i < closes.length; i++) {
    ema[i] = (closes[i] - ema[i - 1]) * k + ema[i - 1];
  }
  return ema;
}

function calcSMA(closes, period) {
  const sma = Array(closes.length).fill(null);
  if (closes.length < period) return sma;
  for (let i = period - 1; i < closes.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) sum += closes[i - j];
    sma[i] = sum / period;
  }
  return sma;
}

function calcRSI(closes, period) {
  const rsi = Array(closes.length).fill(null);
  if (closes.length < period + 1) return rsi;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  rsi[period] = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    rsi[i] = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));
  }
  return rsi;
}

function agoraLocal() {
  return Utilities.formatDate(new Date(), CONFIG.FUSO_LOCAL, 'yyyy-MM-dd HH:mm:ss');
}

function gravarAba(nomeAba, cabecalho, linhas) {
  let aba = SpreadsheetApp.getActive().getSheetByName(nomeAba);
  if (!aba) {
    aba = SpreadsheetApp.getActive().insertSheet(nomeAba);
    aba.appendRow(cabecalho);
  }
  if (linhas.length > 0) {
    aba.getRange(aba.getLastRow() + 1, 1, linhas.length, linhas[0].length).setValues(linhas);
  }
}

function log(agente, evento, detalhe) {
  gravarAba(CONFIG.ABA_CONFIG_LOGS, ['Data', 'Agente', 'Evento', 'Detalhe'], [[agoraLocal(), agente, evento, detalhe]]);
}

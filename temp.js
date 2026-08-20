const SPREADSHEET_ID = '13RyXbvMGYppWPmWAPpFxUJ1bz17_oz6G-dAUAWZxhzQ';
const SYMBOL = 'BTCUSDT';
const TIMEZONE = 'America/Sao_Paulo';
const START_MS = Date.UTC(2017, 0, 1);
const MAX_EXPOSURE_PCT = 30; // Teto técnico configurável; não é recomendação financeira.
const TIMEFRAMES = { BTC_4H: '4h', BTC_1D: '1d', BTC_1W: '1w' };
const HEADERS = ['Timestamp_UTC','Timestamp_BRT','Abertura','Maxima','Minima','Fechamento','Volume','HLC3','RSI(14)','SMA08','SMA20','SMA200','EMA08','EMA20','EMA200','ATR(14)','MACD(12,26,9)','MACD_Signal','MACD_Hist','Tendencia','Alinhamento','Sinal','Posicao','Score'];

function onOpen() {
  SpreadsheetApp.getUi().createMenu('BTC Backtest Machine')
    .addItem('Atualizar tudo agora', 'updateAllTimeframes')
    .addItem('Instalar/renovar gatilho horário', 'installHourlyTrigger')
    .addItem('Atualizar dashboard', 'updateDashboard')
    .addToUi();
}

function installHourlyTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => { if (t.getHandlerFunction() === 'updateAllTimeframes') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('updateAllTimeframes').timeBased().everyHours(1).create();
  SpreadsheetApp.getActive().toast('Gatilho horário instalado com sucesso.');
}

function updateAllTimeframes() {
  Object.keys(TIMEFRAMES).forEach(name => updateKlines_(name, TIMEFRAMES[name]));
  updateNuvemSetup_();
  updateDashboard();
  SpreadsheetApp.getActive().toast('Dados, indicadores e dashboard atualizados.');
}

function fetchKlines_(interval, start, end, latestOnly) {
  const endpoints = ['https://api.binance.com/api/v3/klines','https://data-api.binance.vision/api/v3/klines'];
  for (let i=0; i<endpoints.length; i++) {
    let url = endpoints[i] + '?symbol=' + SYMBOL + '&interval=' + interval + '&limit=1000';
    if (!latestOnly) url += '&startTime=' + start + '&endTime=' + end;
    try {
      const response = UrlFetchApp.fetch(url, {muteHttpExceptions:true});
      const code = response.getResponseCode();
      if (code >= 200 && code < 300) {
        const parsed = JSON.parse(response.getContentText());
        if (Array.isArray(parsed) && parsed.length) return parsed;
      }
    } catch (err) {}
  }
  return [];
}

function rawFromSheet_(sh) {
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2,1,sh.getLastRow()-1,7).getValues().map(r => [new Date(r[0]).getTime(),r[2],r[3],r[4],r[5],r[6]]).filter(r => isFinite(r[0]));
}

function updateKlines_(sheetName, interval) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
  const step = interval === '4h' ? 14400000 : interval === '1d' ? 86400000 : 604800000;
  const previous = rawFromSheet_(sh);
  let start = previous.length ? Math.max(START_MS, previous[previous.length-1][0] - step*250) : START_MS;
  let all = [], end = Date.now();
  while (start < end) {
    const data = fetchKlines_(interval, start, end, false);
    if (!data.length) break;
    all = all.concat(data);
    const next = Number(data[data.length-1][0]) + step;
    if (next <= start) break;
    start = next;
    if (data.length < 1000) break;
    Utilities.sleep(150);
  }
  if (!all.length) all = fetchKlines_(interval, 0, 0, true);
  if (!all.length && previous.length) {
    updateDashboard();
    return;
  }
  if (!all.length) throw new Error('Nenhum candle retornado para ' + sheetName + '. A aba foi preservada.');
  const byTs = {};
  previous.concat(all).forEach(x => { byTs[Number(x[0])] = x; });
  all = Object.keys(byTs).map(Number).sort((a,b)=>a-b).map(k=>byTs[k]);
  const values = buildRows_(all);
  sh.clearContents();
  sh.getRange(1,1,values.length,HEADERS.length).setValues(values);
  formatDataSheet_(sh, values.length);
  sh.getRange(1,1).setNote('Fonte: Binance Spot API/Data Vision | Intervalo: ' + interval + ' | Última atualização: ' + new Date().toISOString());
}

function buildRows_(raw) {
  const rows = raw.map(x => {
    const d = new Date(Number(x[0]));
    return [d.toISOString().replace('T',' ').replace('Z',''), Utilities.formatDate(d, TIMEZONE, 'yyyy-MM-dd HH:mm:ss'), Number(x[1]), Number(x[2]), Number(x[3]), Number(x[4]), Number(x[5])];
  });
  const close = rows.map(r => r[5]);
  const h3 = rows.map(r => (r[3] + r[4] + r[5]) / 3);
  const rsi = RSI_(close,14), sma8 = SMA_(close,8), sma20 = SMA_(close,20), sma200 = SMA_(close,200);
  const ema8 = EMA_(close,8), ema20 = EMA_(close,20), ema200 = EMA_(close,200), atr = ATR_(rows,14);
  const ema12 = EMA_(close,12), ema26 = EMA_(close,26);
  const macd = close.map((_,i) => ema12[i] == null || ema26[i] == null ? null : ema12[i] - ema26[i]);
  const signalValues = EMA_(macd.filter(x => x != null),9), signal = Array(macd.length).fill(null); let j = 0;
  macd.forEach((x,i) => { if (x != null) signal[i] = signalValues[j++]; });
  const output = [HEADERS]; let position = 'FLAT';
  for (let i=0; i<rows.length; i++) {
    const bull = ema8[i] != null && ema8[i] > ema20[i] && ema20[i] > ema200[i];
    const bear = ema8[i] != null && ema8[i] < ema20[i] && ema20[i] < ema200[i];
    const prevBull = i > 0 && ema8[i-1] != null && ema8[i-1] > ema20[i-1] && ema20[i-1] > ema200[i-1];
    const prevBear = i > 0 && ema8[i-1] != null && ema8[i-1] < ema20[i-1] && ema20[i-1] < ema200[i-1];
    let sig = '';
    if (bull && !prevBull) { sig = 'COMPRA'; position = 'LONG'; }
    else if (bear && !prevBear) { sig = 'VENDA'; position = 'SHORT'; }
    else if (position === 'LONG' && !bull) { sig = 'SAIDA_LONG'; position = 'FLAT'; }
    else if (position === 'SHORT' && !bear) { sig = 'SAIDA_SHORT'; position = 'FLAT'; }
    const regime = bull ? 'ALTA' : bear ? 'BAIXA' : 'LATERAL';
    const alignment = bull ? '8>20>200' : bear ? '8<20<200' : 'MISTA';
    const score = technicalScore_(rows[i][5], ema20[i], ema200[i], rsi[i], macd[i], signal[i], bull, bear);
    output.push(rows[i].concat([h3[i],rsi[i],sma8[i],sma20[i],sma200[i],ema8[i],ema20[i],ema200[i],atr[i],macd[i],signal[i],macd[i] == null || signal[i] == null ? null : macd[i]-signal[i],regime,alignment,sig,position,score]));
  }
  return output;
}

function technicalScore_(price, e20, e200, rsi, macd, signal, bull, bear) {
  if (e200 == null) return 0;
  let s = 0;
  if (bull) s += 4; else if (bear) s -= 4;
  if (price > e200) s += 2; else if (price < e200) s -= 2;
  if (rsi != null) { if (rsi >= 55 && rsi <= 70) s += 2; else if (rsi <= 45 && rsi >= 30) s -= 2; else if (rsi > 70) s += 1; else if (rsi < 30) s -= 1; }
  if (macd != null && signal != null) { if (macd > signal) s += 2; else if (macd < signal) s -= 2; }
  return Math.max(-10, Math.min(10, s));
}

function updateDashboard() {
  const ss=SpreadsheetApp.openById(SPREADSHEET_ID), sh=ss.getSheetByName('Dashboard')||ss.insertSheet('Dashboard');
  const ec=[{name:'BTC_1W',label:'1W',weight:50},{name:'BTC_1D',label:'1D',weight:30},{name:'BTC_4H',label:'4H',weight:20}];
  const ema=ec.map(c=>{const q=lastValidEmaRow_(ss.getSheetByName(c.name)); if(!q)return {...c,state:'SEM DADOS',buy:0,sell:0,close:'—',evidence:'—'}; const e8=Number(q[12]),e20=Number(q[13]),e200=Number(q[14]),bull=e8>e20&&e20>e200,bear=e8<e20&&e20<e200; return {...c,state:bull?'ALTA':bear?'BAIXA':'LATERAL',buy:bull?c.weight:0,sell:0,close:q[5],evidence:bull?'EMA8>EMA20>EMA200':bear?'EMA8<EMA20<EMA200':'MISTA'};});
  const eBuy=ema.reduce((a,x)=>a+x.buy,0), eSell=0, eNet=eBuy;
  const nc=[{label:'1W',raw:'1w',weight:50},{label:'1D',raw:'1d',weight:30},{label:'4H',raw:'4h',weight:20}];
  const nu=nc.map(c=>{const q=lastValidNuvemRow_(ss.getSheetByName('Setup_Nuvem_13_49_20'),c.raw); if(!q)return {...c,state:'SEM DADOS',color:'SEM DADOS',buy:0,sell:0,net:0,evidence:'—'}; const pos=String(q[13]), color=String(q[6]); return {...c,state:pos,color,buy:pos==='LONG'?c.weight:0,sell:pos==='SHORT'?c.weight:0,net:pos==='LONG'?c.weight:pos==='SHORT'?-c.weight:0,evidence:'13d/49d + MA20'};});
  const nBuy=nu.reduce((a,x)=>a+x.buy,0),nSell=nu.reduce((a,x)=>a+x.sell,0),nNet=nBuy-nSell;
  const regime=n=>n>=70?'ALTA':n<=-70?'BAIXA':Math.abs(n)>=20?'TRANSIÇÃO':'LATERAL';
  const action=(b,s)=>b>0&&s>0?'CONFLITO':b>0?'COMPRADO PARCIALMENTE':s>0?'VENDIDO PARCIALMENTE':'FICAR EM CAIXA';
  const rows=[
   ['BTC BACKTEST MACHINE | COMPARAÇÃO DE ESTRATÉGIAS','','','','','','','',''],
   ['Atualização',new Date(),'Fonte','Binance Spot API','','','','',''],
   ['','','','','','','','',''],
   ['ESTRATÉGIA 1 — EMA 8/20/200','','','','','','','',''],
   ['Capital comprado',eBuy/100,'Capital vendido',eSell/100,'Exposição líquida',eNet/100,'Capital em caixa',(100-eBuy+eSell)/100,''],
   ['Regime',regime(eNet),'Ação',action(eBuy,eSell),'Força',Math.round(Math.abs(eNet)/10)+'/10','Regra','EMA8 > EMA20 > EMA200',''],
   ['Timeframe','Peso','Estado','Compra','Venda','Líquido','Fechamento','Evidência EMA',''],
   ...ema.map(x=>[x.label,x.weight/100,x.state,x.buy/100,x.sell/100,(x.buy-x.sell)/100,x.close,x.evidence,'']),
   ['','','','','','','','',''],
   ['ESTRATÉGIA 2 — NUVEM 13/49 DIAS + MA20','','','','','','','',''],
   ['Capital comprado',nBuy/100,'Capital vendido',nSell/100,'Exposição líquida',nNet/100,'Capital em caixa',(100-nBuy+nSell)/100,''],
   ['Regime',regime(nNet),'Ação',action(nBuy,nSell),'Força',Math.round(Math.abs(nNet)/10)+'/10','Regra','Verde compra / Azul mantém / Branca sai; Vermelha short / Amarela mantém',''],
   ['Timeframe','Peso','Estado','Cor atual','Compra','Venda','Líquido','Nuvem / MA',''],
   ...nu.map(x=>[x.label,x.weight/100,x.state,x.color,x.buy/100,x.sell/100,x.net/100,x.evidence,'']),
   ['','','','','','','','',''],
   ['COMPARAÇÃO DIRETA','','','','','','','',''],
   ['Métrica','EMA 8/20/200','Nuvem 13/49 + MA20','Interpretação','','','','',''],
   ['Exposição líquida',eNet/100,nNet/100,'Maior valor positivo = maior exposição comprada; valores negativos = exposição vendida.','','','','',''],
   ['Ação',action(eBuy,eSell),action(nBuy,nSell),'Compare as estratégias sem misturar suas regras.','','','','','']
  ];
  sh.clear(); sh.getRange(1,1,rows.length,9).setValues(rows); sh.setHiddenGridlines(true); sh.setFrozenRows(2);
  [1,4,12,20].forEach(r=>sh.getRange(r,1,1,9).merge().setBackground(r===1?'#102A43':'#3D405B').setFontColor('#FFFFFF').setFontWeight('bold').setFontSize(r===1?16:12));
  [5,13].forEach(r=>sh.getRange(r,1,1,9).setBackground('#FFF2CC').setFontWeight('bold'));
  [6,14].forEach(r=>sh.getRange(r,1,1,9).setBackground('#EAF2F8').setFontWeight('bold'));
  [7,15,21].forEach(r=>sh.getRange(r,1,1,9).setBackground('#D9EAF7').setFontWeight('bold'));
  ['B5','D5','F5','H5','B8:B10','D8:F10','B13','D13','F13','H13','B16:B18','E16:G18','B22:C22'].forEach(a=>sh.getRange(a).setNumberFormat('0%'));
  sh.getRange('F6').setNumberFormat('@'); sh.getRange('F14').setNumberFormat('@'); sh.autoResizeColumns(1,9);
}

function nuvemPeriods_(interval) {
  if (interval === '4h') return {short:78, long:294, extra:20, label:'13d/49d via 4H'};
  if (interval === '1d') return {short:13, long:49, extra:20, label:'13d/49d via 1D'};
  return {short:2, long:7, extra:20, label:'13d/49d via 1W (2/7 semanas)'};
}

function rsiUltimate_(src, n) {
  const hi = [], lo = [], diff = [], abs = [], out = Array(src.length).fill(null);
  for (let i=0;i<src.length;i++) {
    const from = Math.max(0,i-n+1);
    hi[i] = Math.max.apply(null,src.slice(from,i+1));
    lo[i] = Math.min.apply(null,src.slice(from,i+1));
    const delta = i ? src[i]-src[i-1] : 0;
    const range = hi[i]-lo[i];
    diff[i] = i && hi[i]>hi[i-1] ? range : i && lo[i]<lo[i-1] ? -range : delta;
    abs[i] = Math.abs(diff[i]);
  }
  const a = EMA_(diff,n), b = EMA_(abs,n);
  for (let i=0;i<src.length;i++) out[i] = a[i]==null || b[i]==null || b[i]===0 ? null : a[i]/b[i]*50+50;
  return out;
}

function colorNuvem_(rsi) {
  if (rsi == null) return 'SEM DADOS';
  if (rsi > 80) return 'AZUL';
  if (rsi > 60) return 'VERDE';
  if (rsi < 20) return 'AMARELA';
  if (rsi < 40) return 'VERMELHA';
  return 'BRANCA';
}

function updateNuvemSetup_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const out = [['Timeframe','Timestamp_UTC','Timestamp_BRT','Fechamento','HLC3','RSI_Ultimate','Cor_Candle','Nuvem_13d','Nuvem_49d','MA20','Acima_3_Medias','Abaixo_3_Medias','Sinal','Posicao','Regra_Periodos']];
  const summaries = [];
  [['BTC_4H','4h'],['BTC_1D','1d'],['BTC_1W','1w']].forEach(pair => {
    const sh = ss.getSheetByName(pair[0]), iv = pair[1], p = nuvemPeriods_(iv);
    if (!sh || sh.getLastRow()<2) { summaries.push({label:iv,state:'SEM DADOS',long:0,short:0}); return; }
    const raw = sh.getRange(2,1,sh.getLastRow()-1,6).getValues();
    const close = raw.map(r=>Number(r[5])), h3 = raw.map(r=>(Number(r[2])+Number(r[3])+Number(r[4]))/3);
    const rsi = rsiUltimate_(h3,20), ma13 = SMAarr_(h3,p.short), ma49 = SMAarr_(h3,p.long), ma20 = SMAarr_(h3,p.extra);
    let pos='FLAT', lastState='SEM DADOS', lastOut=null;
    for (let i=0;i<raw.length;i++) {
      const color = colorNuvem_(rsi[i]), bull=ma13[i]!=null&&ma49[i]!=null&&ma20[i]!=null&&close[i]>ma13[i]&&close[i]>ma49[i]&&close[i]>ma20[i], bear=ma13[i]!=null&&ma49[i]!=null&&ma20[i]!=null&&close[i]<ma13[i]&&close[i]<ma49[i]&&close[i]<ma20[i];
      let sig='';
      if (bull && color==='VERDE' && pos!=='LONG') { sig='COMPRA_NUVEM'; pos='LONG'; }
      else if (pos==='LONG' && color==='BRANCA') { sig='SAIDA_LONG_NUVEM'; pos='FLAT'; }
      else if (bear && color==='VERMELHA' && pos!=='SHORT') { sig='VENDA_NUVEM'; pos='SHORT'; }
      else if (pos==='SHORT' && color==='BRANCA') { sig='SAIDA_SHORT_NUVEM'; pos='FLAT'; }
      lastState = pos;
      lastOut=[iv,raw[i][0],raw[i][1],close[i],h3[i],rsi[i],color,ma13[i],ma49[i],ma20[i],bull,bear,sig,pos,p.label]; out.push(lastOut);
    }
    const last = lastOut || [iv,'','',null,null,null,'SEM DADOS',null,null,null,false,false,'','FLAT',p.label]; summaries.push({label:iv,state:last[13],long:last[13]==='LONG'?({ '4h':20,'1d':30,'1w':50}[iv]||0):0,short:last[13]==='SHORT'?({ '4h':20,'1d':30,'1w':50}[iv]||0):0,color:last[6],bull:last[10],bear:last[11]});
  });
  const sh = ss.getSheetByName('Setup_Nuvem_13_49_20') || ss.insertSheet('Setup_Nuvem_13_49_20');
  sh.clearContents(); sh.getRange(1,1,out.length,out[0].length).setValues(out); sh.setFrozenRows(1); sh.getRange(1,1,1,out[0].length).setFontWeight('bold').setBackground('#17365D').setFontColor('#FFFFFF'); sh.autoResizeColumns(1,out[0].length);
  PropertiesService.getScriptProperties().setProperty('NUVEM_SUMMARY', JSON.stringify(summaries));
}

function SMAarr_(a,n) { const o=Array(a.length).fill(null); for(let i=n-1;i<a.length;i++) o[i]=a.slice(i-n+1,i+1).reduce((x,y)=>x+y,0)/n; return o; }

function lastValidEmaRow_(sh) {
  if (!sh) return null;
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return null;
  const data = sh.getRange(2, 1, lastRow - 1, 24).getValues();
  for (let i = data.length - 1; i >= 0; i--) {
    const q = data[i];
    const validClose = q[5] !== '' && isFinite(Number(q[5]));
    const validEma = [q[12], q[13], q[14]].every(v => v !== '' && isFinite(Number(v)));
    if (validClose && validEma) return q;
  }
  return null;
}

function lastValidNuvemRow_(sh, label) {
  if (!sh) return null;
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return null;
  const data = sh.getRange(2, 1, lastRow - 1, 15).getValues();
  for (let i = data.length - 1; i >= 0; i--) {
    const q = data[i];
    const validLabel = String(q[0]).toLowerCase() === label.toLowerCase();
    const validClose = q[3] !== '' && isFinite(Number(q[3]));
    const validColor = ['VERDE','AZUL','BRANCA','VERMELHA','AMARELA'].indexOf(String(q[6])) >= 0;
    const validMAs = [q[7], q[8], q[9]].every(v => v !== '' && isFinite(Number(v)));
    if (validLabel && validClose && validColor && validMAs) return q;
  }
  return null;
}

function formatDataSheet_(sh, n) { sh.setFrozenRows(1); sh.getRange(1,1,1,HEADERS.length).setFontWeight('bold').setBackground('#17365D').setFontColor('#FFFFFF'); sh.getRange(2,3,Math.max(1,n-1),22).setNumberFormat('0.0000'); sh.autoResizeColumns(1,HEADERS.length); }
function SMA_(a,n){ return a.map((_,i)=>i<n-1?null:a.slice(i-n+1,i+1).reduce((x,y)=>x+y,0)/n); }
function EMA_(a,n){ const o=Array(a.length).fill(null); if(a.length<n)return o; o[n-1]=a.slice(0,n).reduce((x,y)=>x+y,0)/n; const k=2/(n+1); for(let i=n;i<a.length;i++)o[i]=a[i]*k+o[i-1]*(1-k); return o; }
function RSI_(a,n){ const o=Array(a.length).fill(null); if(a.length<=n)return o; let g=0,l=0; for(let i=1;i<=n;i++){const d=a[i]-a[i-1];g+=Math.max(d,0);l+=Math.max(-d,0);} g/=n;l/=n;o[n]=l===0?100:100-100/(1+g/l); for(let i=n+1;i<a.length;i++){const d=a[i]-a[i-1];g=(g*(n-1)+Math.max(d,0))/n;l=(l*(n-1)+Math.max(-d,0))/n;o[i]=l===0?100:100-100/(1+g/l);} return o; }
function ATR_(rows,n){ const tr=rows.map((r,i)=>i===0?r[3]-r[4]:Math.max(r[3]-r[4],Math.abs(r[3]-rows[i-1][5]),Math.abs(r[4]-rows[i-1][5]))); return EMA_(tr,n); }

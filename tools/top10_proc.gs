/* =============================================================================
 * 8. UNIVERSO — lista de ativos (aba UNIVERSO) e semente inicial
 *    Colunas: A Ordem | B Simbolo | C CoinGecko_ID | D Nome | E Rank_MC | F Tipo | G Status | H Fontes |
 *             I Fonte_OK | J Inicio_Historico | K N_Velas | L Ultima_Vela | M Ultima_Atualizacao | N Observacao
 *    Status: REFERENCIA (BTC) | ATIVO | EXCLUIDO. Fontes: "corretora:PAR,corretora:PAR" na ordem de preferência.
 * ===========================================================================*/
const COLS_UNIVERSO = ['Ordem', 'Simbolo', 'CoinGecko_ID', 'Nome', 'Rank_MC', 'Tipo', 'Status', 'Fontes', 'Fonte_OK', 'Inicio_Historico', 'N_Velas', 'Ultima_Vela', 'Ultima_Atualizacao', 'Observacao'];
const SEED_UNIVERSO = [
  [1, 'BTC', 'bitcoin', 'Bitcoin', 'CRIPTO', 'REFERENCIA', 'coinbase:BTC-USD,okx:BTC-USDT,kraken:XBTUSD,binance:BTCUSDT', 'Referência: o mesmo motor roda no BTC para comparação com o Projeto 02. Binance e Bybit bloqueiam o Apps Script (HTTP 403): ficam por último'],
  [2, 'ETH', 'ethereum', 'Ethereum', 'CRIPTO', 'ATIVO', 'kucoin:ETH-USDT,bitfinex:ETHUSD,okx:ETH-USDT,mexc:ETHUSDT,gate:ETH_USDT,coinbase:ETH-USD,kraken:ETHUSD,binance:ETHUSDT,bybit:ETHUSDT', ''],
  [3, 'USDT', 'tether', 'Tether', 'STABLECOIN', 'EXCLUIDO', '', 'Stablecoin: não há tendência para testar'],
  [4, 'BNB', 'binancecoin', 'BNB', 'CRIPTO', 'ATIVO', 'kucoin:BNB-USDT,okx:BNB-USDT,mexc:BNBUSDT,gate:BNB_USDT,binance:BNBUSDT,bybit:BNBUSDT', 'Não está na Coinbase nem na Kraken'],
  [5, 'XRP', 'ripple', 'XRP', 'CRIPTO', 'ATIVO', 'kucoin:XRP-USDT,bitfinex:XRPUSD,okx:XRP-USDT,mexc:XRPUSDT,gate:XRP_USDT,coinbase:XRP-USD,kraken:XRPUSD,binance:XRPUSDT,bybit:XRPUSDT', ''],
  [6, 'USDC', 'usd-coin', 'USDC', 'STABLECOIN', 'EXCLUIDO', '', 'Stablecoin: não há tendência para testar'],
  [7, 'SOL', 'solana', 'Solana', 'CRIPTO', 'ATIVO', 'kucoin:SOL-USDT,bitfinex:SOLUSD,okx:SOL-USDT,mexc:SOLUSDT,gate:SOL_USDT,coinbase:SOL-USD,kraken:SOLUSD,binance:SOLUSDT,bybit:SOLUSDT', 'Histórico desde 2020'],
  [8, 'TRX', 'tron', 'TRON', 'CRIPTO', 'ATIVO', 'kucoin:TRX-USDT,bitfinex:TRXUSD,okx:TRX-USDT,mexc:TRXUSDT,gate:TRX_USDT,kraken:TRXUSD,binance:TRXUSDT,bybit:TRXUSDT', ''],
  [9, 'FIGR_HELOC', 'figure-heloc', 'Figure Heloc', 'RWA', 'EXCLUIDO', '', 'Empréstimo tokenizado cotado perto de US$ 1: não é um ativo de tendência'],
  [10, 'ZEC', 'zcash', 'Zcash', 'CRIPTO', 'ATIVO', 'kucoin:ZEC-USDT,bitfinex:ZECUSD,okx:ZEC-USDT,mexc:ZECUSDT,gate:ZEC_USDT,coinbase:ZEC-USD,kraken:ZECUSD,binance:ZECUSDT,bybit:ZECUSDT', ''],
  [11, 'HYPE', 'hyperliquid', 'Hyperliquid', 'CRIPTO', 'ATIVO', 'kucoin:HYPE-USDT,gate:HYPE_USDT,mexc:HYPEUSDT,bitfinex:HYPE:USD,okx:HYPE-USDT,bybit:HYPEUSDT,binance:HYPEUSDT', 'Histórico curto: consenso só com 500+ velas; a carga completa escolhe a fonte com mais histórico'],
  [12, 'DOGE', 'dogecoin', 'Dogecoin', 'CRIPTO', 'ATIVO', 'kucoin:DOGE-USDT,bitfinex:DOGE:USD,okx:DOGE-USDT,mexc:DOGEUSDT,gate:DOGE_USDT,coinbase:DOGE-USD,kraken:XDGUSD,binance:DOGEUSDT,bybit:DOGEUSDT', ''],
  [13, 'LINK', 'chainlink', 'Chainlink', 'CRIPTO', 'ATIVO', 'kucoin:LINK-USDT,bitfinex:LINK:USD,okx:LINK-USDT,mexc:LINKUSDT,gate:LINK_USDT,coinbase:LINK-USD,kraken:LINKUSD,binance:LINKUSDT,bybit:LINKUSDT', 'MANUAL: escolha do usuário (fora da janela #2 a #13 do ranking)'],
  [14, 'AAVE', 'aave', 'Aave', 'CRIPTO', 'ATIVO', 'kucoin:AAVE-USDT,bitfinex:AAVE:USD,okx:AAVE-USDT,mexc:AAVEUSDT,gate:AAVE_USDT,coinbase:AAVE-USD,kraken:AAVEUSD,binance:AAVEUSDT,bybit:AAVEUSDT', 'MANUAL: escolha do usuário (fora da janela #2 a #13 do ranking). Histórico desde out/2020'],
  [15, 'XMR', 'monero', 'Monero', 'CRIPTO', 'EXCLUIDO', 'bitfinex:XMRUSD,kucoin:XMR-USDT,kraken:XMRUSD', 'Retirada por decisão do usuário (substituída por LINK e AAVE)'],
  [16, 'USDS', 'usds', 'USDS', 'STABLECOIN', 'EXCLUIDO', '', 'Stablecoin'],
];

function universo_() {
  const sh = ss_().getSheetByName(P2.ABAS.universo), out = [];
  if (!sh || sh.getLastRow() < 2) return out;
  sh.getRange(2, 1, sh.getLastRow() - 1, COLS_UNIVERSO.length).getValues().forEach(function (r, i) {
    if (!r[1]) return;
    out.push({ row: i + 2, ordem: r[0], sym: String(r[1]).trim(), geckoId: String(r[2]).trim(), nome: r[3], rank: r[4], tipo: r[5], status: String(r[6]).trim().toUpperCase(),
      fontes: r[7], fonteOk: String(r[8] || '').trim(), inicio: r[9], nVelas: r[10], ultimaVela: r[11] instanceof Date ? Utilities.formatDate(r[11], 'UTC', 'yyyy-MM-dd') : String(r[11] || ''), obs: r[13] });
  });
  return out;
}
function ativosUniverso_() { return universo_().filter(function (u) { return u.status === 'ATIVO' || u.status === 'REFERENCIA'; }); }
function gravarLinhaUniverso_(u, fonteOk, o) {
  const n = o.closes.length, fmt = function (d) { return Utilities.formatDate(d, 'UTC', 'yyyy-MM-dd'); };
  ss_().getSheetByName(P2.ABAS.universo).getRange(u.row, 9, 1, 5).setValues([[fonteOk || u.fonteOk, n ? fmt(o.dates[0]) : '', n, n ? fmt(o.dates[n - 1]) : '',
    Utilities.formatDate(new Date(), P2.TZ_BRT, 'dd/MM/yyyy HH:mm')]]);
}

/* =============================================================================
 * 9. PROCESSAMENTO POR ATIVO — mesmo motor do BTC + métricas de desempenho
 * ===========================================================================*/
function guardarRes_(sym, obj) { PropertiesService.getScriptProperties().setProperty('RES_' + sym, JSON.stringify(obj)); }
function lerRes_(sym) {
  const s = PropertiesService.getScriptProperties().getProperty('RES_' + sym);
  try { return s ? JSON.parse(s) : null; } catch (e) { return null; }
}

/** Desempenho de uma curva de equity (ou de preços) a partir da barra ini, já depois do aquecimento das médias. */
function metricasJanela_(eq, ini) { return metricasFaixa_(eq, ini, eq.length); }
function metricasRet_(r, dd, final) {
  const yrs = r.length / 365.25, cagr = final > 0 ? (Math.pow(final, 1 / yrs) - 1) * 100 : -100;
  const mu = r.reduce(function (a, b) { return a + b; }, 0) / r.length;
  const sd = Math.sqrt(r.reduce(function (a, b) { return a + (b - mu) * (b - mu); }, 0) / r.length);
  return { cagr: r_(cagr, 1), dd: r_(dd, 1), sharpe: r_(sd > 0 ? mu / sd * Math.sqrt(365) : 0, 2), calmar: r_(dd > 0 ? cagr / dd : 0, 2), anos: r_(yrs, 1) };
}
/** Painel das 10 em peso igual no intervalo [a, b): média dos retornos diários das curvas de equity das estratégias. */
function metricasPainel_(res, a, b) {
  const curvas = res.filter(function (x) { return x.eqCurve && !x.erro && x.ativa !== false; }).map(function (x) { return x.eqCurve; });
  if (!curvas.length) return null;
  b = b || curvas[0].length; if (b - a < 90) return null;
  const r = []; let v = 1, peak = 1, dd = 0;
  for (let i = a + 1; i < b; i++) {
    let s = 0; curvas.forEach(function (c) { s += c[i] / c[i - 1] - 1; });
    const x = s / curvas.length; r.push(x); v *= (1 + x); if (v > peak) peak = v; dd = Math.max(dd, (peak - v) / peak * 100);
  }
  return metricasRet_(r, dd, v);
}

/** Roda uma lista de candidatos sobre a série (mesmo motor para todos). */
function rodarLista_(o, lista) {
  return lista.map(function (e) {
    let r;
    try { r = runBacktest_(o, e.fn(o)); } catch (err) { r = { erro: err.message, posAtual: 0 }; }
    r.id = e.id; r.key = e.key || e.id; r.nome = e.nome; r.ativa = true; r.grupo = e.grupo || 'Seleção'; r.fam = e.fam; r.ind = e.ind || classeInd_(e.nome);
    return r;
  });
}

/** Recompõe as definições dos candidatos escolhidos (só gera as grades se algum ID delas foi escolhido). */
function defsPorId_(ids) {
  const mapa = {}; POOL.forEach(function (e) { mapa[e.id] = e; });
  if (ids.some(function (id) { return id.indexOf('X-') === 0; })) gerarPoolAmpliado_().forEach(function (e) { mapa[e.id] = e; });
  if (ids.some(function (id) { return id.indexOf('Y-') === 0; })) gerarPoolEstendido_().forEach(function (e) { mapa[e.id] = e; });
  if (ids.some(function (id) { return id.indexOf('Z-P-') === 0; })) gerarPoolPadroes_().forEach(function (e) { mapa[e.id] = e; });
  if (ids.some(function (id) { return id.indexOf('Z-K-') === 0; })) gerarPoolNovasClasses_().forEach(function (e) { mapa[e.id] = e; });
  if (ids.some(function (id) { return id.indexOf('Z-N-') === 0; })) gerarPoolFino_().forEach(function (e) { mapa[e.id] = e; });
  if (ids.some(function (id) { return id.indexOf('Z-') === 0; })) gerarPoolMassivo_().concat(gerarPoolReversao_()).forEach(function (e) { mapa[e.id] = e; });
  return ids.map(function (id) { return mapa[id]; }).filter(Boolean);
}

/** Mínimo de velas do ativo: MIN_VELAS_POR_ATIVO (SIMBOLO:VELAS) ou, na falta, MIN_VELAS_CONSENSO. */
function minVelas_(sym) {
  const m = {}; String(cfg_('MIN_VELAS_POR_ATIVO') || '').split(',').forEach(function (x) { const p = x.split(':'); if (p.length === 2 && parseInt(p[1], 10) > 0) m[p[0].trim().toUpperCase()] = parseInt(p[1], 10); });
  return m[String(sym).toUpperCase()] || cfgNum_('MIN_VELAS_CONSENSO');
}

function todosDefs_() { return POOL.concat(gerarPoolAmpliado_(), gerarPoolEstendido_(), gerarPoolMassivo_(), gerarPoolReversao_(), gerarPoolFino_(), gerarPoolNovasClasses_(), gerarPoolPadroes_()); }

function processarAtivo_(u, forcar) {
  const prev = lerRes_(u.sym), ontemStr = Utilities.formatDate(new Date(ontemUtcMs_()), 'UTC', 'yyyy-MM-dd');
  const pend = pendentesSel_(), pendente = pend.indexOf(u.sym) >= 0 || pendentesHist_().indexOf(u.sym) >= 0;
  if (!forcar && !pendente && prev && prev.estado === 'OK' && u.ultimaVela >= ontemStr) return { resumo: prev, eventos: [], pulou: true };
  const b = atualizarBase_(u), o = aparaInicio_(b.ohlcv), n = o.closes.length;
  gravarLinhaUniverso_(u, b.fonte, o);
  const base = { sym: u.sym, ordem: u.ordem, nome: u.nome, status: u.status, fonte: b.fonte || u.fonteOk, n: n, atualizado: new Date().toISOString() };
  if (n < minVelas_(u.sym)) {
    const res0 = Object.assign(base, { estado: 'HISTORICO_INSUFICIENTE', ultimaVela: n ? Utilities.formatDate(o.dates[n - 1], 'UTC', 'yyyy-MM-dd') : '', preco: n ? o.closes[n - 1] : null });
    guardarRes_(u.sym, res0); return { resumo: res0, eventos: [] };
  }
  if (u.status !== 'REFERENCIA') o.btcC = alinharBtc_(o, lerBase_('BTC'));
  const hoje = Utilities.formatDate(new Date(), 'UTC', 'yyyy-MM-dd');
  const fixas = u.status === 'REFERENCIA' || !cfgSim_('SELECAO_ATIVA');
  let sel = null, res, cutStr, w0Str, dataSel = '';
  if (fixas) {
    // BTC: as 10 fixas do Projeto 02; a que ficar abaixo dos mínimos de Sharpe sai e é substituída pela melhor candidata que cumpre a régua
    const fx = rodarLista_(o, FIXAS_BTC), hist = cfgNum_('SELECAO_HISTERESE'), min = cfgNum_('SELECAO_SHARPE_MIN');
    const cumpre = function (r) { return !r.erro && r.eqCurve && nivelSharpe_(r.eqCurve, n).full >= min - hist && cumprePermanencia_(r.eqCurve, n, hist).ok; };
    const okFx = fx.filter(cumpre), fora = fx.filter(function (r) { return !cumpre(r); });
    cutStr = '2023-06-02'; w0Str = dataStr_(o.dates[Math.min(200, n - 150)]); dataSel = 'fixas (Projeto 02)';
    if (fora.length && cfgSim_('SELECAO_BTC_SUBSTITUI')) {
      const sig = fora.map(function (r) { return r.id; }).join(','), pBtc = pend.indexOf('BTC') >= 0;
      let sb = lerSel_('BTC');
      if (!sb || sb.sig !== sig || pBtc || idadeDias_(sb.data) >= cfgNum_('SELECAO_REFRESH_DIAS')) {
        const s = selecionar_(o, todosDefs_(), { mantidas: okFx, alvo: FIXAS_BTC.length }), rel = {};
        const motivo = fora.map(function (r) { const nv = r.eqCurve ? nivelSharpe_(r.eqCurve, n) : { full: null, s24: null, s12: null }; return r.id + ' (Sharpe histórico ' + r_(nv.full, 2) + ', 24m ' + r_(nv.s24, 2) + ', 12m ' + r_(nv.s12, 2) + ')'; });
        s.ids.forEach(function (id, k) { rel[id] = 'substitui ' + motivo[k % motivo.length]; });
        s.rel = Object.assign(s.rel || {}, rel); s.sig = sig;
        guardarSel_('BTC', s, hoje); gravarSelecaoCandidatos_('BTC', s, hoje); sb = lerSel_('BTC');
        res = okFx.concat(s.ids.map(function (id) { return s.detalhe.filter(function (d) { return d.id === id; })[0].r; }));
        if (pBtc) setPendentesSel_(pend.filter(function (x) { return x !== 'BTC'; }));
      } else res = okFx.concat(rodarLista_(o, defsPorId_(sb.ids)));
      sel = sb; dataSel = 'fixas + ' + (sb.ids.length) + ' substituta(s)';
    } else res = fx;
  } else {
    sel = lerSel_(u.sym);
    const fazer = function () {
      const s = selecionar_(o, todosDefs_());
      guardarSel_(u.sym, s, hoje); gravarSelecaoCandidatos_(u.sym, s, hoje);
      sel = lerSel_(u.sym);
      res = s.ids.map(function (id) { return s.detalhe.filter(function (d) { return d.id === id; })[0].r; });
      if (pendente) setPendentesSel_(pend.filter(function (x) { return x !== u.sym; }));
    };
    const idade = sel ? idadeDias_(sel.data) : 1e9;
    if (!sel || pendente || idade >= cfgNum_('SELECAO_REFRESH_DIAS') || (idade >= cfgNum_('SELECAO_REVISAO_DIAS') && (sel.vagas > 0 || sel.naoPlenas > 0))) fazer();
    else res = rodarLista_(o, defsPorId_(sel.ids));
    cutStr = sel.corte; w0Str = sel.w0; dataSel = sel.data;
  }
  if (res.length < Math.min(cfgNum_('SELECAO_MIN_PARA_MEDIR'), fixas ? FIXAS_BTC.length : cfgNum_('SELECAO_N_ESTRATEGIAS'))) {   // moeda com menos estratégias aceitas que o mínimo: não é analisada
    const res1 = Object.assign(base, { estado: 'SEM_ESTRATEGIA_ELEGIVEL', achadas: res.length, vagas: sel ? sel.vagas : 10, ultimaVela: Utilities.formatDate(o.dates[n - 1], 'UTC', 'yyyy-MM-dd'), preco: o.closes[n - 1] });
    guardarRes_(u.sym, res1); return { resumo: res1, eventos: [] };
  }
  res.forEach(function (r) {
    if (r.erro || !r.eqCurve) return;
    r.perm = cumprePermanencia_(r.eqCurve, n);
    if (fixas && !cumprePermanencia_(r.eqCurve, n, cfgNum_('SELECAO_HISTERESE')).ok) r.ativa = false;   // BTC: estratégia fora do mínimo sai do consenso (continua visível na tabela como FORA DA REGRA)
  });
  const I = calcularIndicadores_(o), cons = consenso_(res), termo = termometro_(o, I, null);
  const w0 = idxData_(o, w0Str), cut = idxData_(o, cutStr), ini = Math.min(n - 91, cfgNum_('JANELA_INICIO_BARRAS')), C = o.closes, L = n - 1;
  const iSel = sel ? idxData_(o, sel.data) : -1;
  const somaPeso = res.reduce(function (a, r) { return a + (r.ativa && !r.erro ? r.peso || 0 : 0); }, 0);
  const estr = res.map(function (r, k) {
    const m = r.eqCurve ? metricasJanela_(r.eqCurve, ini) : null, mi = r.eqCurve ? metricasFaixa_(r.eqCurve, w0, cut) : null, mo = r.eqCurve ? metricasFaixa_(r.eqCurve, cut, n) : null;
    const fw = r.eqCurve && iSel > 0 ? metricasFaixa_(r.eqCurve, iSel, n) : null;
    return { id: r.id, fam: r.fam || '', ind: r.ind || '', nome: r.nome, slot: k + 1, pos: r.posAtual, evento: r.evento || (r.erro ? 'ERRO' : ''), pe: r.precoEntrada ? r_(r.precoEntrada, 6) : null, stop: r.stopAtual ? r_(r.stopAtual, 6) : null,
      la: r_(r.lucroAbertoPct || 0), lacum: r_(r.lucroAcumPct || 0), nt: r.nTrades || 0, win: r.winRate === null || r.winRate === undefined ? null : r_(r.winRate, 1),
      sh3: r_(r.sharpe || 0, 2), peso: somaPeso > 0 ? r_((r.peso || 0) / somaPeso * 100, 1) : 0, cagr: m ? m.cagr : null, dd: m ? m.dd : null, calmar: m ? m.calmar : null,
      sh12: r.perm && r.perm.s12 !== null ? r_(r.perm.s12, 2) : null, sh24: r.perm && r.perm.s24 !== null ? r_(r.perm.s24, 2) : null, shH: r.eqCurve ? r_(nivelSharpe_(r.eqCurve, n).full, 2) : null, fora: r.ativa === false, nivel: r.eqCurve ? nivelSharpe_(r.eqCurve, n).nivel : '', rel: sel && sel.rel && sel.rel[r.id] ? sel.rel[r.id] : '', isSh: mi ? mi.sharpe : null, isCa: mi ? mi.calmar : null, isTr: r.eqCurve ? contarTrades_(r, w0, cut) : null,
      oosSh: mo ? mo.sharpe : null, oosCa: mo ? mo.calmar : null, oosCagr: mo ? mo.cagr : null, oosDd: mo ? mo.dd : null, fwCagr: fw ? fw.cagr : null, fwDd: fw ? fw.dd : null };
  });
  const bhEq = C;
  let eventos = detectarEventos_(o, I, res, null).map(function (e) { e.sym = u.sym; return e; });
  // alertas: sem e-mail na primeira leitura da moeda (não há "mudança" a comunicar) e, fora do BTC, o consenso só alerta quando a leitura muda de faixa
  if (!prev || prev.estado !== 'OK') eventos = [];
  else if (!fixas) { const mudou = prev.leitura !== cons.leitura; eventos = eventos.filter(function (e) { return !/^CONSENSO_/.test(e.tipo) || mudou; }); }
  const out = Object.assign(base, {
    estado: 'OK', ultimaVela: Utilities.formatDate(o.dates[L], 'UTC', 'yyyy-MM-dd'), preco: C[L],
    v1: r_((C[L] / C[L - 1] - 1) * 100, 2), v7: r_((C[L] / C[L - 7] - 1) * 100, 2), v30: r_((C[L] / C[L - 30] - 1) * 100, 2),
    sma200: r_(I.SMA200[L], 6), acima200: C[L] > I.SMA200[L], idx: r_(cons.pct, 1), leitura: cons.leitura, comprados: cons.comprados, nEstr: cons.n, modo: cons.modo,
    estic: termo.valor, faixa: termo.faixa, acao: termo.acao, regime: termo.regime, cobertura: termo.cobertura,
    painel: metricasPainel_(res, ini), painelIS: metricasPainel_(res, w0, cut), painelOOS: metricasPainel_(res, cut, n),
    bh: metricasJanela_(bhEq, ini), bhIS: metricasFaixa_(bhEq, w0, cut), bhOOS: metricasFaixa_(bhEq, cut, n),
    selData: dataSel, w0: w0Str, corte: cutStr, fixas: fixas, parcial: sel ? !!sel.parcial : false, vagas: sel ? (sel.vagas || 0) : 0, naoPlenas: sel ? (sel.naoPlenas || 0) : 0, nTest: sel ? sel.nTest : null, nElig: sel ? sel.nElig : null, estr: estr, carga: b.carga,
  });
  guardarRes_(u.sym, out);
  return { resumo: out, eventos: eventos };
}

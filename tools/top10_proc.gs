/* =============================================================================
 * 8. UNIVERSO — lista de ativos (aba UNIVERSO) e semente inicial
 *    Colunas: A Ordem | B Simbolo | C CoinGecko_ID | D Nome | E Rank_MC | F Tipo | G Status | H Fontes |
 *             I Fonte_OK | J Inicio_Historico | K N_Velas | L Ultima_Vela | M Ultima_Atualizacao | N Observacao
 *    Status: REFERENCIA (BTC) | ATIVO | EXCLUIDO. Fontes: "corretora:PAR,corretora:PAR" na ordem de preferência.
 * ===========================================================================*/
const COLS_UNIVERSO = ['Ordem', 'Simbolo', 'CoinGecko_ID', 'Nome', 'Rank_MC', 'Tipo', 'Status', 'Fontes', 'Fonte_OK', 'Inicio_Historico', 'N_Velas', 'Ultima_Vela', 'Ultima_Atualizacao', 'Observacao'];
const SEED_UNIVERSO = [
  [1, 'BTC', 'bitcoin', 'Bitcoin', 'CRIPTO', 'REFERENCIA', 'coinbase:BTC-USD,binance:BTCUSDT,okx:BTC-USDT,kraken:XBTUSD', 'Referência: o mesmo motor roda no BTC para comparação com o Projeto 02'],
  [2, 'ETH', 'ethereum', 'Ethereum', 'CRIPTO', 'ATIVO', 'binance:ETHUSDT,coinbase:ETH-USD,okx:ETH-USDT,kucoin:ETH-USDT,kraken:ETHUSD', ''],
  [3, 'USDT', 'tether', 'Tether', 'STABLECOIN', 'EXCLUIDO', '', 'Stablecoin: não há tendência para testar'],
  [4, 'BNB', 'binancecoin', 'BNB', 'CRIPTO', 'ATIVO', 'binance:BNBUSDT,okx:BNB-USDT,kucoin:BNB-USDT,bybit:BNBUSDT', 'Não está na Coinbase nem na Kraken'],
  [5, 'XRP', 'ripple', 'XRP', 'CRIPTO', 'ATIVO', 'binance:XRPUSDT,coinbase:XRP-USD,okx:XRP-USDT,kucoin:XRP-USDT,kraken:XRPUSD', ''],
  [6, 'USDC', 'usd-coin', 'USDC', 'STABLECOIN', 'EXCLUIDO', '', 'Stablecoin: não há tendência para testar'],
  [7, 'SOL', 'solana', 'Solana', 'CRIPTO', 'ATIVO', 'binance:SOLUSDT,coinbase:SOL-USD,okx:SOL-USDT,kucoin:SOL-USDT,kraken:SOLUSD', 'Histórico desde 2020'],
  [8, 'TRX', 'tron', 'TRON', 'CRIPTO', 'ATIVO', 'binance:TRXUSDT,okx:TRX-USDT,kucoin:TRX-USDT,kraken:TRXUSD', ''],
  [9, 'FIGR_HELOC', 'figure-heloc', 'Figure Heloc', 'RWA', 'EXCLUIDO', '', 'Empréstimo tokenizado cotado perto de US$ 1: não é um ativo de tendência'],
  [10, 'ZEC', 'zcash', 'Zcash', 'CRIPTO', 'ATIVO', 'binance:ZECUSDT,coinbase:ZEC-USD,okx:ZEC-USDT,kucoin:ZEC-USDT,kraken:ZECUSD,bitfinex:ZECUSD', ''],
  [11, 'HYPE', 'hyperliquid', 'Hyperliquid', 'CRIPTO', 'ATIVO', 'okx:HYPE-USDT,bybit:HYPEUSDT,kucoin:HYPE-USDT,binance:HYPEUSDT', 'Histórico curto (desde o fim de 2024): consenso só com 450+ velas'],
  [12, 'DOGE', 'dogecoin', 'Dogecoin', 'CRIPTO', 'ATIVO', 'binance:DOGEUSDT,coinbase:DOGE-USD,okx:DOGE-USDT,kucoin:DOGE-USDT,kraken:XDGUSD', ''],
  [13, 'LINK', 'chainlink', 'Chainlink', 'CRIPTO', 'ATIVO', 'binance:LINKUSDT,coinbase:LINK-USD,okx:LINK-USDT,kucoin:LINK-USDT,kraken:LINKUSD,bitfinex:LINK:USD', 'MANUAL: escolha do usuário (fora da janela #2 a #13 do ranking)'],
  [14, 'AAVE', 'aave', 'Aave', 'CRIPTO', 'ATIVO', 'binance:AAVEUSDT,coinbase:AAVE-USD,okx:AAVE-USDT,kucoin:AAVE-USDT,kraken:AAVEUSD,bitfinex:AAVE:USD', 'MANUAL: escolha do usuário (fora da janela #2 a #13 do ranking). Histórico desde out/2020'],
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
  const curvas = res.filter(function (x) { return x.eqCurve && !x.erro; }).map(function (x) { return x.eqCurve; });
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
    r.id = e.id; r.key = e.key || e.id; r.nome = e.nome; r.ativa = true; r.grupo = e.grupo || 'Seleção'; r.fam = e.fam;
    return r;
  });
}

/** Recompõe, só se a seleção usou a fase ampliada, os candidatos da grade (IDs começam com X-). */
function gerarPoolAmpliadoSeNecessario_(sel) {
  return sel.ids.some(function (id) { return id.indexOf('X-') === 0; }) ? gerarPoolAmpliado_() : [];
}

function processarAtivo_(u, forcar) {
  const prev = lerRes_(u.sym), ontemStr = Utilities.formatDate(new Date(ontemUtcMs_()), 'UTC', 'yyyy-MM-dd');
  const pend = pendentesSel_(), pendente = pend.indexOf(u.sym) >= 0;
  if (!forcar && !pendente && prev && prev.estado === 'OK' && u.ultimaVela >= ontemStr) return { resumo: prev, eventos: [], pulou: true };
  const b = atualizarBase_(u), o = b.ohlcv, n = o.closes.length;
  gravarLinhaUniverso_(u, b.fonte, o);
  const base = { sym: u.sym, ordem: u.ordem, nome: u.nome, status: u.status, fonte: b.fonte || u.fonteOk, n: n, atualizado: new Date().toISOString() };
  if (n < cfgNum_('MIN_VELAS_CONSENSO')) {
    const res0 = Object.assign(base, { estado: 'HISTORICO_INSUFICIENTE', ultimaVela: n ? Utilities.formatDate(o.dates[n - 1], 'UTC', 'yyyy-MM-dd') : '', preco: n ? o.closes[n - 1] : null });
    guardarRes_(u.sym, res0); return { resumo: res0, eventos: [] };
  }
  const hoje = Utilities.formatDate(new Date(), 'UTC', 'yyyy-MM-dd');
  const fixas = u.status === 'REFERENCIA' || !cfgSim_('SELECAO_ATIVA');
  let sel = null, res, cutStr, w0Str, dataSel = '';
  if (fixas) {
    res = rodarLista_(o, FIXAS_BTC); cutStr = '2023-06-02'; w0Str = dataStr_(o.dates[Math.min(200, n - 150)]); dataSel = 'fixas (Projeto 02)';
  } else {
    sel = lerSel_(u.sym);
    const shMin = cfgNum_('SELECAO_SHARPE_MIN');
    const fazer = function () {
      const pool = rodarLista_(o, POOL), s = selecionar_(o, pool, function () { return rodarLista_(o, gerarPoolAmpliado_()); });
      guardarSel_(u.sym, s, hoje); gravarSelecaoCandidatos_(u.sym, s, hoje);
      sel = lerSel_(u.sym);
      res = s.ids.map(function (id) { return s.detalhe.filter(function (d) { return d.id === id; })[0].r; });
      if (pendente) setPendentesSel_(pend.filter(function (x) { return x !== u.sym; }));
    };
    if (!sel || pendente || idadeDias_(sel.data) >= cfgNum_('SELECAO_REFRESH_DIAS')) fazer();
    else {
      const lista = sel.ids.map(function (id) { return POOL.concat(gerarPoolAmpliadoSeNecessario_(sel)).filter(function (e) { return e.id === id; })[0]; }).filter(Boolean);
      res = rodarLista_(o, lista);
      // permanência: estratégia cujo Sharpe de 3 anos cai abaixo do mínimo sai da tabela (revisão no máximo a cada SELECAO_REVISAO_DIAS)
      const caiu = res.filter(function (r) { return !r.erro && r.sharpe < shMin; }).length;
      if ((caiu || sel.vagas > 0) && idadeDias_(sel.data) >= cfgNum_('SELECAO_REVISAO_DIAS')) fazer();
    }
    cutStr = sel.corte; w0Str = sel.w0; dataSel = sel.data;
  }
  if (!res.length) {
    const res1 = Object.assign(base, { estado: 'SEM_ESTRATEGIA_ELEGIVEL', vagas: sel ? sel.vagas : 10, fase: sel ? sel.fase : '', ultimaVela: Utilities.formatDate(o.dates[n - 1], 'UTC', 'yyyy-MM-dd'), preco: o.closes[n - 1] });
    guardarRes_(u.sym, res1); return { resumo: res1, eventos: [] };
  }
  const I = calcularIndicadores_(o), cons = consenso_(res), termo = termometro_(o, I, null);
  const w0 = idxData_(o, w0Str), cut = idxData_(o, cutStr), ini = Math.min(n - 91, cfgNum_('JANELA_INICIO_BARRAS')), C = o.closes, L = n - 1;
  const iSel = sel ? idxData_(o, sel.data) : -1;
  const somaPeso = res.reduce(function (a, r) { return a + (r.ativa && !r.erro ? r.peso || 0 : 0); }, 0);
  const estr = res.map(function (r, k) {
    const m = r.eqCurve ? metricasJanela_(r.eqCurve, ini) : null, mi = r.eqCurve ? metricasFaixa_(r.eqCurve, w0, cut) : null, mo = r.eqCurve ? metricasFaixa_(r.eqCurve, cut, n) : null;
    const fw = r.eqCurve && iSel > 0 ? metricasFaixa_(r.eqCurve, iSel, n) : null;
    return { id: r.id, fam: r.fam || '', nome: r.nome, slot: k + 1, pos: r.posAtual, evento: r.evento || (r.erro ? 'ERRO' : ''), pe: r.precoEntrada ? r_(r.precoEntrada, 6) : null, stop: r.stopAtual ? r_(r.stopAtual, 6) : null,
      la: r_(r.lucroAbertoPct || 0), lacum: r_(r.lucroAcumPct || 0), nt: r.nTrades || 0, win: r.winRate === null || r.winRate === undefined ? null : r_(r.winRate, 1),
      sh3: r_(r.sharpe || 0, 2), peso: somaPeso > 0 ? r_((r.peso || 0) / somaPeso * 100, 1) : 0, cagr: m ? m.cagr : null, dd: m ? m.dd : null, calmar: m ? m.calmar : null,
      isSh: mi ? mi.sharpe : null, isCa: mi ? mi.calmar : null, isTr: r.eqCurve ? contarTrades_(r, w0, cut) : null,
      oosSh: mo ? mo.sharpe : null, oosCa: mo ? mo.calmar : null, oosCagr: mo ? mo.cagr : null, oosDd: mo ? mo.dd : null, fwCagr: fw ? fw.cagr : null, fwDd: fw ? fw.dd : null };
  });
  const bhEq = C, eventos = detectarEventos_(o, I, res, null).map(function (e) { e.sym = u.sym; return e; });
  const out = Object.assign(base, {
    estado: 'OK', ultimaVela: Utilities.formatDate(o.dates[L], 'UTC', 'yyyy-MM-dd'), preco: C[L],
    v1: r_((C[L] / C[L - 1] - 1) * 100, 2), v7: r_((C[L] / C[L - 7] - 1) * 100, 2), v30: r_((C[L] / C[L - 30] - 1) * 100, 2),
    sma200: r_(I.SMA200[L], 6), acima200: C[L] > I.SMA200[L], idx: r_(cons.pct, 1), leitura: cons.leitura, comprados: cons.comprados, nEstr: cons.n, modo: cons.modo,
    estic: termo.valor, faixa: termo.faixa, acao: termo.acao, regime: termo.regime, cobertura: termo.cobertura,
    painel: metricasPainel_(res, ini), painelIS: metricasPainel_(res, w0, cut), painelOOS: metricasPainel_(res, cut, n),
    bh: metricasJanela_(bhEq, ini), bhIS: metricasFaixa_(bhEq, w0, cut), bhOOS: metricasFaixa_(bhEq, cut, n),
    selData: dataSel, w0: w0Str, corte: cutStr, fixas: fixas, parcial: sel ? !!sel.parcial : false, vagas: sel ? (sel.vagas || 0) : 0, fase: sel ? sel.fase : '', nTest: sel ? sel.nTest : null, nElig: sel ? sel.nElig : null, estr: estr, carga: b.carga,
  });
  guardarRes_(u.sym, out);
  return { resumo: out, eventos: eventos };
}

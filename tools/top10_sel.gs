/* =============================================================================
 * 2B. SELEÇÃO DAS 10 MELHORES ESTRATÉGIAS DE CADA MOEDA
 *
 * Princípio: escolher entre muitos candidatos contamina a medida (quem escolhe o melhor de 46 sempre vê um número
 * bonito, parte dele sorte). Por isso:
 *  1. A nota de cada candidato usa SOMENTE o período de seleção (IS = primeiros 70% do histórico, após o aquecimento
 *     das médias). O restante (OOS = últimos 30%) NUNCA entra na nota; ele serve para medir a decaída real.
 *  2. Elegível: Sharpe IS >= SELECAO_SHARPE_MIN (1,00) E Sharpe de 3 anos (o mostrado na tabela) >= 1,00, drawdown IS <=
 *     SELECAO_DD_MAX e trades mínimos no IS. Nenhuma vaga é preenchida com candidato abaixo disso (vaga fica ABERTA).
 *     Se faltarem estratégias, entra a BUSCA AMPLIADA (grade de ~300 parâmetros) e a escolha é refeita.
 *  3. Nota = média dos percentis de Sharpe IS e Calmar IS entre os elegíveis.
 *  4. Diversificação gulosa pela ordem da nota: no máximo SELECAO_MAX_POR_FAMILIA por família e correlação dos
 *     retornos diários no IS menor que SELECAO_CORR_MAX com as já escolhidas (evita 10 versões da mesma média móvel).
 *  5. A escolha fica congelada e só muda a cada SELECAO_REFRESH_DIAS ou pelo menu S. Entre reseleções, o desempenho
 *     "desde a seleção" é evidência genuinamente futura.
 * ===========================================================================*/
function dataStr_(d) { return Utilities.formatDate(d, 'UTC', 'yyyy-MM-dd'); }
function idxData_(o, str) { for (let i = 0; i < o.dates.length; i++) if (dataStr_(o.dates[i]) >= str) return i; return o.dates.length; }

/** Desempenho da curva de equity no intervalo de barras [a, b): base na barra a. */
function metricasFaixa_(eq, a, b) {
  if (!(b - a >= 90) || !(eq[a] > 0)) return null;
  const e0 = eq[a], r = []; let peak = 1, dd = 0;
  for (let i = a; i < b; i++) {
    const v = eq[i] / e0; if (v > peak) peak = v; dd = Math.max(dd, (peak - v) / peak * 100);
    if (i > a) r.push(eq[i] / eq[i - 1] - 1);
  }
  return metricasRet_(r, dd, eq[b - 1] / e0);
}
function contarTrades_(r, a, b) { let k = 0; (r.tradeIdx || []).forEach(function (t) { if (t[0] >= a && t[0] < b) k++; }); return k; }
function retornos_(eq, a, b) { const x = []; for (let i = a + 1; i < b; i++) x.push(eq[i] / eq[i - 1] - 1); return x; }
function correl_(x, y) {
  const n = Math.min(x.length, y.length); if (n < 30) return 0;
  let sx = 0, sy = 0; for (let i = 0; i < n; i++) { sx += x[i]; sy += y[i]; }
  const mx = sx / n, my = sy / n; let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) * (x[i] - mx); syy += (y[i] - my) * (y[i] - my); }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : 0;
}
function percentis_(vals) {
  const idx = vals.map(function (v, i) { return i; }).sort(function (a, b) { return vals[a] - vals[b]; }), out = new Array(vals.length);
  idx.forEach(function (k, pos) { out[k] = vals.length > 1 ? pos / (vals.length - 1) : 1; });
  return out;
}

function avaliarCandidatos_(resLista, w0, cut, n, minTr, ddMax, shMin, idsBase) {
  return resLista.map(function (r) {
    const d = { id: r.id, fam: r.fam, nome: r.nome, r: r, situacao: '', slot: 0, base: !!idsBase[r.id] };
    if (r.erro || !r.eqCurve) { d.situacao = 'ERRO no cálculo'; return d; }
    d.isM = metricasFaixa_(r.eqCurve, w0, cut); d.oosM = metricasFaixa_(r.eqCurve, cut, n);
    d.nTrIS = contarTrades_(r, w0, cut); d.sh3 = r.sharpe;
    if (!d.isM) d.situacao = 'sem dados no IS';
    else if (d.isM.sharpe < shMin) d.situacao = 'Sharpe IS ' + d.isM.sharpe + ' < ' + shMin;
    else if (d.sh3 < shMin) d.situacao = 'Sharpe 3 anos ' + r_(d.sh3, 2) + ' < ' + shMin;
    else if (d.isM.dd > ddMax) d.situacao = 'drawdown IS acima de ' + ddMax + '%';
    else if (d.nTrIS < minTr) d.situacao = 'poucos trades no IS (' + d.nTrIS + ' < ' + minTr + ')';
    else d.elegivel = true;
    return d;
  });
}
/** Nota e escolha gulosa (diversificação por família e correlação). Marca slot/situacao em det e devolve as escolhidas. */
function escolherDe_(det, alvo, maxFam, corrMax, w0, cut) {
  const eleg = det.filter(function (d) { return d.elegivel; });
  const pS = percentis_(eleg.map(function (d) { return d.isM.sharpe; })), pC = percentis_(eleg.map(function (d) { return d.isM.calmar; }));
  eleg.forEach(function (d, i) { d.nota = (pS[i] + pC[i]) / 2; });
  eleg.sort(function (a, b) { return b.nota - a.nota || b.isM.calmar - a.isM.calmar; });
  const escolhidas = [], porFam = {};
  eleg.forEach(function (d) {
    if (escolhidas.length >= alvo) { d.situacao = 'elegível, não escolhida (nota ' + r_(d.nota, 2) + ')'; return; }
    if ((porFam[d.fam] || 0) >= maxFam) { d.situacao = 'família ' + d.fam + ' já tem ' + maxFam; return; }
    d.ret = retornos_(d.r.eqCurve, w0, cut);
    for (let k = 0; k < escolhidas.length; k++) {
      const c = correl_(d.ret, escolhidas[k].ret);
      if (c > corrMax) { d.situacao = 'correlação ' + r_(c, 2) + ' com ' + escolhidas[k].id; return; }
    }
    d.slot = escolhidas.length + 1; d.situacao = 'ESCOLHIDA #' + d.slot; porFam[d.fam] = (porFam[d.fam] || 0) + 1; escolhidas.push(d);
  });
  return { escolhidas: escolhidas, nElegiveis: eleg.length };
}

/**
 * Seleção em duas fases. Fase 1: conjunto base. Se faltarem estratégias com Sharpe mínimo, fase 2 (busca ampliada):
 * roda a grade de parâmetros (gerarAmpliado devolve os resultados já calculados) e refaz a escolha sobre base + grade.
 * Se mesmo assim faltar, as vagas ficam ABERTAS (nunca se completa com candidato abaixo do Sharpe mínimo).
 */
function selecionar_(o, resBase, gerarAmpliado) {
  const n = o.closes.length, w0 = Math.min(210, n - 150);
  const cut = w0 + Math.floor((n - w0) * cfgNum_('SELECAO_CORTE_IS'));
  const isAnos = (cut - w0) / 365.25;
  const minTr = Math.max(5, Math.min(cfgNum_('SELECAO_MIN_TRADES_IS'), Math.round(isAnos * 2)));
  const ddMax = cfgNum_('SELECAO_DD_MAX'), maxFam = cfgNum_('SELECAO_MAX_POR_FAMILIA'), corrMax = cfgNum_('SELECAO_CORR_MAX'), alvo = cfgNum_('SELECAO_N_ESTRATEGIAS'), shMin = cfgNum_('SELECAO_SHARPE_MIN');
  const idsBase = {}; resBase.forEach(function (r) { idsBase[r.id] = true; });
  let det = avaliarCandidatos_(resBase, w0, cut, n, minTr, ddMax, shMin, idsBase), esc = escolherDe_(det, alvo, maxFam, corrMax, w0, cut), fase = 'base', nTestados = resBase.length;
  if (esc.escolhidas.length < alvo && gerarAmpliado) {
    const extra = gerarAmpliado();
    det = avaliarCandidatos_(resBase.concat(extra), w0, cut, n, minTr, ddMax, shMin, idsBase);
    esc = escolherDe_(det, alvo, maxFam, corrMax, w0, cut); fase = 'ampliada'; nTestados = resBase.length + extra.length;
  }
  det.forEach(function (d) { if (!d.situacao) d.situacao = '—'; });
  return { ids: esc.escolhidas.map(function (d) { return d.id; }), detalhe: det, w0Data: dataStr_(o.dates[w0]), corteData: dataStr_(o.dates[cut]),
    parcial: esc.escolhidas.length < alvo, vagas: alvo - esc.escolhidas.length, nElegiveis: esc.nElegiveis, minTr: minTr, fase: fase, nTestados: nTestados, shMin: shMin };
}

function lerSel_(sym) {
  const s = PropertiesService.getScriptProperties().getProperty('SEL_' + sym);
  try { return s ? JSON.parse(s) : null; } catch (e) { return null; }
}
function guardarSel_(sym, sel, dataHoje) {
  PropertiesService.getScriptProperties().setProperty('SEL_' + sym, JSON.stringify({ data: dataHoje, ids: sel.ids, w0: sel.w0Data, corte: sel.corteData, parcial: sel.parcial, vagas: sel.vagas, nElig: sel.nElegiveis, fase: sel.fase, nTest: sel.nTestados }));
}
function idadeDias_(str) { return str ? (Date.now() - new Date(str + 'T00:00:00Z').getTime()) / 86400000 : 1e9; }

function pendentesSel_() { try { return JSON.parse(PropertiesService.getScriptProperties().getProperty('SEL_PENDENTES') || '[]'); } catch (e) { return []; } }
function setPendentesSel_(l) { PropertiesService.getScriptProperties().setProperty('SEL_PENDENTES', JSON.stringify(l)); }

const COLS_SELECAO = ['Ativo', 'Posicao_Nota', 'ID', 'Familia', 'Estrategia', 'Trades_IS', 'Sharpe_IS', 'Calmar_IS', 'CAGR_IS_pct', 'MaxDD_IS_pct', 'Sharpe_OOS', 'Calmar_OOS', 'CAGR_OOS_pct', 'MaxDD_OOS_pct', 'Situacao', 'Periodo_IS', 'Data_Selecao'];
/** Auditoria: todos os candidatos de uma moeda, com a razão de cada um ter entrado ou não. Substitui as linhas anteriores da moeda. */
function gravarSelecaoCandidatos_(sym, sel, dataHoje) {
  const sh = ss_().getSheetByName(P2.ABAS.sel); if (!sh) return;
  let antigas = [];
  if (sh.getLastRow() > 1) antigas = sh.getRange(2, 1, sh.getLastRow() - 1, COLS_SELECAO.length).getValues().filter(function (r) { return r[0] !== sym; });
  const visiveis = sel.detalhe.filter(function (d) { return d.base || d.elegivel || d.slot; }), ocultos = sel.detalhe.length - visiveis.length;
  const ord = visiveis.sort(function (a, b) { return (b.slot ? 1000 - b.slot : 0) - (a.slot ? 1000 - a.slot : 0) || (b.nota || -1) - (a.nota || -1); });
  const novas = ord.map(function (d, i) {
    const a = d.isM || {}, b = d.oosM || {};
    return [sym, d.slot || '', d.id, d.fam, d.nome, d.nTrIS === undefined ? '' : d.nTrIS, a.sharpe === undefined ? '' : a.sharpe, a.calmar === undefined ? '' : a.calmar, a.cagr === undefined ? '' : a.cagr, a.dd === undefined ? '' : a.dd,
      b.sharpe === undefined ? '' : b.sharpe, b.calmar === undefined ? '' : b.calmar, b.cagr === undefined ? '' : b.cagr, b.dd === undefined ? '' : b.dd, d.situacao, sel.w0Data + ' a ' + sel.corteData, dataHoje];
  });
  novas.push([sym, '', '(resumo)', '', 'Fase ' + sel.fase + ': ' + sel.nTestados + ' candidatos testados; ' + sel.nElegiveis + ' passaram nos filtros (Sharpe IS e 3 anos >= ' + sel.shMin + ', drawdown, trades); ' + ocultos + ' da busca ampliada reprovados não listados. Vagas abertas: ' + sel.vagas, '', '', '', '', '', '', '', '', '', '', sel.parcial ? 'VAGAS ABERTAS' : 'COMPLETA', sel.w0Data + ' a ' + sel.corteData, dataHoje]);
  const todas = antigas.concat(novas);
  sh.clear();
  sh.getRange(1, 1, 1, COLS_SELECAO.length).setValues([COLS_SELECAO]).setFontWeight('bold').setBackground('#0b1f3a').setFontColor('#ffffff').setWrap(true);
  sh.getRange(2, 16, todas.length, 2).setNumberFormat('@');
  sh.getRange(2, 1, todas.length, COLS_SELECAO.length).setValues(todas);
  todas.forEach(function (r, i) { if (r[1] !== '') sh.getRange(i + 2, 1, 1, COLS_SELECAO.length).setBackground('#e6f4ea'); });
  sh.setFrozenRows(1); sh.setColumnWidth(5, 330); sh.setColumnWidth(15, 280); sh.setColumnWidth(16, 170);
}

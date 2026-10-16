/* =============================================================================
 * 2B. SELEÇÃO DAS 10 MELHORES ESTRATÉGIAS DE CADA MOEDA
 *
 * Princípio: escolher entre muitos candidatos contamina a medida (quem escolhe o melhor de 46 sempre vê um número
 * bonito, parte dele sorte). Por isso:
 *  1. A nota de cada candidato usa SOMENTE o período de seleção (IS = primeiros 70% do histórico, após o aquecimento
 *     das médias). O restante (OOS = últimos 30%) NUNCA entra na nota; ele serve para medir a decaída real.
 *  2. Elegível: Sharpe IS >= SELECAO_SHARPE_MIN (1,00) E Sharpe de 24 meses >= SELECAO_SHARPE_MIN_24M (0,90) E Sharpe de 12 meses >= SELECAO_SHARPE_MIN_12M (0,40), drawdown IS <=
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
/** Sharpe anualizado (raiz 365) dos últimos `dias` retornos da curva de equity, sem contar o aquecimento (barra 210). Sem arredondar. */
function sharpeUlt_(eq, n, dias) {
  const ini = Math.max(211, n - dias), r = []; for (let i = ini; i < n; i++) r.push(eq[i] / eq[i - 1] - 1);
  if (r.length < 60) return null;
  const mu = r.reduce(function (a, b) { return a + b; }, 0) / r.length, sd = Math.sqrt(r.reduce(function (a, b) { return a + (b - mu) * (b - mu); }, 0) / r.length);
  return sd > 0 ? mu / sd * Math.sqrt(365) : 0;
}
/** Verdadeiro se a curva cumpre os mínimos de 24 e 12 meses. margem > 0 = histerese: quem já está na tabela só sai abaixo de (mínimo - margem). */
function cumprePermanencia_(eq, n, margem) {
  margem = margem || 0;
  const a = sharpeUlt_(eq, n, cfgNum_('SELECAO_JANELA_PERM_DIAS')), b = sharpeUlt_(eq, n, 365);
  return { ok: a !== null && b !== null && a >= cfgNum_('SELECAO_SHARPE_MIN_24M') - margem && b >= cfgNum_('SELECAO_SHARPE_MIN_12M') - margem, s24: a, s12: b };
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

/**
 * Nível de uma curva de equity em relação aos mínimos (calculado a cada dia, sobre os dados atuais):
 *  PLENA          Sharpe do histórico todo >= SELECAO_SHARPE_MIN (1,00), 24 meses >= SELECAO_SHARPE_MIN_24M e 12 meses >= SELECAO_SHARPE_MIN_12M
 *  RECENTE FRACA  histórico todo >= 1,00, mas 24 ou 12 meses abaixo do mínimo
 *  PROVISORIA     histórico todo entre SELECAO_PISO_PROVISORIO (0,80) e 1,00
 *  FORA           abaixo disso
 */
function nivelSharpe_(eq, n) {
  const w0 = Math.min(210, n - 150), full = sharpeUlt_(eq, n, n - w0 - 1), p = cumprePermanencia_(eq, n), min = cfgNum_('SELECAO_SHARPE_MIN'), piso = cfgNum_('SELECAO_PISO_PROVISORIO');
  let nivel = 'FORA';
  if (full !== null && full >= min) nivel = p.ok ? 'PLENA' : 'RECENTE FRACA';
  else if (full !== null && full >= piso) nivel = 'PROVISORIA';
  return { nivel: nivel, full: full, s24: p.s24, s12: p.s12 };
}
const ORDEM_NIVEL = { 'PLENA': 0, 'RECENTE FRACA': 1, 'PROVISORIA': 2 };

/**
 * Seleciona as melhores estratégias de uma moeda entre todos os candidatos (base + grade + estendida), em uma passada
 * (cada candidato é calculado, avaliado e só guarda a curva se for elegível, para poupar memória).
 * Base de avaliação: histórico inteiro depois do aquecimento. As colunas IS (70% iniciais) e OOS (30% finais) são apenas descritivas.
 * Ordem de preenchimento: PLENA, depois RECENTE FRACA, depois PROVISORIA; dentro de cada nível por nota (percentil do Sharpe e do Calmar).
 * Diversificação gulosa: máximo SELECAO_MAX_POR_FAMILIA por família e correlação diária máxima SELECAO_CORR_MAX.
 */
function selecionar_(o, defs, opc) {
  opc = opc || {};
  const n = o.closes.length, w0 = Math.min(210, n - 150), cut = w0 + Math.floor((n - w0) * cfgNum_('SELECAO_CORTE_IS'));
  const anos = (n - w0) / 365.25, minTr = Math.max(5, Math.min(cfgNum_('SELECAO_MIN_TRADES_IS'), Math.round(anos * 2)));
  const ddMax = cfgNum_('SELECAO_DD_MAX'), ddMaxR = cfgNum_('SELECAO_DD_MAX_RELAX'), minTrR = cfgNum_('SELECAO_MIN_TRADES_RELAX'), corrR = cfgNum_('SELECAO_CORR_MAX_RELAX'), famR = cfgNum_('SELECAO_MAX_POR_FAMILIA_RELAX'), maxFam = cfgNum_('SELECAO_MAX_POR_FAMILIA'), corrMax = cfgNum_('SELECAO_CORR_MAX'), alvo = opc.alvo || cfgNum_('SELECAO_N_ESTRATEGIAS');
  const idsBase = {}; POOL.forEach(function (e) { idsBase[e.id] = true; });
  const det = [], tIni = Date.now(), orc = cfgNum_('SELECAO_ORCAMENTO_SEG') * 1000; let interrompida = false;
  defs.forEach(function (e) {
    if (Date.now() - tIni > orc) { interrompida = true; return; }   // guarda: a busca nunca estoura o limite de 6 minutos do Apps Script
    const r = rodarLista_(o, [e])[0], d = { id: e.id, fam: e.fam, nome: e.nome, situacao: '', slot: 0, base: !!idsBase[e.id] };
    det.push(d);
    if (r.erro || !r.eqCurve) { d.situacao = 'ERRO no cálculo'; return; }
    const nv = nivelSharpe_(r.eqCurve, n), m = metricasFaixa_(r.eqCurve, w0, n);
    d.nivel = nv.nivel; d.sFull = nv.full; d.s24 = nv.s24; d.s12 = nv.s12; d.isM = metricasFaixa_(r.eqCurve, w0, cut); d.oosM = metricasFaixa_(r.eqCurve, cut, n);
    d.nTr = contarTrades_(r, w0, n); d.dd = m ? m.dd : null; d.calmar = m ? m.calmar : null;
    if (nv.nivel === 'FORA') d.situacao = 'Sharpe do histórico ' + (nv.full === null ? 'indisponível' : r_(nv.full, 2)) + ' < ' + cfgNum_('SELECAO_PISO_PROVISORIO');
    else if (cfgSim_('SELECAO_EXIGE_PLENA') && nv.nivel !== 'PLENA') d.situacao = 'nível ' + nv.nivel + ' (a regra exige PLENA)';
    else if (!m || m.dd > ddMax) { d.situacao = 'drawdown acima de ' + ddMax + '%'; if (m && m.dd <= ddMaxR && nv.nivel === 'PLENA') { d.relaxavel = true; d.r = r; d.ret = retornos_(r.eqCurve, w0, n); } }
    else if (d.nTr < minTr) { d.situacao = 'poucos trades (' + d.nTr + ' < ' + minTr + ')'; if (d.nTr >= minTrR && nv.nivel === 'PLENA') { d.relaxavel = true; d.r = r; d.ret = retornos_(r.eqCurve, w0, n); } }
    else { d.elegivel = true; d.r = r; d.ret = retornos_(r.eqCurve, w0, n); }
  });
  const eleg = det.filter(function (d) { return d.elegivel; }), pS = percentis_(eleg.map(function (d) { return d.sFull; })), pC = percentis_(eleg.map(function (d) { return d.calmar; }));
  eleg.forEach(function (d, i) { d.nota = (pS[i] + pC[i]) / 2; });
  eleg.sort(function (a, b) { return ORDEM_NIVEL[a.nivel] - ORDEM_NIVEL[b.nivel] || b.nota - a.nota; });
  const escolhidas = [], porFam = {};
  (opc.mantidas || []).forEach(function (r, k) {   // estratégias já aceitas (ex.: fixas do BTC que cumprem a régua) entram na conta de vagas, família e correlação
    const d = { id: r.id, fam: r.fam || 'p02', ret: retornos_(r.eqCurve, w0, n), slot: k + 1, mantida: true, situacao: 'MANTIDA' }; escolhidas.push(d); porFam[d.fam] = (porFam[d.fam] || 0) + 1;
  });
  eleg.forEach(function (d) {
    if (escolhidas.length >= alvo) { d.situacao = 'elegível (' + d.nivel + '), não escolhida'; return; }
    if ((porFam[d.fam] || 0) >= maxFam) { d.situacao = 'família ' + d.fam + ' já tem ' + maxFam; return; }
    for (let k = 0; k < escolhidas.length; k++) { const c = correl_(d.ret, escolhidas[k].ret); if (c > corrMax) { d.situacao = 'correlação ' + r_(c, 2) + ' com ' + escolhidas[k].id; return; } }
    d.slot = escolhidas.length + 1; d.situacao = 'ESCOLHIDA #' + d.slot + ' (' + d.nivel + ')'; porFam[d.fam] = (porFam[d.fam] || 0) + 1; escolhidas.push(d);
  });
  // segunda passada: se sobraram vagas, aceita mais uma estratégia por família (a correlação continua valendo)
  eleg.forEach(function (d) {
    if (escolhidas.length >= alvo || d.slot || d.situacao.indexOf('família') !== 0 || (porFam[d.fam] || 0) >= maxFam + 1) return;
    for (let k = 0; k < escolhidas.length; k++) { if (correl_(d.ret, escolhidas[k].ret) > corrMax) return; }
    d.slot = escolhidas.length + 1; d.situacao = 'ESCOLHIDA #' + d.slot + ' (' + d.nivel + ', família extra)'; porFam[d.fam] = (porFam[d.fam] || 0) + 1; escolhidas.push(d);
  });
  // terceira passada (critério relaxado): o Sharpe continua exigido no nível PLENA; relaxam só drawdown, trades, correlação e família
  const relax = {};
  if (escolhidas.length < alvo && cfgSim_('SELECAO_RELAXAR_SE_FALTAR')) {
    const cand = det.filter(function (d) { return !d.slot && d.nivel === 'PLENA' && d.ret && (d.elegivel || d.relaxavel); });
    const pS2 = percentis_(cand.map(function (d) { return d.sFull; })), pC2 = percentis_(cand.map(function (d) { return d.calmar; }));
    cand.forEach(function (d, i) { d.nota2 = (pS2[i] + pC2[i]) / 2; });
    cand.sort(function (a, b) { return b.nota2 - a.nota2; });
    cand.forEach(function (d) {
      if (escolhidas.length >= alvo || (porFam[d.fam] || 0) >= famR) return;
      let cmax = 0, com = ''; for (let k = 0; k < escolhidas.length; k++) { const c = correl_(d.ret, escolhidas[k].ret); if (c > cmax) { cmax = c; com = escolhidas[k].id; } }
      if (cmax > corrR) return;
      const motivo = []; if (d.dd > ddMax) motivo.push('drawdown ' + r_(d.dd, 0) + '%'); if (d.nTr < minTr) motivo.push(d.nTr + ' trades'); if (cmax > corrMax) motivo.push('correlação ' + r_(cmax, 2) + ' com ' + com); if ((porFam[d.fam] || 0) >= maxFam + 1) motivo.push('família ' + d.fam + ' com ' + ((porFam[d.fam] || 0) + 1));
      d.slot = escolhidas.length + 1; d.situacao = 'ESCOLHIDA #' + d.slot + ' (PLENA, critério relaxado' + (motivo.length ? ': ' + motivo.join(', ') : '') + ')'; relax[d.id] = motivo.length ? motivo.join(', ') : 'critério relaxado';
      porFam[d.fam] = (porFam[d.fam] || 0) + 1; escolhidas.push(d);
    });
  }
  det.forEach(function (d) { if (!d.situacao) d.situacao = '—'; });
  return { rel: relax, ids: escolhidas.filter(function (d) { return !d.mantida; }).map(function (d) { return d.id; }), detalhe: det, w0Data: dataStr_(o.dates[w0]), corteData: dataStr_(o.dates[cut]), parcial: escolhidas.length < alvo, vagas: alvo - escolhidas.length,
    naoPlenas: escolhidas.filter(function (d) { return d.nivel !== 'PLENA'; }).length, nRelax: Object.keys(relax).length, nElegiveis: eleg.length, minTr: minTr, nTestados: det.length, interrompida: interrompida, shMin: cfgNum_('SELECAO_SHARPE_MIN') };
}

function lerSel_(sym) {
  const s = PropertiesService.getScriptProperties().getProperty('SEL_' + sym);
  try { return s ? JSON.parse(s) : null; } catch (e) { return null; }
}
function guardarSel_(sym, sel, dataHoje) {
  PropertiesService.getScriptProperties().setProperty('SEL_' + sym, JSON.stringify({ data: dataHoje, ids: sel.ids, w0: sel.w0Data, corte: sel.corteData, parcial: sel.parcial, vagas: sel.vagas, naoPlenas: sel.naoPlenas, nElig: sel.nElegiveis, nTest: sel.nTestados, rel: sel.rel, sig: sel.sig || '' }));
}
function idadeDias_(str) { return str ? (Date.now() - new Date(str + 'T00:00:00Z').getTime()) / 86400000 : 1e9; }

function pendentesSel_() { try { return JSON.parse(PropertiesService.getScriptProperties().getProperty('SEL_PENDENTES') || '[]'); } catch (e) { return []; } }
function setPendentesSel_(l) { PropertiesService.getScriptProperties().setProperty('SEL_PENDENTES', JSON.stringify(l)); }

const COLS_SELECAO = ['Ativo', 'Posicao_Nota', 'ID', 'Familia', 'Estrategia', 'Trades', 'Sharpe_historico', 'Calmar_historico', 'Sharpe_24m', 'Sharpe_12m', 'Nivel', 'Sharpe_70pct_iniciais', 'Sharpe_30pct_finais', 'MaxDD_historico_pct', 'Situacao', 'Periodo_70_30', 'Data_Selecao'];
/** Auditoria: todos os candidatos de uma moeda, com a razão de cada um ter entrado ou não. Substitui as linhas anteriores da moeda. */
function gravarSelecaoCandidatos_(sym, sel, dataHoje) {
  const sh = ss_().getSheetByName(P2.ABAS.sel); if (!sh) return;
  let antigas = [];
  if (sh.getLastRow() > 1) antigas = sh.getRange(2, 1, sh.getLastRow() - 1, COLS_SELECAO.length).getValues().filter(function (r) { return r[0] !== sym; });
  const visiveis = sel.detalhe.filter(function (d) { return d.elegivel || d.slot; }), ocultos = sel.detalhe.length - visiveis.length, v = function (x) { return x === undefined || x === null ? '' : (typeof x === 'number' ? r_(x, 2) : x); };
  const ord = visiveis.sort(function (a, b) { return (b.slot ? 1000 - b.slot : 0) - (a.slot ? 1000 - a.slot : 0) || (b.nota || -1) - (a.nota || -1); }).slice(0, 60);
  const novas = ord.map(function (d) {
    return [sym, d.slot || '', d.id, d.fam, d.nome, v(d.nTr), v(d.sFull), v(d.calmar), v(d.s24), v(d.s12), d.nivel || '', d.isM ? d.isM.sharpe : '', d.oosM ? d.oosM.sharpe : '', v(d.dd), d.situacao, sel.w0Data + ' a ' + sel.corteData, dataHoje];
  });
  novas.push([sym, '', '(resumo)', '', sel.nTestados + ' candidatos testados; ' + sel.nElegiveis + ' elegíveis (Sharpe do histórico >= ' + cfgNum_('SELECAO_PISO_PROVISORIO') + ', drawdown, trades); ' + ocultos + ' reprovados não listados; mostrados os 60 melhores.' + (sel.interrompida ? ' BUSCA INTERROMPIDA POR TEMPO (parte dos candidatos não foi testada).' : '') + ' Vagas abertas: ' + sel.vagas + '. Fora do nível PLENA: ' + sel.naoPlenas, '', '', '', '', '', '', '', '', '', sel.parcial ? 'VAGAS ABERTAS' : 'COMPLETA', sel.w0Data + ' a ' + sel.corteData, dataHoje]);
  const todas = antigas.concat(novas);
  sh.clear();
  sh.getRange(1, 1, 1, COLS_SELECAO.length).setValues([COLS_SELECAO]).setFontWeight('bold').setBackground('#0b1f3a').setFontColor('#ffffff').setWrap(true);
  sh.getRange(2, 16, todas.length, 2).setNumberFormat('@');
  sh.getRange(2, 1, todas.length, COLS_SELECAO.length).setValues(todas);
  todas.forEach(function (r, i) { if (r[1] !== '') sh.getRange(i + 2, 1, 1, COLS_SELECAO.length).setBackground('#e6f4ea'); });
  sh.setFrozenRows(1); sh.setColumnWidth(5, 330); sh.setColumnWidth(15, 280); sh.setColumnWidth(16, 170);
}

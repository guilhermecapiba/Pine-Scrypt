/* =============================================================================
 * 15. AUDITORIA — conciliação entre abas e recálculo independente dos números (menu A)
 *     Escreve a aba AUDITORIA com uma linha por verificação: Grupo | Escopo | Esperado | Encontrado | Status (OK, ATENCAO, ERRO).
 *     O recálculo refaz do zero as estratégias a partir das abas BASE (sem usar os resultados guardados) e compara com o que as abas mostram.
 * ===========================================================================*/
function auditoria() {
  const t0 = Date.now(), L = [], ss = ss_();
  const add = function (grupo, escopo, esperado, achado, ok, nivel) { L.push([grupo, escopo, String(esperado), String(achado), ok ? 'OK' : (nivel || 'ERRO')]); };
  const lerAba = function (nome) { const sh = ss.getSheetByName(nome); if (!sh || sh.getLastRow() < 1) return []; return sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues(); };
  const num = function (x) { const v = parseFloat(String(x).replace(/[$%\s]/g, '').replace(/,(?=\d{3}(\D|$))/g, '').replace(',', '.')); return isFinite(v) ? v : null; };
  const painel = lerAba(P2.ABAS.painel), desemp = lerAba(P2.ABAS.desemp), estr = lerAba(P2.ABAS.estr), selec = lerAba(P2.ABAS.sel);
  const ativos = ativosUniverso_().sort(function (a, b) { return a.ordem - b.ordem; });
  const ontem = dataStr_(new Date(ontemUtcMs_()));
  const linhaPainel = {}; painel.forEach(function (r, i) { if (i >= 4 && r[1]) linhaPainel[String(r[1]).replace(' (referência)', '')] = r; });
  const linhaDesemp = {}; desemp.forEach(function (r, i) { if (i >= 4 && r[0] && r[1] !== '') linhaDesemp[String(r[0]).replace(' (ref.)', '')] = r; });
  const estrPorAtivo = {}; estr.forEach(function (r, i) { if (i >= 1 && r[0] && r[1] !== '' && r[6] !== undefined) (estrPorAtivo[r[0]] = estrPorAtivo[r[0]] || []).push(r); });
  const selPorAtivo = {}; selec.forEach(function (r, i) { if (i >= 1 && r[0] && r[1] !== '' && r[2] !== '(resumo)') (selPorAtivo[r[0]] = selPorAtivo[r[0]] || []).push(r[2]); });

  // 1. Cobertura entre abas
  ativos.forEach(function (u) {
    const rp = linhaPainel[u.sym], re = estrPorAtivo[u.sym] || [], rd = linhaDesemp[u.sym], baseSh = ss.getSheetByName('BASE_' + u.sym);
    const faltam = []; if (!rp) faltam.push('PAINEL_TOP10'); if (!re.length) faltam.push('ESTRATEGIAS_TOP10');
    const estadoOk = rp && String(rp[15]) === 'OK'; if (estadoOk && !rd) faltam.push('DESEMPENHO_10'); if (!baseSh) faltam.push('BASE_' + u.sym);
    add('Cobertura', u.sym, 'presente em PAINEL, ESTRATEGIAS, DESEMPENHO (se OK) e BASE', faltam.length ? 'falta em: ' + faltam.join(', ') : 'presente' + (estadoOk ? '' : ' (estado ' + (rp ? rp[15] : '?') + ': sem DESEMPENHO, por desenho)'), !faltam.length);
  });

  // 2. Dados base: integridade, atualização e conciliação com PAINEL e UNIVERSO
  const bases = {};
  ativos.forEach(function (u) {
    const bruto = lerBase_(u.sym), o = aparaInicio_(lerBase_(u.sym)), n = o.closes.length; bases[u.sym] = o;
    if (!n) { add('Dados', u.sym, 'série diária carregada', 'aba BASE vazia', false); return; }
    let lac = 0, dup = 0, inc = 0, plano = 0, salto = 0, extremos = 0;
    for (let i = 0; i < n; i++) {
      if (i) { const d = (o.dates[i] - o.dates[i - 1]) / 86400000; if (d > 1.5) lac++; if (d < 0.5) dup++; const r = o.closes[i] / o.closes[i - 1]; if (r > 20 || r < 0.05) salto++; if (Math.abs(r - 1) > 0.4) extremos++; }
      if (o.lows[i] > Math.min(o.opens[i], o.closes[i]) * 1.000001 || o.highs[i] < Math.max(o.opens[i], o.closes[i]) * 0.999999) inc++;
      if (o.highs[i] === o.lows[i]) plano++;
    }
    add('Dados', u.sym + ' continuidade', '0 lacunas e 0 datas repetidas', lac + ' lacunas, ' + dup + ' repetidas', !lac && !dup);
    add('Dados', u.sym + ' consistência OHLC', '0 velas com máxima/mínima incoerentes', inc + ' velas', !inc);
    add('Dados', u.sym + ' saltos de preço > 20x em um dia', '0 depois do corte automático do começo', salto + (bruto.closes.length !== n ? ' (começo aparado: ' + (bruto.closes.length - n) + ' velas descartadas)' : ''), !salto);
    add('Dados', u.sym + ' velas planas (máxima = mínima) e quedas/altas > 40% em um dia', 'informativo', plano + ' planas; ' + extremos + ' variações > 40%', plano < n * 0.05, 'ATENCAO');
    const ultima = dataStr_(o.dates[n - 1]);
    add('Dados', u.sym + ' atualização', 'última vela = ' + ontem + ' (ontem UTC)', ultima, ultima >= ontem);
    const rp = linhaPainel[u.sym];
    if (rp) {
      const p = num(rp[2]), c = o.closes[n - 1];
      add('Conciliação', u.sym + ' preço PAINEL x BASE', 'último fechamento ' + c, rp[2], p !== null && Math.abs(p - c) / c < 0.002);
      add('Conciliação', u.sym + ' última vela PAINEL x BASE', ultima, rp[14], String(rp[14]).slice(0, 10) === ultima);
    }
    add('Conciliação', u.sym + ' N_Velas da UNIVERSO x BASE', n, u.nVelas, parseInt(u.nVelas, 10) === n);
  });

  // 3. Estratégias: recálculo independente x ESTRATEGIAS_TOP10, PAINEL e DESEMPENHO
  let totCmp = 0, okCmp = 0;
  ativos.forEach(function (u) {
    const re = estrPorAtivo[u.sym] || [], rp = linhaPainel[u.sym], rd = linhaDesemp[u.sym], o = bases[u.sym];
    const reais = re.filter(function (r) { return r[2] !== '—' && r[6] !== 'VAGA'; });
    if (!reais.length || !o || !o.closes.length) return;
    const n = o.closes.length; if (u.status !== 'REFERENCIA') o.btcC = alinharBtc_(o, lerBase_('BTC'));
    const ids = reais.map(function (r) { return r[2]; }), defs = u.status === 'REFERENCIA' ? FIXAS_BTC.concat(defsPorId_(ids.filter(function (id) { return !FIXAS_BTC.some(function (f) { return f.id === id; }); }))) : defsPorId_(ids);
    const res = rodarLista_(o, defs).filter(function (r) { return ids.indexOf(r.id) >= 0; });
    const dif = [];
    reais.forEach(function (r) {
      const c = res.filter(function (x) { return x.id === r[2]; })[0]; if (!c || !c.eqCurve) { dif.push(r[2] + ' (não recalculável)'); return; }
      const nv = nivelSharpe_(c.eqCurve, n), pares = [['histórico', num(r[15]), nv.full, 0.011], ['24m', num(r[16]), nv.s24, 0.011], ['12m', num(r[17]), nv.s12, 0.011], ['3 anos', num(r[18]), c.sharpe, 0.011], ['trades', num(r[12]), c.nTrades, 0.1], ['posição', num(r[5]), c.posAtual, 0.1]];
      pares.forEach(function (p) { totCmp++; if (p[1] !== null && p[2] !== null && Math.abs(p[1] - p[2]) <= p[3]) okCmp++; else dif.push(r[2] + ' ' + p[0] + ': aba ' + p[1] + ' x recálculo ' + (p[2] === null ? 'n/d' : r_(p[2], 2))); });
      // nível coerente com os mínimos atuais
      const esperado = nv.full >= cfgNum_('SELECAO_SHARPE_MIN') ? (nv.s24 >= cfgNum_('SELECAO_SHARPE_MIN_24M') && nv.s12 >= cfgNum_('SELECAO_SHARPE_MIN_12M') ? 'PLENA' : 'RECENTE FRACA') : 'PROVISORIA';
      if (u.status !== 'REFERENCIA' && String(r[14]) !== esperado && !(String(r[14]) === 'FORA' )) dif.push(r[2] + ' nível ' + r[14] + ' x esperado ' + esperado + ' pelos mínimos atuais');
    });
    add('Recálculo', u.sym + ' estratégias (Sharpe, trades, posição)', reais.length * 6 + ' valores conferem', dif.length ? dif.slice(0, 4).join('; ') + (dif.length > 4 ? ' (+' + (dif.length - 4) + ')' : '') : 'todos conferem', !dif.length);
    // PAINEL: compradas e índice
    if (rp) {
      const comp = reais.filter(function (r) { return r[5] === 1 && r[6] !== 'FORA DA REGRA (Sharpe)'; }).length, ativas = reais.filter(function (r) { return r[6] !== 'FORA DA REGRA (Sharpe)'; }).length;
      add('Conciliação', u.sym + ' estratégias compradas PAINEL x ESTRATEGIAS', comp + '/' + ativas, rp[9], String(rp[9]) === comp + '/' + ativas);
      res.forEach(function (r) { const f = reais.filter(function (x) { return x[2] === r.id; })[0]; r.ativa = !(f && f[6] === 'FORA DA REGRA (Sharpe)'); });
      const cons = consenso_(res), idxP = num(String(rp[7]).split('%')[0]);
      add('Recálculo', u.sym + ' Índice de Exposição Tática', r_(cons.pct, 1) + '%', rp[7], idxP !== null && Math.abs(idxP - cons.pct) <= 1.0);
    }
    if (rd) {
      const plenas = reais.filter(function (r) { return r[14] === 'PLENA'; }).length;
      add('Conciliação', u.sym + ' estratégias PLENAS DESEMPENHO x ESTRATEGIAS', plenas, rd[16], parseInt(rd[16], 10) === plenas);
      const ini = Math.min(n - 91, cfgNum_('JANELA_INICIO_BARRAS')), pt = metricasPainel_(res.filter(function (r) { return r.ativa !== false; }), ini), bh = metricasJanela_(o.closes, ini);
      add('Recálculo', u.sym + ' Calmar do painel e do buy and hold (DESEMPENHO)', (pt ? pt.calmar : 'n/d') + ' e ' + (bh ? bh.calmar : 'n/d'), rd[18] + ' e ' + rd[20], !!pt && !!bh && Math.abs(num(rd[18]) - pt.calmar) <= 0.06 && Math.abs(num(rd[20]) - bh.calmar) <= 0.06);
    }
    // SELECAO_CANDIDATAS x ESTRATEGIAS
    if (u.status !== 'REFERENCIA') {
      const a = (selPorAtivo[u.sym] || []).slice().sort().join(','), b = ids.slice().sort().join(',');
      add('Conciliação', u.sym + ' IDs escolhidos SELECAO_CANDIDATAS x ESTRATEGIAS', b, a || '(sem linhas)', a === b);
    }
  });
  add('Recálculo', 'Total de valores de estratégias recalculados', totCmp, okCmp + ' conferem', okCmp === totCmp);

  // 3B. Regra de diversificação: no máximo 1 da mesma classe de indicador a cada 5 (2 em 10)
  ativos.forEach(function (u) {
    const re = (estrPorAtivo[u.sym] || []).filter(function (r) { return r[2] !== '—' && r[6] !== 'VAGA' && r[6] !== 'FORA DA REGRA (Sharpe)'; });
    if (!re.length) return;
    const cap = Math.max(1, Math.round(re.length / 5 * cfgNum_('SELECAO_MAX_MESMA_CLASSE_POR_5'))), cont = {};
    re.forEach(function (r) { const c = classeInd_(r[4]); cont[c] = (cont[c] || 0) + 1; });
    const exc = Object.keys(cont).filter(function (c) { return cont[c] > cap; }).map(function (c) { return c + ' x' + cont[c]; });
    add('Diversificação', u.sym + ' classes de indicador', 'no máximo ' + cap + ' da mesma classe em ' + re.length, exc.length ? 'excede: ' + exc.join(', ') : 'respeitada (' + Object.keys(cont).length + ' classes)', !exc.length);
  });

  // 4. Mínimos de Sharpe e estratégias abaixo da régua
  const abaixo = []; Object.keys(estrPorAtivo).forEach(function (s) { estrPorAtivo[s].forEach(function (r) {
    if (r[2] === '—' || r[6] === 'VAGA' || r[6] === 'FORA DA REGRA (Sharpe)') return;
    if (r[14] !== 'PLENA') abaixo.push(s + ' ' + r[2] + ' (' + r[14] + ')');
  }); });
  add('Régua de Sharpe', 'estratégias ativas fora do nível PLENA', '0 (histórico >= ' + cfgNum_('SELECAO_SHARPE_MIN') + ', 24m >= ' + cfgNum_('SELECAO_SHARPE_MIN_24M') + ', 12m >= ' + cfgNum_('SELECAO_SHARPE_MIN_12M') + ')', abaixo.length ? abaixo.join('; ') : 'nenhuma', !abaixo.length, 'ATENCAO');
  ativos.forEach(function (u) {
    const re = (estrPorAtivo[u.sym] || []), vagas = re.filter(function (r) { return r[6] === 'VAGA'; }).length;
    if (vagas) { const rp = linhaPainel[u.sym]; add('Régua de Sharpe', u.sym + ' vagas abertas (moeda não analisada por regra: só é medida com todas as ' + cfgNum_('SELECAO_N_ESTRATEGIAS') + ' estratégias aceitas)', 0, vagas + ' vagas' + (rp ? ' · estado ' + rp[15] : ''), false, 'INFO'); }
  });

  // 5. Operação: gatilhos, configuração, log
  const gat = ScriptApp.getProjectTriggers().map(function (t) { return t.getHandlerFunction(); });
  ['motorHorario', 'motorSemanal', 'backupDiario', 'atualizarRanking'].forEach(function (h) { add('Operação', 'gatilho ' + h, 'instalado', gat.indexOf(h) >= 0 ? 'instalado' : 'ausente (menu G)', gat.indexOf(h) >= 0, 'ATENCAO'); });
  const cfgSh = ss.getSheetByName(P2.ABAS.cfg), chaves = {}; if (cfgSh && cfgSh.getLastRow() > 1) cfgSh.getRange(2, 1, cfgSh.getLastRow() - 1, 1).getValues().forEach(function (r) { chaves[r[0]] = true; });
  const semChave = CFG_PADRAO.filter(function (r) { return !chaves[r[0]]; }).map(function (r) { return r[0]; }), codigo = {}; CFG_PADRAO.forEach(function (r) { codigo[r[0]] = true; });
  const obsoletas = Object.keys(chaves).filter(function (k) { return k && !codigo[k]; });
  add('Operação', 'CONFIG_SISTEMA x código', 'sem parâmetros faltando nem obsoletos', (semChave.length ? 'faltam (usam o padrão do código): ' + semChave.join(', ') : '') + (obsoletas.length ? ' obsoletos: ' + obsoletas.join(', ') : '') || 'em dia', !semChave.length && !obsoletas.length, 'ATENCAO');
  const log = lerAba(P2.ABAS.log), recentes = log.slice(1).filter(function (r) { const t = r[0] instanceof Date ? r[0].getTime() : Date.parse(r[0]); return t >= Date.now() - 48 * 3600000 && /^FALHA|^TEMPO_ALTO/.test(String(r[1]) + String(r[5])); });
  const ult = recentes.length ? recentes[recentes.length - 1] : null;
  add('Operação', 'falhas registradas no LOG_DISPAROS nas últimas 48 horas', 0, recentes.length + (ult ? ' (última: ' + (ult[0] instanceof Date ? Utilities.formatDate(ult[0], P2.TZ_BRT, 'dd/MM HH:mm') : ult[0]) + ' ' + ult[1] + ')' : ''), !recentes.length, 'ATENCAO');
  L.push(['Resumo', 'Auditoria executada em ' + Utilities.formatDate(new Date(), P2.TZ_BRT, 'dd/MM/yyyy HH:mm') + ' BRT (' + Math.round((Date.now() - t0) / 1000) + 's)', '', L.filter(function (l) { return l[4] === 'OK'; }).length + ' OK, ' + L.filter(function (l) { return l[4] === 'INFO'; }).length + ' informativos, ' + L.filter(function (l) { return l[4] === 'ATENCAO'; }).length + ' atenção, ' + L.filter(function (l) { return l[4] === 'ERRO'; }).length + ' erro', L.some(function (l) { return l[4] === 'ERRO'; }) ? 'ERRO' : (L.some(function (l) { return l[4] === 'ATENCAO'; }) ? 'ATENCAO' : 'OK')]);

  let sh = ss.getSheetByName(P2.ABAS.audit); if (!sh) sh = ss.insertSheet(P2.ABAS.audit);
  sh.clear();
  sh.getRange(1, 1, 1, 5).setValues([['Grupo', 'Escopo', 'Esperado', 'Encontrado', 'Status']]).setFontWeight('bold').setBackground('#0b1f3a').setFontColor('#ffffff');
  const ordem = L.slice(-1).concat(L.slice(0, -1));
  sh.getRange(2, 3, ordem.length, 2).setNumberFormat('@');   // evita que a planilha reinterprete textos como números/moeda
  sh.getRange(2, 1, ordem.length, 5).setValues(ordem);
  ordem.forEach(function (l, i) { sh.getRange(i + 2, 5).setBackground(l[4] === 'OK' ? '#d9ead3' : l[4] === 'ATENCAO' ? '#fff2cc' : l[4] === 'INFO' ? '#eeeeee' : '#f4cccc').setFontWeight('bold'); });
  sh.setFrozenRows(1); sh.setColumnWidth(1, 110); sh.setColumnWidth(2, 360); sh.setColumnWidth(3, 330); sh.setColumnWidth(4, 520);
  safeToast_('Auditoria concluída: ' + ordem[0][3] + '. Veja a aba AUDITORIA.');
  return ordem;
}

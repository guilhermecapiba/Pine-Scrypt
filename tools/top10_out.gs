/* =============================================================================
 * 12. PAINÉIS — PAINEL_TOP10, ESTRATEGIAS_TOP10 e DESEMPENHO_10 (reconstruídos a partir dos resultados guardados)
 * ===========================================================================*/
function resultadosOrdenados_() {
  return ativosUniverso_().sort(function (a, b) { return a.ordem - b.ordem; }).map(function (u) { return { u: u, r: lerRes_(u.sym) }; });
}
function fmtPreco_(v) {
  if (v === null || v === undefined || isNaN(v)) return '—';
  const d = v >= 100 ? 0 : v >= 1 ? 2 : 4;
  return '$ ' + Number(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}
function fmtPct_(v) { return v === null || v === undefined || isNaN(v) ? '—' : (v > 0 ? '+' : '') + v + '%'; }

function gravarPainel_() {
  const sh = ss_().getSheetByName(P2.ABAS.painel), lista = resultadosOrdenados_();
  const cab = ['Ordem', 'Ativo', 'Preço (fechamento)', '24h', '7 dias', '30 dias', 'Preço vs média de 200d', 'Índice de Exposição Tática', 'Leitura do Consenso', 'Estratégias compradas',
    'Esticamento (0 barato a 100 caro)', 'Faixa', 'Histórico (anos)', 'Fonte dos dados', 'Última vela (UTC)', 'Estado'];
  const rows = lista.map(function (x) {
    const r = x.r, u = x.u;
    if (!r) return [u.ordem, u.sym, '—', '—', '—', '—', '—', '—', '—', '—', '—', '—', '—', u.fonteOk || '—', '—', 'AGUARDANDO CARGA'];
    if (r.estado !== 'OK') return [u.ordem, u.sym, fmtPreco_(r.preco), '—', '—', '—', '—', '—', '—', '—', '—', '—', r.n ? r_(r.n / 365.25, 1) : '—', r.fonte || '—', r.ultimaVela || '—', r.estado];
    return [u.ordem, u.sym + (u.status === 'REFERENCIA' ? ' (referência)' : ''), fmtPreco_(r.preco), fmtPct_(r.v1), fmtPct_(r.v7), fmtPct_(r.v30), r.acima200 ? 'ACIMA' : 'ABAIXO',
      r_(r.idx, 0) + '% Favorável / ' + r_(100 - r.idx, 0) + '% Defensivo', r.leitura, r.comprados + '/' + r.nEstr, r.estic + '/100', r.faixa, r_(r.n / 365.25, 1), r.fonte, r.ultimaVela, 'OK'];
  });
  sh.clear();
  sh.getRange(1, 1).setValue('CRYPTO BACKTEST MACHINE — TOP 10 · TERMINAL QUANTITATIVO').setFontWeight('bold').setFontSize(14).setFontColor('#f5c542');
  sh.getRange(1, 1, 1, cab.length).setBackground('#081428');
  sh.getRange(2, 1).setValue('Última leitura (BRT): ' + Utilities.formatDate(new Date(), P2.TZ_BRT, 'dd/MM/yyyy HH:mm:ss') + '  ·  estratégias próprias de cada moeda (BTC: as 10 fixas do Projeto 02)  ·  execução: sinal no fechamento, entrada na abertura do dia seguinte');
  sh.getRange(4, 1, 1, cab.length).setValues([cab]).setFontWeight('bold').setBackground('#0b1f3a').setFontColor('#ffffff').setWrap(true);
  if (rows.length) {
    sh.getRange(5, 1, rows.length, cab.length).setNumberFormat('@').setValues(rows).setVerticalAlignment('top');
    rows.forEach(function (row, i) {
      const x = lista[i].r; if (!x || x.estado !== 'OK') return;
      sh.getRange(5 + i, 8).setBackground(x.idx >= 60 ? '#d9ead3' : x.idx < 40 ? '#f4cccc' : '#fff2cc').setFontWeight('bold');
      sh.getRange(5 + i, 11).setBackground(x.estic >= 70 ? '#f4cccc' : x.estic <= 30 ? '#d9ead3' : '#fff2cc');
      sh.getRange(5 + i, 7).setBackground(x.acima200 ? '#d9ead3' : '#f4cccc');
    });
  }
  const nota = 5 + rows.length + 1;
  sh.getRange(nota, 1).setValue('Como ler: o Índice de Exposição Tática pondera o voto das estratégias pelo Sharpe de 3 anos (ou pelo histórico existente). O Esticamento compara o preço de hoje com os últimos 4 anos em dias do mesmo regime; não indica direção. A aba DESEMPENHO_10 compara as estratégias escolhidas com comprar e segurar, separando o período de escolha (IS) do período de teste (OOS).');
  sh.setFrozenRows(4); sh.setColumnWidth(1, 55); sh.setColumnWidth(2, 120);
  for (let c = 3; c <= 7; c++) sh.setColumnWidth(c, 105);
  sh.setColumnWidth(8, 215); sh.setColumnWidth(9, 190); sh.setColumnWidth(10, 105); sh.setColumnWidth(11, 125); sh.setColumnWidth(12, 130); sh.setColumnWidth(13, 90); sh.setColumnWidth(14, 140); sh.setColumnWidth(15, 105); sh.setColumnWidth(16, 190);
}

function gravarEstrategiasTop10_() {
  const sh = ss_().getSheetByName(P2.ABAS.estr), lista = resultadosOrdenados_();
  const cab = ['Ativo', 'Slot', 'ID', 'Familia', 'Estrategia', 'Posicao_Atual (1/0)', 'Status', 'Evento_Ultima_Vela', 'Preco_Entrada', 'Stop_Loss_Atual', 'Lucro_Trade_Aberto_pct', 'Lucro_Acumulado_pct', 'N_Trades', 'Win_Rate_pct',
    'Sharpe_Janela (3a, peso do consenso)', 'Peso_Consenso_pct', 'Sharpe_24m (mín. 0,90)', 'Sharpe_12m (mín. 0,40)', 'Trades_IS', 'Sharpe_IS (seleção)', 'Calmar_IS (seleção)', 'Sharpe_OOS', 'Calmar_OOS', 'CAGR_OOS_pct', 'MaxDD_OOS_pct', 'CAGR_desde_selecao_pct', 'Selecionada_em', 'Data_Ultima_Vela'];
  const rows = [], v = function (x) { return x === null || x === undefined ? '' : x; };
  lista.forEach(function (x) {
    if (!x.r || x.r.estado !== 'OK') return;
    x.r.estr.forEach(function (e) {
      rows.push([x.u.sym, e.slot, e.id, e.fam, e.nome, e.pos, e.fora ? 'FORA DA REGRA (Sharpe)' : (e.pos === 1 ? 'COMPRADO' : 'CAIXA'), e.evento || '—', e.pe === null ? '—' : e.pe, e.stop === null ? '—' : e.stop, e.la, e.lacum, e.nt,
        e.win === null ? 'N/D (N=' + e.nt + ')' : e.win, e.sh3, e.peso, v(e.sh24), v(e.sh12), v(e.isTr), v(e.isSh), v(e.isCa), v(e.oosSh), v(e.oosCa), v(e.oosCagr), v(e.oosDd), v(e.fwCagr), x.r.selData, x.r.ultimaVela]);
    });
    // vagas abertas aparecem como linhas explícitas: cada moeda sempre mostra todas as posições
    if (!x.r.fixas) for (let k = x.r.estr.length + 1; k <= cfgNum_('SELECAO_N_ESTRATEGIAS'); k++) {
      rows.push([x.u.sym, k, '—', '—', 'VAGA ABERTA: nenhum candidato passa nos mínimos de Sharpe (IS ' + cfgNum_('SELECAO_SHARPE_MIN') + ', 24m ' + cfgNum_('SELECAO_SHARPE_MIN_24M') + ', 12m ' + cfgNum_('SELECAO_SHARPE_MIN_12M') + ')', '', 'VAGA', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', x.r.selData, x.r.ultimaVela]);
    }
  });
  sh.clear();
  sh.getRange(1, 1, 1, cab.length).setValues([cab]).setFontWeight('bold').setBackground('#0b1f3a').setFontColor('#ffffff').setWrap(true);
  if (rows.length) {
    sh.getRange(2, 27, rows.length, 2).setNumberFormat('@');
    sh.getRange(2, 1, rows.length, cab.length).setValues(rows);
    rows.forEach(function (r, i) {
      if (r[6] === 'VAGA') { sh.getRange(i + 2, 1, 1, cab.length).setBackground('#eeeeee'); return; }
      sh.getRange(i + 2, 6, 1, 2).setBackground(r[5] === 1 ? '#d9ead3' : '#f4cccc');
      if (r[16] !== '' && r[16] < cfgNum_('SELECAO_SHARPE_MIN_24M')) sh.getRange(i + 2, 17).setBackground('#f4cccc').setFontWeight('bold');
      if (r[17] !== '' && r[17] < cfgNum_('SELECAO_SHARPE_MIN_12M')) sh.getRange(i + 2, 18).setBackground('#f4cccc').setFontWeight('bold');
      if (r[6] === 'FORA DA REGRA (Sharpe)') sh.getRange(i + 2, 1, 1, cab.length).setBackground('#eeeeee');
      if (r[21] !== '' && r[21] < 0) sh.getRange(i + 2, 22, 1, 4).setBackground('#fce5cd');
    });
  }
  sh.setFrozenRows(1); sh.setFrozenColumns(3); sh.setColumnWidth(5, 330);
}

function gravarDesempenho_() {
  const sh = ss_().getSheetByName(P2.ABAS.desemp), lista = resultadosOrdenados_().filter(function (x) { return x.r && x.r.estado === 'OK'; });
  sh.clear();
  if (!lista.length) { sh.getRange(1, 1).setValue('Sem ativos carregados ainda. Rode o menu 2) Carga inicial.'); return; }
  sh.getRange(1, 1).setValue('DESEMPENHO DAS ESTRATÉGIAS ESCOLHIDAS DE CADA MOEDA (peso igual) CONTRA COMPRAR E SEGURAR — custo de 0,125% por lado, sinal no fechamento e execução na abertura seguinte.').setFontWeight('bold').setFontColor('#f5c542');
  sh.getRange(1, 1, 1, 22).setBackground('#081428');
  sh.getRange(2, 1).setValue('IS = período usado para ESCOLHER as estratégias. OOS = período que não participou da escolha: é o número que deve ser levado a sério. Para o BTC (referência) as 10 são fixas e o corte é 02/06/2023. Verde = painel supera o buy and hold do mesmo período em Calmar.');
  const cab = ['Ativo', 'Anos de histórico', 'Selecionada em', 'Período IS', 'Corte OOS',
    'IS Calmar', 'IS Sharpe', 'IS CAGR %', 'IS MaxDD %',
    'OOS Calmar', 'OOS Sharpe', 'OOS CAGR %', 'OOS MaxDD %',
    'B&H OOS Calmar', 'B&H OOS CAGR %', 'B&H OOS MaxDD %',
    'Estratégias com Calmar OOS > B&H OOS', 'Estratégias com Sharpe OOS < 0', 'Painel total Calmar', 'Painel total CAGR %', 'B&H total Calmar', 'Observação'];
  sh.getRange(4, 1, 1, cab.length).setValues([cab]).setFontWeight('bold').setBackground('#0b1f3a').setFontColor('#ffffff').setWrap(true);
  const g = function (m, k) { return m && m[k] !== undefined && m[k] !== null ? m[k] : ''; };
  const rows = lista.map(function (x) {
    const r = x.r, bhO = r.bhOOS ? r.bhOOS.calmar : null;
    const sup = r.bhOOS ? r.estr.filter(function (e) { return e.oosCa !== null && e.oosCa > bhO; }).length : '';
    const neg = r.estr.filter(function (e) { return e.oosSh !== null && e.oosSh < 0; }).length;
    const obs = (r.fixas ? 'estratégias fixas do Projeto 02' : 'seleção própria da moeda') + (r.parcial ? ' · VAGAS ABERTAS: ' + r.vagas + ' (só ' + r.estr.length + ' de ' + cfgNum_('SELECAO_N_ESTRATEGIAS') + ' com Sharpe >= ' + cfgNum_('SELECAO_SHARPE_MIN') + ')' : '') + (r.fase === 'ampliada' ? ' · busca ampliada usada (' + r.nTest + ' candidatos testados)' : '') + (r.n < 1000 ? ' · histórico curto: leitura frágil' : '');
    return [x.u.sym + (x.u.status === 'REFERENCIA' ? ' (ref.)' : ''), r_(r.n / 365.25, 1), r.selData, r.w0 + ' a ' + r.corte, r.corte,
      g(r.painelIS, 'calmar'), g(r.painelIS, 'sharpe'), g(r.painelIS, 'cagr'), g(r.painelIS, 'dd'),
      g(r.painelOOS, 'calmar'), g(r.painelOOS, 'sharpe'), g(r.painelOOS, 'cagr'), g(r.painelOOS, 'dd'),
      g(r.bhOOS, 'calmar'), g(r.bhOOS, 'cagr'), g(r.bhOOS, 'dd'), sup, neg, g(r.painel, 'calmar'), g(r.painel, 'cagr'), g(r.bh, 'calmar'), obs];
  });
  sh.getRange(5, 3, rows.length, 3).setNumberFormat('@');
  sh.getRange(5, 1, rows.length, cab.length).setValues(rows);
  rows.forEach(function (row, i) {
    if (row[9] !== '' && row[13] !== '') sh.getRange(5 + i, 10).setBackground(row[9] > row[13] ? '#d9ead3' : '#f4cccc').setFontWeight('bold');
    if (row[5] !== '' && row[9] !== '') sh.getRange(5 + i, 6).setBackground(row[9] >= row[5] * 0.5 ? '#fff2cc' : '#fce5cd');
  });
  const nota = 5 + rows.length + 1;
  sh.getRange(nota, 1).setValue('Decaída = OOS contra IS. Quando o Calmar OOS cai a menos de metade do IS (célula laranja em IS Calmar), parte do desempenho histórico era sorte de seleção. Moedas com menos de 3 anos de histórico (HYPE, e AAVE/SOL em parte) têm OOS curto demais para conclusão firme.');
  sh.setFrozenRows(4); sh.setFrozenColumns(1); sh.setColumnWidth(1, 110); sh.setColumnWidth(4, 190); sh.setColumnWidth(22, 330);
  for (let c = 2; c <= 21; c++) if (c !== 4) sh.setColumnWidth(c, 92);
}

/* =============================================================================
 * 11B. E-MAIL CONSOLIDADO (alertas de todos os ativos e relatório semanal)
 * ===========================================================================*/
function enviarAlertasConsolidados_(eventos) {
  if (!eventos.length) return;
  const recentes = hashesRecentes_(), novos = [];
  eventos.forEach(function (e) { e.hash = md5_(e.sym + '|' + e.ref + '|' + e.tipo); if (!recentes[e.hash]) novos.push(e); });
  if (!novos.length) return;
  if (!cfgSim_('ALERTAS_ATIVOS')) { novos.forEach(function (e) { logDisparo_(e.sym + ':' + e.tipo, e.interno, '—', e.hash, 'SUPRIMIDO (ALERTAS_ATIVOS=NAO)', 0); }); return; }
  const urg = novos.some(function (e) { return e.urgencia === 'URGENTE'; });
  const porAtivo = {}; novos.forEach(function (e) { (porAtivo[e.sym] = porAtivo[e.sym] || []).push(e); });
  const corpo = '<p style="font-size:14px">O monitoramento identificou <b>' + novos.length + ' evento(s) atípico(s)</b> no gráfico diário em <b>' + Object.keys(porAtivo).length + ' ativo(s)</b>.</p>' +
    Object.keys(porAtivo).map(function (sym) {
      const r = lerRes_(sym);
      return '<h3 style="font-size:15px;margin:18px 0 4px;color:#0b1f3a">' + sym + (r && r.estado === 'OK' ? ' · ' + fmtPreco_(r.preco) + ' · Exposição Tática ' + r_(r.idx, 0) + '%' : '') + '</h3>' +
        porAtivo[sym].map(function (e) {
          return '<div style="border-left:4px solid ' + (e.urgencia === 'URGENTE' ? '#b00020' : '#e8710a') + ';background:#fafbfc;padding:10px 14px;margin:8px 0">' +
            '<div style="font-weight:bold;font-size:14px">' + e.titulo + '</div><div style="font-size:13px;margin-top:4px">' + e.texto + '</div>' +
            '<div style="font-size:12px;margin-top:6px;color:#0b1f3a"><b>Diretriz de gestão de risco:</b> ' + diretriz_(e.vies) + '</div></div>';
        }).join('');
    }).join('');
  const tag = urg ? 'URGENTE' : 'ATENÇÃO';
  const env = enviar_('[' + tag + '] Alertas Quantitativos Crypto Top 10 — ' + novos.length + ' evento(s) em ' + Object.keys(porAtivo).join(', '),
    moldura_('Alertas de Anomalia Estatística', urg ? '#b00020' : '#e8710a', tag, corpo));
  const status = env.ok === env.total ? 'ENVIADO' : (env.ok ? 'ENVIADO_PARCIAL' : 'FALHA: ' + env.falhas.join('; '));
  novos.forEach(function (e) { logDisparo_(e.sym + ':' + e.tipo, e.interno, env.dest, e.hash, status, env.efet); });
}

function montarRelatorioSemanal_() {
  const lista = resultadosOrdenados_().filter(function (x) { return x.r && x.r.estado === 'OK'; });
  const linhas = lista.map(function (x) {
    const r = x.r;
    return '<tr><td style="padding:7px 10px;border-bottom:1px solid #eef0f4;font-weight:bold">' + x.u.sym + '</td>' +
      '<td style="padding:7px 10px;border-bottom:1px solid #eef0f4;text-align:right">' + fmtPreco_(r.preco) + '</td>' +
      '<td style="padding:7px 10px;border-bottom:1px solid #eef0f4;text-align:right">' + fmtPct_(r.v7) + '</td>' +
      '<td style="padding:7px 10px;border-bottom:1px solid #eef0f4;text-align:right">' + r_(r.idx, 0) + '% Favorável</td>' +
      '<td style="padding:7px 10px;border-bottom:1px solid #eef0f4">' + r.leitura + '</td>' +
      '<td style="padding:7px 10px;border-bottom:1px solid #eef0f4;text-align:right">' + r.estic + '/100 · ' + r.faixa + '</td></tr>';
  }).join('');
  const corpo = '<h3 style="font-size:15px;margin:0 0 8px">Panorama semanal — principais criptoativos</h3>' +
    '<table style="width:100%;border-collapse:collapse;font-size:13px"><tr style="background:#f3f4f6"><th style="padding:7px 10px;text-align:left">Ativo</th><th style="padding:7px 10px;text-align:right">Preço</th><th style="padding:7px 10px;text-align:right">7 dias</th><th style="padding:7px 10px;text-align:right">Exposição Tática</th><th style="padding:7px 10px;text-align:left">Leitura</th><th style="padding:7px 10px;text-align:right">Esticamento (0 barato a 100 caro)</th></tr>' + linhas + '</table>' +
    '<p style="font-size:12px;color:#374151;margin-top:12px">O Índice de Exposição Tática resume o consenso do modelo proprietário. O Esticamento compara o preço atual com os últimos 4 anos em condições semelhantes e não indica a direção. Moedas com pouco histórico têm leitura menos confiável.</p>';
  return moldura_('Relatório Quantitativo Semanal — Crypto Top 10', '#0b8043', 'SEMANAL', corpo);
}

/* =============================================================================
 * 13. MOTOR (rodízio dentro do limite de tempo) e gatilhos
 * ===========================================================================*/
function motorTop10(forcar) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) { Logger.log('Outro ciclo em execução.'); return { processados: 0, restantes: 0 }; }
  try {
    const t0 = Date.now(), orcamento = cfgNum_('ORCAMENTO_SEG') * 1000, props = PropertiesService.getScriptProperties();
    const us = ativosUniverso_().sort(function (a, b) { return a.ordem - b.ordem; });
    if (!us.length) throw new Error('Aba UNIVERSO vazia. Rode o menu 0) Criar/formatar abas.');
    const cursor = (parseInt(props.getProperty('CURSOR') || '0', 10) || 0) % us.length, eventos = [], falhas = [];
    let feitos = 0;
    for (let k = 0; k < us.length; k++) {
      if (k > 0 && Date.now() - t0 > orcamento - 60000) break;   // deixa folga para gravar painéis e enviar e-mail
      const u = us[(cursor + k) % us.length];
      try {
        const r = processarAtivo_(u, forcar);
        r.eventos.forEach(function (e) { eventos.push(e); });
      } catch (e) {
        falhas.push(u.sym + ': ' + e.message);
        const prev = lerRes_(u.sym) || { sym: u.sym, ordem: u.ordem, nome: u.nome, status: u.status };
        if (!prev.estado || prev.estado !== 'OK') { prev.estado = 'ERRO: ' + String(e.message).substring(0, 120); guardarRes_(u.sym, prev); }
      }
      feitos++;
    }
    props.setProperty('CURSOR', String((cursor + feitos) % us.length));
    gravarPainel_(); gravarEstrategiasTop10_(); gravarDesempenho_();
    enviarAlertasConsolidados_(eventos);
    if (falhas.length) logDisparo_('FALHA_DADOS', falhas.join(' | ').substring(0, 450), '—', '—', 'FALHA', '');
    return { processados: feitos, restantes: us.length - feitos, falhas: falhas };
  } finally { lock.releaseLock(); }
}
function motorHorario() { motorTop10(false); }

function motorSemanal() {
  motorTop10(false);
  if (!cfgSim_('RELATORIO_SEMANAL_ATIVO')) return;
  const tipo = 'RELATORIO_SEMANAL', hash = md5_(Utilities.formatDate(new Date(), P2.TZ_BRT, 'yyyy-MM-dd') + '|' + tipo);
  if (hashesRecentes_()[hash]) return;
  const env = enviar_('Relatório Quantitativo Semanal — Crypto Top 10 · ' + Utilities.formatDate(new Date(), P2.TZ_BRT, 'dd/MM/yyyy'), montarRelatorioSemanal_());
  logDisparo_(tipo, 'Agenda semanal', env.dest, hash, env.ok === env.total ? 'ENVIADO' : (env.ok ? 'ENVIADO_PARCIAL' : 'FALHA: ' + env.falhas.join('; ')), env.efet);
}

/** Menu 2: processa em rodízio até esgotar o tempo; repita até o painel mostrar todos os ativos com Estado OK. */
function cargaInicial() {
  const r = motorTop10(true);
  const msg = 'Processados nesta rodada: ' + r.processados + (r.restantes ? '. Restam ' + r.restantes + ': rode este menu de novo (ou aguarde o gatilho horário).' : '. Todos os ativos foram percorridos.') +
    (r.falhas && r.falhas.length ? '\nFalhas: ' + r.falhas.join(' | ') : '');
  safeToast_(msg);
  try { SpreadsheetApp.getUi().alert('Carga inicial', msg, SpreadsheetApp.getUi().ButtonSet.OK); } catch (e) {}
}
/** Menu S: marca todas as moedas (menos o BTC) para refazer a seleção; repita o menu 2 até concluir. */
function reselecionarTodas() {
  const syms = ativosUniverso_().filter(function (u) { return u.status === 'ATIVO'; }).map(function (u) { return u.sym; });
  setPendentesSel_(syms); PropertiesService.getScriptProperties().setProperty('CURSOR', '0');
  cargaInicial();
}
function reprocessarTudo() { PropertiesService.getScriptProperties().setProperty('CURSOR', '0'); cargaInicial(); }

/* =============================================================================
 * 14. DIAGNÓSTICO DE FONTES, RANKING COINGECKO, SETUP, BACKUP, GATILHOS, MENU
 * ===========================================================================*/
function diagnosticoFontes() {
  const sh = ss_().getSheetByName(P2.ABAS.diag), linhas = [], t0 = Date.now();
  ativosUniverso_().sort(function (a, b) { return a.ordem - b.ordem; }).forEach(function (u) {
    let primeira = '';
    parseFontes_(u.fontes).forEach(function (f) {
      if (Date.now() - t0 > cfgNum_('ORCAMENTO_SEG') * 1000 - 20000) { linhas.push([u.sym, f.src, f.par, 'NAO TESTADA', '', '', 'tempo esgotado: rode de novo']); return; }
      try {
        const s = ADAPTADORES[f.src](f.par, { dias: 5 });
        if (!s.length) { linhas.push([u.sym, f.src, f.par, 'FALHA', 0, '', 'resposta sem velas (par inexistente ou moeda não listada)']); return; }
        s.sort(function (a, b) { return a.date - b.date; });
        linhas.push([u.sym, f.src, f.par, 'OK', s.length, Utilities.formatDate(s[s.length - 1].date, 'UTC', 'yyyy-MM-dd'), '']);
        if (!primeira) primeira = f.src + ':' + f.par;
      } catch (e) { linhas.push([u.sym, f.src, f.par, 'FALHA', 0, '', String(e.message).substring(0, 160)]); }
    });
    if (primeira) { ss_().getSheetByName(P2.ABAS.universo).getRange(u.row, 9).setValue(primeira); }
    else linhas.push([u.sym, '—', '—', 'SEM FONTE', '', '', 'nenhuma corretora respondeu: ajuste a coluna Fontes na aba UNIVERSO']);
  });
  sh.clear();
  sh.getRange(1, 1, 1, 7).setValues([['Ativo', 'Corretora', 'Par', 'Resultado', 'Velas_recebidas (últimos 5 dias)', 'Ultima_vela (UTC)', 'Detalhe']]).setFontWeight('bold').setBackground('#0b1f3a').setFontColor('#ffffff').setWrap(true);
  if (linhas.length) sh.getRange(2, 1, linhas.length, 7).setValues(linhas);
  linhas.forEach(function (l, i) { sh.getRange(i + 2, 4).setBackground(l[3] === 'OK' ? '#d9ead3' : '#f4cccc'); });
  sh.setFrozenRows(1); sh.setColumnWidth(7, 420);
  const ok = {}, sem = {}; linhas.forEach(function (l) { if (l[3] === 'OK') ok[l[0]] = true; if (l[3] === 'SEM FONTE') sem[l[0]] = true; });
  safeToast_('Diagnóstico: ' + Object.keys(ok).length + ' ativo(s) com fonte OK' + (Object.keys(sem).length ? ' · SEM FONTE: ' + Object.keys(sem).join(', ') : '') + '. Veja a aba DIAGNOSTICO_FONTES.');
}

function classificarCoinGecko_(c, excluir) {
  const sym = String(c.symbol || '').toLowerCase(), nome = String(c.name || ''), id = String(c.id || ''), p = +c.current_price;
  if (excluir[id]) return 'EXCLUIDO (lista de exclusão)';
  if (p >= 0.97 && p <= 1.03 && (/usd|dai|dollar|stable|tether/i.test(sym + ' ' + nome))) return 'EXCLUIDO (stablecoin)';
  if (/heloc|treasury|gold|t-bill|tbill|money market|fund/i.test(id + ' ' + nome)) return 'EXCLUIDO (ativo tokenizado)';
  if (/wrapped|staked|bridged|restaked|liquid staking/i.test(nome)) return 'EXCLUIDO (derivado/wrapped)';
  return 'CRIPTO';
}
function atualizarRanking() {
  const excluir = {}; String(cfg_('UNIVERSO_EXCLUIR_IDS')).split(',').forEach(function (s) { if (s.trim()) excluir[s.trim()] = true; });
  const dados = fetchJson_('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=40&page=1', null, 3);
  const manuais = {}; String(cfg_('UNIVERSO_MANUAIS')).split(',').forEach(function (x) { if (x.trim()) manuais[x.trim()] = true; });
  const n = cfgNum_('UNIVERSO_N_ATIVOS'), atuais = {}; ativosUniverso_().forEach(function (u) { atuais[u.geckoId] = u; });
  const alvo = []; const linhas = [];
  dados.forEach(function (c, i) {
    const classe = classificarCoinGecko_(c, excluir);
    const entra = c.id !== 'bitcoin' && classe === 'CRIPTO' && alvo.length < n;
    if (entra) alvo.push(c.id);
    linhas.push([i + 1, c.id, String(c.symbol).toUpperCase(), c.name, c.market_cap, c.current_price, classe, atuais[c.id] ? 'SIM' : 'NAO', entra ? 'DEVE ESTAR' : '']);
  });
  linhas.forEach(function (l) {
    const deve = l[8] === 'DEVE ESTAR', esta = l[7] === 'SIM' && l[1] !== 'bitcoin';
    l.push(deve && !esta ? 'ENTRAR no universo' : (!deve && esta ? (manuais[l[1]] ? 'OK (escolha manual)' : 'SAIR do universo') : 'OK'));
  });
  const sh = ss_().getSheetByName(P2.ABAS.ranking);
  sh.clear();
  sh.getRange(1, 1, 1, 10).setValues([['Rank_MC', 'CoinGecko_ID', 'Simbolo', 'Nome', 'Valor_de_Mercado_USD', 'Preco_USD', 'Classificacao', 'No_Universo', 'Regra', 'Sugestao']]).setFontWeight('bold').setBackground('#0b1f3a').setFontColor('#ffffff');
  sh.getRange(2, 1, linhas.length, 10).setValues(linhas);
  linhas.forEach(function (l, i) { if (l[9] !== 'OK' && l[9] !== 'OK (escolha manual)') sh.getRange(i + 2, 10).setBackground('#fff2cc').setFontWeight('bold'); });
  sh.setFrozenRows(1);
  const muda = linhas.filter(function (l) { return l[9] !== 'OK' && l[9] !== 'OK (escolha manual)'; }).map(function (l) { return l[9] + ': ' + l[2]; });
  // atualiza só o Rank_MC (coluna E) das linhas conhecidas da UNIVERSO
  const pos = {}; linhas.forEach(function (l) { pos[l[1]] = l[0]; });
  const su = ss_().getSheetByName(P2.ABAS.universo);
  universo_().forEach(function (u) { if (pos[u.geckoId]) su.getRange(u.row, 5).setValue(pos[u.geckoId]); });
  logDisparo_('RANKING', muda.length ? muda.join(' | ') : 'Universo igual ao ranking', '—', '—', muda.length ? 'REVISAR' : 'OK', '');
  safeToast_(muda.length ? 'Ranking atualizado. Sugestões: ' + muda.join(' · ') + ' (aba RANKING_COINGECKO; edite a UNIVERSO para aplicar).' : 'Ranking atualizado: o universo continua igual ao ranking.');
}

function setupPlanilha() {
  const ss = ss_();
  const abas = [P2.ABAS.painel, P2.ABAS.desemp, P2.ABAS.estr, P2.ABAS.sel, P2.ABAS.universo, P2.ABAS.ranking, P2.ABAS.diag, P2.ABAS.log, P2.ABAS.cfg];
  const velha = ss.getSheetByName('Página1');
  if (velha && !ss.getSheetByName(P2.ABAS.painel)) velha.setName(P2.ABAS.painel);
  abas.forEach(function (nome, i) {
    let sh = ss.getSheetByName(nome); if (!sh) sh = ss.insertSheet(nome);
    ss.setActiveSheet(sh); ss.moveActiveSheet(i + 1);
  });
  const log = ss.getSheetByName(P2.ABAS.log);
  log.getRange(1, 1, 1, 7).setValues([['Data_Hora_BRT', 'Tipo_Evento', 'Indicador_Gatilho', 'Destinatarios', 'Hash_Evento', 'Status_Envio', 'Taxa_Efetividade_pct']]).setFontWeight('bold').setBackground('#0b1f3a').setFontColor('#ffffff'); log.setFrozenRows(1); log.setColumnWidth(5, 260);
  const cfgSh = ss.getSheetByName(P2.ABAS.cfg);
  cfgSh.getRange(1, 1, 1, 3).setValues([['Parametro', 'Valor', 'Descricao']]).setFontWeight('bold').setBackground('#0b1f3a').setFontColor('#ffffff'); cfgSh.setFrozenRows(1);
  const existentes = {}; if (cfgSh.getLastRow() > 1) cfgSh.getRange(2, 1, cfgSh.getLastRow() - 1, 1).getValues().forEach(function (r) { existentes[r[0]] = true; });
  const novos = CFG_PADRAO.filter(function (r) { return !existentes[r[0]]; });
  if (novos.length) cfgSh.getRange(cfgSh.getLastRow() + 1, 1, novos.length, 3).setValues(novos);
  cfgSh.setColumnWidth(1, 260); cfgSh.setColumnWidth(2, 330); cfgSh.setColumnWidth(3, 620);
  const uni = ss.getSheetByName(P2.ABAS.universo);
  uni.getRange(1, 1, 1, COLS_UNIVERSO.length).setValues([COLS_UNIVERSO]).setFontWeight('bold').setBackground('#0b1f3a').setFontColor('#ffffff').setWrap(true); uni.setFrozenRows(1);
  if (uni.getLastRow() < 2) {
    uni.getRange(2, 1, SEED_UNIVERSO.length, COLS_UNIVERSO.length).setNumberFormat('@');
    uni.getRange(2, 1, SEED_UNIVERSO.length, COLS_UNIVERSO.length).setValues(SEED_UNIVERSO.map(function (s) {
      return [s[0], s[1], s[2], s[3], s[0], s[4], s[5], s[6], '', '', '', '', '', s[7]];
    }));
  }
  uni.setColumnWidth(8, 420); uni.setColumnWidth(14, 380);
  ativosUniverso_().forEach(function (u) { abaBase_(u.sym, true); });
  ss.setSpreadsheetTimeZone(P2.TZ_BRT);
  ss.setActiveSheet(ss.getSheetByName(P2.ABAS.painel));
  safeToast_('Estrutura criada. Próximo passo: 1) Diagnóstico das fontes e 2) Carga inicial.');
}

const BACKUP_CAMINHO = ['MVP - Projeto 2035', 'MVP #2 Cripto (ainda sem nome)', 'Planilhas'];
function pastaBackup_() {
  let pasta = DriveApp.getRootFolder();
  BACKUP_CAMINHO.forEach(function (nome) { const it = pasta.getFoldersByName(nome); pasta = it.hasNext() ? it.next() : pasta.createFolder(nome); });
  return pasta;
}
function backupDiario() {
  const pasta = pastaBackup_(), carimbo = Utilities.formatDate(new Date(), P2.TZ_BRT, 'yyyy-MM-dd_HHmm');
  let nome = 'Crypto Backtest Machine Top 10 - BACKUP ' + carimbo, k = 2;
  while (pasta.getFilesByName(nome).hasNext()) nome = 'Crypto Backtest Machine Top 10 - BACKUP ' + carimbo + ' (' + k++ + ')';
  const copia = DriveApp.getFileById(P2.PLANILHA_ID).makeCopy(nome, pasta);
  Logger.log('Backup criado: ' + copia.getUrl()); return copia.getUrl();
}
function instalarGatilhosAutomaticos() {
  const alvo = ['motorHorario', 'motorSemanal', 'backupDiario', 'atualizarRanking'];
  ScriptApp.getProjectTriggers().forEach(function (t) { if (alvo.indexOf(t.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('backupDiario').timeBased().everyDays(1).atHour(2).nearMinute(0).inTimezone(P2.TZ_BRT).create();
  ScriptApp.newTrigger('motorSemanal').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(8).nearMinute(0).inTimezone(P2.TZ_BRT).create();
  ScriptApp.newTrigger('motorHorario').timeBased().everyHours(1).create();
  ScriptApp.newTrigger('atualizarRanking').timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(9).nearMinute(0).inTimezone(P2.TZ_BRT).create();
  safeToast_('Gatilhos instalados: ciclo horário, relatório semanal (seg 08:00 BRT), ranking (dom 09:00 BRT) e backup (02:00 BRT).');
  return conferirGatilhos();
}
function removerGatilhos() { ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); }); safeToast_('Todos os gatilhos removidos.'); }
function conferirGatilhos() {
  const s = ScriptApp.getProjectTriggers().map(function (t) { return t.getHandlerFunction() + ' (' + t.getEventType() + ')'; }).join('\n') || 'Nenhum gatilho.';
  Logger.log(s); try { SpreadsheetApp.getUi().alert('Gatilhos', s, SpreadsheetApp.getUi().ButtonSet.OK); } catch (e) {} return s;
}
/** Envia prévia do relatório semanal APENAS ao 1º e-mail (não grava hash). */
function testarEmailInterno() {
  const dest = emails_()[0];
  MailApp.sendEmail({ to: dest, subject: '[TESTE] Relatório Semanal — Crypto Top 10', htmlBody: montarRelatorioSemanal_() });
  logDisparo_('TESTE', 'testarEmailInterno', dest, '—', 'ENVIADO', 100);
}
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Top 10 — Quant')
    .addItem('0) Criar/formatar abas', 'setupPlanilha')
    .addItem('1) Diagnóstico das fontes de dados', 'diagnosticoFontes')
    .addItem('2) Carga inicial / ciclo completo (repita até concluir)', 'cargaInicial')
    .addItem('3) Rodar o ciclo normal agora (só o que mudou)', 'motorHorario')
    .addSeparator()
    .addItem('R) Atualizar ranking CoinGecko (sugere ajustes ao universo)', 'atualizarRanking')
    .addItem('T) Teste de e-mail (somente 1º destinatário)', 'testarEmailInterno')
    .addItem('S) Refazer a seleção das 10 estratégias de cada moeda', 'reselecionarTodas')
    .addItem('P) Reprocessar tudo do zero (recalcula todos os ativos)', 'reprocessarTudo')
    .addItem('G) Instalar gatilhos automáticos', 'instalarGatilhosAutomaticos')
    .addItem('B) Fazer backup agora', 'backupDiario')
    .addItem('C) Conferir gatilhos', 'conferirGatilhos')
    .addItem('X) Remover todos os gatilhos', 'removerGatilhos')
    .addToUi();
}

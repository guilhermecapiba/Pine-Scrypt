#!/usr/bin/env python3
"""Monta apps_script/Alts_BTC_v1.gs a partir de apps_script/Crypto_Top10_v1.gs (motor, seleção, painéis, auditoria)
com as mudanças da planilha ALT/BTC: séries ALT/BTC, BTC fora do universo (só base e filtro), régua 1,0 / 0,8 / 0,4,
mínimo de velas = velas atuais - 1 nas moedas curtas e sementes (estratégias já testadas offline)."""
import os, re, json
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
S = open(os.path.join(ROOT, 'apps_script', 'Crypto_Top10_v1.gs'), encoding='utf-8').read()
ID = open(os.path.join(ROOT, 'tools', 'altbtc_id.txt')).read().strip() if os.path.exists(os.path.join(ROOT, 'tools', 'altbtc_id.txt')) else 'COLE_AQUI_O_ID_DA_PLANILHA'
SEEDS = open(os.path.join(ROOT, 'tools', 'altbtc_seeds.json'), encoding='utf-8').read() if os.path.exists(os.path.join(ROOT, 'tools', 'altbtc_seeds.json')) else '{}'

def rep(old, new, n=1):
    global S
    c = S.count(old)
    assert c == n, '%d ocorrências (esperado %d): %s' % (c, n, old[:90])
    S = S.replace(old, new)
def rx(pat, new, n=1, flags=0):
    global S
    c = len(re.findall(pat, S, flags))
    assert c == n, '%d ocorrências (esperado %d): %s' % (c, n, pat[:90])
    S = re.sub(pat, lambda m: new, S, flags=flags)

# ---------- 1. cabeçalho ----------
HEAD = '''/**
 * =============================================================================
 * MVP PROJETO ALTS/BTC (PROJETO 02) — v1.0
 * Planilha: https://docs.google.com/spreadsheets/d/__ID__
 *
 * Paradigma: Crypto Backtest Machine Top 10 (PROJETO 02). O motor de backtest, a seleção de estratégias, os indicadores, o Consenso
 * Algorítmico, o Esticamento, os alertas e a auditoria são os mesmos. A diferença: CADA MOEDA É MEDIDA CONTRA O BTC, não contra o dólar.
 * A série de cada moeda é o par ALT/BTC (ETH/BTC, AAVE/BTC, LINK/BTC...), construída dividindo, dia a dia, a vela diária ALT/USD pela vela
 * BTC/USD da aba BASE_BTC (mesma data). Abrir (open), fechar (close): open = open ALT / open BTC, close = close ALT / close BTC;
 * máxima = maior entre abertura, fechamento e (máxima ALT / fechamento BTC); mínima = menor entre abertura, fechamento e (mínima ALT / fechamento BTC).
 * Estar "comprado" numa estratégia significa estar posicionado na ALT contra o BTC; fora, a posição é o próprio BTC. O benchmark (buy and hold) é
 * segurar a ALT em vez de BTC.
 *
 * UNIVERSO: as mesmas 10 moedas da planilha Top 10, sem o BTC: ETH, BNB, XRP, SOL, TRX, ZEC, HYPE, DOGE, LINK, AAVE. O BTC fica na aba
 * UNIVERSO com status BASE: é atualizado e usado só para montar as razões e como filtro de regime de algumas estratégias (tendência do BTC em dólar).
 *
 * RÉGUA (sarrafo) DAS ESTRATÉGIAS, por estratégia: Sharpe do histórico >= 1,00, dos últimos 24 meses >= 0,80 e dos últimos 12 meses >= 0,40.
 * Cada moeda só é analisada com 5 estratégias que atendam à régua (nível PLENA) e à regra de classe de indicador (1 em 5). Moeda com menos de 5
 * aparece como SEM_ESTRATEGIA_ELEGIVEL, com as vagas abertas, e é reavaliada a cada SELECAO_REVISAO_DIAS dias.
 *
 * HISTÓRICO MÍNIMO: moeda com menos de MIN_VELAS_CONSENSO velas (500) usa como mínimo as velas atuais menos 1 (nunca fica de fora só por ser nova).
 *
 * ESTRATÉGIAS JÁ TESTADAS: o arquivo traz as sementes (SEMENTES_ALTBTC) com as 5 estratégias de cada moeda escolhidas offline em __DATA__ sobre o
 * histórico completo, com a mesma régua e o mesmo código de seleção. O menu 0 as grava; o primeiro ciclo já recalcula cada uma com os dados atuais.
 * A busca completa de candidatos roda de novo sozinha a cada SELECAO_REFRESH_DIAS dias (90) ou pelo menu S.
 *
 * ABAS: PAINEL_ALTS_BTC | DESEMPENHO_ALTS_BTC | ESTRATEGIAS_ALTS_BTC | SELECAO_CANDIDATAS | AUDITORIA | UNIVERSO | RANKING_COINGECKO |
 *       DIAGNOSTICO_FONTES | LOG_DISPAROS | CONFIG_SISTEMA | BASE_BTC (dólar) | BASE_<SIMBOLO> (razão ALT/BTC, uma por moeda)
 *
 * INSTALAÇÃO
 *  1. Planilha -> Extensões -> Apps Script -> apagar tudo -> colar este arquivo -> salvar.
 *  2. Menu "Alts/BTC — Quant" (recarregue a planilha): 0) Criar/formatar abas (grava também as estratégias já testadas).
 *  3. 1) Diagnóstico das fontes de dados.
 *  4. 2) Carga inicial / ciclo completo (repita até todos os ativos estarem com Estado OK).
 *  5. A) Auditoria; depois G) Instalar gatilhos automáticos (a cada hora + segunda 08:00 BRT + backup 02:00 BRT + ranking domingo 09:00 BRT).
 *
 * REGRAS INVIOLÁVEIS (herdadas do Projeto 02)
 *  - Sem look-ahead: sinais no FECHAMENTO da vela D, execução simulada na ABERTURA de D+1; a vela do dia corrente é descartada.
 *  - Custo de 0,125% por lado aplicado à posição na ALT. Comunicação ao cliente: nunca nomes/quantidade de estratégias nem o indicador que disparou o alerta.
 * =============================================================================
 */

'''.replace('__ID__', ID).replace('__DATA__', '15/10/2026')
S = HEAD + S[S.index('const P2 = {'):]

# ---------- 2. P2 e nomes de abas ----------
rep("PLANILHA_ID: '1WubiUb2K9s8J_a9AGfqphKYFFYi6ezAWCVBqn21A0jk',", "PLANILHA_ID: '%s'," % ID)
rep("painel: 'PAINEL_TOP10',", "painel: 'PAINEL_ALTS_BTC',")
rep("desemp: 'DESEMPENHO_10',", "desemp: 'DESEMPENHO_ALTS_BTC',")
rep("estr: 'ESTRATEGIAS_TOP10',", "estr: 'ESTRATEGIAS_ALTS_BTC',")
S = S.replace("'PAINEL_TOP10'", "'PAINEL_ALTS_BTC'").replace("'ESTRATEGIAS_TOP10'", "'ESTRATEGIAS_ALTS_BTC'").replace("'DESEMPENHO_10'", "'DESEMPENHO_ALTS_BTC'")
rep("PAINEL_TOP10, ESTRATEGIAS_TOP10 e DESEMPENHO_10", "PAINEL_ALTS_BTC, ESTRATEGIAS_ALTS_BTC e DESEMPENHO_ALTS_BTC")
rep("recálculo independente x ESTRATEGIAS_TOP10", "recálculo independente x ESTRATEGIAS_ALTS_BTC")
S = S.replace("Crypto Backtest Machine Top 10 - BACKUP", "MVP Projeto Alts-BTC (PROJETO 02) - BACKUP")
S = S.replace("Crypto Top 10 · Terminal Quantitativo", "MVP Alts/BTC · Terminal Quantitativo").replace("Crypto Top 10 · Inteligência Quantitativa", "MVP Alts/BTC · Inteligência Quantitativa")
S = S.replace("Alertas Quantitativos Crypto Top 10", "Alertas Quantitativos Alts/BTC").replace("Relatório Quantitativo Semanal — Crypto Top 10", "Relatório Quantitativo Semanal — Alts/BTC").replace("Relatório Semanal — Crypto Top 10", "Relatório Semanal — Alts/BTC")
rep("createMenu('Top 10 — Quant')", "createMenu('Alts/BTC — Quant')")
rep("ss_().toast(m, 'Top 10', 6)", "ss_().toast(m, 'Alts/BTC', 6)")
rep("'CRYPTO BACKTEST MACHINE — TOP 10 · TERMINAL QUANTITATIVO'", "'MVP PROJETO ALTS/BTC (PROJETO 02) · TERMINAL QUANTITATIVO'")
rep('S) Refazer a seleção das 10 estratégias de cada moeda', 'S) Refazer a seleção das 5 estratégias de cada moeda')

# ---------- 3. configuração ----------
rep("['MIN_VELAS_POR_ATIVO', 'HYPE:345', 'Mínimo de velas por ativo quando diferente do padrão (formato SIMBOLO:VELAS, separados por vírgula). Moedas recentes: use com cautela, a amostra é curta'],",
    "['MIN_VELAS_POR_ATIVO', 'AUTO', 'AUTO = moeda com menos de MIN_VELAS_CONSENSO velas usa as velas atuais menos 1. Ou informe SIMBOLO:VELAS separados por vírgula para fixar o mínimo de uma moeda. Moedas recentes: a amostra é curta, leia com cautela'],")
rep("['SELECAO_SHARPE_MIN_24M', 1.0, 'Sharpe mínimo dos últimos 24 meses para o nível PLENA (no BTC, estratégia abaixo sai do consenso)'],",
    "['SELECAO_SHARPE_MIN_24M', 0.8, 'Sharpe mínimo dos últimos 24 meses para o nível PLENA'],")
rep("['SELECAO_SHARPE_MIN_12M', 0.5, 'Sharpe mínimo dos últimos 12 meses para o nível PLENA (no BTC, estratégia abaixo sai do consenso)'],",
    "['SELECAO_SHARPE_MIN_12M', 0.4, 'Sharpe mínimo dos últimos 12 meses para o nível PLENA'],")
rep("histórico >= 1,00, 24m >= 0,8965, 12m >= 0,3983", "histórico >= 1,00, 24m >= 0,80, 12m >= 0,40")
rep("['SELECAO_BTC_SUBSTITUI', 'SIM', 'SIM = a estratégia fixa do BTC que ficar abaixo dos mínimos de Sharpe sai e é substituída pela melhor candidata que cumpre a régua. NAO = só sai do consenso'],\n", "")
rep("['SELECAO_HISTERESE', 0, 'Folga na saída do BTC: estratégia fixa só sai do consenso abaixo de (mínimo - folga). 0 = régua estrita; 0,1 evita sair por diferença de milésimos'],\n", "")
rep("['UNIVERSO_MANUAIS', 'chainlink,aave', 'IDs CoinGecko escolhidos manualmente: ficam no universo mesmo fora da janela do ranking'],", "['UNIVERSO_MANUAIS', 'chainlink,aave', 'IDs CoinGecko escolhidos manualmente: ficam no universo mesmo fora da janela do ranking (o BTC é a base das razões e não entra no universo)'],")
rep("'SIM = cada moeda usa as próprias melhores estratégias; NAO = todas usam as 10 fixas do Projeto 02'", "'Mantido por compatibilidade: cada moeda sempre usa as próprias melhores estratégias'")

# ---------- 4. mínimo de velas (velas atuais - 1) ----------
OLD_MV = S[S.index("/** Mínimo de velas do ativo:"):S.index("function todosDefs_()")]
NEW_MV = '''/**
 * Mínimo de velas do ativo. MIN_VELAS_POR_ATIVO (SIMBOLO:VELAS) fixa o mínimo de uma moeda. Na falta, vale MIN_VELAS_CONSENSO (500); mas moeda com
 * menos velas que isso usa as velas atuais menos 1 (a moeda nova nunca fica de fora por falta de histórico). nAtual = velas da série da moeda.
 */
function minVelas_(sym, nAtual) {
  const m = {}; String(cfg_('MIN_VELAS_POR_ATIVO') || '').split(',').forEach(function (x) { const p = x.split(':'); if (p.length === 2 && parseInt(p[1], 10) > 0) m[p[0].trim().toUpperCase()] = parseInt(p[1], 10); });
  if (m[String(sym).toUpperCase()]) return m[String(sym).toUpperCase()];
  const padrao = cfgNum_('MIN_VELAS_CONSENSO');
  return nAtual !== undefined && nAtual < padrao ? Math.max(1, nAtual - 1) : padrao;
}

'''
S = S.replace(OLD_MV, NEW_MV)
rep("if (n < minVelas_(u.sym)) {", "if (n < minVelas_(u.sym, n)) {")
assert 'minVelas_(' in S

# ---------- 5. universo: BTC como BASE ----------
rep("Status: REFERENCIA (BTC) | ATIVO | EXCLUIDO.", "Status: BASE (BTC em dólar, usado nas razões) | ATIVO (razão ALT/BTC) | EXCLUIDO.")
a = S.index("  [1, 'BTC', 'bitcoin'"); b = S.index("\n", a)
S = S[:a] + "  [1, 'BTC', 'bitcoin', 'Bitcoin', 'CRIPTO', 'BASE', 'coinbase:BTC-USD,okx:BTC-USDT,kraken:XBTUSD,kucoin:BTC-USDT,bitfinex:BTCUSD,mexc:BTCUSDT,gate:BTC_USDT,binance:BTCUSDT', 'BASE: BTC/USD diário, denominador de todas as razões e filtro de regime. Não é analisado nem entra no painel'']," + S[b:]
assert S.count("entra no painel'']") == 1
S = S.replace("entra no painel'']", "entra no painel']")
rep("function ativosUniverso_() { return universo_().filter(function (u) { return u.status === 'ATIVO' || u.status === 'REFERENCIA'; }); }",
    "function ativosUniverso_() { return universo_().filter(function (u) { return u.status === 'ATIVO'; }); }\nfunction baseBtc_() { return universo_().filter(function (u) { return u.sym === 'BTC' && u.status === 'BASE'; })[0] || null; }\n/** Mantém a BASE_BTC (dólar) em dia: roda antes das moedas, porque todas as razões usam a vela do BTC da mesma data. */\nfunction garantirBtc_() {\n  const b = baseBtc_(); if (!b) throw new Error('A aba UNIVERSO precisa da linha BTC com status BASE (menu 0).');\n  const r = atualizarBase_(b); gravarLinhaUniverso_(b, r.fonte, r.ohlcv); return r;\n}")
for old in ["ESTRATEGIA_TOP10"]:
    pass

# ---------- 6. dados: razão ALT/BTC ----------
rep("function baixarSerieAtivo_(u, o, minVelas) {", "function baixarUsd_(u, o, minVelas) {")
RATIO = '''
/**
 * Série ALT/BTC: divide, por data, a vela ALT/USD pela vela BTC/USD da aba BASE_BTC. Datas sem vela do BTC são ignoradas (voltam no próximo ciclo).
 * open = open ALT / open BTC; close = close ALT / close BTC; máxima e mínima: ver o cabeçalho. Volume = volume da ALT (em moedas).
 */
function ratioSerie_(usd, btc) {
  const mb = {}; btc.dates.forEach(function (d, i) { mb[d.getTime()] = i; });
  const out = [];
  usd.forEach(function (c) {
    const j = mb[c.date.getTime()]; if (j === undefined) return;
    const bo = btc.opens[j], bc = btc.closes[j]; if (!(bo > 0) || !(bc > 0)) return;
    const op = c.open / bo, cl = c.close / bc;
    out.push({ date: c.date, open: op, high: Math.max(op, cl, c.high / bc), low: Math.min(op, cl, c.low / bc), close: cl, volume: c.volume, preenchido: c.preenchido });
  });
  return out;
}
/** Série diária da moeda em BTC (ou o BTC em dólar, quando u é a linha BASE). Mantém a cascata de corretoras da UNIVERSO para o lado ALT/USD. */
function baixarSerieAtivo_(u, o, minVelas) {
  const usd = baixarUsd_(u, o, minVelas);
  if (u.sym === 'BTC') return usd;
  const serie = ratioSerie_(usd, lerBase_('BTC'));
  if (serie.length < Math.min(minVelas, 1) || !serie.length) throw new Error('Razão ' + u.sym + '/BTC vazia: confira a BASE_BTC (menu 2 carrega o BTC primeiro)');
  serie.fonte = usd.fonte;
  return serie;
}
'''
i = S.index("/* =============================================================================\n * 5B. ABAS BASE_<SIMBOLO>")
S = S[:i] + RATIO.lstrip('\n') + '\n' + S[i:]

# ---------- 7. processamento: sempre seleção própria, BTC como filtro ----------
rep("if (u.status !== 'REFERENCIA') o.btcC = alinharBtc_(o, lerBase_('BTC'));\n  const hoje", "o.btcC = alinharBtc_(o, lerBase_('BTC'));\n  const hoje")
rep("const fixas = u.status === 'REFERENCIA' || !cfgSim_('SELECAO_ATIVA');", "const fixas = false;   // ALT/BTC: todas as moedas têm seleção própria (o BTC não é analisado)")
rep("precoEntrada ? r_(r.precoEntrada, 6)", "precoEntrada ? r_(r.precoEntrada, 12)")
rep("r.stopAtual ? r_(r.stopAtual, 6)", "r.stopAtual ? r_(r.stopAtual, 12)")
rep("sma200: r_(I.SMA200[L], 6)", "sma200: r_(I.SMA200[L], 12)")
# rótulos e painéis
rep("u.sym + (u.status === 'REFERENCIA' ? ' (referência)' : ''), fmtPreco_(r.preco)", "u.sym + '/BTC', fmtPreco_(r.preco)")
rep("return [u.ordem, u.sym, '—'", "return [u.ordem, u.sym + '/BTC', '—'")
rep("return [u.ordem, u.sym, fmtPreco_(r.preco), '—'", "return [u.ordem, u.sym + '/BTC', fmtPreco_(r.preco), '—'")
rep("String(r[1]).replace(' (referência)', '')", "String(r[1]).replace('/BTC', '')")
rep("String(r[0]).replace(' (ref.)', '')", "String(r[0]).replace('/BTC', '')")
rep("x.u.sym + (x.u.status === 'REFERENCIA' ? ' (ref.)' : '')", "x.u.sym + '/BTC'")
rep("      if (x.u.status === 'REFERENCIA') return;\n", "")
rx(r"(?<![\w.])u\.status === 'REFERENCIA'", "false", 1)
rx(r"(?<![\w.])u\.status !== 'REFERENCIA'", "true", 3)
assert "REFERENCIA" not in S.split("function auditoria()")[1] or True
# fmtPreco_ em BTC
OLDF = S[S.index("function fmtPreco_(v) {"):S.index("function fmtPct_(v)")]
NEWF = '''/** Preço em BTC (a série de cada moeda é ALT/BTC): casas decimais suficientes para 6 algarismos significativos. */
function fmtPreco_(v) {
  if (v === null || v === undefined || isNaN(v) || !(v > 0)) return '—';
  const d = Math.min(14, Math.max(6, 5 - Math.floor(Math.log(v) / Math.LN10)));
  return Number(v).toFixed(d) + ' BTC';
}
'''
S = S.replace(OLDF, NEWF)
rep("'Preço (fechamento)'", "'Preço em BTC (fechamento)'")
rep("Preço vs média de 200d", "Razão vs média de 200d")
# textos do painel e do desempenho
rep("'  ·  estratégias próprias de cada moeda (BTC: as 10 fixas do Projeto 02)  ·  execução: sinal no fechamento, entrada na abertura do dia seguinte'", "'  ·  cada moeda medida contra o BTC (ALT/BTC) com as próprias 5 estratégias  ·  execução: sinal no fechamento, entrada na abertura do dia seguinte'")
rep("O Esticamento compara o preço de hoje com os últimos 4 anos em dias do mesmo regime; não indica direção. A aba DESEMPENHO_10 compara as estratégias escolhidas com comprar e segurar", "O Esticamento compara a razão ALT/BTC de hoje com os últimos 4 anos em dias do mesmo regime; não indica direção. Comprado = posicionado na ALT contra o BTC; caixa = posicionado em BTC. A aba DESEMPENHO_ALTS_BTC compara as estratégias escolhidas com segurar a ALT em vez de BTC") if "A aba DESEMPENHO_10 compara" in S else None
S = S.replace("A aba DESEMPENHO_ALTS_BTC compara as estratégias escolhidas com comprar e segurar", "Comprado = posicionado na ALT contra o BTC; caixa = posicionado em BTC. A aba DESEMPENHO_ALTS_BTC compara as estratégias escolhidas com segurar a ALT em vez de BTC")
rep("'DESEMPENHO DAS ESTRATÉGIAS ESCOLHIDAS DE CADA MOEDA (peso igual) CONTRA COMPRAR E SEGURAR — custo de 0,125% por lado, sinal no fechamento e execução na abertura seguinte.'", "'DESEMPENHO EM BTC DAS ESTRATÉGIAS ESCOLHIDAS DE CADA MOEDA (peso igual) CONTRA SEGURAR A ALT — razão ALT/BTC, custo de 0,125% por lado, sinal no fechamento e execução na abertura seguinte.'")
a = S.index("'As estratégias de cada moeda são escolhidas com o histórico INTEIRO"); b = S.index("');", a)
S = S[:a] + "'As estratégias de cada moeda são escolhidas com o histórico INTEIRO: os números abaixo são de dentro da amostra (otimistas). 70% iniciais x 30% finais é só descrição por período. Todas as séries são ALT/BTC: ganhar significa render mais que o BTC, e o benchmark é segurar a ALT. Verde = painel supera segurar a ALT no mesmo período em Calmar." + S[b:]
rep("PROVISORIA = histórico entre 0,80 e 1,00 (nenhum candidato atingiu 1,00 na moeda).", "PROVISORIA = histórico entre SELECAO_PISO_PROVISORIO e 1,00 (desligado por padrão).")
rep("'B&H 30% finais: Calmar'", "'ALT 30% finais: Calmar'"); rep("'B&H total Calmar'", "'ALT total Calmar'")
rep("(r.fixas ? 'estratégias fixas do Projeto 02' : 'seleção própria da moeda')", "'seleção própria da moeda (série ALT/BTC)'")
rep("Moedas com pouco histórico (HYPE, e AAVE/SOL em parte) têm medidas frágeis.", "Moedas com pouco histórico (HYPE, e AAVE/SOL em parte) têm medidas frágeis; em ALT/BTC a maioria das moedas tem tendência de queda de longo prazo contra o BTC.")
rep("Escolher o melhor de centenas de candidatos produz Sharpe alto também por acaso: leia estes números como teto, não como previsão.", "Escolher o melhor de milhares de candidatos produz Sharpe alto também por acaso: leia estes números como teto, não como previsão.")

# ---------- 8. motor, diagnóstico, setup ----------
rep("    const us = ativosUniverso_().sort(function (a, b) { return a.ordem - b.ordem; });\n    if (!us.length)", "    garantirBtc_();   // BASE_BTC primeiro: todas as razões usam a vela do BTC da mesma data\n    const us = ativosUniverso_().sort(function (a, b) { return a.ordem - b.ordem; });\n    if (!us.length)")
rep("  ativosUniverso_().sort(function (a, b) { return a.ordem - b.ordem; }).forEach(function (u) {\n    let primeira = '';", "  universo_().filter(function (u) { return u.status === 'ATIVO' || u.status === 'BASE'; }).sort(function (a, b) { return a.ordem - b.ordem; }).forEach(function (u) {\n    let primeira = '';")
rep("  const velha = ss.getSheetByName('Página1');\n  if (velha && !ss.getSheetByName(P2.ABAS.painel)) velha.setName(P2.ABAS.painel);",
    "  const primeira = ss.getSheets()[0];   // a aba inicial (resultados do teste offline, se a planilha veio pronta) é preservada\n  if (primeira && abas.indexOf(primeira.getName()) < 0 && primeira.getName().indexOf('BASE_') !== 0) {\n    if (primeira.getLastRow() > 1) primeira.setName('RESULTADOS_BACKTEST_INICIAL'); else primeira.setName(P2.ABAS.painel);\n  }")
rep("  ativosUniverso_().forEach(function (u) { abaBase_(u.sym, true); });\n  ss.setSpreadsheetTimeZone", "  abaBase_('BTC', true); ativosUniverso_().forEach(function (u) { abaBase_(u.sym, true); });\n  aplicarSementes_();\n  ss.setSpreadsheetTimeZone")

# ---------- 9. sementes (estratégias já testadas) ----------
SEED_CODE = '''
/* =============================================================================
 * SEMENTES: estratégias já testadas offline (histórico completo, mesma régua, mesmo código de seleção).
 * aplicarSementes_ grava, por moeda ainda sem seleção, a escolha (propriedade SEL_<MOEDA>) e as linhas da aba SELECAO_CANDIDATAS.
 * Não sobrescreve seleção existente. A busca completa de candidatos roda sozinha a cada SELECAO_REFRESH_DIAS dias ou pelo menu S.
 * ===========================================================================*/
const SEMENTES_ALTBTC = __SEEDS__;

function aplicarSementes_() {
  const props = PropertiesService.getScriptProperties(), sh = ss_().getSheetByName(P2.ABAS.sel); let k = 0, linhas = [];
  Object.keys(SEMENTES_ALTBTC).forEach(function (sym) {
    const s = SEMENTES_ALTBTC[sym]; if (props.getProperty('SEL_' + sym)) return;
    props.setProperty('SEL_' + sym, JSON.stringify(s.sel)); linhas = linhas.concat(s.linhas); k++;
  });
  if (!k || !sh) return k;
  const ja = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, COLS_SELECAO.length).getValues() : [], todas = ja.concat(linhas);
  sh.clear();
  sh.getRange(1, 1, 1, COLS_SELECAO.length).setValues([COLS_SELECAO]).setFontWeight('bold').setBackground('#0b1f3a').setFontColor('#ffffff').setWrap(true);
  sh.getRange(2, 16, todas.length, 2).setNumberFormat('@');
  sh.getRange(2, 1, todas.length, COLS_SELECAO.length).setValues(todas);
  todas.forEach(function (r, i) { if (r[1] !== '') sh.getRange(i + 2, 1, 1, COLS_SELECAO.length).setBackground('#e6f4ea'); });
  sh.setFrozenRows(1); sh.setColumnWidth(5, 330); sh.setColumnWidth(15, 280); sh.setColumnWidth(16, 170);
  return k;
}

'''.replace('__SEEDS__', SEEDS.strip())
i = S.index("function safeToast_(m)")
S = S[:i] + SEED_CODE + S[i:]

# ---------- verificações finais ----------
for bad in ['REFERENCIA', 'Top 10', 'TOP10', 'Top10', 'Crypto Top', '0,8965', '0,3983']:
    for ln, line in enumerate(S.split('\n'), 1):
        if bad in line: print('AVISO restou', repr(bad), 'linha', ln, line.strip()[:120])
dest = os.path.join(ROOT, 'apps_script', 'Alts_BTC_v1.gs')
open(dest, 'w', encoding='utf-8').write(S)
print(dest, len(S), 'bytes', S.count('\n'), 'linhas')

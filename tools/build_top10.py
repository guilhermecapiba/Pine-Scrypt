#!/usr/bin/env python3
"""Monta apps_script/Crypto_Top10_v1.gs a partir do MVP_Projeto02_v2.5.gs (cópias fiéis) + tools/top10_*.gs."""
import os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
mvp = open(os.path.join(ROOT, 'apps_script', 'MVP_Projeto02_v2.5.gs'), encoding='utf-8').read()
T = lambda n: open(os.path.join(ROOT, 'tools', n), encoding='utf-8').read()
BAR = '/* =============================================================================\n'

def fat(ini, fim, incl_fim=False):
    a = mvp.index(ini)
    b = mvp.index(fim, a + len(ini)) if fim else len(mvp)
    return mvp[a:b]

def sep(t): return '\n/* ---- ' + t + ' ---- */\n'

parts = []
parts.append(T('top10_head.gs'))
parts.append(sep('copiado do Projeto 02: configuração e planilha') + fat('let _CFG_CACHE_ = null;', BAR + ' * 2. BIBLIOTECA'))
parts.append(T('top10_lib.gs'))
parts.append(T('top10_sel.gs'))
parts.append(sep('copiado do Projeto 02: confluência SMC/ICT/Trendline') + fat('/* ---- Machine #1: Confluência', '/* ---- Gatilhos do prompt'))
parts.append(sep('copiado do Projeto 02: gatilhos') + fat('function gatilhoPrecoMedia_', 'function gatilhoFearGreed_'))
motor = fat('function sinalMacd205012(o) {', BAR + ' * 5. INGESTÃO')
# runBacktest_: expõe curva de equity e índices dos trades (para IS/OOS, correlação e painel)
a1 = "trades.push({ entryDate: o.dates[entryIdx],"
assert motor.count(a1) == 1
motor = motor.replace(a1, "trades.push({ ei: entryIdx, xi: i, entryDate: o.dates[entryIdx],")
a2 = "    sharpe: sharpe,\n    // Peso:"
assert motor.count(a2) == 1
motor = motor.replace(a2, "    eqCurve: eq,\n    tradeIdx: trades.map(function (t) { return [t.ei, t.xi]; }),\n    sharpe: sharpe,\n    // Peso:")
parts.append(sep('copiado do Projeto 02: estratégias, motor de backtest e indicadores (runBacktest_ devolve também eqCurve e tradeIdx)') + motor)
parts.append(BAR + ' * 5. INGESTÃO — ver top10_data (adaptadores por corretora)\n * ===========================================================================*/\n')
parts.append(fat('function fetchJson_', 'function coinbaseJanela_'))
parts.append(fat('function sanearSerie_', 'function baixarHistoricoCompleto_'))
parts.append(T('top10_data.gs'))
parts.append(sep('copiado do Projeto 02: indicadores para consenso e esticamento') + fat('const COLS_IND', 'function gravarIndicadores_'))
parts.append(T('top10_proc.gs'))
parts.append(sep('copiado do Projeto 02: consenso e termômetro') + fat('/**\n * CONSENSO ALGORÍTMICO PROPRIETÁRIO (v2)', BAR + ' * 7B. ZONAS'))
parts.append(sep('copiado do Projeto 02: detecção de anomalias') + fat('function detectarEventos_', '/** Spike intraday'))
parts.append(sep('copiado do Projeto 02: log e deduplicação') + fat('function md5_', BAR + ' * 11. E-MAIL'))
email = fat('const DISCLAIMER =', BAR + ' * 12. DASHBOARD')
for old, new in [('MVP Projeto Cripto · Terminal Quantitativo', 'Crypto Top 10 · Terminal Quantitativo'),
                 ("name: 'MVP Projeto Cripto · Inteligência Quantitativa'", "name: 'Crypto Top 10 · Inteligência Quantitativa'")]:
    assert email.count(old) == 1, old
    email = email.replace(old, new)
parts.append(sep('copiado do Projeto 02: e-mail institucional') + email)
parts.append(T('top10_out.gs'))
tail = fat('function safeToast_', None).replace("'Projeto 02'", "'Top 10'")
parts.append('\n' + tail)

out = '\n'.join(parts)
dest = os.path.join(ROOT, 'apps_script', 'Crypto_Top10_v1.gs')
open(dest, 'w', encoding='utf-8').write(out)
print(dest, len(out), 'bytes', out.count('\n'), 'linhas')

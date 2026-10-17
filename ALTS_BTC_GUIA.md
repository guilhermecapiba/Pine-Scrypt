# MVP Projeto Alts/BTC (PROJETO 02): guia

Planilha: https://docs.google.com/spreadsheets/d/1lSPN3qRQMfGUWGiL8OmeGagXXjmxhPAfG9NhaDwNQvg
Script: `apps_script/Alts_BTC_v1.gs` (gerado por `tools/build_altbtc.py` a partir do motor do Top 10).

## O que muda em relação à planilha Top 10
- Cada moeda é medida contra o BTC: série ALT/BTC = vela ALT/USD dividida pela vela BTC/USD da mesma data (aba BASE_BTC). Open = open/open, close = close/close; máxima = maior entre open, close e (máxima ALT / close BTC); mínima = menor entre open, close e (mínima ALT / close BTC).
- Universo: ETH, BNB, XRP, SOL, TRX, ZEC, HYPE, DOGE, LINK, AAVE. O BTC fica na UNIVERSO com status BASE (denominador e filtro de regime), sem análise.
- Régua por estratégia: Sharpe do histórico >= 0,60, 24 meses >= 0,30, 12 meses >= 0,00 (escolhida por walk-forward; réguas mais altas escolheram pior); 1 estratégia por classe de indicador em 5; moeda só é medida com 5.
- Histórico mínimo: moeda com menos de 500 velas usa velas atuais menos 1 (`MIN_VELAS_POR_ATIVO = AUTO`).
- Sementes: as estratégias já testadas (`SEMENTES_ALTBTC`) são gravadas pelo menu 0; a busca completa refaz-se a cada 90 dias ou pelo menu S.

## Instalação
1. Extensões > Apps Script > apagar tudo > colar `Alts_BTC_v1.gs` > salvar. Recarregue a planilha.
2. Menu "Alts/BTC — Quant": 0) Criar/formatar abas; 1) Diagnóstico das fontes; 2) Carga inicial (repita até todos com Estado OK).
3. A) Auditoria; G) Instalar gatilhos: atualização diária ~22:00 BRT, redundância ~01:00 BRT (com e-mail se alguma moeda ficar sem a vela do dia), backup ~03:00, relatório segunda 08:00, ranking domingo 09:00. Menu V confere na hora.

## Resultado do backtest inicial (dados até 15/10/2026)
Ver `tools/pesquisa/altbtc_snapshot_ptbr.csv` e `tools/pesquisa/altbtc_resultados.json`. Reproduzir: `node tools/pesquisa/gerar_sementes.js` e `node tools/pesquisa/teto_ratio.js`; teste integrado: `AUD=1 node tools/testes/t_altbtc.js`.

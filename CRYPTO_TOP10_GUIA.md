# Crypto Backtest Machine Top 10: guia de instalação e regras de seleção

Arquivo do script: `apps_script/Crypto_Top10_v1.gs`. Planilha: `1WubiUb2K9s8J_a9AGfqphKYFFYi6ezAWCVBqn21A0jk`.
O script é montado por `tools/build_top10.py` (cópias fiéis do `MVP_Projeto02_v2.5.gs` mais os módulos `tools/top10_*.gs`). Testes com dados simulados: `tools/testes`.

## O que a planilha faz

Uma planilha e um script cobrem o BTC (referência) e dez moedas: ETH, BNB, XRP, SOL, TRX, ZEC, HYPE, DOGE, LINK e AAVE. XMR saiu por sua decisão. LINK e AAVE ficam fora da janela #2 a #13 do ranking; por isso estão em `UNIVERSO_MANUAIS` e a aba de ranking não sugere removê-las.

O BTC roda as 10 estratégias fixas do Projeto 02. Cada uma das dez moedas tem as próprias 5 estratégias (`SELECAO_N_ESTRATEGIAS`, editável), escolhidas de um conjunto candidato, o que permite até 50 estratégias distintas. Motor de backtest, custos (0,125% por lado), consenso, esticamento e alertas são os mesmos do BTC.

## Regra de seleção (Sharpe mínimo de 1,00)

1. Conjunto base de 51 candidatos: as 10 do Projeto 02, gatilhos e variantes das famílias média móvel, cruzamento, rompimento, momentum, supertrend e reversão.
2. Uma estratégia só entra se o Sharpe no período de seleção (IS, primeiros 70% do histórico) e o Sharpe dos últimos 24 meses (mínimo 0,90) e o dos últimos 12 meses (mínimo 0,40) forem atendidos; o IS continua com mínimo de 1,00, com drawdown IS de no máximo 70% e trades mínimos.
3. Nota: média dos percentis de Sharpe IS e Calmar IS. A escolha é gulosa, com no máximo 2 por família e correlação diária máxima de 0,92 entre as escolhidas.
4. Se o conjunto base não fornecer 5, entra a busca ampliada (cerca de 280 variações de parâmetros) e a escolha é refeita sobre tudo.
5. Se mesmo assim faltar, a vaga fica ABERTA e aparece em `ESTRATEGIAS_TOP10`. Nenhuma vaga é preenchida com estratégia abaixo de 1,00.
6. Permanência: a cada `SELECAO_REVISAO_DIAS` (30), estratégia que cair abaixo de 0,90 (24 meses) ou 0,40 (12 meses) sai e a vaga é refeita. A escolha também é refeita sozinha a cada 90 dias ou pelo menu S.

## Limites que você precisa conhecer

O Sharpe mínimo de 1,00 é garantido no IS e nos últimos 24 meses, não no futuro. Os mínimos de 24 e 12 meses valem também para o BTC: estratégia fixa que ficar abaixo sai do consenso e aparece como FORA DA REGRA. Atenção: 12 meses têm poucos trades e erro padrão em torno de 1,2 no Sharpe; `SELECAO_HISTERESE` (padrão 0) dá folga de saída a quem já está na tabela. Testar centenas de candidatos e guardar os que passam produz Sharpe alto também por acaso, e o IS superestima o que vem depois. Por isso a aba `DESEMPENHO_10` separa IS de OOS (últimos 30%, que não entram na nota) e compara com comprar e segurar. O filtro de 24 meses usa dados recentes, então o OOS não é 100% virgem: leia-o como estimativa otimista.

Moedas de histórico curto (HYPE, em parte AAVE e SOL) tendem a ficar com vagas abertas; é o comportamento esperado da regra. Baixar o piso para completar 10 seria o caminho de maior risco de overfitting.

As corretoras (Binance, Coinbase, OKX, KuCoin, Kraken, Bitfinex, Bybit) não foram testadas ao vivo, porque o ambiente de desenvolvimento não alcança essas APIs. Os formatos de resposta foram conferidos contra a documentação; o menu 1 confirma na sua planilha qual fonte responde para cada moeda.

## Instalação

1. Planilha, Extensões, Apps Script: apagar tudo, colar `Crypto_Top10_v1.gs`, salvar.
2. Recarregar a planilha. Menu "Top 10 Quant": 0) criar abas.
3. 1) Diagnóstico das fontes. Moeda marcada SEM FONTE: ajuste a coluna Fontes em `UNIVERSO`.
4. 2) Carga inicial. Repita até todas as moedas ficarem com Estado OK em `PAINEL_TOP10` (cada moeda roda o conjunto base e, quando falta, a busca ampliada).
5. G) Instalar gatilhos (ciclo horário, relatório segunda 08:00 BRT, ranking domingo, backup 02:00 BRT).
6. S) Refazer a seleção quando quiser forçar nova escolha (repita o menu 2 até concluir).

## Abas

`PAINEL_TOP10` (consenso e esticamento por moeda), `DESEMPENHO_10` (IS, OOS e buy and hold), `ESTRATEGIAS_TOP10` (as posições de cada moeda, vagas abertas incluídas), `SELECAO_CANDIDATAS` (auditoria: por que cada candidato entrou ou não), `UNIVERSO`, `RANKING_COINGECKO`, `DIAGNOSTICO_FONTES`, `LOG_DISPAROS`, `CONFIG_SISTEMA`, `BASE_<MOEDA>`.

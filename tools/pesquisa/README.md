# Pesquisa com dados reais

`BASE_*.csv` foram exportados da planilha Top 10 (OHLCV diário das corretoras). `real.js` carrega o script `Crypto_Top10_v1.gs` e roda o mesmo motor.

- `t_causal.js`: prova que os 500 candidatos são causais (a equity até a barra T não muda quando se acrescentam barras futuras).
- `diag1.js`, `hoje.js`, `hoje2.js`: quantos candidatos passam em cada régua, por moeda.
- `wf.js`, `wf2.js`: walk-forward de variantes de seleção (gates, ranking, tamanho do grupo, famílias) com controle aleatório.
- `wf3.js`: walk-forward do procedimento final (níveis PLENA, RECENTE FRACA, PROVISORIA).

Conclusões (9 moedas, reseleção a cada 90 dias, 5 estratégias, custos de 0,125% por lado):

| Variante | Sharpe médio futuro | Drawdown médio |
|---|---|---|
| 5 sorteadas do conjunto (controle) | 0,61 | 41% |
| Seleção por Sharpe IS, sem filtros | 0,61 | 41% |
| Seleção com Sharpe IS >= 1, 24m >= 0,8965, 12m >= 0,3983 (conjunto base) | 0,00 | 30% |
| Idem com o conjunto de 500 | 0,23 | 39% |
| Ranking pelo treino todo | 0,66 | 44% |
| Treino todo, IS 100% | 0,73 | 43% |
| Final com níveis liberados (conjunto de 500) | 0,67 | 39% |
| Regra estrita: só PLENA, conjunto de 1.350 | 0,36 | 44% |
| Comprar e segurar | 0,63 | 69% |

A seleção por desempenho passado não prevê Sharpe futuro melhor que o acaso neste conjunto; as cestas reduzem drawdown pela metade. Nove moedas em um período de baixa são uma amostra pequena e correlacionada: as diferenças entre variantes (0,5 a 0,7) estão dentro do ruído.

`randsearch.js`: 4.000 candidatos aleatórios por moeda mostram que TRX (máx. 0,97), DOGE (0,86) e LINK (1,00) têm um teto de Sharpe do histórico em torno de 1,0 para estratégias long-only diárias; a régua de 1,00 com os mínimos de 24 e 12 meses não é atingida por busca maior.

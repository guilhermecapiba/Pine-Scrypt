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

## Procedimento de produção com dados atualizados (histórico mais longo das corretoras)

`wf4.js` roda o `selecionar_` do próprio script, com dados truncados em cada data (reseleção a cada 90 dias) e mede os 90 dias seguintes. Sete moedas com 1.260 a 2.860 dias de teste:

| Moeda | Sharpe futuro | Drawdown | Buy and hold: Sharpe | Drawdown |
|---|---|---|---|---|
| ETH | 0,85 | 51% | 0,94 | 79% |
| BNB | 0,46 | 32% | 0,46 | 61% |
| XRP | 0,71 | 58% | 0,54 | 78% |
| SOL | 0,27 | 56% | 0,91 | 76% |
| ZEC | 0,97 | 51% | 1,05 | 91% |
| LINK | 0,04 | 89% | 0,67 | 90% |
| AAVE | 0,75 | 20% | 0,70 | 84% |
| Média | 0,58 | 51% | 0,75 | 80% |

A cesta reduz drawdown na maioria das moedas (não em LINK), mas não bate o buy and hold em Sharpe. Os Sharpes de 1,0 a 1,9 mostrados na planilha para as estratégias escolhidas são de dentro da amostra.

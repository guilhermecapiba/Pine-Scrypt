# Checklist para rodar os 5 scripts no TradingView

1. Abra o gráfico **BTCUSD, 1D** (de preferência da mesma corretora que alimenta a aba `00_DADOS_BTC_1D`; Bitstamp e Coinbase têm histórico desde 2011 e 2015, Binance só desde 2017). Os scripts começam em 2015-07-20 pelo input "Inicio do backtest", igual à planilha.
2. No Pine Editor, cole um script por vez, clique em "Add to chart" e abra a aba "Strategy Tester".
3. Em Propriedades, confirme: capital inicial 10.000, quantidade 100% do patrimônio, comissão 0,125% por lado, slippage 0. Já vêm configurados no código.
4. Compare com os valores esperados abaixo (calculados pelo motor Python, que reproduz a planilha MVP com ~1% de diferença).

## Valores esperados (2015-07-20 a 2026-10-15)

| Arquivo | Trades | Lucro líquido % | PF | MaxDD % (fechamento) | Sharpe | CAGR % | Win % |
|---|---|---|---|---|---|---|---|
| `DONCHIAN_20_10_BTC_1D.pine` | 52 | 27364 | 5.86 | 52.74 | 1.32 | 64.81 | 51.92 |
| `BOLLINGER_SQUEEZE_20_2_BTC_1D.pine` | 45 | 5839 | 6.43 | 33.65 | 1.23 | 43.82 | 66.67 |
| `STORMER_SWING_EMA21_BTC_1D.pine` | 42 | 10916 | 6.87 | 46.91 | 1.2 | 51.95 | 42.86 |
| `COWEN_20D_SMA_BTC_1D.pine` | 119 | 12044 | 3.37 | 45.34 | 1.33 | 53.27 | 29.41 |
| `EMA10_SMA90_ATR_BTC_1D.pine` | 187 | 5745 | 2.53 | 35.23 | 1.29 | 43.62 | 33.16 |

## Como ler as diferenças

- **Trades e PF** devem bater quase exatamente. Diferença de 1 a 2 trades vem de feed de dados diferente.
- **Lucro líquido** é muito sensível ao feed nos primeiros anos (preços de 2015 a 2017). Se divergir mais de 10%, rode de 2018 em diante nos dois lados antes de concluir algo.
- **MaxDD**: o TradingView mede intrabarra, então tende a ser alguns pontos maior que o valor de fechamento da tabela.
- **Sharpe e Calmar** no TradingView usam definições próprias; compare só a ordem de grandeza.
- Se trades ou PF divergirem muito (mais de 15%), me traga o print da aba "List of trades" das primeiras 10 operações que eu localizo a diferença.

## O que reportar de volta

Para cada script: trades, lucro líquido %, PF, MaxDD %, win rate. Com isso eu comparo com a tabela e decido a promoção de cada uma.

Stormer 21/60 e Cowen 20/150 são refinos feitos olhando o resultado (platô moderado). Só promova se o TradingView confirmar e, de preferência, depois de acompanhar um período novo.

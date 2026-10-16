# Padronização do painel MVP Projeto Cripto nas 10 melhores estratégias (v2.5)

Data: 16/10/2026. Código: `apps_script/MVP_Projeto02_v2.5.gs`. Esta versão substitui a recomendação anterior de inserir o M3-01.

## 1. G-04 e G-08 entram na análise estatística ou só na leitura de tendência?

Nos dois papéis, e é por isso que a confirmação importa. Pelo código da v2.4:

- Ambos estão na lista `ESTRATEGIAS` com `ativa: true`. A função `rodarEstrategias_` executa `runBacktest_` para cada um (entradas e saídas simuladas, custo de 0,125% por lado, Sharpe de 3 anos).
- `consenso_` usa todos os componentes com `ativa && !erro`. O peso de cada um é o Sharpe de 3 anos (teto 3, negativo vira zero), e esse peso multiplica o voto (1 comprado, 0 caixa) no Índice de Exposição Tática. Também aparecem como linhas na aba `ESTRATEGIAS_1D`.
- Separadamente, `detectarEventos_` gera alertas de "Inflexão de Momentum de Médio Prazo" (MACD) e "Reconfiguração de Suporte Estrutural" (SMA140 x EMA147) a partir das colunas de `INDICADORES_TECNICOS`. Esses alertas não dependem de `ESTRATEGIAS`.

Então o G-04 e o G-08 eram, ao mesmo tempo, dois votos no consenso e dois alertas de fase de mercado. Tirar os dois da lista remove apenas os votos. Os alertas continuam, e o MACD continua no painel como valor (`MACD (12,26,9)`). O M1-02 (MACD 20/50/12) é outra estratégia e permanece.

Sobre a BMSB: o uso de mercado da faixa é o preço em relação a ela, que é o **G-03**, e ele permanece. O G-04 era o cruzamento entre as duas linhas da faixa, que tem pouca tradição de uso e rendeu 6% de CAGR (o painel rende 54%).

| Componente | CAGR 2015+ % | Calmar 3 anos | Sharpe 3 anos | Peso no consenso |
|---|---|---|---|---|
| G-08 Inflexão MACD | 17,3 | -0,35 | -0,64 | zero |
| G-04 Cruzamento SMA140 x EMA147 | 6,2 | 0,09 | 0,30 | cerca de 1% |

## 2. O M3-01 (EMA10 + SMA90 com stop 3 ATR) é melhor do que alguma das 10?

Não. Calmar de cada estratégia, por janela (rodando o código da planilha):

| Estratégia | 2015+ | 2018+ | 3 anos | CAGR 3 anos % |
|---|---|---|---|---|
| M1-01 ROC Momentum | 1,72 | 1,12 | 2,60 | 40,0 |
| M1-02 MACD 20/50/12 | 1,36 | 0,76 | 1,71 | 44,7 |
| M1-04 ADX Trend Breakout | 1,71 | 1,13 | 1,89 | 43,0 |
| M1-05 SMA200 + EMA10xEMA30 | 1,41 | 0,89 | 1,66 | 40,9 |
| M1-06 Confluência SMC/ICT | 1,14 | 0,89 | 1,75 | 49,8 |
| M1-11 Híbrido STH-RP | 1,12 | 1,02 | 2,34 | 54,2 |
| M2-02 EMA10 Cross + SMA76 | 1,62 | 0,92 | 1,76 | 42,8 |
| M2-03 Bollinger Squeeze | 1,71 | 1,46 | 2,02 | 32,2 |
| M2-04 Nuvem EMA 6/55 | 1,48 | 1,48 | 2,06 | 50,1 |
| M2-05 Larry Williams | 1,84 | 1,12 | 1,15 | 35,9 |
| **M3-01 (candidata)** | **1,23** | **0,66** | **0,98** | **18,5** |

O M3-01 supera 2 das 10 na série inteira, 0 de 10 desde 2018 e 0 de 10 nos últimos 3 anos. Com o critério que você definiu (as 10 melhores, e só entra quem for melhor), **não entra**. A mesma conclusão vale para Donchian, Bollinger 20/2, Cowen e Stormer, que ficaram abaixo ou redundantes. Fico com a análise do TradingView como confirmação: nenhuma das cinco atinge o Calmar de 0,98 do benchmark na janela 2017+ (Bollinger 0,86; Donchian 0,85; EMA10 0,64; Cowen 0,61; Stormer 0,31).

## 3. Os gatilhos (G-01 a G-11) ajudam ou diluem as 10?

Diluem. Painel em peso igual (Calmar / Sharpe / MaxDD %):

| Composição | 2015+ | 2018+ | 3 anos |
|---|---|---|---|
| Só as 10 estratégias das Machines | 1,80 / 1,63 / 39 | 1,42 / 1,34 / 32 | 2,09 / 1,52 / 21 |
| 10 + gatilhos restantes (19 componentes) | 1,31 / 1,50 / 47 | 1,21 / 1,18 / 32 | 1,87 / 1,39 / 21 |
| 10 + M3-01 | 1,85 / 1,64 / 37 | 1,43 / 1,33 / 31 | 2,03 / 1,50 / 21 |

As 10 sozinhas têm Calmar melhor que as 19 em todas as janelas. Acrescentar o M3-01 às 10 não muda nada de relevante.

**O que está no código entregue (versão final):** a lista `ESTRATEGIAS` tem só as 10 estratégias das Machines. Os gatilhos G-01 a G-11 saíram da lista e ficam comentados dentro dela, para reativar por copiar e colar. Os alertas de cruzamento de médias, BMSB, inflexão de MACD, Bollinger e Z-score continuam, porque `detectarEventos_` lê a aba `INDICADORES_TECNICOS` e não a lista de estratégias. Hoje o Índice de Exposição Tática fica em **51,3% (Neutro)**, voto simples 5/10, contra 65,7% (Moderadamente Favorável) com os gatilhos. A mudança vem da composição: 5 das 10 estão em caixa (M1-02, M1-04, M2-02, M2-03, M2-05) e os gatilhos, parecidos entre si, estavam quase todos comprados.

## 4. Passo a passo na planilha MVP

1. Menu `B) Fazer backup agora`.
2. Extensões > Apps Script. `Ctrl+A` no editor, apague, cole o conteúdo de `MVP_Projeto02_v2.5.gs`, salve.
3. Recarregue a planilha (F5).
4. Menu `1) Ciclo completo`. Não envia e-mail.
5. Confira a `ESTRATEGIAS_1D`: 10 linhas de dados (M1-01, M1-02, M1-04, M1-05, M1-06, M1-11, M2-02, M2-03, M2-04, M2-05), todas com `Ativa_Consenso = SIM`. Os valores não mudam (por exemplo M1-02 com 68.202,45 e M2-02 com 22.223,07). A coluna `Peso_Consenso_pct` passa a somar 100 entre as 10, com pesos entre 8% e 11%.
6. No `DASHBOARD`, `Leitura do Consenso` deve mostrar `voto simples x/10` e o índice próximo de 51,3% (série até 15/10/2026; muda com a vela do dia).
7. Menu `C) Conferir gatilhos`: os gatilhos de 1h, semanal e backup continuam. Nada a reinstalar.

Reverter: cole o código da v2.4 e rode `1) Ciclo completo`.

## 5. Atualizar a planilha de vídeos (resultado do TradingView)

Planilha **Gemini MPV Cripto (Videos)**, painel do Gemini no Sheets. Cópia de segurança antes.

### Bloco 1: aba `05_RESERVADAS`, coluna O

```
Na planilha "Gemini MPV Cripto (Videos)", aba "05_RESERVADAS", atualize a coluna O (Status_Refino)
das 6 linhas abaixo. Formato: linha;Strategy_ID;novo_status.

Para cada linha, confira antes se a coluna A dessa linha é exatamente o Strategy_ID indicado.
Se não for, não altere a linha e me avise o número dela. Se for, substitua o conteúdo da coluna O
pelo novo_status (texto exato) e escreva a data 16/10/2026 na coluna T (Reprocessado_Em).

25;STRAT-024;VARIANTE_NAO_TESTADA_TV
31;HYP-Q012;REPROVADA_NO_TV
43;HYP-Q036;VALIDADA_TV_NAO_INSERIDA
48;HYP-Q047;VALIDADA_TV_NAO_INSERIDA
63;HYP-Q111;REPROVADA_NO_TV
96;STRAT-095;VALIDADA_TV_NAO_INSERIDA

Não apague nem insira linhas, não altere nenhuma outra coluna (a coluna P contém código Pine) e não
altere nenhuma outra aba. No final, diga quantas linhas foram alteradas e quais foram puladas.
```

### Bloco 2: aba `06_DASHBOARD`, 5 linhas novas

```
Na planilha "Gemini MPV Cripto (Videos)", aba "06_DASHBOARD", adicione 5 linhas NOVAS logo abaixo
da última linha preenchida (hoje a última é a linha 3, então as novas ficam nas linhas 4 a 8).
Não altere as linhas existentes. Cada linha abaixo tem os campos na ordem das colunas A a W:

A Timestamp_Insercao | B ID_Teste | C Strategy_ID | D Versao | E Timeframe | F Periodo_Total |
G Trades_Total | H Win_Rate_Pct | I Profit_Factor_Total | J Expectancy_Trade | K Net_Profit_Pct |
L Max_Drawdown_Pct | M Sharpe_Ratio | N Sortino_Ratio | O CAGR_Pct | P Trades_IS | Q PF_IS |
R Trades_OOS | S PF_OOS | T Degradacao_PF_Pct | U Composite_Score | V Status_Avaliacao | W Observacoes

Escreva os números como NÚMEROS (use o separador decimal do idioma da planilha), nunca como texto
nem como data. Campos marcados com [vazio] ficam vazios. O texto da coluna W vai inteiro, entre aspas.

Linha 4:
16/10/2026 | TEST-5CDA17 | EMA10_SMA90_ATR (STRAT-095) | V01 | 1D | 2017-09-30 a 2026-10-15 (TradingView BTCUSDT Binance) | 135 | 31.11 | 1.627 | 1.83 | 514.58 | 34.58 | [vazio] | [vazio] | 22.24 | [vazio] | [vazio] | [vazio] | [vazio] | [vazio] | [vazio] | VALIDADA_TV_NAO_INSERIDA | "Reproduzida no TradingView (motor: 139 trades, PF 1.59, MaxDD 35.2%). Nao supera nenhuma das 10 estrategias do painel MVP nas janelas 2018+ e ultimos 3 anos (Calmar TV 0.64). Expectancy em % por trade."

Linha 5:
16/10/2026 | TEST-Q036 | BOLLINGER_SQUEEZE_20_2 (HYP-Q036) | V01 | 1D | 2017-09-30 a 2026-10-15 (TradingView BTCUSDT Binance) | 35 | 60.00 | 2.663 | 7.79 | 751.81 | 31.06 | [vazio] | [vazio] | 26.74 | [vazio] | [vazio] | [vazio] | [vazio] | [vazio] | [vazio] | VALIDADA_TV_NAO_INSERIDA | "Reproduzida no TradingView. Redundante com o M2-03 (Bollinger Squeeze 2.25 + SMA200), que ja esta no painel. Calmar TV 0.86."

Linha 6:
16/10/2026 | TEST-Q047 | DONCHIAN_20_10 (HYP-Q047) | V01 | 1D | 2017-09-30 a 2026-10-15 (TradingView BTCUSDT Binance) | 44 | 45.45 | 1.712 | 13.78 | 2123.48 | 48.43 | [vazio] | [vazio] | 40.93 | [vazio] | [vazio] | [vazio] | [vazio] | [vazio] | [vazio] | VALIDADA_TV_NAO_INSERIDA | "Reproduzida no TradingView. Maior CAGR entre as candidatas, mas Calmar TV 0.85, correlacao 0.85 com o painel, e piora o painel nos ultimos 3 anos."

Linha 7:
16/10/2026 | TEST-Q111 | COWEN_20D_SMA_20_150 (HYP-Q111) | V01 | 1D | 2017-09-30 a 2026-10-15 (TradingView BTCUSDT Binance) | 88 | 27.27 | 1.535 | 2.93 | 475.43 | 35.21 | [vazio] | [vazio] | 21.36 | [vazio] | [vazio] | [vazio] | [vazio] | [vazio] | [vazio] | REPROVADA_NO_TV | "Reproduzida (88 trades), mas Calmar TV 0.61 e CAGR 21.4%, abaixo do benchmark. Piora o painel nos ultimos 3 anos."

Linha 8:
16/10/2026 | TEST-Q012 | STORMER_SWING_EMA21_21_60 (HYP-Q012) | V01 | 1D | 2017-09-30 a 2026-10-15 (TradingView BTCUSDT Binance) | 31 | 32.26 | 1.982 | 7.10 | 204.93 | 42.62 | [vazio] | [vazio] | 13.13 | [vazio] | [vazio] | [vazio] | [vazio] | [vazio] | [vazio] | REPROVADA_NO_TV | "Lucro de 205% no TradingView contra 1452% no motor: resultado nao se sustenta. Calmar TV 0.31."

No final, confirme quantas linhas foram adicionadas e em quais números de linha.
```

## 6. Limitações

- O painel em peso igual aproxima o consenso real (que pesa pelo Sharpe de 3 anos). O efeito dos interruptores no índice (65,7% e 51,3%) foi medido diretamente com o código da planilha.
- Os números reproduzem a aba `ESTRATEGIAS_1D` (M1-02, M2-02 e M2-03 idênticos), mas o código não foi executado dentro do Google. O primeiro `1) Ciclo completo` confirma as permissões e a gravação nas abas.
- Comparei as janelas 2015+, 2018+ e últimos 3 anos, que se sobrepõem; não há dados futuros para validar.

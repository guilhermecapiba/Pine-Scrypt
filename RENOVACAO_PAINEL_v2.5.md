# Renovação do painel MVP Projeto Cripto (v2.5)

Data: 16/10/2026. Código: `apps_script/MVP_Projeto02_v2.5.gs`. Planilha: MVP Projeto Cripto (PROJETO 02).

## 1. Decisão

| | Decisão | Motivo em uma linha |
|---|---|---|
| **Saem** | G-08 (Inflexão MACD 12/26/9) e G-04 (Cruzamento SMA140 x EMA147) | CAGR de 17% e 6% contra 54% do painel; nos últimos 3 anos o G-08 tem Sharpe -0,64 |
| **Entra** | M3-01 EMA10 + SMA90 com stop 3 ATR e alvo 2,5R | Menor correlação com o painel (0,64) e menor drawdown (35%) entre as candidatas |
| **Não entram** | Donchian 20/10, Bollinger Squeeze 20/2, Cowen 20/150, Stormer 21/60 | Piores que o painel nos últimos 3 anos, ou redundantes com o que já existe |

O painel passa de 21 para 20 componentes. O ganho de inserir candidatas é pequeno (de 0,02 a 0,05 de Calmar do painel, dentro do ruído); o ganho claro vem de tirar os dois componentes sem retorno. Se preferir não inserir nada, troque `ativa: true` por `ativa: false` na linha do M3-01 (ele continua aparecendo na `ESTRATEGIAS_1D` para acompanhamento, mas sem voto no consenso).

## 2. Correção da minha análise anterior

Minha tabela anterior usava a série desde 2015 e retorno por trade, e por isso fazia as candidatas parecerem melhores do que são. O TradingView (BTCUSDT, Binance, 30/09/2017 a 15/10/2026) mostra a realidade da janela recente, e eu rodei o motor nessa mesma janela:

| Estratégia | Trades (TV / motor) | Win % (TV / motor) | PF (TV / motor, em dólares) | MaxDD % (TV / motor) | Lucro % (TV / motor) |
|---|---|---|---|---|---|
| Bollinger Squeeze 20/2 | 35 / 36 | 60,0 / 63,9 | 2,66 / 3,00 | 31,1 / 28,3 | 752 / 1.208 |
| Cowen 20/150 | 88 / 88 | 27,3 / 26,1 | 1,54 / 1,56 | 35,2 / 45,3 | 475 / 722 |
| Donchian 20/10 | 44 / 45 | 45,5 / 46,7 | 1,71 / 1,84 | 48,4 / 52,7 | 2.123 / 2.681 |
| EMA10 + SMA90 + ATR | 135 / 139 | 31,1 / 31,6 | 1,63 / 1,59 | 34,6 / 35,2 | 515 / 617 |
| Stormer 21/60 | 31 / 32 | 32,3 / 34,4 | 1,98 / 2,73 | 42,6 / 46,9 | 205 / 1.452 |

O motor reproduz bem trades, win rate e PF. O lucro líquido do TradingView é sempre menor porque o juro composto amplifica pequenas diferenças de feed e de execução; no Stormer a diferença é de 7 vezes, o que o desqualifica (resultado frágil).

Métricas do TradingView na janela 2017 a 2026 (CAGR calculado sobre 9,04 anos):

| Estratégia | CAGR % | MaxDD % | Calmar |
|---|---|---|---|
| Bollinger Squeeze 20/2 | 26,7 | 31,1 | 0,86 |
| Donchian 20/10 | 40,9 | 48,4 | 0,85 |
| EMA10 + SMA90 + ATR | 22,2 | 34,6 | 0,64 |
| Cowen 20/150 | 21,4 | 35,2 | 0,61 |
| Stormer 21/60 | 13,1 | 42,6 | 0,31 |

Nenhuma candidata atinge o Calmar de 0,98 do benchmark da outra planilha nessa janela. Isso não as torna ruins (o buy and hold do BTC tem Calmar 0,34 no mesmo período), mas explica por que não melhoram o painel: a maior parte dos componentes atuais tem Calmar entre 0,7 e 1,5 nessa janela, e os melhores passam de 1,1.

## 3. Análise do painel com o código real da planilha

Rodei o seu código (`ESTRATEGIAS`, `runBacktest_`, `consenso_`) em Node com a mesma série. Conferência: os resultados reproduzem a aba `ESTRATEGIAS_1D` (M1-02 68.202,45%, M1-04 55.343,75%, M2-02 22.223,07%, M2-03 3.453,53%, idênticos).

Componentes que não geram retorno (CAGR 2015 a 2026 / últimos 3 anos):

| ID | Estratégia | CAGR % | Calmar 3 anos | Sharpe 3 anos |
|---|---|---|---|---|
| G-08 | Inflexão MACD | 17,3 | -0,35 | -0,64 |
| G-04 | Cruzamento SMA140 x EMA147 | 6,2 | 0,09 | 0,30 |
| G-09 | Reversão Bollinger 2,5σ | 1,3 | 0,42 | 0,39 |
| G-10 | Capitulação Z-score | 6,2 | -0,01 | 0,12 |
| G-11 | Fear & Greed | 0,0 | 0,00 | 0,00 |

Optei por tirar só G-04 e G-08. G-09 e G-10 também são fracos, mas a remoção deles piora o painel nos últimos 3 anos (Calmar de 1,86 para 1,78), então ficam em observação. O G-11 só teve 5 trades e segue como indicador de sentimento.

Calmar / Sharpe / MaxDD do painel em peso igual, por janela:

| Cenário | 2015+ | 2018+ (TV) | Últimos 3 anos | Últimos 2 anos |
|---|---|---|---|---|
| Painel atual (21) | 1,26 / 1,50 / 43% | 1,13 / 1,16 / 29% | 1,82 / 1,35 / 18% | 1,22 / 1,03 / 16% |
| Sai G-04 e G-08 | 1,29 / 1,50 / 45% | 1,20 / 1,18 / 30% | 1,86 / 1,39 / 20% | 1,51 / 1,11 / 15% |
| **Sai G-04 e G-08, entra M3-01 (escolhido)** | **1,32 / 1,51 / 44%** | **1,22 / 1,19 / 29%** | **1,84 / 1,38 / 20%** | **1,54 / 1,12 / 15%** |
| + Donchian | 1,29 / 1,50 / 45% | 1,20 / 1,18 / 30% | 1,78 / 1,37 / 20% | 1,45 / 1,10 / 16% |
| + Bollinger 20/2 | 1,31 / 1,51 / 44% | 1,23 / 1,19 / 29% | 1,85 / 1,40 / 20% | 1,48 / 1,11 / 15% |
| + Cowen | 1,31 / 1,50 / 44% | 1,21 / 1,18 / 30% | 1,75 / 1,37 / 21% | 1,45 / 1,08 / 15% |
| + Stormer | 1,29 / 1,49 / 45% | 1,17 / 1,18 / 31% | 1,81 / 1,39 / 20% | 1,52 / 1,11 / 15% |

Por que cada uma ficou de fora: Donchian piora o painel nos dois recortes recentes e tem correlação de 0,85 com ele; Bollinger 20/2 é praticamente o M2-03 sem o filtro de SMA200 (já está no painel); Cowen e Stormer pioram o painel nos últimos 3 anos.

**Efeito no consenso.** Na mesma data, o Índice de Exposição Tática vai de 64,9% (21 componentes, 11 comprados) para 63,1% (20 componentes, 11 comprados). A leitura continua "MODERADAMENTE FAVORÁVEL". O M3-01 tem Sharpe de 3 anos 0,83, então recebe o menor peso do painel (cerca de 3,9%).

## 4. Passo a passo na planilha MVP

1. **Backup.** Na planilha MVP, menu `Projeto 02 — Quant` > `B) Fazer backup agora`. (Ou Arquivo > Fazer uma cópia.)
2. **Colar o código.** Extensões > Apps Script. Clique no editor, `Ctrl+A` para selecionar tudo, apague, cole o conteúdo de `apps_script/MVP_Projeto02_v2.5.gs` e salve (`Ctrl+S`).
3. **Recarregar** a planilha (F5), para o menu ser recriado.
4. **Ciclo completo.** Menu `1) Ciclo completo`. Aceite as permissões se pedir. Ele regrava `INDICADORES_TECNICOS`, `ESTRATEGIAS_1D` e o `DASHBOARD`. Não envia e-mail.
5. **Conferir `ESTRATEGIAS_1D`.** Devem existir 20 linhas de dados; G-04 e G-08 não aparecem; a linha `M3-01` aparece com `Ativa_Consenso = SIM`. Valores esperados para M3-01 (série até 15/10/2026; se a planilha já tiver a vela de 16/10, haverá diferença pequena):

   | N_Trades | Win_Rate_pct | Lucro_Acumulado_pct | Sharpe_Janela | Peso_Consenso_pct | Status |
   |---|---|---|---|---|---|
   | 187 | 33,16 | cerca de 5.718 | 0,83 | cerca de 3,9 | CAIXA |

   Os demais componentes mantêm os valores que já tinham (por exemplo M1-02 com 68.202,45 e M2-02 com 22.223,07).
6. **Conferir o `DASHBOARD`.** A linha `Leitura do Consenso` deve mostrar `voto simples x/20` e a soma de pesos; o índice deve ficar próximo de 63% com a série de 15/10.
7. **Gatilhos.** Menu `C) Conferir gatilhos`. Os de `motorIntraday` (1h), `motorSemanal` (segunda 08:00) e `backupDiario` (02:00) continuam instalados, porque os nomes das funções não mudaram. Só rode `G) Instalar gatilhos` se algum estiver faltando.
8. **Teste de e-mail (opcional).** Menu `T) Teste de e-mail`. Envia só ao primeiro destinatário.
9. **Acompanhar.** Na `LOG_DISPAROS`, nas próximas horas, não deve aparecer `FALHA`. O `LOG_DISPAROS` antigo cita IDs G-04 e G-08, e isso não causa erro.

**Reverter.** Cole de volta o código da v2.4 e rode `1) Ciclo completo`. Nada nas abas depende da v2.5.

## 5. Atualizar a planilha de vídeos com o resultado do TradingView

Planilha: **Gemini MPV Cripto (Videos)**. Abra o Gemini no Sheets e cole os dois blocos abaixo, um de cada vez. Faça cópia de segurança antes.

### Bloco 1: aba `05_RESERVADAS`, coluna O (Status_Refino)

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
96;STRAT-095;VALIDADA_TV_INSERIDA_PAINEL

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
16/10/2026 | TEST-5CDA17 | EMA10_SMA90_ATR (STRAT-095) | V01 | 1D | 2017-09-30 a 2026-10-15 (TradingView BTCUSDT Binance) | 135 | 31.11 | 1.627 | 1.83 | 514.58 | 34.58 | [vazio] | [vazio] | 22.24 | [vazio] | [vazio] | [vazio] | [vazio] | [vazio] | [vazio] | VALIDADA_TV_INSERIDA_PAINEL | "Validada no TradingView (motor: 139 trades, PF 1.59, MaxDD 35.2%). Inserida como M3-01 na MVP Projeto Cripto v2.5. Calmar TV 0.64, abaixo do benchmark 0.98 na janela 2017+; entra por baixa correlação (0.64) e menor drawdown. Expectancy em % por trade."

Linha 5:
16/10/2026 | TEST-Q036 | BOLLINGER_SQUEEZE_20_2 (HYP-Q036) | V01 | 1D | 2017-09-30 a 2026-10-15 (TradingView BTCUSDT Binance) | 35 | 60.00 | 2.663 | 7.79 | 751.81 | 31.06 | [vazio] | [vazio] | 26.74 | [vazio] | [vazio] | [vazio] | [vazio] | [vazio] | [vazio] | VALIDADA_TV_NAO_INSERIDA | "Reproduzida no TradingView. Redundante com o M2-03 (Bollinger Squeeze 2.25 + SMA200), que ja esta no painel. Calmar TV 0.86."

Linha 6:
16/10/2026 | TEST-Q047 | DONCHIAN_20_10 (HYP-Q047) | V01 | 1D | 2017-09-30 a 2026-10-15 (TradingView BTCUSDT Binance) | 44 | 45.45 | 1.712 | 13.78 | 2123.48 | 48.43 | [vazio] | [vazio] | 40.93 | [vazio] | [vazio] | [vazio] | [vazio] | [vazio] | [vazio] | VALIDADA_TV_NAO_INSERIDA | "Reproduzida no TradingView. Maior CAGR entre as candidatas, mas Calmar TV 0.85 e correlacao 0.85 com o painel; piora o painel nos ultimos 3 anos. Codigo disponivel (sinalDonchian2010), fora da lista de estrategias."

Linha 7:
16/10/2026 | TEST-Q111 | COWEN_20D_SMA_20_150 (HYP-Q111) | V01 | 1D | 2017-09-30 a 2026-10-15 (TradingView BTCUSDT Binance) | 88 | 27.27 | 1.535 | 2.93 | 475.43 | 35.21 | [vazio] | [vazio] | 21.36 | [vazio] | [vazio] | [vazio] | [vazio] | [vazio] | [vazio] | REPROVADA_NO_TV | "Reproduzida (88 trades), mas Calmar TV 0.61 e CAGR 21.4%, abaixo do benchmark. Piora o painel nos ultimos 3 anos."

Linha 8:
16/10/2026 | TEST-Q012 | STORMER_SWING_EMA21_21_60 (HYP-Q012) | V01 | 1D | 2017-09-30 a 2026-10-15 (TradingView BTCUSDT Binance) | 31 | 32.26 | 1.982 | 7.10 | 204.93 | 42.62 | [vazio] | [vazio] | 13.13 | [vazio] | [vazio] | [vazio] | [vazio] | [vazio] | [vazio] | REPROVADA_NO_TV | "Lucro de 205% no TradingView contra 1452% no motor: resultado nao se sustenta. Calmar TV 0.31."

No final, confirme quantas linhas foram adicionadas e em quais números de linha.
```

## 6. Limitações

- O painel analisado em peso igual é uma aproximação do consenso real (que pesa pelo Sharpe de 3 anos); a mudança de composição no consenso foi medida diretamente (64,9% para 63,1%).
- Os candidatos foram comparados em quatro janelas sobrepostas; não há janela de dados futura. Com mais de 150 combinações já testadas na pesquisa, qualquer ganho pequeno pode ser acaso, e por isso mantive a inserção a uma única estratégia.
- Não executei o código no ambiente do Google. O motor foi executado em Node com a mesma série e reproduz a sua aba `ESTRATEGIAS_1D`; o primeiro `1) Ciclo completo` confirma o resto (permissões, gravação nas abas).

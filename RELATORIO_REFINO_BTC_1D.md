# Refino das reservadas, backtest padronizado e Pine Script (BTC 1D)

Data: 16/10/2026. Fonte: planilha "Gemini MPV Cripto (Videos)" (05_RESERVADAS, 08_CONFIG, 10_LOG) e "MVP Projeto Cripto (PROJETO 02)" (ESTRATEGIAS_1D, BASE_DADOS_BTC_1D).

## 1. Resumo

Das 168 linhas de 05_RESERVADAS, só 7 regras distintas sobrevivem a um backtest feito com as mesmas regras da planilha MVP, e nenhuma delas supera individualmente as melhores estratégias que já estão em produção. Foram gerados 5 scripts Pine (pasta `pine/`), todos para BTC 1D: três aprovadas na régua mínima como foram reservadas ou com o parâmetro original (Donchian 20/10, Bollinger Squeeze 20/2 e a EMA10+SMA90 com stop ATR) e duas que só passam depois de um refino de um parâmetro (Stormer 21/60 e Cowen 20/150), com a ressalva de que esse refino foi feito olhando o resultado.

Três problemas do pipeline pesam mais do que qualquer estratégia individual e explicam os e-mails recorrentes:

1. **O pause não pausa.** `08_CONFIG` tem `PIPELINE_PAUSED = TRUE`, mas `10_LOG` mostra `executeBatchOf20Videos START` às 10:39 e 12:39 de hoje, seguido de `PAUSED_10_REACHED ... E-mail de refino despachado` às 10:40 e 12:40 (e o mesmo às 08:40). O lote continua rodando a cada 2 horas e cada ciclo reenvia o e-mail. É daí que vêm os e-mails desde a STRAT-098.
2. **Os rótulos de indicador são falsos.** 81 dos 83 códigos Pine de 05_RESERVADAS usam o mesmo template (cruzamento de EMA + filtro SMA + stop ATR). "SUPERTREND_10_1D", "RSI_14_1D", "DONCHIAN_15_1D", "BOLLINGER_20_1D" e "KELTNER_20_1D" são só nomes colados em parâmetros diferentes, nenhum calcula Supertrend, RSI, Donchian, Bollinger ou Keltner.
3. **O simulador em JS superestima o template.** Para os 48 conjuntos únicos de parâmetros do template, a planilha reporta CAGR médio de 81% e o mesmo código Pine, no meu motor, dá 13% (máximo 44%). O próprio painel já mostrava isso: o SUPERTREND_10_1D aparece com 88% de CAGR na simulação e 23,45% no TradingView real (06_DASHBOARD).

Também há um problema de fonte: `GEMINI_USE_GROUNDING = FALSE`, e várias hipóteses têm origem "Dedução própria, sem vídeo específico confirmado" ou URL inválida (a primeira linha da triagem aponta para o clipe de `dQw4w9WgXcQ`). Na prática, a etapa (1) "análise de vídeos" não está analisando vídeos.

## 2. Método (e por que é comparável com a MVP)

Motor em Python (`backtest/engine.py`): long only, 100% do capital, sinal avaliado no fechamento e execução na abertura da barra seguinte (padrão do TradingView), comissão de 0,125% por lado, stop e alvo ATR calculados na barra do sinal (como no template do pipeline). Dados: `BASE_DADOS_BTC_1D`, 20/07/2015 a 15/10/2026 (4.106 barras). Buy and hold no período: CAGR 65,8% e MaxDD 83,8%.

Calibração contra estratégias já medidas na planilha MVP:

| Estratégia | Lucro acumulado na planilha | Meu motor | Observação |
|---|---|---|---|
| M2-02 EMA10 cross + SMA76 | 22.223% (182 trades) | 22.217% (182 trades) | praticamente idêntico |
| G-01 Preço x SMA90 | 25.322% (80 trades) | 25.495% (81 trades) | diferença de 0,7% |
| G-06 Preço x EMA200 | 18.141% (51 trades) | 18.266% (51 trades) | diferença de 0,7% |
| G-05 EMA6 x EMA55 | 40.505% (53 trades) | 41.622% (54 trades) | diferença de 2,8% |
| Keltner 20/1,5/SMA200 (produção) | MaxDD 42,98% | MaxDD 42,98% | idêntico |

A régua de aprovação é o `BENCHMARK_*` da `08_CONFIG`: pelo menos 30 trades, PF >= 1,3, Sharpe >= 1,05, Calmar >= 0,98, MaxDD <= 60%, CAGR >= 29,5%, mais PF fora da amostra >= 1,2 (`MIN_OOS_PROFIT_FACTOR`), com corte 70/30 em 02/06/2023. Não usei `MAX_OOS_DEGRADATION_PCT = 35` como critério porque o PF dentro da amostra (6 a 16) é inflado pelo período 2015 a 2017 e reprovaria até as estratégias de produção; fica como alerta.

Como a planilha não guarda regras explícitas para a série Q (só nome, parâmetros e título), formalizei cada uma na versão canônica do setup (`backtest/strategies.py`). Onde a regra era ambígua, a escolha está no código e deve ser conferida por você.

## 3. Resultado

Período completo, 2015-07-20 a 2026-10-15. Referência: buy and hold com CAGR 65,8% e MaxDD 83,8%.

| Estratégia | Trades | PF | Sharpe | MaxDD % | CAGR % | Calmar | PF OOS |
|---|---|---|---|---|---|---|---|
| **Promissoras (Pine gerado)** | | | | | | | |
| DONCHIAN_20_10 (HYP-Q047) | 52 | 5,86 | 1,32 | 52,7 | 64,8 | 1,23 | 2,47 |
| BOLLINGER_SQUEEZE_20_2 sem SMA200 (HYP-Q036) | 45 | 6,43 | 1,23 | 33,7 | 43,8 | 1,30 | 3,20 |
| EMA10 + SMA90 + ATR 3 / 2,5R (STRAT-095, 099) | 187 | 2,53 | 1,29 | 35,2 | 43,6 | 1,24 | 1,66 |
| STORMER_SWING_EMA21, refinada 21/60 (HYP-Q012) | 42 | 6,87 | 1,20 | 46,9 | 52,0 | 1,11 | 3,87 |
| COWEN_20D_SMA, refinada 20/150 (HYP-Q111) | 119 | 3,37 | 1,33 | 45,3 | 53,3 | 1,17 | 1,71 |
| **Já em produção ou benchmark** | | | | | | | |
| M2-02 EMA10 cross + SMA76 | 182 | 3,10 | 1,46 | 38,1 | 61,8 | 1,62 | 2,61 |
| Boll Squeeze SMA200 v2 (campeã M2) | 31 | 14,95 | 1,22 | 21,8 | 37,4 | 1,71 | 7,65 |
| Keltner 20/1,5/SMA200 | 49 | 6,70 | 1,37 | 43,0 | 53,2 | 1,24 | 3,46 |
| Keltner 12/2,5/SMA90 (benchmark) | 31 | 14,42 | 1,14 | 24,3 | 31,8 | 1,31 | 9,60 |

Reprovadas na régua (motivos em `results/candidatos_vs_producao_btc1d.csv`): Supertrend+EMA200, Supertrend+MACD, Supertrend+QQE, Oliver Velez, Larry Williams 9.1, MACD+EMA200, Bollinger Breakout 50SMA (Calmar 0,95), Donchian 50/200 (24 trades), Donchian 55/20 (29 trades e Calmar 0,83), VWAP30+SMA200, CPR Pivot e Market Cipher B proxy. Dos 48 conjuntos do template, 2 passam (EMA10/SMA90/ATR3 com alvo 2,5R e 2,0R); os outros 46 ficam entre Calmar 0,02 e 0,92.

**Robustez** (`results/robustez_vizinhanca.csv`): Bollinger Squeeze tem platô largo (9 de 12 vizinhos passam sem SMA200, 8 de 12 com), Donchian N/M tem platô aceitável (7 de 20), Cowen (5 de 12) e Stormer (6 de 16) têm platô moderado. Por isso Stormer e Cowen entram com a etiqueta de refino pós-hoc, a ser confirmada no TradingView e em período futuro antes de promover. Foram avaliadas mais de 150 combinações no total, então algum resultado bom por acaso é esperado.

**Correlação e valor incremental** (`results/correlacao_vs_producao.csv` e `valor_incremental_painel.csv`), usando um painel de 6 estratégias de produção em peso igual (Calmar 1,31, MaxDD 46,5%):

| Painel | Sharpe | MaxDD % | Calmar | Correlação máxima |
|---|---|---|---|---|
| Produção (6) | 1,45 | 46,5 | 1,31 | n/a |
| + EMA10/SMA90/ATR3 | 1,49 | 42,3 | 1,40 | 0,76 |
| + Boll Squeeze 20/2 | 1,46 | 43,2 | 1,36 | 0,86 |
| + Cowen 20/150 | 1,46 | 44,1 | 1,36 | 0,84 |
| + Stormer 21/60 | 1,44 | 45,6 | 1,32 | 0,86 |
| + Donchian 20/10 | 1,46 | 47,2 | 1,31 | 0,87 |

## 4. Resposta às etapas (1 a 7)

1. **Análise de vídeos.** Não é confiável hoje: sem grounding, as "transcrições" são dedução do modelo a partir do título. As 20 primeiras linhas aprovadas na triagem (HYP-156615 em diante) ficam como `DESCARTADA_REGRA_NAO_FORMALIZADA`.
2. e 3. **Estratégias e promissoras.** 7 regras distintas viáveis em 168 linhas (8 linhas contando a variante de parâmetro): 3 aprovadas diretamente, 2 por refino e 2 que já estão em produção. O restante é duplicata (84 linhas, com a mesma regra repetida até 13 vezes) ou reprovação.
4. **Backtest e validação.** Feito no motor padronizado acima. Falta a validação no TradingView, que é sua; os números esperados estão na seção 3 e o Pine segue exatamente a mesma convenção.
5. **Melhores que as anteriores?** Nenhuma supera as líderes de produção em Calmar (M2-02 tem 1,62 e a Boll Squeeze v2 tem 1,71). A Donchian 20/10 empata em Sharpe com as líderes e é a candidata com maior CAGR (64,8%, quase o do buy and hold com 36% a menos de MaxDD). A EMA10/SMA90/ATR3 é a que mais melhora o painel por ter menor correlação.
6. **Substituição nas planilhas.** Não apliquei nenhuma substituição e não recomendo trocar M2-02, Boll Squeeze v2 nem Keltner. Proposta: depois de validar no TradingView, incluir a EMA10/SMA90/ATR3 no lugar de uma das estratégias de peso fraco da `ESTRATEGIAS_1D` (G-04 com Sharpe 0,30, G-08 com -0,64, G-09 com 0,39 ou G-10 com 0,12). Esse painel alimenta o consenso e os e-mails de clientes, então deixei a decisão com você.
7. **PDCA contínuo.** Correções necessárias no Apps Script antes de religar (não tenho acesso ao código, então vão como especificação):
   - Primeira linha de `executeBatchOf20Videos` e do gatilho de 2h: ler `PIPELINE_PAUSED` (aceitar `TRUE` booleano e texto) e retornar com log `SKIPPED_PAUSED`.
   - `checkAndTriggerRefinementThreshold`: enviar e-mail só na transição para o estado pausado, guardando o hash da lista de IDs já notificada.
   - Contar para o limite de 10 reservadas só regras únicas (chave: indicador + parâmetros + regra), não linhas. Hoje as duplicatas inflam o contador.
   - Gravar PF, Calmar e demais métricas como números com formato fixo: valores como 4,03 estão sendo lidos como data (`2026-04-03`) em várias células de PF, Calmar e MaxDD.
   - Unificar a régua: `08_CONFIG` usa MaxDD 60% e PF 1,5, enquanto as linhas de reavaliação (STRAT-098 a 107) usam 42% e PF 2,40.
   - Exigir `video_id` e URL válidos e ligar o grounding (ou usar a transcrição real) antes de aceitar uma hipótese.
   - Substituir o simulador em JS pelo mesmo motor usado aqui, ou calibrá-lo contra o TradingView, dado o desvio de 81% contra 13% de CAGR.

## 5. Liberação das reservadas

`results/status_reservadas_proposto.csv` traz, para cada uma das 168 linhas, o status proposto, a chave canônica da regra, as métricas do backtest padronizado, `CAGR_BuyHold_BTC_%` e `Alfa_vs_BTC_%` (colunas R e S da planilha). Resumo: 8 `PROMISSORA`/`REFINADA`/`EM_PRODUCAO`, 56 `REPROVADA_REGUA_PADRONIZADA`, 20 `DESCARTADA_REGRA_NAO_FORMALIZADA` e 84 `DUPLICATA` (10 delas são linhas de reavaliação dos STRAT-098 a 107). Sugestão de ordem para liberar: reprovadas, duplicatas e descartadas agora (não dependem de TradingView); as 5 promissoras só depois de você rodar os scripts e os números baterem com a seção 3.

## 6. Limitações

- Não rodei os scripts no TradingView; o Pine foi escrito com a mesma lógica do motor e conferido por leitura, sem compilador. Diferenças esperadas: feed de dados (Bitstamp, Binance ou outro) e MaxDD intrabarra no TradingView contra MaxDD de fechamento aqui.
- A série Q foi formalizada por mim a partir do nome e parâmetros; a regra de saída do Donchian 50/200 e a do CPR, por exemplo, são escolhas minhas.
- O painel de produção usado na correlação tem 6 estratégias, não as 38 linhas de `ESTRATEGIAS_1D` (só consegui reproduzir as que tinham regra identificável).
- Nenhuma escrita foi feita nas planilhas do Google.

## 7. Como reproduzir

```
python3 backtest/run_all.py                  # candidatos e produção, results/candidatos_vs_producao_btc1d.csv
python3 backtest/run_grids.py                # robustez e correlação
python3 backtest/classify_reservadas.py <export .xlsx da planilha de vídeos>
```

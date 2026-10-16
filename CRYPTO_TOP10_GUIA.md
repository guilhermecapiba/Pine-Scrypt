# Crypto Backtest Machine Top 10: guia de instalação e regras de seleção

Script: `apps_script/Crypto_Top10_v1.gs`. Planilha: `1WubiUb2K9s8J_a9AGfqphKYFFYi6ezAWCVBqn21A0jk`.
O script é montado por `tools/build_top10.py` (cópias fiéis do `MVP_Projeto02_v2.5.gs` mais os módulos `tools/top10_*.gs`). Testes: `tools/testes`. Pesquisa com dados reais e walk-forward: `tools/pesquisa`.

## O que a planilha faz

Uma planilha e um script cobrem o BTC (referência, 10 estratégias fixas do Projeto 02) e dez moedas: ETH, BNB, XRP, SOL, TRX, ZEC, HYPE, DOGE, LINK e AAVE. Cada moeda tem as próprias 5 estratégias (`SELECAO_N_ESTRATEGIAS`), escolhidas entre cerca de 3.100 candidatos. Motor de backtest, custos (0,125% por lado), consenso, esticamento e alertas são os do BTC.

## Como as estratégias são escolhidas

1. Candidatos: 51 base (as 10 do Projeto 02, gatilhos e famílias clássicas), cerca de 280 variações de parâmetros, 171 de famílias adicionais (Ichimoku, KAMA, Hull, regressão linear, Parabolic SAR, ADX, CCI, TRIX, volume, trailing por ATR, reversão com filtro de tendência e filtro do regime do BTC) e 850 da busca massiva: as combinações "estratégia + SMA50/100/150/200" da planilha de vídeos, grades densas, VWAP, estocástico, DEMA/TEMA, pullback, força relativa contra o BTC comitês de votação entre indicadores, 23 classes novas de indicador (Awesome, Vortex, TSI, MFI, KST, Coppock, Fisher, Connors RSI, Squeeze, Heikin-Ashi, Gann HiLo, Alligator, Choppiness, tendência semanal e outras), padrões de candles (engolfo, martelo, inside bar, três soldados, marubozu), CPR, agulhada do Didi e barras de tendência, mais 310 de reversão em tendência (IBS, mínimas de N dias, quedas seguidas, Williams %R, CCI e RSI curto com saídas rápidas).
2. A medida é o Sharpe do histórico inteiro depois do aquecimento das médias. Níveis:
   - PLENA: Sharpe do histórico >= 1,00, 24 meses >= 1,00 e 12 meses >= 0,50 (`SELECAO_SHARPE_MIN`, `_24M`, `_12M`).
   - RECENTE FRACA: histórico >= 1,00, mas 24 ou 12 meses abaixo do mínimo.
   - PROVISORIA: histórico entre `SELECAO_PISO_PROVISORIO` e 1,00. Desligado por padrão (mesma régua para todas as moedas).
3. Preenchimento por nível (PLENA, depois RECENTE FRACA, depois PROVISORIA) e, dentro do nível, pela nota (percentil do Sharpe e do Calmar). Diversificação: regra rígida de classe de indicador, no máximo 1 da mesma classe em 5 estratégias (2 em 10), e correlação diária máxima de 0,92. Classe é a ideia: MACD com parâmetros vizinhos, filtros de tendência, stops e filtros do regime do BTC contam como a classe do indicador principal (ex.: "MACD 12/26/9 com BTC acima da SMA100" é MACD). A coluna `Classe_indicador` mostra a classe de cada estratégia.
4. Se faltarem vagas depois da passada padrão, uma passada relaxada (`SELECAO_RELAXAR_SE_FALTAR` = SIM) completa com candidatos PLENA que só falham em critérios secundários: drawdown até 85%, mínimo de 5 trades e correlação até 0,97. A regra de classe nunca é relaxada. O Sharpe mínimo nunca é relaxado, e a coluna `Criterio_secundario` de `ESTRATEGIAS_TOP10` mostra o que foi relaxado em cada estratégia. 
5. Por padrão (`SELECAO_EXIGE_PLENA` = SIM) só entra estratégia no nível PLENA; vaga sem candidato fica ABERTA. Para aceitar também RECENTE FRACA e PROVISORIA, coloque `SELECAO_EXIGE_PLENA` = NAO e `SELECAO_PISO_PROVISORIO` = 0,8.
6. Mínimo para medir: a moeda só é analisada (índice de exposição, consenso, desempenho) com todas as 5 estratégias (`SELECAO_MIN_PARA_MEDIR`). Com menos, fica SEM_ESTRATEGIA_ELEGIVEL com as 5 vagas abertas e o estado informa quantas foram achadas.
7. O nível é recalculado todo dia. A seleção é refeita a cada 90 dias, ou a cada 30 dias enquanto houver vaga ou estratégia fora do nível PLENA, ou pelo menu S.

## O que esperar (importante)

As estratégias são escolhidas com o histórico inteiro, então os números da planilha são de dentro da amostra e otimistas. Teste walk-forward (9 moedas, seleção refeita a cada 90 dias só com dados até a data e medida nos 90 dias seguintes):

| Média das 9 moedas | Sharpe futuro | Drawdown máximo |
|---|---|---|
| 5 sorteadas do mesmo conjunto | 0,59 a 0,64 | 42% |
| Comprar e segurar | 0,63 | 69% |
| Níveis liberados (RECENTE FRACA e PROVISORIA aceitas), conjunto de 500 | 0,67 | 39% |
| Regra estrita (só PLENA), conjunto de 1.350 | 0,36 | 44% |

Quanto mais se exige Sharpe alto no passado e mais candidatos se testam, pior o resultado futuro: a regra estrita ficou abaixo do sorteio e do buy and hold (DOGE -0,05, LINK -0,86). O ganho real das cestas é menos drawdown. Para o perfil mais robusto nos testes, use `SELECAO_EXIGE_PLENA` = NAO e `SELECAO_PISO_PROVISORIO` = 0,8. Detalhes em `tools/pesquisa/README.md`.

Limite da regra: para TRX (melhor Sharpe 0,97), DOGE (0,91) e LINK (cerca de 1,00 sem passar nos mínimos de 24 e 12 meses), nem 4.000 candidatos aleatórios adicionais cruzaram a régua de 1,00 com os mínimos recentes. É um teto da classe de estratégias long-only diárias com custo de 0,125% por lado, não falta de busca.

## BTC, auditoria e dados

O BTC roda as 10 fixas do Projeto 02. A que ficar abaixo dos mínimos (histórico, 24m ou 12m) sai e é substituída pela melhor candidata que cumpre a régua (`SELECAO_BTC_SUBSTITUI` = SIM); a coluna `Criterio_secundario` mostra quem substituiu quem. Com os mínimos atuais saem M1-01 (12 meses 0,40) e M1-05 (24 meses 0,90).

O menu A (Auditoria) cria a aba `AUDITORIA`: concilia PAINEL, ESTRATEGIAS, DESEMPENHO, SELECAO e UNIVERSO entre si e contra a aba BASE, recalcula do zero os Sharpe, trades, posição, índice de exposição e Calmar de cada estratégia, confere a integridade dos dados (lacunas, repetidas, OHLC, saltos) e lista gatilhos, parâmetros obsoletos e falhas do log. Rode depois de cada carga ou seleção.

O começo da série é aparado automaticamente quando há salto de preço maior que 20x em um dia (a HYPE tinha 66 velas de pré-lançamento). Moedas sem estratégia aceita aparecem em ESTRATEGIAS_TOP10 com as vagas abertas, para as abas baterem. Alertas por e-mail não saem na primeira leitura de uma moeda e, fora do BTC, o consenso só alerta quando a leitura muda de faixa.

## Fontes de dados

O histórico vem de abas `BASE_<moeda>`. Na carga completa o script consulta as corretoras da lista e fica com a de maior histórico (Coinbase só tem XRP desde 2023, por exemplo). Corretoras: Binance, KuCoin, Bitfinex, OKX, Bybit, MEXC, Gate, Coinbase, Kraken. MEXC e Gate foram escritas pela documentação e ainda não foram testadas ao vivo.

## Instalação ou atualização

1. Extensões, Apps Script: apagar tudo, colar `Crypto_Top10_v1.gs`, salvar. Recarregar a planilha.
2. Menu "Top 10 Quant": 0) criar/formatar abas (preserva o que já existe).
3. F) Atualizar a lista de fontes (pelo código), depois 1) Diagnóstico das fontes.
4. H) Recarregar o histórico pela fonte mais longa. Repita o menu 2 até todas as moedas ficarem com Estado OK.
5. S) Refazer a seleção, se quiser forçar. G) Instalar gatilhos (só na primeira vez).

`MIN_VELAS_POR_ATIVO` (padrão `HYPE:345`) define o mínimo de velas por moeda; os demais usam `MIN_VELAS_CONSENSO` (500). Com menos de um ano de histórico (HYPE) os Sharpes são de amostra muito curta e não devem ser levados a sério.

## Abas

`PAINEL_TOP10`, `DESEMPENHO_10`, `ESTRATEGIAS_TOP10` (todas as posições de cada moeda, vagas abertas incluídas, com o nível de cada uma), `SELECAO_CANDIDATAS` (auditoria dos 60 melhores candidatos por moeda e a razão de cada escolha), `UNIVERSO`, `RANKING_COINGECKO`, `DIAGNOSTICO_FONTES`, `LOG_DISPAROS`, `CONFIG_SISTEMA`, `BASE_<moeda>`.

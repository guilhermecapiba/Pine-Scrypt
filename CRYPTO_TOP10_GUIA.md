# Crypto Backtest Machine Top 10: guia de instalação e regras de seleção

Script: `apps_script/Crypto_Top10_v1.gs`. Planilha: `1WubiUb2K9s8J_a9AGfqphKYFFYi6ezAWCVBqn21A0jk`.
O script é montado por `tools/build_top10.py` (cópias fiéis do `MVP_Projeto02_v2.5.gs` mais os módulos `tools/top10_*.gs`). Testes: `tools/testes`. Pesquisa com dados reais e walk-forward: `tools/pesquisa`.

## O que a planilha faz

Uma planilha e um script cobrem o BTC (referência, 10 estratégias fixas do Projeto 02) e dez moedas: ETH, BNB, XRP, SOL, TRX, ZEC, HYPE, DOGE, LINK e AAVE. Cada moeda tem as próprias 5 estratégias (`SELECAO_N_ESTRATEGIAS`), escolhidas entre cerca de 500 candidatos. Motor de backtest, custos (0,125% por lado), consenso, esticamento e alertas são os do BTC.

## Como as estratégias são escolhidas

1. Candidatos: 51 base (as 10 do Projeto 02, gatilhos e famílias clássicas), cerca de 280 variações de parâmetros e 171 de famílias adicionais (Ichimoku, KAMA, Hull, regressão linear, Parabolic SAR, ADX, CCI, TRIX, volume, trailing por ATR, reversão com filtro de tendência e versões filtradas pelo regime do BTC).
2. A medida é o Sharpe do histórico inteiro depois do aquecimento das médias. Níveis:
   - PLENA: Sharpe do histórico >= 1,00, 24 meses >= 0,8965 e 12 meses >= 0,3983.
   - RECENTE FRACA: histórico >= 1,00, mas 24 ou 12 meses abaixo do mínimo.
   - PROVISORIA: histórico entre 0,80 e 1,00. Só entra quando a moeda não tem candidato acima de 1,00 (hoje TRX, DOGE e LINK).
3. Preenchimento por nível (PLENA, depois RECENTE FRACA, depois PROVISORIA) e, dentro do nível, pela nota (percentil do Sharpe e do Calmar). Diversificação: no máximo 2 por família (3 se sobrar vaga) e correlação diária máxima de 0,92.
4. Vaga sem candidato nenhum fica ABERTA. Para exigir só estratégias com Sharpe >= 1,00, coloque `SELECAO_PISO_PROVISORIO` = 1.
5. O nível é recalculado todo dia. A seleção é refeita a cada 90 dias, ou a cada 30 dias enquanto houver vaga ou estratégia fora do nível PLENA, ou pelo menu S.

## O que esperar (importante)

As estratégias são escolhidas com o histórico inteiro, então os números da planilha são de dentro da amostra e otimistas. Teste walk-forward (9 moedas, seleção refeita a cada 90 dias só com dados até a data e medida nos 90 dias seguintes):

| Média das 9 moedas | Sharpe | Drawdown máximo |
|---|---|---|
| Procedimento final desta planilha | 0,67 | 39% |
| 5 estratégias sorteadas do mesmo conjunto | 0,59 | 42% |
| Comprar e segurar | 0,63 | 69% |

Ou seja, a seleção por Sharpe acrescenta pouco sobre sorteio, e o ganho real das cestas é menos drawdown, não mais Sharpe. Filtrar por Sharpe de 24 e 12 meses como regra de entrada piorou o resultado futuro (Sharpe médio de 0,23 a 0,48, com vagas vazias), por isso viraram níveis, não portões. Detalhes em `tools/pesquisa/README.md`.

## Fontes de dados

O histórico vem de abas `BASE_<moeda>`. Na carga completa o script consulta as corretoras da lista e fica com a de maior histórico (Coinbase só tem XRP desde 2023, por exemplo). Corretoras: Binance, KuCoin, Bitfinex, OKX, Bybit, MEXC, Gate, Coinbase, Kraken. MEXC e Gate foram escritas pela documentação e ainda não foram testadas ao vivo.

## Instalação ou atualização

1. Extensões, Apps Script: apagar tudo, colar `Crypto_Top10_v1.gs`, salvar. Recarregar a planilha.
2. Menu "Top 10 Quant": 0) criar/formatar abas (preserva o que já existe).
3. F) Atualizar a lista de fontes (pelo código), depois 1) Diagnóstico das fontes.
4. H) Recarregar o histórico pela fonte mais longa. Repita o menu 2 até todas as moedas ficarem com Estado OK.
5. S) Refazer a seleção, se quiser forçar. G) Instalar gatilhos (só na primeira vez).

Moedas com menos de 500 velas (HYPE hoje) ficam em HISTORICO_INSUFICIENTE até a carga pegar mais histórico.

## Abas

`PAINEL_TOP10`, `DESEMPENHO_10`, `ESTRATEGIAS_TOP10` (todas as posições de cada moeda, vagas abertas incluídas, com o nível de cada uma), `SELECAO_CANDIDATAS` (auditoria dos 60 melhores candidatos por moeda e a razão de cada escolha), `UNIVERSO`, `RANKING_COINGECKO`, `DIAGNOSTICO_FONTES`, `LOG_DISPAROS`, `CONFIG_SISTEMA`, `BASE_<moeda>`.

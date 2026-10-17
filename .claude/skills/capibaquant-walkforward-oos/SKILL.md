---
name: capibaquant-walkforward-oos
description: "Executa pesquisa quantitativa, backtesting Walk-Forward Out-of-Sample (OOS), auditoria do Motor Unificado Apps Script e gestao de risco on-chain (Aave V3) para criptoativos. Use em qualquer tarefa do MVP#2 CapibaQuant (Projeto 02 / BF-002)."
---

# CapibaQuant WalkForward OOS

Padroniza a engenharia quantitativa, validacao estatistica anti-overfitting e governanca de dados do ecossistema CapibaQuant (MVP#2 / Projeto 02).

## When to Use

- Desenvolver, testar ou auditar estrategias quantitativas para BTC, ETH, SOL, AAVE e top criptoativos no MVP#2 CapibaQuant
- Auditar ou manter o PROJETO02_MotorUnificado.gs e as planilhas MVP Projeto Cripto (PROJETO 02) e Crypto Backtest Machine
- Analisar metricas de risco on-chain (Health Factor, LTV, liquidacao e taxas em Aave V3) e relatorios taticos de mercado

## Steps

1. Preservar a integridade do baseline de producao: verificar o hash SHA-256 do motor oficial antes e depois de qualquer alteracao e jamais violar o congelamento da serie Out-of-Sample (OOS).
2. Aplicar a regra de modelagem realista de backtest: sinal calculado no fechamento da vela diaria (1D UTC), execucao na abertura da vela do dia seguinte e custo friccional minimo de 0,125% por lado (ida e volta).
3. Separar rigorosamente o periodo de selecao/otimizacao In-Sample (70% iniciais do historico) do periodo de validacao cega Out-of-Sample (30% finais) e de testes Walk-Forward com reselecao periodica, comparando sempre Sharpe, Calmar, CAGR e Max Drawdown contra o Buy & Hold do mesmo periodo.
4. Tratar medidas de ativos com historico curto (<3 anos, como HYPE) como estatisticamente frageis e alertar contra vies de selecao multipla (testar milhares de candidatos gera Sharpe alto por acaso dentro da amostra).
5. Manter conformidade regulatoria estrita (Classe R5 - CVM 19/20): operar o sistema como laboratorio proprietario de autoconsumo, vedando oferta publica de sinais ou gestao de carteira de terceiros sem o respectivo credenciamento e Responsavel Tecnico habilitado.

## Gotchas

- Nunca criar novas copias numeradas da planilha de controle (v4..v11) na raiz do Drive; atualize exclusivamente a planilha canonica viva do MVP#2.
- Nunca declarar edge estatistico comercial sem atingir amostra minima significativa fora da amostra (OOS >= 30 trades) e superacao consistente do benchmark em risco/retorno (Calmar/Sharpe).

# Código.gs v5.0: instalação, o que mudou e como liberar as reservadas

## Instalação (5 minutos)

1. Na planilha "Gemini MPV Cripto": Extensões > Apps Script. Faça backup do código atual (copie para um arquivo `Codigo_v4_backup.gs`).
2. Substitua todo o conteúdo pelo de `apps_script/Codigo.gs` e salve.
3. Recarregue a planilha. No menu ENGINE QUANT:
   - **4. Retomar Automação** (hoje `PIPELINE_PAUSED=TRUE` na 08_CONFIG; o v5 não pausa sozinho).
   - **3** e depois **2** para recriar o gatilho com o intervalo da chave `TRIGGER_HORAS` (padrão 2 horas).
4. Rode **1. Executar 1 Ciclo Agora** e confira a 10_LOG. O script cria sozinho as chaves novas da 08_CONFIG (nunca sobrescreve as existentes).

## O que foi corrigido

| Pedido | Causa encontrada | Correção |
|---|---|---|
| E-mail repetido a cada 2h | O teste de pausa comparava a linha inteira da config (`String(cfgData[c])`) com 'TRUE'; o limite de 10 nunca limpava a fila; o e-mail lia colunas erradas | `isPaused_` lê a coluna B; cada estratégia é notificada uma vez (IDs em ScriptProperties); colunas do e-mail corrigidas; Pine vai em anexo |
| Reservadas = 30, sem pausar | Limite fixo em 10 e pausa automática | `RESERVADAS_LIMITE_EMAIL=30`, `PAUSAR_AO_ATINGIR_LIMITE=FALSE` |
| Rótulos falsos | Motor ignorava `indicador`; todo setup era EMA + SMA | Regras reais para EMA, SMA, DONCHIAN, KELTNER, BOLLINGER, SUPERTREND, RSI, MACD e VWAP; Pine gerado da mesma especificação |
| Simulador superestima | Barra de entrada sem stop, ATR por média simples, gap executado no preço do stop, regras diferentes do Pine, sem OOS | Portagem do motor Python calibrado; IS/OOS 70/30 com PF fora da amostra como corte |
| Análise de vídeos | `oEmbed` aceitava qualquer vídeo existente (inclusive o do exemplo do prompt) | Título real do YouTube precisa ser parecido com o declarado; IDs de exemplo bloqueados; coluna Origem (URL_REAL, URL_NAO_VERIFICADA, DEDUCAO_PROPRIA); `EXIGIR_VIDEO_VERIFICADO` opcional |
| Duplicatas (até 13 cópias da mesma regra) | Deduplicação só por título | Deduplicação por regra (indicador + parâmetros) contra toda a 02_BACKTEST; o prompt recebe as regras já testadas |
| Poucas ideias novas por ciclo | Uma chamada ao Gemini, 3 a 4 novas após o filtro | Até `MAX_CHAMADAS_GEMINI_POR_CICLO` chamadas até atingir `NOVAS_ALVO_POR_CICLO` |
| Células de PF viravam data | Colunas sem formato numérico | Formato `0.00` aplicado na gravação; item 10 do menu repara as abas |

### Verificação feita antes de entregar

O motor JS foi executado em Node contra o motor Python em 8 regras (Donchian, EMA com stop e alvo, Keltner, Bollinger, Supertrend, RSI, MACD, VWAP) com resultado idêntico em trades, PF, Sharpe, MaxDD e CAGR. O fluxo completo (gatilho com pausa, ciclo, e-mail único, reprocessamento, aplicação de status) foi exercitado com um mock em memória do Sheets, Gemini, oEmbed e MailApp. **Não foi executado dentro do Google**: as chamadas reais ao Gemini, ao YouTube e ao MailApp precisam do seu primeiro ciclo para confirmar.

### Decisão que você deve conhecer: critério de alfa

O código antigo (e a chave `EXIGIR_ALPHA_POSITIVO`) exigia CAGR acima do buy and hold do BTC (65,8% a.a. com MaxDD 83,8%). Isso reprova qualquer estratégia que reduza risco, inclusive as de produção. O v5 usa `EXIGIR_CALMAR_SUPERIOR_BH`: o Calmar da estratégia precisa superar o do buy and hold (0,78). O alfa em CAGR continua gravado na coluna S.

## Liberação das reservadas em duas etapas

**Etapa 1, agora (não depende do TradingView): reprovadas, duplicatas e descartadas**

1. Importe `results/status_reservadas_proposto.csv` em uma aba nova chamada `STATUS_PROPOSTO` (Arquivo > Importar > Inserir nova planilha, ou crie a aba e importe).
2. Menu **11. Aplicar Classificação**. Ele casa por `Linha_Planilha` e `Strategy_ID` (se o ID não bater, pula a linha), grava o status na coluna O e o alfa nas colunas R e S. Não apaga nada e não toca em EM_PRODUCAO, CAMPEA nem em status manuais.
3. Opcional: menu **9. Reprocessar** reavalia no motor v5 o que restou como AGUARDANDO_REFINO (reinterpretando pelo indicador real).

**Etapa 2, depois do TradingView: as 5 promissoras**

1. Rode os 5 scripts de `pine/` seguindo `pine/CHECKLIST_TRADINGVIEW.md` e traga os números.
2. As que confirmarem passam para `VALIDADA_TV` (digite à mão na coluna O; o script não mexe em status manuais).
3. As demais voltam para `REPROVADA_NO_TV`.

## Alternativa: prompt para o Gemini fazer o reparo da planilha

Use só se preferir não rodar o item 11. Importe o CSV na aba `STATUS_PROPOSTO` e cole no Gemini (painel lateral do Sheets):

```
Na aba 05_RESERVADAS, para cada linha da aba STATUS_PROPOSTO, localize a linha da 05_RESERVADAS
cujo número seja igual a Linha_Planilha e cujo Strategy_ID (coluna A) seja igual ao Strategy_ID
da STATUS_PROPOSTO. Se os dois conferirem e o Status_Refino atual (coluna O) for AGUARDANDO_REFINO,
APROVADA ou vazio, escreva Status_Proposto na coluna O, CAGR_BuyHold_BTC_% na coluna R e
Alfa_vs_BTC_% na coluna S, e a data de hoje na coluna T. Formate R e S como número com 2 casas.
Se o Strategy_ID não conferir, não altere a linha e liste-a no final. Não apague nenhuma linha,
não altere linhas com status EM_PRODUCAO, CAMPEA_MACHINE_2 ou PRODUCAO_MACHINE_2 e não altere nenhuma
outra coluna. No fim, informe quantas linhas foram alteradas e quais foram puladas.
```

O item 11 do menu é preferível: é determinístico, valida o ID e deixa log na 10_LOG.

## Chaves novas da 08_CONFIG

`RESERVADAS_LIMITE_EMAIL` (30), `PAUSAR_AO_ATINGIR_LIMITE` (FALSE), `EXIGIR_CALMAR_SUPERIOR_BH` (TRUE), `EXIGIR_VIDEO_VERIFICADO` (FALSE), `TITULO_SIMILARIDADE_MIN` (0,4), `NOVAS_ALVO_POR_CICLO` (12), `MAX_CHAMADAS_GEMINI_POR_CICLO` (3), `CUSTO_POR_LADO_PCT` (0,125), `TRIGGER_HORAS` (2). O e-mail de destino é a chave `ALERT_EMAIL` que já existe.

## Pontos de atenção

- Sem billing no projeto da chave Gemini, o grounding falha por quota (HTTP 429) e todas as hipóteses viram DEDUCAO_PROPRIA. Isso é detectável: o item 7 do menu mostra a contagem de origens. Com `EXIGIR_VIDEO_VERIFICADO=TRUE` e sem grounding, o ciclo não reserva nada.
- Uma estratégia com origem DEDUCAO_PROPRIA pode ser uma boa regra, mas não é "estratégia de um vídeo". Trate-a como hipótese do modelo.
- Os 100 e-mails/dia do MailApp são mais que suficientes agora (1 e-mail por 30 reservadas inéditas).
- A série histórica usada no backtest é a da aba `00_DADOS_BTC_1D`; rode o item 6 de tempos em tempos para atualizá-la.

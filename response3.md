Com certeza! Fixar um indicador em um tempo gráfico específico (neste caso, "1D") independente do tempo gráfico que você está olhando na tela é o que chamamos de **Análise Multi-Timeframe (MTF)**.

Fiz essa adequação usando a função `request.security()`. Agora, mesmo que você esteja olhando o gráfico de 1 Hora ou 15 Minutos, as velas serão coloridas baseadas exclusivamente no cruzamento MACD(20,50,12) do gráfico Diário (1D).

Seguindo as melhores práticas do Pine Script para evitar limites de execução, empacotei as requisições em uma única chamada `request.security()`.

### Código Pine Script v5 (Coloração de Velas Fixada em 1D)

```pine
//@version=5
indicator("MACD(20,50,12) Coloração de Velas (Fixo 1D)", overlay=true)

// =========================================================================
// PARÂMETROS
// =========================================================================
fastLength = input.int(20, title="MACD Fast Length (EMA)", group="Parâmetros MACD")
slowLength = input.int(50, title="MACD Slow Length (EMA)", group="Parâmetros MACD")
signalLength = input.int(12, title="MACD Signal Length (EMA)", group="Parâmetros MACD")

opMode = input.string("Long / Flat (Verde/Neutro)", title="Modo da Estratégia", options=["Long / Flat (Verde/Neutro)", "Long / Short (Verde/Vermelho)"], group="Estilo de Coloração")

// =========================================================================
// CÁLCULOS MACD (Base)
// =========================================================================
// Expressões base que serão enviadas para o motor do TradingView processar em 1D
macdCalc = ta.ema(close, fastLength) - ta.ema(close, slowLength)
signalCalc = ta.ema(macdCalc, signalLength)

// =========================================================================
// FIXANDO EM 1 DIA (Multi-Timeframe / MTF)
// =========================================================================
// request.security busca os dados de "1D" (1 Dia) independentemente do gráfico atual.
// Juntamos em uma tupla [var1, var2] para otimização de performance do Pine.
[macdLine1D, signalLine1D] = request.security(syminfo.tickerid, "1D", [macdCalc, signalCalc], lookahead=barmerge.lookahead_off)

// =========================================================================
// DEFINIÇÃO DE ESTADO E LÓGICA DE COLORAÇÃO
// =========================================================================
// Avalia o MACD do diário (1D)
candleColor = macdLine1D > signalLine1D ? color.new(color.green, 0) : (opMode == "Long / Short (Verde/Vermelho)" ? color.new(color.red, 0) : na)

// =========================================================================
// PLOTAGENS
// =========================================================================
// Pinta as velas sobre o gráfico nativo de acordo com a regra estipulada
barcolor(candleColor, title="Coloração de Velas MACD (1D)")
```

### Como usar:
1. Apague o código antigo no Pine Editor e cole esse novo.
2. Adicione ao gráfico.
3. Mude seu gráfico para **4 Horas** (por exemplo) e veja que **múltiplas velas seguidas terão a mesma cor**, pois elas estão espelhando a tendência "Pai" (a tendência Macro do Gráfico Diário).

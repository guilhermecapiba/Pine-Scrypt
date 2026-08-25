Claro, posso sim!

Transformar uma estratégia em um **Indicador de Coloração de Velas** é uma ótima maneira de limpar o gráfico, mantendo apenas a leitura do viés/estado em que o algoritmo se encontra.

### Sobre o Estado "Neutro" vs "Vendido" (Short)
Um cruzamento contínuo de médias móveis como o MACD só tem matematicamente dois lados: ou a linha MACD está *acima* da linha de sinal, ou está *abaixo*. Não existe um terceiro estado matemático puro onde elas não estejam em nenhum dos dois (exceto pelo exato micro-segundo em que o valor empata em zero vírgula alguma coisa).

Como a sua estratégia original que testamos era **"Long/Flat"** (ou seja, quando desfaz a compra, você apenas fica fora do mercado, não aposta na queda), o "estado abaixo da linha de sinal" funcionaria como o seu **"Neutro"**.

Para deixar o indicador perfeitamente flexível para você, eu incluí um menu de opções (Dropdown) no indicador:
*   **Modo Long / Flat**: Velas **Verdes** quando Comprado, velas **Sem Cor (Neutras)** quando o MACD cruza para baixo (Flat).
*   **Modo Long / Short**: Velas **Verdes** quando Comprado, velas **Vermelhas** quando o MACD cruza para baixo (Vendido).

Abaixo está o código. Note que mudei a primeira função de `strategy` para `indicator`, o que permite adicioná-lo sobre o gráfico normal sem criar janelas de painel de trades.

### Código Pine Script v5 (Coloração de Velas)

Cole no seu Pine Editor e adicione ao gráfico.

```pine
//@version=5
indicator("MACD(20,50,12) Coloração de Velas", overlay=true)

// =========================================================================
// PARÂMETROS
// =========================================================================
fastLength = input.int(20, title="MACD Fast Length (EMA)", group="Parâmetros MACD")
slowLength = input.int(50, title="MACD Slow Length (EMA)", group="Parâmetros MACD")
signalLength = input.int(12, title="MACD Signal Length (EMA)", group="Parâmetros MACD")

// =========================================================================
// CÁLCULOS MACD
// =========================================================================
macdLine = ta.ema(close, fastLength) - ta.ema(close, slowLength)
signalLine = ta.ema(macdLine, signalLength)

// =========================================================================
// DEFINIÇÃO DE ESTADO E LÓGICA DE COLORAÇÃO
// =========================================================================
// Menu para o usuário escolher como deseja interpretar as barras que não estão em tendência de alta
opMode = input.string("Long / Flat (Verde/Neutro)", title="Modo da Estratégia", options=["Long / Flat (Verde/Neutro)", "Long / Short (Verde/Vermelho)"], group="Estilo de Coloração")

// Lógica condicional inline (no escopo global, seguindo as melhores práticas do Pine Script).
// Se MACD > Signal: Verde
// Se não: Verifica o Modo. Se for "Long/Short", pinta de Vermelho. Se for "Long/Flat", usa 'na' (nenhuma cor extra, vela normal/neutra).
candleColor = macdLine > signalLine ? color.new(color.green, 0) : (opMode == "Long / Short (Verde/Vermelho)" ? color.new(color.red, 0) : na)

// =========================================================================
// PLOTAGENS
// =========================================================================
// Pinta as velas sobre o gráfico nativo de acordo com a regra estipulada
barcolor(candleColor, title="Coloração de Velas MACD")
```

Para alterar entre Vermelho e Neutro, basta ir nas **Configurações** do indicador (ícone de engrenagem) e alterar o "Modo da Estratégia" na aba Inputs/Valores!

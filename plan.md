## Passo 1: Corrigir Bugs Críticos em `capiba_v2.pine` e Implementar Faltas
1.  **Bug do FVG Invalidation**: Corrigir a precedência em `invalidBull or invalidBear and not eachFairValueGap.mitigated` para `(invalidBull or invalidBear) and not eachFairValueGap.mitigated`.
2.  **Bug do FVG Size Filter**: Alterar a lógica do FVG Size para comparar com a métrica da Elephant Bar ou volume/deslocamento relativo, ao invés de usar o gap vs ATR.
3.  **Elephant Bar Defaults**: Ajustar `elephantMult` para um valor mais realista, como `1.0` ou `1.2`.
4.  **Sniper OB Logic**: Implementar a lógica real em vez de stub (`bool isSniperOB = false`). Checar se o pivot varreu liquidez anterior E deixou FVG.
5.  **FVG + Sweep**: Adicionar trigger de entrada.
6.  **Strong/Weak Classifications**: Não usar o estado global `swingHigh`. Comparar o pivot com pivôs locais anteriores.
7.  **SFP (Swing Failure Pattern)**: Marcar SFP quando há apenas um pavio que sweepa e volta.
8.  **Gatilho de Mudança de Cor (Mapeamento de Invalidação)**: Mudar cor para cinza (mitigado).

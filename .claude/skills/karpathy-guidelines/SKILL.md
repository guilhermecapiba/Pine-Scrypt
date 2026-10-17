---
name: karpathy-guidelines
description: "Aplica as diretrizes de engenharia de software de Andrej Karpathy para agentes de codificacao: simplicidade radical, mudancas cirurgicas, zero abstracao prematura e verificacao empirica antes de codar (inspirada em multica-ai/andrej-karpathy-skills). Use ao escrever, refatorar ou depurar qualquer script Python, JS ou Apps Script."
---

# Karpathy Guidelines

Previne os erros classicos de LLMs na programacao (excesso de engenharia, invencao de abstracoes desnecessarias, edicao destrutiva de codigo funcionando e falta de testes reais) impondo disciplina cirurgica de engenharia.

## When to Use

- Escrever novo codigo em Python, JavaScript, TypeScript, SQL ou Google Apps Script
- Refatorar ou corrigir bugs em motores existentes (PortaoDeterministico, MotorUnificado.gs, MotorGatekeeper)
- Revisar pull requests, scripts de automacao ou arquiteturas de software

## Steps

1. Ler e compreender o codigo existente e o estado real dos dados antes de propor qualquer alteracao; nunca chutar a causa de um bug sem reproduzi-lo ou inspecionar o log/input real.
2. Preferir funcoes simples, lineares e explicitas em um unico arquivo a hierarquias complexas de classes, frameworks pesados ou abstracoes para casos futuros hipoteticos (YAGNI).
3. Fazer mudancas cirurgicas e minimas: alterar apenas as linhas estritamente necessarias para resolver o problema, preservando assinaturas de funcoes, comentarios uteis e comportamentos ja homologados.
4. Verificar empiricamente cada mudanca rodando testes automatizados ou scripts de verificacao com dados reais e casos de borda (inputs nulos, tipos invalidos, fusos horarios, limites zero).
5. Se uma abordagem falhar duas vezes seguidas, parar de empilhar remendos (patches sobre patches), reverter ao estado limpo e redesenhar a causa raiz com o menor volume de codigo possivel.

## Gotchas

- Nunca remover validacoes de seguranca ou testes existentes apenas para fazer um teste passar.
- Nunca introduzir bibliotecas externas quando a biblioteca padrao da linguagem (JS V8 nativo ou Python standard library) resolve o problema em poucas linhas.

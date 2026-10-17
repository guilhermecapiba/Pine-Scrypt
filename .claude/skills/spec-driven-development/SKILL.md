---
name: spec-driven-development
description: "Implementa o fluxo de Desenvolvimento Orientado a Especificacoes (Spec-Driven Development: requirements.md -> design.md -> tasks.md) antes da codificacao (inspirada em FredAntB/Spec-Driven-Development e Fission-AI/OpenSpec). Use ao projetar novos modulos, arquiteturas de agentes ou sistemas nos MVPs."
---

# Spec Driven Development

Converte pedidos de funcionalidades ou sistemas em especificacoes verificaveis (requirements.md, design.md e tasks.md) antes de escrever codigo de producao, aplicando o padrao Sub-Agent Planner -> Single Executor.

## When to Use

- Iniciar a construcao de um novo motor, integracao ou aplicativo web/backend nos MVPs
- Estruturar mudancas arquiteturais que envolvam banco de dados, schemas JSON e regras de negocio
- Preparar especificacoes limpas para que um unico Agente Executor implemente o codigo sem ambiguidade

## Steps

1. Fase 1 - Requisitos (requirements.md): documentar de forma concisa o objetivo funcional, entradas exatas, saidas esperadas, restricoes de performance/custo e criterios de aceite no formato QUANDO [evento] O SISTEMA DEVE [resposta verificavel].
2. Fase 2 - Desenho Tecnico (design.md): definir a arquitetura minima viavel, os contratos de dados (JSON Schemas ou colunas de tabela), o fluxo de estados (FSM), o tratamento de erros Fail-Closed e a estrategia de testes.
3. Fase 3 - Lista de Implementacao (tasks.md): quebrar o desenho em tarefas atomicas, sequenciais e testaveis, onde cada passo produz um incremento funcional verificavel.
4. Fase 4 - Execucao e Verificacao: implementar o codigo seguindo estritamente o design.md, validando cada item contra os criterios do requirements.md e marcando a conclusao em tasks.md.

## Gotchas

- Nunca escrever especificacoes literarias longas; uma boa spec tecnica tem alta densidade de esquemas, tipos de dados, assinaturas de funcao e regras binarias.
- Nunca alterar requisitos silenciosamente durante a codificacao sem atualizar a especificacao correspondente.

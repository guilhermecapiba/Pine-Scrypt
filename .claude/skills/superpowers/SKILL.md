---
name: superpowers
description: "Transforma o agente em um fluxo disciplinado de engenharia de software ponta a ponta: brainstorm focado, especificacao, plano de implementacao, TDD (Test-Driven Development), revisao critica e debug sistematico (inspirada em obra/superpowers). Use em tarefas de desenvolvimento, automacao e correcao de bugs."
---

# Superpowers

Aplica o ciclo completo de engenharia disciplinada (Spec -> Plan -> Red-Green-Refactor TDD -> Self-Review -> Verification) para entregar software robusto na primeira tentativa.

## When to Use

- Desenvolver scripts, motores de regras, APIs, dashboards ou aplicacoes completas
- Resolver bugs complexos ou falhas de integracao em codigo existente
- Garantir qualidade de producao antes de submeter entregas tecnicas ao Auditor Independente

## Steps

1. Descoberta e Escopo: confirmar o problema real, ler os arquivos de codigo existentes e identificar as restricoes do ambiente antes de propor solucoes.
2. TDD Estrito (Test-First): escrever primeiro o teste automatizado que reproduz o bug ou valida o requisito novo, confirmar que ele falha pelo motivo certo (Red), escrever o codigo minimo para passar (Green) e limpar duplicacoes (Refactor).
3. Debug Sistematico (Root-Cause First): diante de qualquer erro, ler o stack trace completo, isolar a linha e o input exato que causam a falha e formular uma hipotese testavel antes de alterar o codigo.
4. Auto-Auditoria Pre-Entrega: revisar o diff gerado procurando variaveis orfas, credenciais expostas, fusos horarios nao tratados, caminhos hardcoded ou regressao em testes antigos.
5. Evidencia de Conclusao: nunca declarar que o codigo funciona sem executar a suite de testes e anexar o resultado real da execucao (exit code 0 e contagem de testes aprovados).

## Gotchas

- Nunca pular a execucao dos testes por achar que a mudanca no codigo foi "pequena demais".
- Nunca mascarar erros com blocos try/catch vazios que engolem excecoes; em sistemas Fail-Closed, todo erro deve ser registrado explicitamente e interromper a transicao invalida.

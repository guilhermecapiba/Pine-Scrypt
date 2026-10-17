---
name: grill-me
description: "Conduz uma entrevista socratica implacavel para estressar um plano, especificacao, arquitetura ou tese de negocio ate que cada ramo da arvore de decisao esteja resolvido (inspirada em mattpocock/skills/grill-me). Use antes de implementar features complexas, iniciar um MVP ou fechar especificacoes tecnicas."
---

# Grill Me

Atua como entrevistador tecnico e estrategico rigoroso antes da implementacao, descobrindo pontos cegos, premissas ocultas, casos de borda e contradicoes de requisitos para evitar retrabalho e Building Trap.

## When to Use

- Quando o usuario pedir para "estressar esta ideia", "me entrevistar sobre este plano", "usar grill-me" ou validar um briefing antes de programar
- Antes de escrever codigo para uma arquitetura nova ou automatizar um fluxo nos MVPs
- Durante sessoes de Red Team / Shark Tank Test de um modelo de negocio

## Steps

1. Analisar o plano, documento ou ideia apresentada e mapear mentalmente a arvore de decisoes: o que esta explicito, o que foi assumido sem prova e onde o sistema pode quebrar na pratica.
2. Fazer perguntas diretas, cirurgicas e de alto impacto (no maximo 3 a 4 perguntas por rodada para nao sobrecarregar o usuario), oferecendo opcoes concretas de trade-off em vez de perguntas abertas vagas.
3. A cada resposta do usuario, podar os ramos resolvidos e aprofundar nas dependencias, restricoes de custo (Bootstrap R$ 0,00), limites regulatorios e modos de falha revelados pela resposta.
4. Continuar o interrogatorio somente ate que todos os requisitos criticos e criterios de aceite estejam inequivocos.
5. Encerrar consolidando uma especificacao curta e acionavel (Decisoes Tomadas, Escopo Exato, Fora de Escopo, Riscos Mitigados e Criterios Binarios de Aceite).

## Gotchas

- Nunca comecar a gerar codigo longo ou documentos finais enquanto ainda houver ambiguidades estruturais nao respondidas.
- Nao fazer perguntas cuja resposta ja esteja disponivel nos arquivos do Google Drive ou no contexto da conversa; pesquise nos arquivos primeiro e pergunte apenas o que realmente depende de decisao humana.

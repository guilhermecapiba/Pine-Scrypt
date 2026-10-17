---
name: planning-with-files
description: "Mantem planos de execucao, estados de tarefas, descobertas de pesquisa e memoria de sessao persistidos em arquivos e planilhas estruturadas para evitar perda de contexto (Context Rot) em tarefas longas (inspirada em OthmanAdi/planning-with-files). Use em projetos multi-etapas, auditorias extensas ou sessoes longas de desenvolvimento."
---

# Planning With Files

Usa o sistema de arquivos e planilhas vivas como memoria externa persistente para evitar degradacao da janela de contexto (Context Rot) e perda de estado entre turnos ou sessoes.

## When to Use

- Executar tarefas complexas que exigem mais de 3 passos de pesquisa, codificacao ou analise documental
- Trabalhar com bases grandes de documentos (editais no MVP#1, series historicas no MVP#2, tabelas do Soul MV no MVP#3 ou acervo hospitalar no MVP#5)
- Coordenar trabalho entre subagentes pesquisadores e o agente executor principal

## Steps

1. Antes de iniciar leituras pesadas ou implementacoes longas, criar ou atualizar um arquivo de plano estruturado (task.md ou linha correspondente na planilha viva do projeto) com metas verificaveis (- [ ], - [/], - [x]).
2. Aplicar a Regra de Ouro da Compressao de Contexto: ao ler documentos extensos, PDFs ou planilhas brutas, extrair apenas os fatos, numeros, links e hashes relevantes para um arquivo de notas/especificacao enxuto, evitando despejar saidas brutas gigantes no historico da conversa.
3. Atualizar o arquivo de plano em paralelo com as chamadas de ferramentas substantivas a cada marco concluido, registrando os IDs/links dos artefatos gerados e eventuais bloqueios.
4. Em caso de retomada de sessao ou compactacao de contexto, ler primeiro o arquivo de plano/estado para reconstruir 100% da consciencia situacional antes de agir.

## Gotchas

- Nunca manter o estado de um projeto apenas na memoria da conversa; se uma decisao ou entrega nao foi gravada na planilha ou arquivo oficial, ela nao existe para o proximo ciclo.
- Nunca emitir um turno isolado apenas para atualizar o checklist; faca a atualizacao junto com a acao principal.

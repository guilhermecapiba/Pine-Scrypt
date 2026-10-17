---
name: mcp-builder
description: "Guia a arquitetura, implementacao e teste de servidores Model Context Protocol (MCP) em Python (FastMCP) ou TypeScript para conectar agentes de IA a bancos de dados SQL, APIs externas e ferramentas locais (inspirada em anthropics/skills/mcp-builder). Use ao criar integracoes e conectores para agentes."
---

# MCP Builder

Constroi servidores MCP (Model Context Protocol) enxutos, seguros e bem tipados para expor bancos de dados, APIs e validadores deterministas como ferramentas nativas para agentes de IA (Claude e Gemini).

## When to Use

- Criar um servidor MCP para conectar agentes ao banco SQL do ERP Soul MV (MVP#3 AuditGlosas AI), API do PNCP (MVP#1 ValidEdital), APIs de mercado cripto (MVP#2 CapibaQuant) ou Google Workspace
- Desenhar ferramentas (Tools), recursos (Resources) e prompts reutilizaveis para agentes autonomos
- Otimizar definicoes de ferramentas para reduzir o consumo de tokens no contexto do agente

## Steps

1. Definir a superficie minima de ferramentas: agrupar operacoes relacionadas em poucas ferramentas de alto valor (evitando criar dezenas de micro-ferramentas que poluem o prompt de sistema do agente).
2. Projetar contratos de entrada estritos (Pydantic em Python com FastMCP ou zod em TypeScript): usar nomes de parametros autoexplicativos, descricoes curtas e validacao rigorosa de tipos.
3. Formatar saidas otimizadas para LLMs: retornar apenas os campos essenciais em JSON compacto ou Markdown estruturado, com paginacao ou truncamento seguro para evitar estourar a janela de contexto.
4. Implementar seguranca por padrao: conexoes de banco de dados em modo somente leitura (READ ONLY) quando o objetivo for auditoria/consulta, credenciais injetadas exclusivamente via variaveis de ambiente e mensagens de erro acionaveis que ensinem o agente a corrigir a chamada.
5. Testar o servidor MCP localmente com chamadas reais e casos de erro antes de registra-lo no cliente do agente.

## Gotchas

- Nunca retornar dumps brutos de milhares de linhas SQL ou HTML inteiro pela ferramenta MCP; filtre e agregue no codigo do servidor antes de devolver ao modelo.
- Nunca expor operacoes destrutivas (DROP, DELETE, escrita em producao) em ferramentas de agentes sem trava de confirmacao humana explicita.

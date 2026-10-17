---
name: gws-workflow
description: "Padroniza fluxos de automacao e operacao in-place no Google Workspace (Google Sheets, Drive, Docs, Gmail e Apps Script), prevenindo a proliferacao de arquivos .xlsx duplicados (split-brain) e garantindo rastreabilidade por ID unico (inspirada em googleworkspace/gws-workflow). Use sempre que manipular planilhas, pastas e documentos no Drive."
---

# GWS Workflow

Garante operacao limpa, rastreavel e in-place sobre arquivos nativos do Google Workspace (Sheets, Docs e Drive), eliminando duplicacao de versoes .xlsx e mantendo fonte unica da verdade.

## When to Use

- Ler, criar ou atualizar planilhas de controle e filas de tarefas no Google Sheets
- Organizar pastas de projetos, templates de Starter Kit e documentos entregaveis no Google Drive
- Sincronizar scripts do Google Apps Script com planilhas oficiais dos MVPs

## Steps

1. Regra da Fonte Unica Viva (Zero Split-Brain): em qualquer projeto ativo, manter apenas 1 planilha Google Sheets nativa (application/vnd.google-apps.spreadsheet) como centro de comando operacional; nunca fazer upload de multiplos arquivos .xlsx (v1, v2, v3) para representar mudancas de estado da mesma fila.
2. Protecao de Templates de Prateleira: ao testar ou iniciar um projeto a partir de um template (como 03_TEMPLATE_PLANILHA_FILA_VIVA_14COL), criar primeiro uma copia operacional na pasta do projeto e manter o template original 100% limpo e intocado.
3. Enderecamento por ID Canonico: sempre referenciar pastas e arquivos pelo seu fileId real de 25+ caracteres do Google Drive e incluir o link clicavel completo (viewUrl / webViewLink) em celulas de evidencia e relatorios.
4. Leitura Profunda Antes de Escrita: nunca resumir ou alterar um documento Google Docs ou planilha Google Sheets baseando-se apenas no snippet truncado da busca; executar leitura completa do conteudo antes de editar ou auditar.
5. Higiene de Arquivamento: quando uma versao legada precisar ser substituida, move-la para uma subpasta dedicada de historico (99_Historico ou (OLD)) mantendo o diretorio raiz do MVP limpo apenas com os arquivos ativos.

## Gotchas

- Nunca usar links genericos como https://drive.google.com ou https://docs.google.com sem o ID especifico do arquivo/pasta.
- Ao criar arquivos no Drive que pertencem a uma pasta especifica, verificar e atualizar o parentId para que o arquivo nao fique solto na raiz do Meu Drive.

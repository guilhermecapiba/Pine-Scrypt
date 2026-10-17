---
name: trail-of-bits-security
description: "Aplica auditoria de seguranca defensiva em codigo, scripts de automacao e acervos documentais: prevencao de vazamento de credenciais, conformidade estrita com a LGPD (Art. 5 e Art. 7), blindagem contra bypass de permissoes e clarificacao de requisitos ambiguos (inspirada em trailofbits/skills). Use ao revisar codigo, planilhas de governanca ou documentos sensiveis."
---

# Trail Of Bits Security

Executa revisao de seguranca, privacidade de dados (LGPD) e analise de modelo de ameaca sobre scripts, planilhas e fluxos de agentes de IA.

## When to Use

- Auditar scripts em Google Apps Script, JavaScript ou Python antes de coloca-los em producao
- Inspecionar pastas do Google Drive e planilhas em busca de credenciais expostas em texto claro ou vulnerabilidades de permissao
- Garantir conformidade com a LGPD em dados hospitalares (MVP#3 e MVP#5) e abordagens comerciais B2B (MVP#1 e MVP#7)

## Steps

1. Modelagem de Ameaca e Fronteira de Confianca: identificar quem pode editar cada recurso (ex.: diferenciar quando o Executor roda na mesma conta Google do Decisor vs. em conta separada) e documentar controles compensatorios onde o bloqueio tecnico nao alcanca (como escritas via REST API).
2. Varredura de Segredos e Credenciais: verificar se existem senhas, tokens OAuth ou chaves de API salvos em texto claro dentro de scripts, documentos ou planilhas; ao detectar, recomendar remocao imediata, rotacao da senha e migracao para cofres seguros (PropertiesService ou variaveis de ambiente).
3. Protecao Estrita LGPD (Lei 13.709/2018): bloquear a inclusao de dados pessoais sensiveis (dados medicos/prontuarios identificaveis de pacientes - Art. 5, II) ou dados pessoais de terceiros em prompts e relatorios sem anonimizacao/pseudonimizacao previa e base legal valida.
4. Analise de Bypass em Maquinas de Estado: testar se um usuario ou agente malicioso/equivocado consegue burlar travas colando intervalos multicoluna, inserindo formulas (=), editando contadores de iteracao manualmente ou clonando linhas fora do estado inicial (BACKLOG).
5. Clarificacao de Requisitos Ambiguos (ask-questions-if-underspecified): quando uma especificacao de seguranca ou permissao tiver brechas interpretativas, pausar e perguntar ao Decisor antes de assumir um padrao inseguro.

## Gotchas

- Nunca assumir que Session.getActiveUser().getEmail() retorna o e-mail em gatilhos simples onEdit(e); exija sempre gatilho instalavel OAuth e trate retorno vazio como negacao imediata (Fail-Closed).
- Nunca exibir senhas encontradas em auditorias de arquivos dentro do texto do relatorio; cite apenas o nome/ID do arquivo afetado para que o proprietario faca o saneamento.

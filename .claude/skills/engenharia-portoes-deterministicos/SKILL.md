---
name: engenharia-portoes-deterministicos
description: "Desenvolve e audita motores deterministas em JavaScript (Node/V8 e Google Apps Script) e Python, suites de testes unitarios autocontidas e validadores de schema com hash SHA-256. Use ao criar ou revisar codigo para o Gatekeeper do MVP#7, Portao Deterministico do MVP#1, Motor Unificado do MVP#2 ou extratores do MVP#3."
---

# Engenharia Portoes Deterministicos

Separa rigorosamente a interpretacao contextual de modelos de linguagem (LLMs) da validacao matematica, regulatoria e de estado, implementando portoes deterministas em funcoes puras com testes automatizados e rastreabilidade por hash SHA-256.

## When to Use

- Escrever ou refatorar motores em Google Apps Script (.gs), JavaScript puro (.js) ou Python (.py) nos MVPs do Projeto 2035
- Criar validadores de transicao de estado (onEdit instalavel), validadores de CNPJ/CPF, calculos de indices contabeis, datas de vencimento ou metricas financeiras
- Construir suites de testes unitarios e de regressao autocontidas (zero dependencias externas)
- Auditar codigo existente contra falsos positivos, bugs de fuso horario ou bypass de regras de governanca

## Steps

1. Isolar toda regra matematica, financeira, temporal ou de transicao de estados em funcoes puras deterministas: nunca delegar a um LLM a verificacao de validade de um CNPJ, calculo de liquidez, contagem de iteracoes ou checagem se uma URL existe.
2. Normalizar explicitamente datas e fusos horarios usando America/Sao_Paulo (BRT) ou UTC padronizado, evitando desvios de new Date() implicito entre navegador e servidor.
3. Implementar validacao Fail-Closed real nos portoes: ao validar uma entrega, checar por expressao regular estrita o formato da URL do Google Drive (ID de 25+ caracteres), confirmar existencia fisica via DriveApp e exigir os eventos de auditoria correspondentes no log antes de permitir estado DONE.
4. Construir uma suite de testes autocontida que cubra 100% dos caminhos nominais e dos casos de borda/ataque (edicao manual de iteracao, rebaixamento de risco pos-BACKLOG, colagem multicoluna, cartao novo fora de BACKLOG, campos vazios ou identidade nao autorizada).
5. Executar a suite de testes no terminal/sandbox ate obter exit code 0 em 100% dos casos e calcular o hash SHA-256 normalizado do codigo-fonte e da suite de testes para registro probatorio.

## Gotchas

- Nunca salvar scripts executaveis apenas como prosa dentro de documentos sem manter o arquivo de codigo limpo e testavel na sandbox ou no Apps Script.
- Em gatilhos do Google Sheets que usam DriveApp ou Session.getActiveUser().getEmail(), usar sempre gatilho instalavel (onEditInstalavel) autorizado via OAuth, pois gatilhos simples onEdit(e) rodam sem permissao para ler o Drive ou identificar o editor com confiabilidade.
- Nunca aprovar uma validacao baseada apenas em string nao vazia (if (obs)): valide o padrao exato esperado (^PASS: ou ^FAIL: na coluna de parecer).

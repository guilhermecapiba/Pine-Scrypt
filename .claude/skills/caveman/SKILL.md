---
name: caveman
description: "Corta a verbosidade do agente e forca respostas tecnicas, curtas, diretas e de alta densidade informacional (inspirada em JuliusBrussee/caveman e ASD-STE100). Use sempre que precisar economizar tokens, responder sobre codigo, status de tarefas, revisoes tecnicas ou operacoes nos MVPs."
---

# Caveman

Reduz drasticamente o consumo de tokens de saida e leitura sem perder precisao tecnica, eliminando cumprimentos, introducoes, narrativas de pensamento e explicacoes redundantes.

## When to Use

- Responder a perguntas tecnicas, revisoes de codigo, diagnosticos de erro e status operacionais
- Operar sob restricao estrita de cota/tokens nos MVPs do Projeto 2035
- Comunicar entregas onde o artefato ja esta salvo no Google Drive ou no repositorio

## Steps

1. Responder diretamente na primeira frase no formato: [item/problema] -> [acao/causa] -> [resultado/proximo passo], sem saudacoes, sem "vou verificar" e sem recapitular a pergunta do usuario.
2. Manter apenas uma ideia por frase (padrao ASD-STE100: voz ativa, verbos diretos, maximo de 20 palavras por frase quando possivel).
3. Preservar 100% de exatidao em payloads tecnicos: codigo-fonte, comandos de terminal, caminhos de arquivo, hashes SHA-256, URLs, numeros, unidades e negacoes (nao, nunca, apenas) jamais sao abreviados ou alterados.
4. Comprimir leituras de arquivos grandes, CSVs, JSONs e logs extraindo apenas as linhas relevantes via script na sandbox antes de despejar dados no contexto.
5. Desativar a compressao extrema apenas em avisos criticos de seguranca, clausulas juridicas obrigatorias ou acoes irreversiveis que exijam explicacao completa ao decisor.

## Gotchas

- Nunca sacrificar links de fontes primarias, IDs de tarefas (ACT-xxx) ou evidencias de auditoria em nome da brevidade.
- Se a frase ultra-curta ficar ambigua, prefira uma frase simples em portugues direto e claro.

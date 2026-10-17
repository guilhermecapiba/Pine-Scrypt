---
name: gemini-api-dev
description: "Aplica as melhores praticas oficiais para desenvolver aplicacoes e agentes autonomos com a API do Google Gemini e Vertex AI (SDK google-genai, Structured Outputs com JSON Schema, Function Calling, Context Caching e roteamento Flash vs Pro). Use ao programar agentes em Python ou JS/Apps Script integrados ao Gemini."
---

# Gemini API Dev

Guia a implementacao tecnica de agentes e pipelines usando o SDK oficial google-genai (Python e JS/TS) e chamadas REST no Google Apps Script (UrlFetchApp), garantindo saidas estruturadas deterministas e eficiencia de custos.

## When to Use

- Escrever codigo que chama a API do Gemini (gemini-2.5-pro, gemini-2.5-flash) em Python, Node.js ou Google Apps Script
- Implementar Structured Outputs (response_schema / response_mime_type: "application/json") para garantir que a saida do modelo siga exatamente o Schema Canonico dos MVPs
- Configurar Function Calling, Grounding com Google Search ou Context Caching para documentos grandes

## Steps

1. Usar sempre o SDK unificado google-genai (from google import genai em Python ou @google/genai em JS/TS), evitando pacotes legados deprecados (google-generativeai).
2. Roteamento inteligente de modelos por complexidade (FinOps): usar gemini-2.5-flash para extracao estruturada em lote, triagem documental e classificacao rapida; reservar gemini-2.5-pro para raciocinio arquitetural complexo, auditoria critica e geracao de codigo denso.
3. Forcar Structured Outputs sempre que a saida alimentar outro script ou planilha: passar um schema Pydantic ou JSON Schema estrito em response_schema com response_mime_type="application/json" para eliminar erros de parsing.
4. Em documentos normativos ou bases que se repetem em varias chamadas, utilizar Context Caching ou carregar apenas o trecho relevante via busca lexica/script para reduzir latencia e consumo de tokens em ate 80%.
5. Em integracoes via Google Apps Script (UrlFetchApp.fetch), armazenar a GEMINI_API_KEY exclusivamente em PropertiesService.getScriptProperties() (nunca hardcoded no codigo .gs) e implementar retry com backoff exponencial para codigos HTTP 429/503.

## Gotchas

- Nunca fazer parse de JSON gerado por LLM usando regex fragil sobre texto livre quando voce pode exigir response_mime_type: "application/json" nativamente na chamada da API.
- Nunca expor chaves de API em celulas de planilhas Google Sheets, logs de eventos ou arquivos versionados no Drive.

---
name: firecrawl-serpapi-extraction
description: "Padroniza a raspagem web limpa em Markdown e a busca estruturada em portais publicos (PNCP, Diarios Oficiais, Receita/CNPJ, ONA, ANVISA, Ministerio da Saude e dados de mercado) com fidelidade estrita a fonte primaria (inspirada em firecrawl-agent e serpapi-web-search). Use em tarefas de pesquisa web, coleta de leads ou levantamento regulatorio."
---

# Firecrawl SerpApi Extraction

Executa coleta de dados publicos na web e extracao de documentos com rastreabilidade de fonte primaria, impedindo alucinacao de CNPJs, telefones, links ou normas regulatorias.

## When to Use

- Coletar dados de editais e fornecedores de SADT/Saude no PNCP e portais publicos (MVP#1 ValidEdital)
- Levantar normas regulatorias, portarias do Ministerio da Saude (CEBAS), exigencias sanitarias (ANVISA/Bombeiros) e diretrizes de acreditacao (ONA) no MVP#5
- Extrair dados de mercado, precos e documentacao tecnica na web para qualquer MVP

## Steps

1. Busca Focada por Entidade: formular queries estruturadas com operadores exatos (site:, aspas para termos literais, UF/municipio e numero de norma/processo) para localizar a pagina oficial da entidade ou orgao publico.
2. Leitura da Pagina Completa Antes de Citar: nunca extrapolar numeros, datas de vencimento, aliquotas de impostos, CNAEs ou contatos a partir de apenas um snippet curto de busca; abrir e ler o conteudo completo da pagina antes de registrar o dado.
3. Validacao Cruzada de Dados Cadastrais: ao coletar listas de empresas (leads B2B), exigir CNPJ de 14 digitos validado matematicamente pelo algoritmo oficial de digito verificador e URL comprovada da fonte de origem.
4. Classificacao de Evidencia: se um dado nao puder ser confirmado em fonte primaria publica durante a varredura, rotular explicitamente como SEM FONTE PRIMARIA LOCALIZADA ou NAO VALIDADO, jamais preenchendo lacunas por deducao.

## Gotchas

- Nunca fabricar URLs nem usar a homepage generica de um site (https://gov.br) como link de comprovacao de uma norma ou edital especifico.
- Nunca usar ferramentas de navegacao web externa para tentar acessar arquivos privados do Google Workspace; para o Workspace, use sempre os conectores nativos de Drive/Sheets/Docs/Gmail.

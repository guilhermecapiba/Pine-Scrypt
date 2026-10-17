---
name: validedital-licitacoes-14133
description: "Estrutura a analise de editais de licitacao publica (Lei 14.133/2021), extracao para Schema Canonico JSON, cotejo com jurisprudencia verificada do TCU e prospeccao qualitativa de prestadores SADT/Saude. Use em qualquer tarefa do MVP#1 ValidEdital (BF-001)."
---

# ValidEdital Licitacoes 14133

Executa a triagem, extracao estruturada e conferencia documental assistida de editais publicos sob a Lei Federal 14.133/2021, combinando parsing estruturado com o Portao Logico Deterministico e base jurisprudencial verificada do TCU.

## When to Use

- Analisar editais de licitacao publica (especialmente servicos de saude e SADT) no MVP#1 ValidEdital (BF-001)
- Extrair requisitos de habilitacao juridica, fiscal, trabalhista, economico-financeira e qualificacao tecnica para o Schema Canonico JSON v1.4
- Cruzar exigencias restritivas de editais com sumulas e acordaos do TCU
- Gerar ou higienizar listas de fornecedores/licitantes do PNCP e preparar roteiros de pesquisa comercial de WTP

## Steps

1. Extrair os dados do edital PDF ou do PNCP estritamente dentro do contrato de campos do Schema Canonico v1.4, marcando explicitamente como REVISAO_OBRIGATORIA qualquer campo ausente ou ambiguo no documento original (politica Fail-Closed).
2. Submeter indices contabeis (LG, LC, SG, Capital Social/Patrimonio Liquido minimo) e prazos de validade de certidoes ao PortaoDeterministico_v1_1_2.js para validacao exata sem inferencia de LLM.
3. Cotejar exigencias de qualificacao tecnica e economico-financeira exclusivamente contra o catalogo verificado de precedentes vinculantes (como Sumulas TCU 263, 272, 289 e Acordao 1.211/2021-Plenario); nunca citar numeros de acordaos de memoria sem fonte primaria comprovada na pasta do projeto.
4. Na geracao de listas de leads/prestadores SADT via PNCP ou Receita, validar matematicamente os digitos verificadores de 100% dos CNPJs via script determinista, confirmar telefone/e-mail em fonte primaria e excluir conflitantes (como o Hospital Antonio Targino - HAT).
5. Em abordagens comerciais de validacao (Gate 1 / WTP), aplicar exclusivamente o protocolo de entrevista qualitativa consultiva sobre dores do processo licitatorio, a custo zero.

## Gotchas

- E terminantemente proibido oferecer "Risco Reverso" (promessa de pagar taxas de edital ou multas) ou emitir "Certificado de Habilitacao" (risco de passivo financeiro e exercicio privativo da advocacia OAB, conforme veto formal H-VE01).
- Nunca misturar precedentes de Tribunais de Contas Estaduais (ex.: TCE-PB) ainda em quarentena com a base homologada do TCU sem a conferencia do inteiro teor do acordao.

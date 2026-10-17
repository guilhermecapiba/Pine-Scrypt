---
name: auditglosas-soulmv-tiss
description: "Modela queries SQL, validacoes headless de faturamento hospitalar no ERP Soul MV (XML TISS, TUSS, SIGTAP, OPME) e dossies regulatorios/ONA/CEBAS para o Hospital Antonio Targino (HAT/ISAS). Use em qualquer tarefa do MVP#3 AuditGlosas AI ou do MVP#5 Gestao Hospitalar."
---

# AuditGlosas SoulMV TISS

Guia a engenharia de prevencao de glosas hospitalares 100% headless sobre o banco de dados do ERP Soul MV e a gestao regulatoria, financeira e de acreditacao ONA/CEBAS em unidades hospitalares.

## When to Use

- Desenvolver queries SQL, scripts extratores ou regras de auditoria de contas medicas para o MVP#3 AuditGlosas AI
- Cruzar tabelas do Soul MV (ATENDIME, REG_FAT, CONTA_HOSP, ITREG_FAT, VAL_PRO, PRE_MED, ITPRE_MED, HRPRE_MED, AVISO_CIRURGIA, MVTO_ESTOQUE) com lotes XML TISS, BPA/APAC e notas fiscais de OPME/Brasindice/SIMPRO
- Elaborar dossies executivos, planos de acao 5W2H, matrizes RACI, respostas a oficios (CEBAS/MS, Vigilancia Sanitaria, Bombeiros AVCB, Alvara Municipal) e matrizes de preparacao ONA Niveis 1 a 3 no MVP#5 (HAT/ISAS)

## Steps

1. No MVP#3 (AuditGlosas AI), projetar toda solucao sob o principio 100% Headless: a auditoria deve ocorrer no nivel do dado (replica SQL read-only do Soul MV e interceptacao do XML TISS pre-envio), sem exigir digitacao adicional de medicos, enfermeiros no plantao ou operacao de sistema paralelo pelo faturista.
2. Separar a auditoria de contas em duas camadas: (a) Motor Deterministico em Python/SQL para batimento de checagem de enfermagem (HRPRE_MED vs ITREG_FAT), validacao de codigos TUSS/SIGTAP e cruzamento de nota fiscal de OPME vs MVTO_ESTOQUE; e (b) Agente LLM Clinico restrito a validar compatibilidade CID x Procedimento, justificativa de diarias/UTI e conformidade com DUT da ANS.
3. No MVP#5 (Gestao Hospitalar / HAT), priorizar sempre bloqueios regulatorios e juridicos com prazo fatal (AVCB Corpo de Bombeiros, Alvara Sanitario e Municipal, Certidoes Negativas e diligencias CEBAS 100% SUS/ISAS) antes de expansoes documentais de longo prazo.
4. Ao trabalhar com requisitos da acreditacao ONA sem o manual pago em maos, rotular explicitamente cada requisito com a fonte publica indireta utilizada e o nivel de confianca da linha, sem inventar normas.
5. Respeitar as restricoes de seguranca do acervo hospitalar: manter quadros externos (como Trello) em modo somente leitura salvo autorizacao expressa do Decisor, nao depender de arquivos protegidos por senha e jamais expor dados pessoais sensiveis de pacientes (LGPD Art. 5, II).

## Gotchas

- Nunca propor fluxos no AuditGlosas AI que transfiram trabalho burocratico para a ponta assistencial (alertas no meio do plantao ou exigencia de dupla digitacao).
- Nunca atribuir responsaveis em matrizes RACI hospitalares por inferencia: utilizar apenas os coordenadores nominalmente confirmados pela direcao para cada setor.

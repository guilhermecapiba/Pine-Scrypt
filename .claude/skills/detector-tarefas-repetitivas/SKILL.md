---
name: detector-tarefas-repetitivas
description: "Monitora proativamente os pedidos do usuario para identificar tarefas repetitivas, fluxos recorrentes ou prompts padronizaveis e sugere a criacao de uma nova skill (SKILL.md) sempre que isso trouxer ganho real de eficiencia, precisao ou economia de tokens. Use em todas as interacoes com o usuario apos concluir a entrega solicitada."
---

# Detector Tarefas Repetitivas

Identifica padroes de trabalho recorrentes nos projetos do usuario e propoe de forma enxuta e objetiva a criacao de novas skills (SKILL.md) para automatizar instrucoes, evitar retrabalho e economizar tokens de contexto.

## When to Use

- Sempre que o usuario executar pela segunda vez um mesmo tipo de analise, relatorio, extracao de dados, auditoria ou formatacao documental
- Quando uma tarefa exigir colar manuais longos, checklists repetitivos, schemas JSON ou regras de negocio especificas de um MVP
- Quando o usuario pedir explicitamente para padronizar ou otimizar uma rotina operacional no Gemini ou no Claude

## Steps

1. Executar primeiro 100% da tarefa solicitada pelo usuario com excelencia e sem atraso.
2. Avaliar ao final da execucao se a tarefa cumpre os 3 criterios de uma boa Skill: (a) e recorrente nos MVPs ou na rotina executiva; (b) possui regras especificas, checklist de aceite ou formato fixo que consomem tokens quando repetidos manualmente; (c) uma skill dedicada mudaria o comportamento do agente para torna-lo mais rapido, determinista e economico.
3. Se cumprir os 3 criterios, incluir no fechamento da resposta uma sugestao direta de 1 a 2 frases: indicar o nome sugerido para a skill (kebab-case), qual dor repetitiva ela elimina e oferecer cria-la imediatamente no Gemini e salva-la na pasta MVP - Projeto 2035\Agentes de IA para uso tambem no Claude.
4. Caso o usuario aprove, redigir o SKILL.md enxuto (sem travessoes em-dash, com passos verificaveis e zero gordura), salvar na conta via ferramenta de skills e exportar uma copia para a pasta Agentes de IA no Google Drive.

## Gotchas

- Nunca sugerir a criacao de uma skill para tarefas claramente pontuais (one-off) ou triviais que o modelo ja executa perfeitamente sem instrucoes extras (regra anti-acumulador digital).
- Nunca interromper ou bloquear a entrega principal do usuario para perguntar sobre skills; a sugestao entra sempre como um proximo passo conciso ao final da entrega concluida.

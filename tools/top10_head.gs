/**
 * =============================================================================
 * CRYPTO BACKTEST MACHINE — TOP 10 (PROJETO 02) — v1.0
 * Planilha: https://docs.google.com/spreadsheets/d/1WubiUb2K9s8J_a9AGfqphKYFFYi6ezAWCVBqn21A0jk
 *
 * Paradigma: MVP Projeto Cripto (PROJETO 02) v2.5. Motor de backtest, indicadores, Consenso Algorítmico, Esticamento do Mercado
 * e detecção de alertas são CÓPIAS FIÉIS do código do BTC. A diferença desta planilha: CADA MOEDA TEM AS PRÓPRIAS 5 MELHORES
 * ESTRATÉGIAS (até 50 distintas no total; SELECAO_N_ESTRATEGIAS é editável), escolhidas de um conjunto candidato de 51 (mais uma busca ampliada de ~300 quando faltam) por critério de
 * desempenho (Sharpe mínimo de 1,00 por estratégia) e diversificação medidos só no período de seleção (IS 70%), com os 30% finais (OOS) reservados para medir a decaída
 * real. O BTC é a referência e roda as 10 fixas do Projeto 02. Ver seção 2B (SELEÇÃO).
 *
 * UNIVERSO: BTC (referência) + 10 moedas: as 8 primeiras NEGOCIÁVEIS do ranking de valor de mercado (sem stablecoins, ativos
 * tokenizados e derivados/wrapped) + LINK e AAVE por escolha manual. Hoje: ETH, BNB, XRP, SOL, TRX, ZEC, HYPE, DOGE, LINK, AAVE.
 * A lista vive na aba UNIVERSO (editável); a aba RANKING_COINGECKO sugere ajustes, sem aplicá-los sozinha.
 *
 * DIFERENÇAS EM RELAÇÃO AO BTC (de propósito):
 *  - Sem zonas de liquidez (dependem de dados de liquidação), sem Aave e sem on-chain/derivativos.
 *  - Dados diários de cada moeda vêm de uma cascata de corretoras definida na aba UNIVERSO (coluna Fontes).
 *  - Indicadores técnicos são calculados em memória (não gravados em aba): a planilha fica leve.
 *  - Uma planilha, um script, onze ativos processados em rodízio dentro do limite de 6 minutos do Apps Script.
 *
 * ABAS: PAINEL_TOP10 | DESEMPENHO_10 | ESTRATEGIAS_TOP10 | SELECAO_CANDIDATAS | AUDITORIA | UNIVERSO | RANKING_COINGECKO | DIAGNOSTICO_FONTES |
 *       LOG_DISPAROS | CONFIG_SISTEMA | BASE_<SIMBOLO> (uma por ativo, OHLCV diário)
 *
 * INSTALAÇÃO
 *  1. Planilha -> Extensões -> Apps Script -> apagar tudo -> colar este arquivo -> salvar.
 *  2. Menu "Top 10 — Quant" (recarregue a planilha): 0) Criar/formatar abas.
 *  3. 1) Diagnóstico das fontes de dados (confirma qual corretora responde para cada moeda).
 *  4. 2) Carga inicial / ciclo completo (repita até todos os ativos estarem carregados; o gatilho horário também continua).
 *  5. G) Instalar gatilhos automáticos (a cada hora + segunda 08:00 BRT + backup 02:00 BRT).
 *
 * REGRAS INVIOLÁVEIS (herdadas do Projeto 02)
 *  - Sem look-ahead: sinais no FECHAMENTO da vela D, execução simulada na ABERTURA de D+1; a vela do dia corrente é descartada.
 *  - Comunicação ao cliente: nunca nomes/quantidade de estratégias, nem o indicador que disparou o alerta.
 * =============================================================================
 */

const P2 = {
  PLANILHA_ID: '1WubiUb2K9s8J_a9AGfqphKYFFYi6ezAWCVBqn21A0jk',
  TZ_BRT: 'America/Sao_Paulo',
  ABAS: {
    painel: 'PAINEL_TOP10',
    desemp: 'DESEMPENHO_10',
    estr: 'ESTRATEGIAS_TOP10',
    sel: 'SELECAO_CANDIDATAS',
    audit: 'AUDITORIA',
    universo: 'UNIVERSO',
    ranking: 'RANKING_COINGECKO',
    diag: 'DIAGNOSTICO_FONTES',
    log: 'LOG_DISPAROS',
    cfg: 'CONFIG_SISTEMA',
  },
  CAPITAL_BASE: 10000,
  FEE_PCT: 0.075,        // idêntico ao BTC (custo total 0,125% por lado com o slippage)
  SLIPPAGE_PCT: 0.050,
  MIN_CANDLES: 200,
  HIST_INICIO_MS: Date.UTC(2013, 0, 1),
};

/** Parâmetros editáveis (chave, valor padrão, descrição). Gravados em CONFIG_SISTEMA. */
const CFG_PADRAO = [
  ['EMAILS_CLIENTES', 'guilhermecapiba@gmail.com, capibatrader@gmail.com', 'Destinatários (separados por vírgula)'],
  ['ALERTAS_ATIVOS', 'SIM', 'SIM/NAO — liga/desliga o e-mail consolidado de alertas'],
  ['RELATORIO_SEMANAL_ATIVO', 'SIM', 'SIM/NAO — liga/desliga o relatório consolidado de segunda 08:00 BRT'],
  ['JANELA_DEDUP_HORAS', 24, 'Janela anti-reenvio do mesmo evento (ativo + data da vela + tipo)'],
  ['ZSCORE_LIMIAR', 2.0, '|Z-score| do retorno diário para spike de volatilidade'],
  ['ZSCORE_JANELAS', '9,21,30,90', 'Janelas (dias) avaliadas para o Z-score'],
  ['MACD_DIVERGENCIA_MIN_BARRAS', 20, 'Barras mínimas do regime anterior para inflexão MACD relevante'],
  ['CONSENSO_PESO_REF', 5, 'Soma de pesos (Sharpe 3 anos, cada um entre 0 e 3) a partir da qual o Consenso é 100% ponderado'],
  ['CONSENSO_JANELA_SHARPE_DIAS', 1095, 'Janela (dias) do Sharpe que pondera cada componente do consenso (se o ativo tiver menos histórico, usa o que existe)'],
  ['MIN_VELAS_POR_ATIVO', 'HYPE:345', 'Mínimo de velas por ativo quando diferente do padrão (formato SIMBOLO:VELAS, separados por vírgula). Moedas recentes: use com cautela, a amostra é curta'],
  ['MIN_VELAS_CONSENSO', 500, 'Velas diárias mínimas para calcular consenso e esticamento (abaixo disso: HISTORICO_INSUFICIENTE)'],
  ['JANELA_INICIO_BARRAS', 200, 'Barra a partir da qual o desempenho (CAGR, MaxDD, Calmar) é medido, depois do aquecimento das médias'],
  ['ORCAMENTO_SEG', 270, 'Tempo máximo de cada execução (segundos); o Apps Script corta em 360'],
  ['UNIVERSO_N_ATIVOS', 8, 'Quantidade de moedas do ranking CoinGecko (além do BTC e das escolhas manuais)'],
  ['UNIVERSO_MANUAIS', 'chainlink,aave', 'IDs CoinGecko escolhidos manualmente: ficam no universo mesmo fora da janela do ranking'],
  ['SELECAO_ATIVA', 'SIM', 'SIM = cada moeda usa as próprias melhores estratégias; NAO = todas usam as 10 fixas do Projeto 02'],
  ['SELECAO_N_ESTRATEGIAS', 5, 'Quantidade de estratégias escolhidas por moeda'],
  ['SELECAO_CORTE_IS', 0.70, 'Fração inicial do histórico para a divisão DESCRITIVA 70% iniciais x 30% finais (não é teste fora da amostra)'],
  ['SELECAO_MIN_TRADES_IS', 12, 'Trades mínimos no histórico (reduz automaticamente para moedas de histórico curto, piso 5)'],
  ['SELECAO_SHARPE_MIN', 1.0, 'Sharpe mínimo do histórico todo (régua cheia: níveis PLENA e RECENTE FRACA)'],
  ['SELECAO_EXIGE_PLENA', 'SIM', 'SIM = só entra estratégia no nível PLENA (histórico >= 1,00, 24m >= 0,8965, 12m >= 0,3983). NAO = aceita também RECENTE FRACA e PROVISORIA'],
  ['SELECAO_PISO_PROVISORIO', 1.0, 'Piso do nível PROVISORIA (Sharpe do histórico entre este valor e a régua). Só preenche vaga quando não há candidato acima da régua. Padrão 1 = desligado (mesma régua para todas as moedas). Use 0,8 para permitir estratégias provisórias'],
  ['SELECAO_JANELA_PERM_DIAS', 730, 'Janela (dias) do Sharpe de 24 meses usado na permanência'],
  ['SELECAO_SHARPE_MIN_24M', 1.0, 'Sharpe mínimo dos últimos 24 meses para o nível PLENA (no BTC, estratégia abaixo sai do consenso)'],
  ['SELECAO_SHARPE_MIN_12M', 0.5, 'Sharpe mínimo dos últimos 12 meses para o nível PLENA (no BTC, estratégia abaixo sai do consenso)'],
  ['SELECAO_BTC_SUBSTITUI', 'SIM', 'SIM = a estratégia fixa do BTC que ficar abaixo dos mínimos de Sharpe sai e é substituída pela melhor candidata que cumpre a régua. NAO = só sai do consenso'],
  ['SELECAO_HISTERESE', 0, 'Folga na saída do BTC: estratégia fixa só sai do consenso abaixo de (mínimo - folga). 0 = régua estrita; 0,1 evita sair por diferença de milésimos'],
  ['SELECAO_REVISAO_DIAS', 30, 'Intervalo mínimo entre revisões que tentam melhorar o nível das estratégias (vaga aberta ou fora do nível PLENA)'],
  ['SELECAO_DD_MAX', 70, 'Drawdown máximo (%) do histórico para um candidato ser elegível'],
  ['SELECAO_MAX_MESMA_CLASSE_POR_5', 1, 'Máximo de estratégias da mesma classe de indicador (a ideia, ex.: MACD com parâmetros vizinhos) a cada 5 escolhidas: 1 em 5, 2 em 10. Regra rígida, nunca relaxada'],
  ['SELECAO_MIN_PARA_MEDIR', 5, 'Mínimo de estratégias aceitas para a moeda ser analisada (índice, consenso, desempenho). Abaixo disso a moeda fica como SEM_ESTRATEGIA_ELEGIVEL com as vagas abertas'],
  ['SELECAO_ORCAMENTO_SEG', 150, 'Tempo máximo (segundos) da busca de candidatos de uma moeda; passado disso a busca é interrompida e a resposta indica'],
  ['SELECAO_RELAXAR_SE_FALTAR', 'SIM', 'SIM = se faltarem estratégias PLENA, relaxa SÓ os filtros secundários (drawdown, trades e correlação) para completar as vagas; o Sharpe mínimo nunca é relaxado. A coluna Criterio_secundario mostra o que foi relaxado'],
  ['SELECAO_DD_MAX_RELAX', 85, 'Drawdown máximo (%) do histórico na passada relaxada'],
  ['SELECAO_MIN_TRADES_RELAX', 5, 'Trades mínimos na passada relaxada'],
  ['SELECAO_CORR_MAX_RELAX', 0.97, 'Correlação máxima entre escolhidas na passada relaxada'],
  ['SELECAO_CORR_MAX', 0.92, 'Correlação máxima dos retornos diários (histórico) entre duas escolhidas'],
  ['SELECAO_REFRESH_DIAS', 90, 'Dias até refazer a seleção sozinha (ou use o menu S). Entre reseleções, a escolha fica congelada'],
  ['UNIVERSO_EXCLUIR_IDS', 'tether,usd-coin,usds,dai,ethena-usde,usd1-world-liberty-financial,paypal-usd,first-digital-usd,true-usd,usdd,figure-heloc,tether-gold,pax-gold,wrapped-bitcoin,staked-ether,wrapped-steth,weth,coinbase-wrapped-btc,wrapped-eeth,usdt0,blackrock-usd-institutional-digital-liquidity-fund',
    'IDs CoinGecko que nunca entram no universo (stablecoins, RWA, wrapped/staked). Separe por vírgula'],
];

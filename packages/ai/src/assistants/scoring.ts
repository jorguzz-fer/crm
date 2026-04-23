/**
 * Assistente de scoring de leads
 *
 * Calcula uma pontuação 0-100 ("temperatura") para cada lead com base em:
 *  - Recência da última interação        (peso 35%)
 *  - Volume total de atividades          (peso 25%)
 *  - Status do lead                      (peso 20%)
 *  - Possui oportunidade aberta          (peso 20%)
 *
 * Para leads com histórico suficiente (≥3 atividades), enriquece o score
 * heurístico com uma análise via Claude Haiku (custo mínimo).
 */

export type ScoreLabel = "frio" | "morno" | "quente";

export interface LeadScoreInput {
  leadId: string;
  status: string;           // LeadStatus enum value
  lastActivityAt: Date | null;
  activityCount: number;
  hasOpenOpportunity: boolean;
  notes?: string[];         // últimas 3 notas (para análise IA)
}

export interface LeadScoreResult {
  score: number;            // 0-100
  label: ScoreLabel;
  factors: {
    recency: number;        // 0-35
    volume: number;         // 0-25
    status: number;         // 0-20
    opportunity: number;    // 0-20
  };
}

// Pontuação por status do lead
const STATUS_SCORE: Record<string, number> = {
  NOVO:            10,
  EM_CONTATO:      20,
  QUALIFICADO:     20,
  DESQUALIFICADO:  0,
  CONVERTIDO:      15,
};

/**
 * Score de recência: decai exponencialmente com os dias sem interação.
 * - 0 dias  → 35 pts (acabou de interagir)
 * - 7 dias  → ~28 pts
 * - 30 dias → ~15 pts
 * - 90 dias → ~3 pts
 * - sem histórico → 0 pts
 */
function recencyScore(lastActivityAt: Date | null): number {
  if (!lastActivityAt) return 0;
  const daysSince = (Date.now() - lastActivityAt.getTime()) / 86_400_000;
  const raw = 35 * Math.exp(-daysSince / 30);
  return Math.round(Math.max(0, raw));
}

/**
 * Score de volume: satura em 10 atividades = 25 pts.
 */
function volumeScore(count: number): number {
  return Math.round(Math.min(25, (count / 10) * 25));
}

function labelFromScore(score: number): ScoreLabel {
  if (score >= 60) return "quente";
  if (score >= 30) return "morno";
  return "frio";
}

/**
 * Cálculo puramente heurístico — sem custo de API.
 */
export function scoreLeadHeuristic(input: LeadScoreInput): LeadScoreResult {
  const recency     = recencyScore(input.lastActivityAt);
  const volume      = volumeScore(input.activityCount);
  const status      = STATUS_SCORE[input.status] ?? 0;
  const opportunity = input.hasOpenOpportunity ? 20 : 0;

  const score = Math.min(100, recency + volume + status + opportunity);

  return {
    score,
    label: labelFromScore(score),
    factors: { recency, volume, status, opportunity },
  };
}

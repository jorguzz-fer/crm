/**
 * Assistente de acompanhamento — detecção de leads parados.
 *
 * Usa heurísticas puras (sem chamada de API) para detectar leads sem interação
 * há mais de `thresholdDays` dias. O custo é zero: não consome tokens.
 *
 * Regras:
 *   - Lead está nos status: NOVO | EM_CONTATO | QUALIFICADO
 *   - A data mais recente entre: createdAt, última atividade, última nota
 *     está há ≥ thresholdDays dias
 */

export interface LeadForFollowUp {
  id: string;
  name: string;
  status: string;
  createdAt: Date;
  lastActivityAt: Date | null;
  lastNoteAt: Date | null;
}

export interface StaleAlert {
  leadId: string;
  leadName: string;
  type: "SEM_INTERACAO";
  daysStale: number;
  message: string;
}

const ACTIVE_STATUSES = ["NOVO", "EM_CONTATO", "QUALIFICADO"];

/**
 * Retorna a lista de leads que precisam de acompanhamento.
 */
export function detectStaleLeads(
  leads: LeadForFollowUp[],
  thresholdDays = 7
): StaleAlert[] {
  const now = Date.now();
  const alerts: StaleAlert[] = [];

  for (const lead of leads) {
    if (!ACTIVE_STATUSES.includes(lead.status)) continue;

    // Data mais recente de interação
    const candidates: number[] = [lead.createdAt.getTime()];
    if (lead.lastActivityAt) candidates.push(lead.lastActivityAt.getTime());
    if (lead.lastNoteAt) candidates.push(lead.lastNoteAt.getTime());

    const lastInteraction = Math.max(...candidates);
    const daysStale = Math.floor((now - lastInteraction) / 86_400_000);

    if (daysStale >= thresholdDays) {
      alerts.push({
        leadId: lead.id,
        leadName: lead.name,
        type: "SEM_INTERACAO",
        daysStale,
        message:
          daysStale === thresholdDays
            ? `${lead.name} está sem interação há ${daysStale} dias.`
            : `${lead.name} está parado há ${daysStale} dias — precisa de atenção.`,
      });
    }
  }

  // Ordena pelos mais parados primeiro
  return alerts.sort((a, b) => b.daysStale - a.daysStale);
}

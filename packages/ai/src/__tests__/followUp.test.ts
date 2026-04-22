import { describe, it, expect } from "vitest";
import { detectStaleLeads } from "../assistants/followUp";
import type { LeadForFollowUp } from "../assistants/followUp";

// ── Helpers ──────────────────────────────────────────────────────────────────

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

function makeLead(overrides: Partial<LeadForFollowUp> = {}): LeadForFollowUp {
  return {
    id: "lead-1",
    name: "Lead Teste",
    status: "NOVO",
    createdAt: daysAgo(10),
    lastActivityAt: null,
    lastNoteAt: null,
    ...overrides,
  };
}

// ── detectStaleLeads ──────────────────────────────────────────────────────────

describe("detectStaleLeads", () => {
  const THRESHOLD = 7;

  // ─── Casos básicos ──────────────────────────────────────────────────────────

  it("retorna alerta para lead sem interação acima do threshold", () => {
    const leads = [makeLead({ createdAt: daysAgo(10) })];
    const alerts = detectStaleLeads(leads, THRESHOLD);

    expect(alerts).toHaveLength(1);
    expect(alerts[0].leadId).toBe("lead-1");
    expect(alerts[0].daysStale).toBeGreaterThanOrEqual(THRESHOLD);
    expect(alerts[0].type).toBe("SEM_INTERACAO");
  });

  it("não gera alerta para lead dentro do threshold", () => {
    const leads = [makeLead({ createdAt: daysAgo(3) })];
    const alerts = detectStaleLeads(leads, THRESHOLD);

    expect(alerts).toHaveLength(0);
  });

  it("exatamente no threshold gera alerta", () => {
    const leads = [makeLead({ createdAt: daysAgo(THRESHOLD) })];
    const alerts = detectStaleLeads(leads, THRESHOLD);

    expect(alerts).toHaveLength(1);
    expect(alerts[0].daysStale).toBe(THRESHOLD);
  });

  it("retorna lista vazia se não houver leads", () => {
    expect(detectStaleLeads([], THRESHOLD)).toHaveLength(0);
  });

  // ─── Filtro por status ──────────────────────────────────────────────────────

  it("ignora lead DESQUALIFICADO mesmo que antigo", () => {
    const leads = [makeLead({ status: "DESQUALIFICADO", createdAt: daysAgo(30) })];
    expect(detectStaleLeads(leads, THRESHOLD)).toHaveLength(0);
  });

  it("ignora lead CONVERTIDO mesmo que antigo", () => {
    const leads = [makeLead({ status: "CONVERTIDO", createdAt: daysAgo(30) })];
    expect(detectStaleLeads(leads, THRESHOLD)).toHaveLength(0);
  });

  it("gera alerta para NOVO, EM_CONTATO e QUALIFICADO", () => {
    const leads: LeadForFollowUp[] = [
      makeLead({ id: "l1", status: "NOVO",        createdAt: daysAgo(10) }),
      makeLead({ id: "l2", status: "EM_CONTATO",  createdAt: daysAgo(12) }),
      makeLead({ id: "l3", status: "QUALIFICADO", createdAt: daysAgo(8) }),
    ];
    const alerts = detectStaleLeads(leads, THRESHOLD);

    expect(alerts).toHaveLength(3);
    const ids = alerts.map((a) => a.leadId);
    expect(ids).toContain("l1");
    expect(ids).toContain("l2");
    expect(ids).toContain("l3");
  });

  // ─── Data de última interação ───────────────────────────────────────────────

  it("usa lastActivityAt se mais recente que createdAt", () => {
    const leads = [
      makeLead({
        createdAt: daysAgo(30),
        lastActivityAt: daysAgo(3), // recente — não deve gerar alerta
      }),
    ];
    expect(detectStaleLeads(leads, THRESHOLD)).toHaveLength(0);
  });

  it("usa lastNoteAt se mais recente que createdAt e lastActivityAt", () => {
    const leads = [
      makeLead({
        createdAt: daysAgo(30),
        lastActivityAt: daysAgo(20),
        lastNoteAt: daysAgo(2), // recente — não deve gerar alerta
      }),
    ];
    expect(detectStaleLeads(leads, THRESHOLD)).toHaveLength(0);
  });

  it("usa createdAt quando não há atividade nem nota", () => {
    const leads = [makeLead({ createdAt: daysAgo(10), lastActivityAt: null, lastNoteAt: null })];
    const alerts = detectStaleLeads(leads, THRESHOLD);

    expect(alerts).toHaveLength(1);
    expect(alerts[0].daysStale).toBeGreaterThanOrEqual(THRESHOLD);
  });

  it("usa a data MAIS RECENTE entre as três", () => {
    const leads = [
      makeLead({
        createdAt: daysAgo(30),
        lastActivityAt: daysAgo(15),
        lastNoteAt: daysAgo(5), // mais recente (5 dias) → sem alerta
      }),
    ];
    expect(detectStaleLeads(leads, THRESHOLD)).toHaveLength(0);
  });

  // ─── Ordenação ─────────────────────────────────────────────────────────────

  it("ordena alertas do mais parado ao menos parado", () => {
    const leads: LeadForFollowUp[] = [
      makeLead({ id: "l1", createdAt: daysAgo(8) }),   // 8 dias
      makeLead({ id: "l2", createdAt: daysAgo(20) }),  // 20 dias
      makeLead({ id: "l3", createdAt: daysAgo(12) }),  // 12 dias
    ];
    const alerts = detectStaleLeads(leads, THRESHOLD);

    expect(alerts[0].leadId).toBe("l2"); // 20 dias → primeiro
    expect(alerts[1].leadId).toBe("l3"); // 12 dias → segundo
    expect(alerts[2].leadId).toBe("l1"); // 8 dias  → terceiro
  });

  // ─── Mensagens ─────────────────────────────────────────────────────────────

  it("mensagem diferente para exatamente no threshold vs acima", () => {
    const onThreshold = detectStaleLeads([makeLead({ name: "João", createdAt: daysAgo(THRESHOLD) })], THRESHOLD);
    const above = detectStaleLeads([makeLead({ name: "João", createdAt: daysAgo(THRESHOLD + 5) })], THRESHOLD);

    // Exatamente no threshold: mensagem mais suave
    expect(onThreshold[0].message).toContain("João");
    // Acima: mensagem de atenção
    expect(above[0].message).toContain("atenção");
  });

  // ─── Threshold personalizado ────────────────────────────────────────────────

  it("respeita threshold customizado (3 dias)", () => {
    const leads = [makeLead({ createdAt: daysAgo(4) })];
    expect(detectStaleLeads(leads, 3)).toHaveLength(1);
    expect(detectStaleLeads(leads, 10)).toHaveLength(0);
  });

  it("threshold 0 gera alerta para todos os leads ativos", () => {
    const leads = [
      makeLead({ id: "l1", createdAt: daysAgo(0) }),
      makeLead({ id: "l2", createdAt: daysAgo(1) }),
    ];
    const alerts = detectStaleLeads(leads, 0);

    expect(alerts).toHaveLength(2);
  });

  // ─── Múltiplos leads — mix de ativos e inativos ───────────────────────────

  it("processa corretamente mix de leads ativos e convertidos", () => {
    const leads: LeadForFollowUp[] = [
      makeLead({ id: "ativo",    status: "NOVO",        createdAt: daysAgo(10) }),
      makeLead({ id: "conv",     status: "CONVERTIDO",  createdAt: daysAgo(30) }),
      makeLead({ id: "desq",     status: "DESQUALIFICADO", createdAt: daysAgo(30) }),
      makeLead({ id: "recente",  status: "EM_CONTATO",  createdAt: daysAgo(2) }),
    ];

    const alerts = detectStaleLeads(leads, THRESHOLD);

    expect(alerts).toHaveLength(1);
    expect(alerts[0].leadId).toBe("ativo");
  });
});

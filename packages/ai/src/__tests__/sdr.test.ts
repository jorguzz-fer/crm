import { describe, it, expect } from "vitest";
import {
  firstContactInputSchema,
  firstContactOutputSchema,
  followUpInputSchema,
  followUpOutputSchema,
  generateFirstContact,
  generateFollowUp,
} from "../assistants/sdr";

describe("firstContactInputSchema", () => {
  it("aceita payload mínimo válido", () => {
    const result = firstContactInputSchema.safeParse({
      tenantId: "t1",
      leadId: "l1",
      leadName: "João",
      channel: "whatsapp",
      productContext: {
        name: "Pós Cardio",
        priceBrl: 14997,
        highlights: ["EAD", "certificado MEC"],
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejeita canal desconhecido", () => {
    const result = firstContactInputSchema.safeParse({
      tenantId: "t1",
      leadId: "l1",
      leadName: "João",
      channel: "telegram",
      productContext: { name: "X", priceBrl: 1, highlights: ["a"] },
    });
    expect(result.success).toBe(false);
  });

  it("exige priceBrl positivo", () => {
    const result = firstContactInputSchema.safeParse({
      tenantId: "t1",
      leadId: "l1",
      leadName: "João",
      channel: "whatsapp",
      productContext: { name: "X", priceBrl: 0, highlights: ["a"] },
    });
    expect(result.success).toBe(false);
  });

  it("aplica tone=consultivo como default", () => {
    const result = firstContactInputSchema.safeParse({
      tenantId: "t1",
      leadId: "l1",
      leadName: "João",
      channel: "whatsapp",
      productContext: { name: "X", priceBrl: 100, highlights: ["a"] },
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.tone).toBe("consultivo");
  });
});

describe("firstContactOutputSchema", () => {
  it("aceita output válido", () => {
    const result = firstContactOutputSchema.safeParse({
      message: "Oi João! Vi que você baixou o material...",
      suggestedFollowUpMinutes: 120,
      intent: "qualify",
    });
    expect(result.success).toBe(true);
  });

  it("rejeita message vazia", () => {
    const result = firstContactOutputSchema.safeParse({
      message: "",
      suggestedFollowUpMinutes: 60,
      intent: "qualify",
    });
    expect(result.success).toBe(false);
  });

  it("rejeita message acima de 900 chars (WhatsApp-safe)", () => {
    const result = firstContactOutputSchema.safeParse({
      message: "x".repeat(901),
      suggestedFollowUpMinutes: 60,
      intent: "qualify",
    });
    expect(result.success).toBe(false);
  });
});

describe("generateFirstContact (Fase 2)", () => {
  it("por ora lança NotImplemented — scaffold RED", async () => {
    await expect(
      generateFirstContact({
        tenantId: "t1",
        leadId: "l1",
        leadName: "João",
        channel: "whatsapp",
        productContext: { name: "X", priceBrl: 100, highlights: ["a"] },
        tone: "consultivo",
      }),
    ).rejects.toThrow(/not implemented/i);
  });

  it.todo("gera mensagem personalizada com nome + highlight de produto");
  it.todo("adapta tom conforme parâmetro (formal/informal/consultivo)");
  it.todo("não inclui link de pagamento na primeira mensagem");
  it.todo("mantém mensagem ≤ 900 chars (limite WhatsApp)");
  it.todo("suggestedFollowUpMinutes é função do canal (wpp 120, email 1440)");
  it.todo("inclui CTA de qualificação (pergunta aberta)");
  it.todo("tenant isolation: prompt nunca referencia outro tenant");
});

describe("followUpInputSchema", () => {
  it("aceita payload válido", () => {
    const result = followUpInputSchema.safeParse({
      tenantId: "t1",
      leadId: "l1",
      leadName: "João",
      channel: "whatsapp",
      previousMessages: [{ role: "sdr", content: "oi", at: new Date() }],
      attempt: 1,
      daysSinceLastReply: 3,
    });
    expect(result.success).toBe(true);
  });

  it("rejeita attempt > 5 (cap de follow-ups)", () => {
    const result = followUpInputSchema.safeParse({
      tenantId: "t1",
      leadId: "l1",
      leadName: "João",
      channel: "whatsapp",
      previousMessages: [{ role: "sdr", content: "oi", at: new Date() }],
      attempt: 6,
      daysSinceLastReply: 1,
    });
    expect(result.success).toBe(false);
  });
});

describe("followUpOutputSchema", () => {
  it("aceita shouldEscalate true com nextAttemptHours null", () => {
    const result = followUpOutputSchema.safeParse({
      message: "Vou te colocar com um consultor.",
      shouldEscalate: true,
      nextAttemptHours: null,
    });
    expect(result.success).toBe(true);
  });
});

describe("generateFollowUp (Fase 2)", () => {
  it("por ora lança NotImplemented — scaffold RED", async () => {
    await expect(
      generateFollowUp({
        tenantId: "t1",
        leadId: "l1",
        leadName: "João",
        channel: "whatsapp",
        previousMessages: [{ role: "sdr", content: "oi", at: new Date() }],
        attempt: 1,
        daysSinceLastReply: 3,
      }),
    ).rejects.toThrow(/not implemented/i);
  });

  it.todo("attempt=1 é breezy check-in");
  it.todo("attempt=3 introduz objection-handling comum (preço/tempo)");
  it.todo("attempt=5 sugere shouldEscalate=true E nextAttemptHours=null");
  it.todo("nunca repete verbatim o texto da attempt anterior");
  it.todo("respeita janela de 24h do WhatsApp (não envia fora)");
});

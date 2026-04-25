import { describe, it, expect } from "vitest";
import {
  classifierInputSchema,
  classificationSchema,
  classifyLead,
} from "../assistants/classifier";

describe("classifierInputSchema", () => {
  it("exige tenantId não-vazio", () => {
    const result = classifierInputSchema.safeParse({
      tenantId: "",
      leadId: "l1",
      messages: [{ role: "lead", content: "oi", at: new Date() }],
    });
    expect(result.success).toBe(false);
  });

  it("exige ao menos 1 mensagem", () => {
    const result = classifierInputSchema.safeParse({
      tenantId: "t1",
      leadId: "l1",
      messages: [],
    });
    expect(result.success).toBe(false);
  });

  it("aceita payload mínimo válido", () => {
    const result = classifierInputSchema.safeParse({
      tenantId: "t1",
      leadId: "l1",
      messages: [{ role: "lead", content: "quanto custa?", at: new Date() }],
    });
    expect(result.success).toBe(true);
  });

  it("aceita attribution e productContext opcionais", () => {
    const result = classifierInputSchema.safeParse({
      tenantId: "t1",
      leadId: "l1",
      messages: [{ role: "lead", content: "olá", at: new Date() }],
      attribution: { utmSource: "meta", ctwaClid: "ARB" },
      productContext: { name: "Pós Cardio", priceBrl: 14997 },
    });
    expect(result.success).toBe(true);
  });
});

describe("classificationSchema", () => {
  it("aceita classificação válida", () => {
    const result = classificationSchema.safeParse({
      classification: "hot",
      confidence: 0.87,
      rationale: "perguntou preço e turma",
      recommendedNextAction: "route_to_human",
    });
    expect(result.success).toBe(true);
  });

  it("rejeita confidence fora de [0,1]", () => {
    const result = classificationSchema.safeParse({
      classification: "hot",
      confidence: 1.5,
      rationale: "x",
      recommendedNextAction: "route_to_human",
    });
    expect(result.success).toBe(false);
  });

  it("rejeita classificação desconhecida", () => {
    const result = classificationSchema.safeParse({
      classification: "maybe",
      confidence: 0.5,
      rationale: "x",
      recommendedNextAction: "route_to_human",
    });
    expect(result.success).toBe(false);
  });
});

describe("classifyLead (Fase 2)", () => {
  // Comportamentos cobertos em classifier.behavior.test.ts (com mocks do AI SDK).
  it.todo("retorna cold quando lead respondeu só emoji/sticker");
  it.todo("retorna unqualified quando lead é competidor (domínio conhecido)");
});

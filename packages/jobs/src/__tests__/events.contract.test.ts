import { describe, it, expect } from "vitest";
import {
  EVENT_SCHEMAS,
  leadCreatedSchema,
  leadClassifiedSchema,
  messageReceivedSchema,
  paymentReceivedSchema,
} from "../events";

/**
 * Contract tests para eventos Inngest.
 *
 * Protegem o contrato documentado em .coordination/EVENTS.md:
 * - `tenantId` sempre obrigatório
 * - Campos enum só aceitam valores listados
 * - Campos novos precisam ser optional (este teste não protege isso, mas
 *   o code review protege)
 */

describe("event schemas — contrato base", () => {
  it("todos os eventos exigem tenantId", () => {
    for (const [name, schema] of Object.entries(EVENT_SCHEMAS)) {
      const result = schema.safeParse({ /* sem tenantId */ });
      expect(result.success, `${name} aceitou payload sem tenantId`).toBe(false);
    }
  });

  it("tenantId não pode ser string vazia", () => {
    const result = leadCreatedSchema.safeParse({
      tenantId: "",
      leadId: "lead_1",
      source: "WHATSAPP",
    });
    expect(result.success).toBe(false);
  });
});

describe("lead/created", () => {
  it("aceita payload mínimo válido", () => {
    const result = leadCreatedSchema.safeParse({
      tenantId: "tenant_1",
      leadId: "lead_1",
      source: "WHATSAPP",
    });
    expect(result.success).toBe(true);
  });

  it("rejeita source desconhecido", () => {
    const result = leadCreatedSchema.safeParse({
      tenantId: "tenant_1",
      leadId: "lead_1",
      source: "TIKTOK", // não está no enum
    });
    expect(result.success).toBe(false);
  });
});

describe("lead/classified", () => {
  it("aceita score válido", () => {
    const result = leadClassifiedSchema.safeParse({
      tenantId: "tenant_1",
      leadId: "lead_1",
      score: "HOT",
      confidence: 0.92,
      reasons: ["respondeu em <5min", "médico confirmado"],
      modelUsed: "claude-haiku-4-5",
    });
    expect(result.success).toBe(true);
  });

  it("rejeita confidence > 1", () => {
    const result = leadClassifiedSchema.safeParse({
      tenantId: "tenant_1",
      leadId: "lead_1",
      score: "HOT",
      confidence: 1.5,
      reasons: [],
      modelUsed: "x",
    });
    expect(result.success).toBe(false);
  });

  it("rejeita score inválido", () => {
    const result = leadClassifiedSchema.safeParse({
      tenantId: "tenant_1",
      leadId: "lead_1",
      score: "MAYBE",
      confidence: 0.5,
      reasons: [],
      modelUsed: "x",
    });
    expect(result.success).toBe(false);
  });
});

describe("message/received", () => {
  it("aceita mensagem de texto WhatsApp", () => {
    const result = messageReceivedSchema.safeParse({
      tenantId: "tenant_1",
      conversationId: "conv_1",
      messageId: "msg_1",
      channel: "whatsapp",
      content: { type: "text", body: "Olá" },
      from: "+5511999999999",
      receivedAt: new Date().toISOString(),
    });
    expect(result.success).toBe(true);
  });

  it("preserva providerMetadata (ctwa_clid, fbclid)", () => {
    const result = messageReceivedSchema.safeParse({
      tenantId: "tenant_1",
      conversationId: "conv_1",
      messageId: "msg_1",
      channel: "whatsapp",
      content: { type: "text", body: "Olá" },
      from: "+5511999999999",
      receivedAt: new Date().toISOString(),
      providerMetadata: { ctwa_clid: "ARBxxxxx", fbclid: "IwAR..." },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.providerMetadata?.ctwa_clid).toBe("ARBxxxxx");
    }
  });
});

describe("payment/received", () => {
  it("aceita payload Hotmart", () => {
    const result = paymentReceivedSchema.safeParse({
      tenantId: "tenant_1",
      gateway: "hotmart",
      externalId: "HP17472301230",
      amount: 997,
      currency: "BRL",
      buyerEmail: "comprador@example.com",
      rawPayload: { event: "PURCHASE_APPROVED" },
    });
    expect(result.success).toBe(true);
  });

  it("rejeita currency com mais de 3 chars", () => {
    const result = paymentReceivedSchema.safeParse({
      tenantId: "tenant_1",
      gateway: "hotmart",
      externalId: "HP1",
      amount: 100,
      currency: "REAL",
      rawPayload: {},
    });
    expect(result.success).toBe(false);
  });
});

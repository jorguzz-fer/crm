import { describe, it, expect } from "vitest";
import { inboundMessageSchema, outboundMessageSchema } from "../types";

describe("inboundMessageSchema", () => {
  const base = {
    tenantId: "t1",
    providerInstanceId: "inst-1",
    externalMessageId: "wamid.1",
    from: { phoneE164: "+5511999990000", name: "João" },
    to: { phoneE164: "+5511888880000" },
    receivedAt: new Date(),
  };

  it("aceita mensagem text válida", () => {
    const result = inboundMessageSchema.safeParse({
      ...base,
      message: { type: "text", text: "oi" },
    });
    expect(result.success).toBe(true);
  });

  it("rejeita phone fora de E.164", () => {
    const result = inboundMessageSchema.safeParse({
      ...base,
      from: { phoneE164: "11999990000" },
      message: { type: "text", text: "oi" },
    });
    expect(result.success).toBe(false);
  });

  it("aceita ctwaClid (Click-to-WhatsApp Ad)", () => {
    const result = inboundMessageSchema.safeParse({
      ...base,
      ctwaClid: "ARBxxx",
      message: { type: "text", text: "oi" },
    });
    expect(result.success).toBe(true);
  });

  it("aceita media image com caption opcional", () => {
    const result = inboundMessageSchema.safeParse({
      ...base,
      message: {
        type: "image",
        mediaUrl: "https://cdn.example/img.jpg",
        caption: "tabela de preços",
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejeita mensagem text vazia", () => {
    const result = inboundMessageSchema.safeParse({
      ...base,
      message: { type: "text", text: "" },
    });
    expect(result.success).toBe(false);
  });

  it("exige externalMessageId pra dedup", () => {
    const { externalMessageId: _ignored, ...rest } = base;
    const result = inboundMessageSchema.safeParse({
      ...rest,
      message: { type: "text", text: "oi" },
    });
    expect(result.success).toBe(false);
  });
});

describe("outboundMessageSchema", () => {
  it("aceita text com externalEventId", () => {
    const result = outboundMessageSchema.safeParse({
      tenantId: "t1",
      providerInstanceId: "inst-1",
      toPhoneE164: "+5511999990000",
      content: { type: "text", text: "Olá!" },
      externalEventId: "msg-uuid-1",
    });
    expect(result.success).toBe(true);
  });

  it("aceita template com variáveis", () => {
    const result = outboundMessageSchema.safeParse({
      tenantId: "t1",
      providerInstanceId: "inst-1",
      toPhoneE164: "+5511999990000",
      content: {
        type: "template",
        templateName: "welcome_v1",
        locale: "pt_BR",
        variables: ["João", "Pós Cardio"],
      },
      externalEventId: "msg-uuid-2",
    });
    expect(result.success).toBe(true);
  });

  it("rejeita envio sem externalEventId (sem idempotency)", () => {
    const result = outboundMessageSchema.safeParse({
      tenantId: "t1",
      providerInstanceId: "inst-1",
      toPhoneE164: "+5511999990000",
      content: { type: "text", text: "Olá!" },
    });
    expect(result.success).toBe(false);
  });
});

import { describe, it, expect } from "vitest";
import { createEvolutionAdapter } from "../adapters/evolution";
import { createMetaCloudAdapter } from "../adapters/meta-cloud";

describe("createEvolutionAdapter", () => {
  it("retorna adapter com provider = 'evolution'", () => {
    const a = createEvolutionAdapter({
      baseUrl: "https://evo.example",
      apiKey: "k",
      instanceName: "inst",
      instancePhone: "+5511000000000",
    });
    expect(a.provider).toBe("evolution");
  });

  // Contratos cobertos pelos arquivos evolution.*.test.ts
  it.todo("sendMessage é idempotente via externalEventId (dedup no DB — Fase 3)");
  it.todo("tenant isolation: erra se providerInstanceId não pertence ao tenant");
});

describe("createMetaCloudAdapter", () => {
  it("retorna adapter com provider = 'meta-cloud'", () => {
    const a = createMetaCloudAdapter({
      appSecret: "s",
      accessToken: "t",
      phoneNumberId: "p",
      wabaId: "w",
    });
    expect(a.provider).toBe("meta-cloud");
  });

  it("sendMessage lança NotImplemented (Fase 1 — Meta Cloud pendente)", async () => {
    const a = createMetaCloudAdapter({
      appSecret: "s",
      accessToken: "t",
      phoneNumberId: "p",
      wabaId: "w",
    });
    await expect(
      a.sendMessage({
        tenantId: "t1",
        providerInstanceId: "i1",
        toPhoneE164: "+5511999990000",
        content: { type: "text", text: "oi" },
        externalEventId: "x",
      }),
    ).rejects.toThrow(/not implemented/i);
  });

  it.todo("sendMessage usa Graph API v21.0 por default");
  it.todo("verifyWebhookSignature valida HMAC-SHA256 em x-hub-signature-256");
  it.todo("verifyWebhookSignature rejeita sem header de assinatura");
  it.todo("parseInbound normaliza entry[].changes[].value.messages[]");
  it.todo("parseInbound extrai ctwa_clid do referral (quando Click-to-WhatsApp)");
  it.todo("parseInbound lida com batch (múltiplas mensagens no mesmo webhook)");
});

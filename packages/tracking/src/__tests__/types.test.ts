import { describe, it, expect } from "vitest";
import { attributionDataSchema, conversionEventPayloadSchema } from "../types";

describe("attributionDataSchema", () => {
  it("aceita todos os campos null (lead sem nenhum tracking)", () => {
    const result = attributionDataSchema.safeParse({
      fbclid: null,
      fbp: null,
      fbc: null,
      ctwaClid: null,
      gclid: null,
      utmSource: null,
    });
    expect(result.success).toBe(true);
  });

  it("aceita payload completo com CTWA click ID", () => {
    const result = attributionDataSchema.safeParse({
      fbclid: "IwAR0",
      fbp: "fb.1.x",
      fbc: "fb.1.y",
      ctwaClid: "ARBxxxx",
      gclid: null,
      utmSource: "meta",
      utmMedium: "paid",
      utmCampaign: "pos-card",
      landingPage: "/lp",
    });
    expect(result.success).toBe(true);
  });
});

describe("conversionEventPayloadSchema", () => {
  it("exige externalEventId (para dedup com pixel)", () => {
    const result = conversionEventPayloadSchema.safeParse({
      tenantId: "t1",
      leadId: "l1",
      eventType: "purchase",
      value: 997,
      currency: "BRL",
      userData: { email: "x@y.com" },
      attribution: {},
      // externalEventId ausente
    });
    expect(result.success).toBe(false);
  });

  it("aceita payload Purchase válido", () => {
    const result = conversionEventPayloadSchema.safeParse({
      tenantId: "t1",
      leadId: "l1",
      eventType: "purchase",
      value: 997,
      currency: "BRL",
      userData: { email: "x@y.com", phone: "+5511999" },
      attribution: { fbclid: "IwAR", ctwaClid: "ARB" },
      externalEventId: "purchase_deal_1",
    });
    expect(result.success).toBe(true);
  });

  it("rejeita eventType desconhecido", () => {
    const result = conversionEventPayloadSchema.safeParse({
      tenantId: "t1",
      leadId: "l1",
      eventType: "view_video", // não está no enum
      userData: {},
      attribution: {},
      externalEventId: "x",
    });
    expect(result.success).toBe(false);
  });

  it("BRL é default quando currency omitido", () => {
    const result = conversionEventPayloadSchema.safeParse({
      tenantId: "t1",
      leadId: "l1",
      eventType: "lead",
      userData: {},
      attribution: {},
      externalEventId: "lead_l1",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.currency).toBe("BRL");
    }
  });
});

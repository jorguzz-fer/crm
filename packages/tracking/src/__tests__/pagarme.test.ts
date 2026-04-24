import { createHmac } from "crypto";
import { describe, it, expect } from "vitest";
import { parsePagarme, verifyPagarmeSignature } from "../webhooks/pagarme";

const SECRET = "pagarme-webhook-secret";

function makeSignature(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

const approvedBody = JSON.stringify({
  type: "order.paid",
  data: {
    id: "or_abc123",
    status: "paid",
    amount: 999700,
    currency: "BRL",
    customer: {
      email: "maria@example.com",
      phones: {
        mobile_phone: {
          country_code: "55",
          area_code: "11",
          number: "987654321",
        },
      },
    },
    items: [{ code: "prod_123" }],
    created_at: "2024-04-24T20:00:00Z",
  },
});

describe("verifyPagarmeSignature", () => {
  it("retorna valid=true para assinatura HMAC-SHA256 correta", () => {
    const headers = new Headers({ "x-hub-signature": `sha256=${makeSignature(approvedBody, SECRET)}` });
    const result = verifyPagarmeSignature(headers, approvedBody, SECRET);
    expect(result.valid).toBe(true);
  });

  it("retorna valid=false com reason=missing-signature quando header ausente", () => {
    const headers = new Headers();
    const result = verifyPagarmeSignature(headers, approvedBody, SECRET);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("missing-signature");
  });

  it("retorna valid=false com reason=invalid-signature para HMAC errado", () => {
    const headers = new Headers({ "x-hub-signature": "sha256=wrong" });
    const result = verifyPagarmeSignature(headers, approvedBody, SECRET);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("invalid-signature");
  });
});

describe("parsePagarme", () => {
  it("normaliza order.paid corretamente", () => {
    const result = parsePagarme(JSON.parse(approvedBody));
    expect(result).not.toBeNull();
    expect(result!.gateway).toBe("pagarme");
    expect(result!.status).toBe("approved");
    expect(result!.externalId).toBe("or_abc123");
    expect(result!.amount).toBe(9997.0);
    expect(result!.currency).toBe("BRL");
    expect(result!.buyerEmail).toBe("maria@example.com");
    expect(result!.productExternalId).toBe("prod_123");
    expect(result!.occurredAt).toBeInstanceOf(Date);
  });

  it("normaliza order.refunded com status=refunded", () => {
    const payload = JSON.parse(approvedBody);
    payload.type = "order.refunded";
    payload.data.status = "refunded";
    const result = parsePagarme(payload);
    expect(result!.status).toBe("refunded");
  });

  it("normaliza order.chargedback com status=chargeback", () => {
    const payload = JSON.parse(approvedBody);
    payload.type = "order.chargedback";
    payload.data.status = "chargedback";
    const result = parsePagarme(payload);
    expect(result!.status).toBe("chargeback");
  });

  it("retorna null para eventos ignorados", () => {
    const payload = JSON.parse(approvedBody);
    payload.type = "subscription.created";
    const result = parsePagarme(payload);
    expect(result).toBeNull();
  });

  it("converte centavos para reais corretamente (999700 → 9997.00)", () => {
    const result = parsePagarme(JSON.parse(approvedBody));
    expect(result!.amount).toBe(9997.0);
  });

  it("retorna null para payload malformado", () => {
    const result = parsePagarme({ type: "order.paid" });
    expect(result).toBeNull();
  });
});

import { describe, it, expect } from "vitest";
import { parseHotmart, verifyHotmartSignature } from "../webhooks/hotmart";

const HOTMART_TOKEN = "secret-hotmart-token";

// Minimal approved purchase payload from Hotmart v2 webhooks
const approvedPayload = {
  event: "PURCHASE_APPROVED",
  version: "2.0.0",
  data: {
    purchase: {
      transaction: "HP23894820485",
      status: "APPROVED",
      date_next_charge: null,
      price: {
        value: 9997.0,
        currency_value: "BRL",
      },
    },
    buyer: {
      email: "joao@example.com",
      checkout_phone: "+5511987654321",
    },
    product: {
      id: 123456,
    },
    date_creation: "2024-04-24T20:00:00Z",
  },
};

const refundedPayload = {
  event: "PURCHASE_REFUNDED",
  version: "2.0.0",
  data: {
    purchase: {
      transaction: "HP23894820486",
      status: "REFUNDED",
      date_next_charge: null,
      price: { value: 9997.0, currency_value: "BRL" },
    },
    buyer: { email: "joao@example.com" },
    product: { id: 123456 },
    date_creation: "2024-04-24T20:00:00Z",
  },
};

describe("verifyHotmartSignature", () => {
  it("retorna valid=true quando hottok header bate com token configurado", () => {
    const headers = new Headers({ "x-hotmart-hottok": HOTMART_TOKEN });
    const result = verifyHotmartSignature(headers, HOTMART_TOKEN);
    expect(result.valid).toBe(true);
  });

  it("retorna valid=false com reason=missing-signature quando header ausente", () => {
    const headers = new Headers();
    const result = verifyHotmartSignature(headers, HOTMART_TOKEN);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("missing-signature");
  });

  it("retorna valid=false com reason=invalid-signature quando token errado", () => {
    const headers = new Headers({ "x-hotmart-hottok": "wrong-token" });
    const result = verifyHotmartSignature(headers, HOTMART_TOKEN);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("invalid-signature");
  });
});

describe("parseHotmart", () => {
  it("normaliza PURCHASE_APPROVED corretamente", () => {
    const result = parseHotmart(approvedPayload);
    expect(result).not.toBeNull();
    expect(result!.gateway).toBe("hotmart");
    expect(result!.status).toBe("approved");
    expect(result!.externalId).toBe("HP23894820485");
    expect(result!.amount).toBe(9997.0);
    expect(result!.currency).toBe("BRL");
    expect(result!.buyerEmail).toBe("joao@example.com");
    expect(result!.buyerPhone).toBe("+5511987654321");
    expect(result!.productExternalId).toBe("123456");
    expect(result!.occurredAt).toBeInstanceOf(Date);
    expect(result!.rawPayload).toEqual(approvedPayload);
  });

  it("normaliza PURCHASE_REFUNDED com status=refunded", () => {
    const result = parseHotmart(refundedPayload);
    expect(result!.status).toBe("refunded");
    expect(result!.externalId).toBe("HP23894820486");
  });

  it("normaliza PURCHASE_CANCELLED com status=cancelled", () => {
    const payload = {
      ...approvedPayload,
      event: "PURCHASE_CANCELLED",
      data: {
        ...approvedPayload.data,
        purchase: { ...approvedPayload.data.purchase, transaction: "HP999", status: "CANCELLED" },
      },
    };
    const result = parseHotmart(payload);
    expect(result!.status).toBe("cancelled");
  });

  it("retorna null para eventos ignorados (ex: PURCHASE_DELAYED)", () => {
    const payload = { ...approvedPayload, event: "PURCHASE_DELAYED" };
    const result = parseHotmart(payload);
    expect(result).toBeNull();
  });

  it("retorna null para payload malformado sem data.purchase", () => {
    const result = parseHotmart({ event: "PURCHASE_APPROVED" });
    expect(result).toBeNull();
  });

  it("buyerPhone é opcional — funciona sem checkout_phone", () => {
    const noPhone = {
      ...approvedPayload,
      data: {
        ...approvedPayload.data,
        buyer: { email: "joao@example.com" },
      },
    };
    const result = parseHotmart(noPhone);
    expect(result).not.toBeNull();
    expect(result!.buyerPhone).toBeUndefined();
  });
});

import { createHmac, timingSafeEqual } from "crypto";
import type { NormalizedPayment, VerifyResult } from "./index";

const STATUS_MAP: Record<string, NormalizedPayment["status"] | null> = {
  "order.paid": "approved",
  "order.refunded": "refunded",
  "order.chargedback": "chargeback",
  "order.canceled": "cancelled",
};

export function verifyPagarmeSignature(headers: Headers, body: string, secret: string): VerifyResult {
  const header = headers.get("x-hub-signature");
  if (!header) return { valid: false, reason: "missing-signature" };

  const expected = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
  try {
    const a = Buffer.from(header);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return { valid: false, reason: "invalid-signature" };
    if (!timingSafeEqual(a, b)) return { valid: false, reason: "invalid-signature" };
  } catch {
    return { valid: false, reason: "invalid-signature" };
  }
  return { valid: true };
}

export function parsePagarme(payload: unknown): NormalizedPayment | null {
  try {
    const p = payload as Record<string, unknown>;
    const type = p.type as string;
    const status = STATUS_MAP[type];
    if (status === undefined || status === null) return null;

    const data = p.data as Record<string, unknown>;
    if (!data?.id) return null;

    const customer = data.customer as Record<string, unknown> | undefined;
    const mobilePhone = (customer?.phones as Record<string, unknown> | undefined)
      ?.mobile_phone as Record<string, string> | undefined;

    const buyerPhone = mobilePhone
      ? `+${mobilePhone.country_code}${mobilePhone.area_code}${mobilePhone.number}`
      : undefined;

    const items = data.items as Array<Record<string, unknown>> | undefined;
    const productExternalId = items?.[0]?.code as string | undefined;

    return {
      gateway: "pagarme",
      externalId: data.id as string,
      status,
      amount: (data.amount as number) / 100,
      currency: data.currency as string,
      buyerEmail: customer?.email as string | undefined,
      buyerPhone,
      productExternalId,
      occurredAt: new Date(data.created_at as string),
      rawPayload: payload as Record<string, unknown>,
    };
  } catch {
    return null;
  }
}

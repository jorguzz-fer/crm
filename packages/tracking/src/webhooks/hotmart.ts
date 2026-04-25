import type { NormalizedPayment, VerifyResult } from "./index";

const STATUS_MAP: Record<string, NormalizedPayment["status"] | null> = {
  PURCHASE_APPROVED: "approved",
  PURCHASE_REFUNDED: "refunded",
  PURCHASE_CANCELLED: "cancelled",
  PURCHASE_CHARGEBACK: "chargeback",
  PURCHASE_COMPLETE: "approved",
};

export function verifyHotmartSignature(headers: Headers, expectedToken: string): VerifyResult {
  const token = headers.get("x-hotmart-hottok");
  if (!token) return { valid: false, reason: "missing-signature" };
  if (token !== expectedToken) return { valid: false, reason: "invalid-signature" };
  return { valid: true };
}

export function parseHotmart(payload: unknown): NormalizedPayment | null {
  try {
    const p = payload as Record<string, unknown>;
    const event = p.event as string;
    const status = STATUS_MAP[event];
    if (status === undefined || status === null) return null;

    const data = p.data as Record<string, unknown>;
    if (!data?.purchase) return null;

    const purchase = data.purchase as Record<string, unknown>;
    const price = purchase.price as Record<string, unknown>;
    const buyer = data.buyer as Record<string, unknown>;
    const product = data.product as Record<string, unknown>;

    return {
      gateway: "hotmart",
      externalId: purchase.transaction as string,
      status,
      amount: price.value as number,
      currency: price.currency_value as string,
      buyerEmail: buyer?.email as string | undefined,
      buyerPhone: (buyer?.checkout_phone as string | undefined) ?? undefined,
      productExternalId: product?.id != null ? String(product.id) : undefined,
      occurredAt: new Date(data.date_creation as string),
      rawPayload: payload as Record<string, unknown>,
    };
  } catch {
    return null;
  }
}

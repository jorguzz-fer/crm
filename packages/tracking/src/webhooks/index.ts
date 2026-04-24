/**
 * Parsers de webhooks de gateway.
 *
 * Cada adapter expõe:
 *  - `verifySignature(req) -> boolean`
 *  - `parse(payload) -> NormalizedPayment | null`
 *
 * Normalizamos pra `payment/received` antes de emitir no Inngest.
 *
 * Implementações virão na Fase 4. Stubs aqui só pra estabilizar interfaces.
 */

export type NormalizedPayment = {
  gateway: "hotmart" | "pagarme" | "paypal" | "stripe";
  externalId: string;
  status: "pending" | "approved" | "refunded" | "chargeback" | "cancelled";
  amount: number;
  currency: string;
  buyerEmail?: string;
  buyerPhone?: string;
  productExternalId?: string;
  occurredAt: Date;
  rawPayload: Record<string, unknown>;
};

export type VerifyResult =
  | { valid: true; reason?: never }
  | { valid: false; reason: "missing-signature" | "invalid-signature" | "malformed" };

export * from "./hotmart";
export * from "./pagarme";
// TODO (Fase 4): export * from "./paypal";
// TODO (Fase 4): export * from "./stripe";

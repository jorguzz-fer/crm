import { createHmac, createHash } from "node:crypto";

/**
 * Helpers para assinar payloads de webhook em testes.
 * Cada provider tem seu método de assinatura distinto — nunca misture.
 */

export function hmacSha256(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * Meta (WhatsApp Cloud API, Facebook webhooks) — header `x-hub-signature-256`.
 * Format: `sha256=<hex>`
 */
export function signMetaWebhook(payload: string, appSecret: string): string {
  return `sha256=${hmacSha256(payload, appSecret)}`;
}

/**
 * Pagar.me v5 — header `x-hub-signature`.
 * Format: `sha256=<hex>`
 */
export function signPagarmeWebhook(payload: string, endpointSecret: string): string {
  return `sha256=${hmacSha256(payload, endpointSecret)}`;
}

/**
 * Hotmart — header `x-hotmart-hottok` com valor literal do hottok cadastrado.
 * Hotmart não assina payload; valida só o token shared secret.
 */
export function makeHotmartHottok(hottok: string): string {
  return hottok;
}

/**
 * Stripe — header `stripe-signature`.
 * Format: `t=<timestamp>,v1=<signature>`
 */
export function signStripeWebhook(
  payload: string,
  secret: string,
  timestamp: number = Math.floor(Date.now() / 1000),
): string {
  const signedPayload = `${timestamp}.${payload}`;
  const signature = hmacSha256(signedPayload, secret);
  return `t=${timestamp},v1=${signature}`;
}

/**
 * PayPal IPN — validação é stateful (POSTa de volta), difícil em unit test.
 * Helper retorna um mock de verificação bem-sucedida para usar com MSW.
 */
export function paypalIpnVerifyMock(): { status: "VERIFIED" | "INVALID" } {
  return { status: "VERIFIED" };
}

/**
 * Hash SHA-256 — usado pelo Meta CAPI e Google Enhanced Conversions
 * para email/phone (compliance + privacidade).
 */
export function sha256Hex(input: string): string {
  return createHash("sha256").update(input.trim().toLowerCase()).digest("hex");
}

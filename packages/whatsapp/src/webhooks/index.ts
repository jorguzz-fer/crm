/**
 * Handler compartilhado para webhooks WhatsApp.
 *
 * Fluxo (vale pros DOIS adapters):
 *   1) verifyWebhookSignature(raw) — 401 se falha
 *   2) rate-limit por providerInstanceId
 *   3) parseInbound(raw) → InboundMessage[]
 *   4) dedup por externalMessageId
 *   5) enqueue evento `message/received` no Inngest (com tenantId)
 *
 * Fase 1 implementa.
 */

import type { WhatsAppAdapter, InboundMessage } from "../types";

export interface HandleWebhookInput {
  adapter: WhatsAppAdapter;
  rawBody: string;
  headers: Record<string, string>;
  secret: string;
}

export interface HandleWebhookResult {
  status: 200 | 401 | 429 | 500;
  processed: number;
  messages: InboundMessage[];
  error?: string;
}

export async function handleWebhook(
  _input: HandleWebhookInput,
): Promise<HandleWebhookResult> {
  throw new Error("handleWebhook: not implemented (Fase 1)");
}

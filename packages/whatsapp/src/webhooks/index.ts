/**
 * Handler compartilhado para webhooks WhatsApp.
 *
 * Fluxo:
 *   1) verifyWebhookSignature(raw) — 401 se falha
 *   2) parseInbound(raw) → RawInboundMessage[]
 *   3) adiciona tenantId → InboundMessage[]
 *   4) retorna resultado
 *
 * Dedup (via externalMessageId) e Inngest dispatch são feitos
 * pela rota apps/web que chama este handler — Phase 3.
 */

import type { WhatsAppAdapter, InboundMessage } from "../types";

export interface HandleWebhookInput {
  adapter: WhatsAppAdapter;
  rawBody: string;
  headers: Record<string, string>;
  secret: string;
  tenantId: string;
}

export interface HandleWebhookResult {
  status: 200 | 401 | 500;
  processed: number;
  messages: InboundMessage[];
  error?: string;
}

export async function handleWebhook(
  input: HandleWebhookInput,
): Promise<HandleWebhookResult> {
  // 1) Verificar assinatura
  const verify = await input.adapter.verifyWebhookSignature({
    rawBody: input.rawBody,
    headers: input.headers,
    secret: input.secret,
  });

  if (!verify.ok) {
    return { status: 401, processed: 0, messages: [] };
  }

  // 2) Parsear + adicionar tenantId
  try {
    const raw = await input.adapter.parseInbound(input.rawBody);
    const messages: InboundMessage[] = raw.map((m) => ({
      ...m,
      tenantId: input.tenantId,
    }));

    return { status: 200, processed: messages.length, messages };
  } catch {
    // Nunca vazar stack interno — retorna 500 limpo
    return {
      status: 500,
      processed: 0,
      messages: [],
      error: "Internal error processing webhook",
    };
  }
}

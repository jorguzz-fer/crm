/**
 * Contratos canônicos do package @crm/whatsapp.
 *
 * A ideia: desacoplar o resto da app do provedor (Evolution API vs
 * Meta Cloud API). Todo código consumidor fala com o `WhatsAppAdapter`
 * abaixo — cada implementação concreta mora em `src/adapters/*`.
 *
 * A decisão final entre Evolution-only, Meta-only ou multi-provider
 * está em `.coordination/OPEN_QUESTIONS.md`. Até lá, os dois adapters
 * existem como stubs RED.
 */

import { z } from "zod";

// ── Normalized inbound event (qualquer provedor → este formato) ──────────────

export const inboundMessageSchema = z.object({
  tenantId: z.string().min(1),
  providerInstanceId: z.string().min(1), // conexão WABA / instância Evolution
  externalMessageId: z.string().min(1),  // pro idempotency dedup
  from: z.object({
    phoneE164: z.string().regex(/^\+\d{10,15}$/, "E.164 esperado"),
    name: z.string().nullable().optional(),
  }),
  to: z.object({
    phoneE164: z.string().regex(/^\+\d{10,15}$/),
  }),
  message: z.discriminatedUnion("type", [
    z.object({ type: z.literal("text"), text: z.string().min(1).max(4096) }),
    z.object({
      type: z.literal("image"),
      mediaUrl: z.string().url(),
      caption: z.string().max(1024).optional(),
    }),
    z.object({
      type: z.literal("audio"),
      mediaUrl: z.string().url(),
      durationSec: z.number().positive().optional(),
    }),
    z.object({
      type: z.literal("document"),
      mediaUrl: z.string().url(),
      filename: z.string().min(1),
    }),
    z.object({ type: z.literal("button"), payload: z.string().min(1) }),
    z.object({ type: z.literal("interactive"), payload: z.string().min(1) }),
  ]),
  // Click-to-WhatsApp Ads — crítico pro tracking server-side
  ctwaClid: z.string().nullable().optional(),
  receivedAt: z.date(),
});

export type InboundMessage = z.infer<typeof inboundMessageSchema>;

// ── Outbound message (app → provedor) ────────────────────────────────────────

export const outboundMessageSchema = z.object({
  tenantId: z.string().min(1),
  providerInstanceId: z.string().min(1),
  toPhoneE164: z.string().regex(/^\+\d{10,15}$/),
  content: z.discriminatedUnion("type", [
    z.object({ type: z.literal("text"), text: z.string().min(1).max(4096) }),
    z.object({
      type: z.literal("template"),
      templateName: z.string().min(1),
      locale: z.string().min(2).max(10),
      variables: z.array(z.string()).default([]),
    }),
  ]),
  externalEventId: z.string().min(1), // idempotency (retries seguros)
});

export type OutboundMessage = z.infer<typeof outboundMessageSchema>;

export interface SendResult {
  providerMessageId: string;
  status: "queued" | "sent" | "failed";
  error?: string;
}

// ── Adapter interface ────────────────────────────────────────────────────────

export interface WhatsAppAdapter {
  readonly provider: "evolution" | "meta-cloud";

  /**
   * Envia mensagem. Deve ser idempotente via `externalEventId`.
   */
  sendMessage(msg: OutboundMessage): Promise<SendResult>;

  /**
   * Verifica assinatura do webhook recebido. Deve ser chamado ANTES de
   * qualquer parsing de payload. Retorna o raw body + headers verificados.
   */
  verifyWebhookSignature(input: {
    rawBody: string;
    headers: Record<string, string>;
    secret: string;
  }): Promise<{ ok: true } | { ok: false; reason: string }>;

  /**
   * Normaliza o payload do provider pro formato canônico `InboundMessage[]`.
   * Um único webhook pode entregar múltiplas mensagens (batching).
   */
  parseInbound(rawBody: string): Promise<InboundMessage[]>;
}

/**
 * Contratos canônicos do package @crm/whatsapp.
 *
 * WhatsAppAdapter desacopla o resto da app do provedor concreto.
 * Cada implementação mora em src/adapters/*.
 */

import { z } from "zod";

// ── Normalized inbound event (após parse, sem tenantId) ──────────────────────

export const rawInboundMessageSchema = z.object({
  providerInstanceId: z.string().min(1),
  externalMessageId: z.string().min(1),
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
  // Click-to-WhatsApp Ads — crítico pro tracking server-side.
  // Disponível apenas via Meta Cloud API; Evolution/Z-API retorna null.
  ctwaClid: z.string().nullable().optional(),
  receivedAt: z.date(),
});

export type RawInboundMessage = z.infer<typeof rawInboundMessageSchema>;

// InboundMessage = RawInboundMessage + tenantId (adicionado pelo handler)
export const inboundMessageSchema = rawInboundMessageSchema.extend({
  tenantId: z.string().min(1),
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
  externalEventId: z.string().min(1),
});

export type OutboundMessage = z.infer<typeof outboundMessageSchema>;

export interface SendResult {
  providerMessageId: string;
  status: "queued" | "sent" | "failed";
  error?: string;
}

// ── Adapter interface ────────────────────────────────────────────────────────

export interface WhatsAppAdapter {
  readonly provider: "evolution" | "zapi" | "meta-cloud";

  /**
   * Envia mensagem. Deve ser idempotente via `externalEventId`.
   */
  sendMessage(msg: OutboundMessage): Promise<SendResult>;

  /**
   * Verifica assinatura/autenticidade do webhook recebido.
   * Deve ser chamado ANTES de qualquer parsing.
   */
  verifyWebhookSignature(input: {
    rawBody: string;
    headers: Record<string, string>;
    secret: string;
  }): Promise<{ ok: true } | { ok: false; reason: string }>;

  /**
   * Normaliza o payload raw do provider → RawInboundMessage[].
   * Não inclui tenantId (adicionado pelo handler após lookup no DB).
   * Um webhook pode entregar múltiplas mensagens (batching).
   */
  parseInbound(rawBody: string): Promise<RawInboundMessage[]>;
}

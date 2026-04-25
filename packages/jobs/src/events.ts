import { z } from "zod";

/**
 * Contrato de eventos Inngest — documentado em .coordination/EVENTS.md
 *
 * Regras:
 * - `tenantId` sempre obrigatório (isolation enforcado no consumer)
 * - Nomes imutáveis — versão nova = `/v2`
 * - Campos novos devem ser opcionais
 * - Schema Zod é a source of truth do formato em runtime
 */

// ─── Base ───────────────────────────────────────────────────────────────────

const triggeredBySchema = z.object({
  userId: z.string().optional(),
  source: z.enum(["user", "system", "webhook", "cron"]),
});

const baseEventSchema = z.object({
  tenantId: z.string().min(1),
  triggeredBy: triggeredBySchema.optional(),
  occurredAt: z.string().datetime().optional(),
});

// ─── Events ─────────────────────────────────────────────────────────────────

export const leadCreatedSchema = baseEventSchema.extend({
  leadId: z.string().min(1),
  source: z.enum([
    "WEBSITE",
    "WHATSAPP",
    "INSTAGRAM",
    "FACEBOOK",
    "INDICACAO",
    "EVENTO",
    "COLD_OUTREACH",
    "OUTRO",
  ]),
  channel: z.enum(["whatsapp", "email", "sms", "webchat", "instagram"]).optional(),
  attributionId: z.string().optional(),
  initialMessage: z.string().optional(),
  // Optional: product context for AI SDR first contact
  productContext: z
    .object({
      name: z.string().min(1),
      priceBrl: z.number().positive(),
      highlights: z.array(z.string().min(1)).min(1).max(5),
    })
    .optional(),
});

export const leadUpdatedSchema = baseEventSchema.extend({
  leadId: z.string().min(1),
  changes: z.record(
    z.object({
      before: z.unknown(),
      after: z.unknown(),
    }),
  ),
});

export const leadClassifiedSchema = baseEventSchema.extend({
  leadId: z.string().min(1),
  score: z.enum(["HOT", "WARM", "COLD", "DISQUALIFIED"]),
  confidence: z.number().min(0).max(1),
  reasons: z.array(z.string()),
  modelUsed: z.string(),
});

export const leadQualifiedSchema = baseEventSchema.extend({
  leadId: z.string().min(1),
  qualifiedBy: z.enum(["ai", "human"]),
  userId: z.string().optional(),
});

export const messageReceivedSchema = baseEventSchema.extend({
  conversationId: z.string().min(1),
  messageId: z.string().min(1),
  leadId: z.string().optional(),
  channel: z.enum(["whatsapp", "email", "sms", "webchat", "instagram"]),
  content: z.object({
    type: z.enum(["text", "image", "audio", "video", "document", "location", "interactive"]),
    body: z.string().optional(),
    mediaUrl: z.string().optional(),
  }),
  from: z.string().min(1),
  receivedAt: z.string().datetime(),
  providerMetadata: z.record(z.unknown()).optional(),
});

export const messageSentSchema = baseEventSchema.extend({
  conversationId: z.string().min(1),
  messageId: z.string().min(1),
  channel: z.string(),
  sentBy: z.enum(["ai", "human"]),
  userId: z.string().optional(),
});

export const followupScheduledSchema = baseEventSchema.extend({
  leadId: z.string().min(1),
  sequenceId: z.string().min(1),
  nextStepAt: z.string().datetime(),
});

export const dealWonSchema = baseEventSchema.extend({
  opportunityId: z.string().min(1),
  leadId: z.string().optional(),
  value: z.number(),
  currency: z.string().length(3),
  closedBy: z.string().optional(),
});

export const paymentReceivedSchema = baseEventSchema.extend({
  gateway: z.enum(["hotmart", "pagarme", "paypal", "stripe"]),
  externalId: z.string().min(1),
  amount: z.number(),
  currency: z.string().length(3),
  buyerEmail: z.string().email().optional(),
  buyerPhone: z.string().optional(),
  productExternalId: z.string().optional(),
  rawPayload: z.record(z.unknown()),
});

export const conversionReportedSchema = baseEventSchema.extend({
  platform: z.enum(["meta", "google"]),
  eventType: z.string().min(1),
  leadId: z.string().min(1),
  value: z.number().optional(),
  externalEventId: z.string().min(1),
  success: z.boolean(),
  errorMessage: z.string().optional(),
});

// ─── Registry ────────────────────────────────────────────────────────────────

export const EVENT_SCHEMAS = {
  "lead/created": leadCreatedSchema,
  "lead/updated": leadUpdatedSchema,
  "lead/classified": leadClassifiedSchema,
  "lead/qualified": leadQualifiedSchema,
  "message/received": messageReceivedSchema,
  "message/sent": messageSentSchema,
  "followup/scheduled": followupScheduledSchema,
  "deal/won": dealWonSchema,
  "payment/received": paymentReceivedSchema,
  "conversion/reported": conversionReportedSchema,
} as const;

export type EventName = keyof typeof EVENT_SCHEMAS;
export type EventData<N extends EventName> = z.infer<(typeof EVENT_SCHEMAS)[N]>;

import { z } from "zod";

/**
 * Attribution completa de um lead.
 *
 * Captura tudo que podemos coletar no momento da entrada, pra usar depois
 * quando evento de conversão for disparado ao Meta/Google.
 */
export const attributionDataSchema = z.object({
  // Meta identifiers
  fbclid: z.string().nullable().optional(),
  fbp: z.string().nullable().optional(),
  fbc: z.string().nullable().optional(),
  ctwaClid: z.string().nullable().optional(), // Click-to-WhatsApp Ads

  // Google identifiers
  gclid: z.string().nullable().optional(),
  gbraid: z.string().nullable().optional(),
  wbraid: z.string().nullable().optional(),

  // UTMs
  utmSource: z.string().nullable().optional(),
  utmMedium: z.string().nullable().optional(),
  utmCampaign: z.string().nullable().optional(),
  utmContent: z.string().nullable().optional(),
  utmTerm: z.string().nullable().optional(),

  // Contexto adicional
  landingPage: z.string().nullable().optional(),
  referrer: z.string().nullable().optional(),
  userAgent: z.string().nullable().optional(),
  ip: z.string().nullable().optional(),
});

export type AttributionData = z.infer<typeof attributionDataSchema>;

/**
 * Payload padronizado de conversão (antes de adaptar pra cada plataforma).
 */
export const conversionEventPayloadSchema = z.object({
  tenantId: z.string(),
  leadId: z.string(),
  eventType: z.enum(["lead", "qualified", "purchase", "refund", "initiate_checkout"]),
  value: z.number().optional(),
  currency: z.string().length(3).default("BRL"),

  // Dados do usuário (serão hasheados antes de enviar)
  userData: z.object({
    email: z.string().email().optional(),
    phone: z.string().optional(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    country: z.string().optional(),
    zip: z.string().optional(),
  }),

  // Attribution capturada
  attribution: attributionDataSchema,

  // Idempotência
  externalEventId: z.string(), // identificador único pra dedup com pixel browser
  occurredAt: z.date().optional(),
});

export type ConversionEventPayload = z.infer<typeof conversionEventPayloadSchema>;

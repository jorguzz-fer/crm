/**
 * Lead classifier — hot / warm / cold.
 *
 * Input: mensagens já trocadas + attribution/UTMs.
 * Output: classificação + confiança + rationale curta.
 *
 * Roda em Haiku 4.5 por default (barato, rápido). Prompt caching do sistema
 * promptCache = true no provider OpenRouter quando suportado.
 *
 * Fase 2: implementação RED/GREEN. Hoje expõe apenas os contratos (Zod).
 */

import { z } from "zod";

export const classifierInputSchema = z.object({
  tenantId: z.string().min(1),
  leadId: z.string().min(1),
  messages: z
    .array(
      z.object({
        role: z.enum(["lead", "sdr", "agent"]),
        content: z.string().min(1),
        at: z.date(),
      }),
    )
    .min(1, "pelo menos 1 mensagem"),
  attribution: z
    .object({
      utmSource: z.string().nullable().optional(),
      utmMedium: z.string().nullable().optional(),
      utmCampaign: z.string().nullable().optional(),
      fbclid: z.string().nullable().optional(),
      gclid: z.string().nullable().optional(),
      ctwaClid: z.string().nullable().optional(),
    })
    .optional(),
  productContext: z
    .object({
      name: z.string(),
      priceBrl: z.number().positive(),
    })
    .optional(),
});

export type ClassifierInput = z.infer<typeof classifierInputSchema>;

export const classificationSchema = z.object({
  classification: z.enum(["hot", "warm", "cold", "unqualified"]),
  confidence: z.number().min(0).max(1),
  rationale: z.string().min(1).max(280),
  recommendedNextAction: z.enum([
    "route_to_human",
    "send_pricing",
    "send_education",
    "followup_later",
    "archive",
  ]),
  signals: z
    .object({
      intent: z.enum(["low", "medium", "high"]),
      budget: z.enum(["unknown", "fit", "misfit"]),
      timeline: z.enum(["unknown", "short", "medium", "long"]),
    })
    .optional(),
});

export type Classification = z.infer<typeof classificationSchema>;

/**
 * Classifica um lead. Fase 2 implementa com AI SDK + OpenRouter.
 *
 * Por ora, lança NotImplemented — mantém TDD RED.
 */
export async function classifyLead(input: ClassifierInput): Promise<Classification> {
  classifierInputSchema.parse(input);
  throw new Error("classifyLead: not implemented (Fase 2)");
}

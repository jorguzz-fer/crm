/**
 * SDR assistant — geração de primeira mensagem + follow-ups.
 *
 * Fase 2: implementação via Vercel AI SDK + OpenRouter (Haiku 4.5 default,
 * Sonnet 4.6 para casos complexos). Prompt caching habilitado no system prompt.
 *
 * Este arquivo expõe apenas os contratos Zod + stubs que lançam NotImplemented
 * — os testes RED validam schemas e cobrem as especificações de comportamento
 * com `it.todo`.
 */

import { z } from "zod";

// ── First contact ────────────────────────────────────────────────────────────

export const firstContactInputSchema = z.object({
  tenantId: z.string().min(1),
  leadId: z.string().min(1),
  leadName: z.string().min(1).max(120),
  channel: z.enum(["whatsapp", "instagram", "email", "sms"]),
  productContext: z.object({
    name: z.string().min(1),
    priceBrl: z.number().positive(),
    highlights: z.array(z.string().min(1)).min(1).max(5),
  }),
  attribution: z
    .object({
      utmSource: z.string().nullable().optional(),
      utmCampaign: z.string().nullable().optional(),
      ctwaClid: z.string().nullable().optional(),
    })
    .optional(),
  tone: z.enum(["formal", "informal", "consultivo"]).default("consultivo"),
});

export type FirstContactInput = z.infer<typeof firstContactInputSchema>;

export const firstContactOutputSchema = z.object({
  message: z.string().min(1).max(900),
  suggestedFollowUpMinutes: z.number().int().positive().max(10_080),
  intent: z.enum(["qualify", "educate", "book_call"]),
});

export type FirstContactOutput = z.infer<typeof firstContactOutputSchema>;

export async function generateFirstContact(
  input: FirstContactInput,
): Promise<FirstContactOutput> {
  firstContactInputSchema.parse(input);
  throw new Error("generateFirstContact: not implemented (Fase 2)");
}

// ── Follow-up ────────────────────────────────────────────────────────────────

export const followUpInputSchema = z.object({
  tenantId: z.string().min(1),
  leadId: z.string().min(1),
  leadName: z.string().min(1).max(120),
  channel: z.enum(["whatsapp", "instagram", "email", "sms"]),
  previousMessages: z
    .array(
      z.object({
        role: z.enum(["lead", "sdr"]),
        content: z.string().min(1),
        at: z.date(),
      }),
    )
    .min(1),
  attempt: z.number().int().min(1).max(5),
  daysSinceLastReply: z.number().int().min(0),
});

export type FollowUpInput = z.infer<typeof followUpInputSchema>;

export const followUpOutputSchema = z.object({
  message: z.string().min(1).max(600),
  shouldEscalate: z.boolean(),
  nextAttemptHours: z.number().int().positive().max(720).nullable(),
});

export type FollowUpOutput = z.infer<typeof followUpOutputSchema>;

export async function generateFollowUp(input: FollowUpInput): Promise<FollowUpOutput> {
  followUpInputSchema.parse(input);
  throw new Error("generateFollowUp: not implemented (Fase 2)");
}

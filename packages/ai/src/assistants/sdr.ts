import { z } from "zod";
import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { MODELS } from "../models";

// ── First contact ─────────────────────────────────────────────────────────────

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

// ── Follow-up ─────────────────────────────────────────────────────────────────

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

// ── Internals ─────────────────────────────────────────────────────────────────

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

const FIRST_CONTACT_SYSTEM = `Você é um SDR consultivo especializado em pós-graduações médicas.
Gere a primeira mensagem de contato para um lead via WhatsApp/canal digital.

REGRAS OBRIGATÓRIAS:
- Use o nome do lead na abertura
- NÃO mencione preço na primeira mensagem
- Inclua uma pergunta aberta de qualificação como CTA
- Máximo 900 caracteres
- Adapte o tom conforme indicado (formal/informal/consultivo)
- Não use emojis em excesso; 1-2 no máximo se o tom for informal/consultivo

CAMPOS DE SAÍDA JSON: message, suggestedFollowUpMinutes (whatsapp=120, instagram=180, email=1440, sms=240), intent.`;

const FOLLOW_UP_SYSTEM = `Você é um SDR consultivo especializado em pós-graduações médicas.
Gere uma mensagem de follow-up para um lead que não respondeu ou respondeu pouco.

REGRAS:
- Varie o ângulo: não repita o texto do contato anterior
- attempt 1-2: breezy check-in, curioso, sem pressão
- attempt 3: introduza objeção comum (preço/tempo) e ofereça solução
- attempt 4: urgência leve (turma fechando, vagas limitadas)
- attempt 5: encerramento respeitoso — sugira escalate=true e nextAttemptHours=null
- Máximo 600 caracteres

CAMPOS DE SAÍDA JSON: message, shouldEscalate, nextAttemptHours (null se shouldEscalate=true).`;

function buildFirstContactPrompt(input: FirstContactInput): string {
  const lines: string[] = [
    `Lead: ${input.leadName}`,
    `Canal: ${input.channel}`,
    `Tom: ${input.tone}`,
    `Produto: ${input.productContext.name}`,
    `Destaques: ${input.productContext.highlights.join(", ")}`,
  ];

  if (input.attribution) {
    const attr = input.attribution;
    const parts: string[] = [];
    if (attr.utmSource) parts.push(`source=${attr.utmSource}`);
    if (attr.utmCampaign) parts.push(`campaign=${attr.utmCampaign}`);
    if (attr.ctwaClid) parts.push(`ctwaClid=${attr.ctwaClid}`);
    if (parts.length > 0) lines.push(`Atribuição: ${parts.join(", ")}`);
  }

  return lines.join("\n");
}

function buildFollowUpPrompt(input: FollowUpInput): string {
  const lines: string[] = [
    `Lead: ${input.leadName}`,
    `Canal: ${input.channel}`,
    `Tentativa: ${input.attempt} de 5`,
    `Dias sem resposta: ${input.daysSinceLastReply}`,
    "",
    "Mensagens anteriores:",
  ];

  for (const msg of input.previousMessages) {
    lines.push(`[${msg.role.toUpperCase()}] ${msg.content}`);
  }

  return lines.join("\n");
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function generateFirstContact(
  input: FirstContactInput,
): Promise<FirstContactOutput> {
  firstContactInputSchema.parse(input);

  const openai = createOpenAI({
    baseURL: OPENROUTER_BASE_URL,
    apiKey: process.env.OPENROUTER_API_KEY ?? "",
  });

  const { object } = await generateObject({
    model: openai(MODELS.sdr),
    schema: firstContactOutputSchema,
    system: FIRST_CONTACT_SYSTEM,
    prompt: buildFirstContactPrompt(input),
  });

  return object;
}

export async function generateFollowUp(input: FollowUpInput): Promise<FollowUpOutput> {
  followUpInputSchema.parse(input);

  const openai = createOpenAI({
    baseURL: OPENROUTER_BASE_URL,
    apiKey: process.env.OPENROUTER_API_KEY ?? "",
  });

  const { object } = await generateObject({
    model: openai(MODELS.sdr),
    schema: followUpOutputSchema,
    system: FOLLOW_UP_SYSTEM,
    prompt: buildFollowUpPrompt(input),
  });

  return object;
}

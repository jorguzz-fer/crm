import { z } from "zod";
import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { MODELS } from "../models";

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

// ── Internals ─────────────────────────────────────────────────────────────────

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

const CLASSIFIER_SYSTEM = `Você é um classificador de leads para uma empresa de pós-graduação médica.
Classifique o lead com base no histórico de mensagens e dados de atribuição.

CRITÉRIOS:
- hot: alta intenção — perguntou preço, parcelamento, turma ou prazo; pronto para comprar
- warm: engajado mas ainda explorando; fez perguntas mas sem intenção clara de compra
- cold: pouco engajamento; respostas monossilábicas, stickers ou ausência de resposta
- unqualified: não é profissional de saúde, é concorrente ou claramente fora do público

AÇÃO RECOMENDADA:
- route_to_human: encaminhar para consultor (hot)
- send_pricing: enviar tabela de preços (warm com dúvida financeira)
- send_education: enviar conteúdo educativo (warm em exploração)
- followup_later: agendar follow-up (cold)
- archive: arquivar (unqualified)

Retorne JSON com: classification, confidence [0.0-1.0], rationale (≤280 chars), recommendedNextAction, signals.`;

function buildClassifierPrompt(input: ClassifierInput): string {
  const lines: string[] = [];

  if (input.productContext) {
    lines.push(`Produto: ${input.productContext.name} (R$ ${input.productContext.priceBrl.toFixed(2)})`);
  }

  if (input.attribution) {
    const attr = input.attribution;
    const parts: string[] = [];
    if (attr.utmSource) parts.push(`source=${attr.utmSource}`);
    if (attr.utmMedium) parts.push(`medium=${attr.utmMedium}`);
    if (attr.utmCampaign) parts.push(`campaign=${attr.utmCampaign}`);
    if (attr.ctwaClid) parts.push(`ctwaClid=${attr.ctwaClid}`);
    if (attr.fbclid) parts.push(`fbclid=${attr.fbclid}`);
    if (attr.gclid) parts.push(`gclid=${attr.gclid}`);
    if (parts.length > 0) lines.push(`Atribuição: ${parts.join(", ")}`);
  }

  lines.push("\nHistórico de mensagens:");
  for (const msg of input.messages) {
    lines.push(`[${msg.role.toUpperCase()}] ${msg.content}`);
  }

  return lines.join("\n");
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function classifyLead(input: ClassifierInput): Promise<Classification> {
  classifierInputSchema.parse(input);

  const openai = createOpenAI({
    baseURL: OPENROUTER_BASE_URL,
    apiKey: process.env.OPENROUTER_API_KEY ?? "",
  });

  const { object } = await generateObject({
    model: openai(MODELS.scoring),
    schema: classificationSchema,
    system: CLASSIFIER_SYSTEM,
    prompt: buildClassifierPrompt(input),
  });

  return object;
}

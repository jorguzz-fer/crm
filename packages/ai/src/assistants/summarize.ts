import { generateObject } from "ai";
import { z } from "zod";
import { openrouter, MODELS } from "../index";

export const summarySchema = z.object({
  summary: z.string().describe("Resumo executivo em 3-5 linhas sobre a situação atual"),
  nextSteps: z.array(z.string()).max(3).describe("2-3 próximos passos concretos e acionáveis"),
  sentiment: z.enum(["positivo", "neutro", "negativo"]).describe("Sentimento geral da negociação"),
});

export type SummaryResult = z.infer<typeof summarySchema>;

export interface SummaryResponse {
  result:    SummaryResult;
  model:     string;
  tokens:    number;
  latencyMs: number;
}

interface SummarizeInput {
  entityType: "lead" | "oportunidade";
  entityName: string;
  notes: { content: string; author: string; date: Date }[];
  activities: { type: string; subject: string; description?: string | null; date: Date }[];
}

const ACTIVITY_LABEL: Record<string, string> = {
  LIGACAO: "Ligação", EMAIL: "E-mail", REUNIAO: "Reunião",
  WHATSAPP: "WhatsApp", VISITA: "Visita", OUTRO: "Outro",
};

export async function summarize(input: SummarizeInput): Promise<SummaryResponse> {
  const { entityType, entityName, notes, activities } = input;

  const notesText = notes
    .map((n) => `[${n.date.toLocaleDateString("pt-BR")}] ${n.author}: ${n.content}`)
    .join("\n");

  const activitiesText = activities
    .map((a) => `[${a.date.toLocaleDateString("pt-BR")}] ${ACTIVITY_LABEL[a.type] ?? a.type}: ${a.subject}${a.description ? ` — ${a.description}` : ""}`)
    .join("\n");

  const hasContext = notes.length > 0 || activities.length > 0;

  const t0 = Date.now();
  const res = await generateObject({
    model: openrouter(MODELS.summarize),
    schema: summarySchema,
    system: `Você é um assistente especializado em CRM comercial.
Analise históricos de negociações e forneça resumos executivos precisos e acionáveis.
Responda sempre em português brasileiro. Seja direto e prático.`,
    prompt: `Analise o ${entityType} "${entityName}" com base no histórico abaixo e forneça um resumo executivo.

${hasContext ? [
  notesText ? `Notas:\n${notesText}` : "",
  activitiesText ? `Atividades:\n${activitiesText}` : "",
].filter(Boolean).join("\n\n") : "Não há histórico registrado ainda."}`,
  });

  return {
    result:    res.object,
    model:     MODELS.summarize,
    tokens:    (res.usage?.totalTokens ?? 0),
    latencyMs: Date.now() - t0,
  };
}

// AI client via OpenRouter (compatível com Vercel AI SDK)
// OPENROUTER_API_KEY deve ser configurado no ambiente
// Modelos usam roteamento OpenRouter → Anthropic/OpenAI/Google conforme disponibilidade

import { createOpenAI } from "@ai-sdk/openai";

export const openrouter = createOpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY ?? "",
});

// Modelos padrão por caso de uso
// Ajustar conforme custo/qualidade em produção
export const MODELS = {
  summarize: "anthropic/claude-sonnet-4-6",
  followUp: "anthropic/claude-sonnet-4-6",
  research: "anthropic/claude-sonnet-4-6",
  scoring: "anthropic/claude-haiku-4-5",
  coaching: "anthropic/claude-opus-4-7",
  fast: "anthropic/claude-haiku-4-5",
} as const;

export type ModelKey = keyof typeof MODELS;

export { summarize } from "./assistants/summarize";
export type { SummaryResult, SummaryResponse } from "./assistants/summarize";

export { detectStaleLeads } from "./assistants/followUp";
export type { LeadForFollowUp, StaleAlert } from "./assistants/followUp";

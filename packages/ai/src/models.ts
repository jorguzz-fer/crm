export const MODELS = {
  scoring: "anthropic/claude-haiku-4-5",
  sdr: "anthropic/claude-haiku-4-5",
  complex: "anthropic/claude-sonnet-4-6",
} as const;

export type ModelKey = keyof typeof MODELS;

/**
 * @crm/tracking — atribuição e tracking de conversões
 *
 * Resolve o problema crítico de pixel furado: captura IDs de clique na LP,
 * preserva attribution através do WhatsApp (via token ou CTWA), dispara
 * eventos server-side (Meta CAPI + Google Offline Conversions) quando
 * gateway confirma pagamento.
 *
 * Ver .coordination/IMPLEMENTATION_PLAN.md — Fase 4.
 */

// Re-exports organizados por ambiente
export * as client from "./client";
export * as server from "./server";
export * as webhooks from "./webhooks";
export * as attribution from "./attribution";

export type { AttributionData, ConversionEventPayload } from "./types";

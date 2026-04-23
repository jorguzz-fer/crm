/**
 * @crm/jobs — Inngest functions + event contract
 *
 * Implementações virão na Fase 3 do plano (ver .coordination/IMPLEMENTATION_PLAN.md).
 * No scaffold, expomos apenas o client, os schemas de eventos e um registry
 * vazio de functions.
 */

export { inngest } from "./client";
export * from "./events";

/**
 * Lista de functions Inngest a serem exportadas para o endpoint `/api/inngest`.
 *
 * TODO (Fase 3): adicionar:
 * - firstContactFn    → on `lead/created` → dispara IA SDR < 5s
 * - followupSequenceFn → on `followup/scheduled` → D+1/D+3/D+7 + loop
 * - classifyOnMessageFn → on `message/received` → re-classifica lead
 * - routeQualifiedFn → on `lead/qualified` → distribui pra vendedor
 */
export const functions: Array<never> = [];

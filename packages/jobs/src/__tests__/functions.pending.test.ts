import { describe, it } from "vitest";

/**
 * Testes RED (pending) para as functions Inngest da Fase 3.
 *
 * Cada `.todo` é uma especificação de teste que DEVE ser implementada
 * antes que a function correspondente seja considerada pronta.
 *
 * Quando a function for implementada, substituir o `.todo` por `it(..., async () => {...})`.
 *
 * Ver .coordination/IMPLEMENTATION_PLAN.md — Fase 3.
 */

describe("packages/jobs (Fase 3) — especificações pendentes", () => {
  describe("firstContactFn — resposta da IA em < 5s após lead/created", () => {
    it.todo("dispara IA SDR e emite message/sent em < 5s");
    it.todo("usa canal do payload (whatsapp/email/etc.)");
    it.todo("não dispara se lead já tem conversação ativa (idempotência)");
    it.todo("tenant isolation: lead da org A nunca é processado com config de org B");
  });

  describe("followupSequenceFn — sequência D+1/D+3/D+7 com loop", () => {
    it.todo("agenda D+1 corretamente após criação");
    it.todo("avança para D+3 se lead não responde");
    it.todo("cancela sequência quando lead responde");
    it.todo("idempotente — evento repetido não duplica mensagem");
    it.todo("entra em loop após D+7 até resposta ou limite de 30 dias");
  });

  describe("classifyOnMessageFn — re-score após message/received", () => {
    it.todo("chama classifier após cada mensagem inbound");
    it.todo("emite lead/classified com score atualizado");
    it.todo("não classifica mensagens outbound (sentBy=ai ou human)");
    it.todo("rate limit por lead (máx 1 classificação a cada 30s)");
  });

  describe("routeQualifiedFn — distribui lead HOT", () => {
    it.todo("atribui lead HOT a vendedor online disponível");
    it.todo("respeita regras de roteamento por produto");
    it.todo("respeita regras de roteamento por performance");
    it.todo("fallback: se ninguém online, agenda p/ primeiro turno");
    it.todo("notifica vendedor via canal configurado");
  });
});

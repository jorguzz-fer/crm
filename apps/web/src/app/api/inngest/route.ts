/**
 * POST /api/inngest  — ponto de entrada do Inngest (durable workflows).
 *
 * O SDK serve() registra todas as functions exportadas de @crm/jobs.
 * Fase 3 implementa as functions concretas (firstContactFn, followupFn, etc.).
 * Por enquanto, o handler está vivo mas sem functions — o painel do Inngest
 * vai exibi-lo como app registrado com functions=[].
 *
 * Segurança: o Inngest SDK valida a assinatura HMAC de cada invoke
 * internamente via INNGEST_SIGNING_KEY. Não é rota pública de ingesta —
 * só o Inngest Cloud chama diretamente.
 */

import { serve } from "inngest/next";
import { inngest } from "@crm/jobs";

// TODO Fase 3: importar e listar functions concretas aqui
// import { firstContactFn, followupSequenceFn } from "@crm/jobs";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    // firstContactFn,
    // followupSequenceFn,
    // classifyOnMessageFn,
    // routeQualifiedFn,
  ],
});

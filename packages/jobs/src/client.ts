/**
 * Cliente Inngest compartilhado (emit e functions).
 *
 * Uso:
 * - `apps/web` chama `inngest.send(...)` para emitir
 * - Functions neste package consomem via `inngest.createFunction(...)`
 */

import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "crm-saas",
  // Em dev, sem env var, Inngest roda modo local (serve via endpoint)
});

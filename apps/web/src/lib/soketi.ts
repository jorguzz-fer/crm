/**
 * Cliente Soketi (Pusher-compatible) — servidor
 *
 * Variáveis de ambiente necessárias:
 *   SOKETI_APP_ID     — APP_ID da instância Soketi
 *   SOKETI_APP_KEY    — APP_KEY (mesma usada no cliente)
 *   SOKETI_APP_SECRET — APP_SECRET (apenas server-side)
 *   SOKETI_HOST       — hostname do Soketi (sem protocolo)
 *   SOKETI_PORT       — porta (default 443)
 *   SOKETI_USE_TLS    — "true" | "false" (default "true")
 */
import Pusher from "pusher";

let _pusher: Pusher | null = null;

export function getSoketi(): Pusher | null {
  if (!process.env.SOKETI_APP_ID) return null; // Soketi não configurado — modo silencioso

  if (!_pusher) {
    _pusher = new Pusher({
      appId:   process.env.SOKETI_APP_ID!,
      key:     process.env.SOKETI_APP_KEY!,
      secret:  process.env.SOKETI_APP_SECRET!,
      host:    process.env.SOKETI_HOST!,
      port:    process.env.SOKETI_PORT ?? "443",
      useTLS:  (process.env.SOKETI_USE_TLS ?? "true") === "true",
    });
  }
  return _pusher;
}

/**
 * Emite um evento para um canal. Não lança erro se Soketi não estiver configurado.
 */
export async function emit(channel: string, event: string, data: unknown): Promise<void> {
  const soketi = getSoketi();
  if (!soketi) return;
  try {
    await soketi.trigger(channel, event, data);
  } catch (err) {
    // Não derruba a request se o Soketi estiver indisponível
    console.warn("[soketi] emit failed:", err instanceof Error ? err.message : err);
  }
}

/** Canal por tenant — isolamento multi-tenant */
export function pipelineChannel(tenantId: string) {
  return `private-pipeline-${tenantId}`;
}

/**
 * Next.js Instrumentation hook — inicializa o Sentry SDK no Node.js e no Edge runtime.
 *
 * Colocado na raiz de apps/web (Next.js 15 lê este arquivo automaticamente quando
 * `experimental.instrumentationHook = true` está habilitado no next.config.ts).
 *
 * Docs: https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/#create-initialization-config-files
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Captura erros não tratados em Server Components e Route Handlers.
// Next.js 15 chama este hook com o request como objeto Request-like.
export async function onRequestError(
  error: unknown,
  request: Request,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context: any,
) {
  const Sentry = await import("@sentry/nextjs");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Sentry.captureRequestError(error, request as any, context);
}

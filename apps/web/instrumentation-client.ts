/**
 * Sentry — configuração do SDK no browser (Client Components, navegação, JS errors).
 *
 * Documentação: https://docs.sentry.io/platforms/javascript/guides/nextjs/
 *
 * Variáveis de ambiente obrigatórias (Coolify → Environment Variables):
 *   NEXT_PUBLIC_SENTRY_DSN  — ex: https://abc123@o123456.ingest.sentry.io/789
 *
 * Para gerar o DSN: sentry.io → Settings → Projects → seu-projeto → Client Keys (DSN)
 */
import * as Sentry from "@sentry/nextjs";

// Instrumenta navegações client-side (page transitions) — requerido pelo SDK v10
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // % de transações enviadas ao Sentry para o Performance Monitoring.
  // 0.1 = 10 % (balanceia custo × visibilidade). Ajuste por plano/cota.
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Replays: 10% de sessões normais, 100% de sessões com erro.
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  // Não captura nada em development — evita poluição do projeto Sentry.
  enabled: process.env.NODE_ENV === "production",

  // Ambiente separado para staging vs produção.
  environment: process.env.NODE_ENV,

  // ── Remoção de PII ──────────────────────────────────────────────────────────
  // `beforeSend` é a última chance de redactar antes de enviar ao Sentry.
  // Complementa o redactObject do audit log — aqui protegemos breadcrumbs
  // e campos de request que o SDK coleta automaticamente.
  beforeSend(event) {
    // Remove cookies da request (podem conter session token)
    if (event.request) {
      event.request.cookies = {};
    }
    // Remove headers de Authorization e Cookie
    if (event.request?.headers) {
      const headers = event.request.headers as Record<string, string>;
      if (headers["authorization"]) headers["authorization"] = "[redacted]";
      if (headers["cookie"]) headers["cookie"] = "[redacted]";
    }
    return event;
  },

  integrations: [
    // Session Replay (requer @sentry/nextjs ≥ 7.x)
    Sentry.replayIntegration({
      // Mascara todo o texto e bloqueia todas as mídias no replay (LGPD)
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
});

/**
 * Sentry — configuração do SDK no Edge runtime (middleware.ts).
 *
 * O Edge runtime é mais restrito que o Node.js — não tem acesso a `fs`, etc.
 * Apenas captura erros e envia ao Sentry.
 */
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,

  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  enabled: process.env.NODE_ENV === "production",

  environment: process.env.NODE_ENV,
});

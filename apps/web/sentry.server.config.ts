/**
 * Sentry — configuração do SDK no Node.js runtime (Server Components, Route Handlers,
 * Server Actions, middleware server-side).
 *
 * Variáveis de ambiente (Coolify → Environment Variables):
 *   SENTRY_DSN          — DSN do servidor (pode ser o mesmo que o do client)
 *   SENTRY_ORG          — Slug da organização no sentry.io
 *   SENTRY_PROJECT      — Slug do projeto no sentry.io
 *   SENTRY_AUTH_TOKEN   — Token com escopo "project:releases" para source maps
 *
 * Para gerar o token: sentry.io → Settings → Account → API → Auth Tokens
 */
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,

  // 10 % das transações server-side em produção
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  enabled: process.env.NODE_ENV === "production",

  environment: process.env.NODE_ENV,

  // ── PII ─────────────────────────────────────────────────────────────────────
  beforeSend(event) {
    // Remove cookies e cabeçalhos sensíveis
    if (event.request) {
      event.request.cookies = {};
    }
    if (event.request?.headers) {
      const headers = event.request.headers as Record<string, string>;
      if (headers["authorization"]) headers["authorization"] = "[redacted]";
      if (headers["cookie"]) headers["cookie"] = "[redacted]";
    }
    return event;
  },

  // Adiciona contexto de tenant/usuário a cada evento.
  // O hook `setUser` / `setTag` deve ser chamado nas Server Actions/Route Handlers
  // após autenticação (ver seção "Uso" abaixo).
});

/**
 * Uso nas Server Actions / Route Handlers:
 *
 * import * as Sentry from "@sentry/nextjs";
 * import { auth } from "@/lib/auth";
 *
 * export async function minhaAction() {
 *   const session = await auth();
 *   if (session) {
 *     Sentry.setUser({ id: session.user.id, email: session.user.email });
 *     Sentry.setTag("tenantId", session.user.tenantId);
 *   }
 *   // ... resto da action
 * }
 */

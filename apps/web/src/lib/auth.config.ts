import type { NextAuthConfig } from "next-auth";

export const PUBLIC_PATHS = [
  "/",
  "/login",
  "/signup",
  "/api/auth",
  "/api/health",
  // ⚠️ /api/cron e /api/webhooks são públicos para o middleware (sem sessão JWT),
  // mas implementam sua PRÓPRIA autenticação em cada route handler:
  //   - /api/cron/*     → valida header x-cron-secret === process.env.CRON_SECRET
  //   - /api/webhooks/* → valida origem/token do provider (Evolution API, etc.)
  // NUNCA remova esses paths daqui sem garantir que o handler valida o secret.
  "/api/cron",
  "/api/webhooks",
  // Extensão Chrome usa Bearer token — sem cookie JWT
  "/api/extension",
  // Formulários públicos de sites/landing pages (sem auth, rate-limited por IP)
  "/api/public",
  // OAuth callback do Meta — chega via redirect do Facebook (cookie de sessão é preservado)
  "/api/integrations/meta/callback",
  // Data Deletion Callback obrigatório pelo Meta (chamado pelo servidor do Facebook)
  "/api/integrations/meta/data-deletion",
  // Página pública de status de exclusão de dados (usuário acompanha pelo código)
  "/dados",
  "/privacidade",
  "/termos",
  "/forgot-password",
  "/reset-password",
];

// Configuração Edge-compatible — sem Prisma, sem bcryptjs
// Usada pelo middleware para verificar JWT sem precisar de Node.js APIs
export const authConfig: NextAuthConfig = {
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60,
    updateAge: 60 * 60,
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const pathname = nextUrl.pathname;
      const isPublic = PUBLIC_PATHS.some(
        (p) => pathname === p || pathname.startsWith(p + "/")
      );
      const isLoggedIn = !!auth;

      if (!isLoggedIn && !isPublic) return false;
      if (isLoggedIn && pathname === "/login") {
        return Response.redirect(new URL("/dashboard", nextUrl));
      }
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role;
        token.tenantId = (user as { tenantId?: string }).tenantId;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as string;
      session.user.tenantId = token.tenantId as string;
      return session;
    },
  },
  providers: [], // providers completos ficam em auth.ts
};

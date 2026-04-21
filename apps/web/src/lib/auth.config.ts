import type { NextAuthConfig } from "next-auth";

export const PUBLIC_PATHS = [
  "/",
  "/login",
  "/signup",
  "/api/auth",
  "/api/health",
  "/api/cron",
  "/api/webhooks",
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

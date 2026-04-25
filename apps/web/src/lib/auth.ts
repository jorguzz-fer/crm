import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { authenticator } from "otplib";
import { prisma } from "@crm/db";
import { rateLimit } from "@/lib/rateLimit";
import { authConfig } from "@/lib/auth.config";

export interface AppSession {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    tenantId: string;
  };
}

const loginSchema = z.object({
  email:    z.string().email().max(200),
  password: z.string().min(8).max(200),
  totp:     z.string().optional(),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID ?? "",
      clientSecret: process.env.AUTH_GOOGLE_SECRET ?? "",
      allowDangerousEmailAccountLinking: true,
    }),
    Credentials({
      async authorize(credentials, req) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const email = parsed.data.email.toLowerCase();

        // Rate limit por IP
        const xff = (req as Request).headers?.get?.("x-forwarded-for");
        const realIp = (req as Request).headers?.get?.("x-real-ip");
        const ip = xff?.split(",")[0].trim() ?? realIp ?? "unknown";

        const ipLimit = await rateLimit({ key: `login:ip:${ip}`, windowSec: 900, max: 10 });
        if (!ipLimit.allowed) return null;

        const emailLimit = await rateLimit({ key: `login:email:${email}`, windowSec: 3600, max: 10 });
        if (!emailLimit.allowed) return null;

        const user = await prisma.user.findUnique({
          where: { email },
          include: { tenant: true },
        });

        if (!user || !user.passwordHash || !user.active) return null;
        if (!user.tenant.active) return null;

        const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!valid) return null;

        // 2FA TOTP — se habilitado, verifica o código antes de concluir o login
        if (user.twoFactorEnabled && user.twoFactorSecret) {
          const totp = parsed.data.totp ?? "";
          const totpValid = authenticator.verify({ token: totp, secret: user.twoFactorSecret });
          if (!totpValid) return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tenantId: user.tenantId,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, account }) {
      // Login inicial — user está presente
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role;
        token.tenantId = (user as { tenantId?: string }).tenantId;
      }

      // OAuth: carrega tenantId/role do DB via Membership
      if (account?.provider !== "credentials" && token.id && !token.tenantId) {
        const membership = await prisma.membership.findFirst({
          where: { userId: token.id as string },
          include: { tenant: true },
          orderBy: { tenant: { createdAt: "asc" } },
        });
        if (membership) {
          token.role = membership.role;
          token.tenantId = membership.tenantId;
        }
      }

      return token;
    },
  },
});

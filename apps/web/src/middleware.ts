import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

// Usa apenas auth.config (Edge-compatible) — sem Prisma nem bcryptjs
export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|images|logo).*)"],
};

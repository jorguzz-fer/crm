import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const PUBLIC_PATHS = [
  "/",
  "/login",
  "/signup",
  "/api/auth",
  "/privacidade",
  "/termos",
  "/forgot-password",
  "/reset-password",
];

// TODO Fase 1: substituir por auth() do Auth.js v5 (ver skill nextjs-prisma-multitenant-security seção 8)
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));

  // Protege rotas /app/* e /admin/*
  if (!isPublic && (pathname.startsWith("/app") || pathname.startsWith("/admin"))) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|images|logo).*)"],
};

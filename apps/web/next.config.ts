import type { NextConfig } from "next";

const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    // camera/microphone/geolocation necessários para visitas de campo (foto, áudio, check-in)
    value: "camera=(self), microphone=(self), geolocation=(self), interest-cohort=()",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Next.js + charts (ApexCharts) precisam de unsafe-inline/eval
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self' data:",
      // blob: para preview de fotos/áudio capturados localmente
      "img-src 'self' data: blob:",
      "media-src 'self' blob:",
      // OpenRouter API + wss: reservado para Soketi na V2
      "connect-src 'self' https://openrouter.ai wss: ws:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  // Workspace packages exportam TypeScript direto — Next.js precisa compilar
  transpilePackages: ["@crm/db", "@crm/validators", "@crm/ai", "@crm/ui"],
  serverExternalPackages: [
    "@prisma/client",
    "prisma",
    "@auth/core",
    "@auth/prisma-adapter",
    "bcryptjs",
    // ⚠️ NÃO incluir "next-auth" — causa ERR_MODULE_NOT_FOUND para next/server
  ],
  images: {
    // ⚠️ NUNCA usar wildcard em remotePatterns — SSRF
    // Adicionar hosts explícitos conforme integrar storage (R2, S3):
    // { protocol: "https", hostname: "pub-xxx.r2.dev" },
    remotePatterns: [],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;

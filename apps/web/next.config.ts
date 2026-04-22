import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

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
  // Next.js 15 lê instrumentation.ts automaticamente (não precisa de flag experimental)
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

// Envolve com withSentryConfig para:
//   - Injetar o SDK automaticamente via Webpack
//   - Upload de source maps (habilita stack traces legíveis no Sentry)
//   - Tree-shaking do SDK nos bundles de produção
//
// Variáveis necessárias para upload de source maps (CI/Coolify):
//   SENTRY_ORG, SENTRY_PROJECT, SENTRY_AUTH_TOKEN
//
// Se SENTRY_DSN não estiver configurado, o SDK fica inativo (enabled: false).
export default withSentryConfig(nextConfig, {
  // Organização e projeto do sentry.io (usados no upload de source maps)
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Source maps: enviados ao Sentry e deletados do bundle final
  silent: true,           // não polui o output do build com logs do Sentry
  widenClientFileUpload: true,
  // Source maps: enviados ao Sentry e removidos do bundle público
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN, // só faz upload se tiver token
    deleteSourcemapsAfterUpload: true,
  },

  // Desativa a telemetria do SDK Sentry durante o build
  telemetry: false,

  // Não adiciona a rota /api/sentry-tunnel automaticamente (evita rota extra
  // desnecessária se não usar CSP tunneling)
  tunnelRoute: undefined,

  // Instrumenta automaticamente Server Components e Route Handlers para
  // performance tracing
  webpack: {
    automaticVercelMonitors: false,
  },
});

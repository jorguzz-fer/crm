"use client";

/**
 * global-error.tsx — captura erros de renderização React em Server Components
 * e os reporta ao Sentry. Necessário pelo App Router do Next.js 15.
 *
 * Este arquivo envolve o <html> inteiro, então não pode usar shadcn ou layouts
 * do app — só HTML/CSS inline básico.
 *
 * Documentação: https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/#react-render-errors-in-app-router
 */

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "sans-serif",
          background: "#f9fafb",
          color: "#111827",
          padding: "2rem",
          textAlign: "center",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.5rem" }}>
          Algo deu errado
        </h1>
        <p style={{ color: "#6b7280", marginBottom: "1.5rem", maxWidth: "400px" }}>
          Ocorreu um erro inesperado. Nossa equipe foi notificada automaticamente.
        </p>
        {error.digest && (
          <p
            style={{
              fontFamily: "monospace",
              fontSize: "0.75rem",
              color: "#9ca3af",
              marginBottom: "1.5rem",
            }}
          >
            Código: {error.digest}
          </p>
        )}
        <button
          onClick={reset}
          style={{
            padding: "0.5rem 1.25rem",
            background: "#4f46e5",
            color: "#fff",
            border: "none",
            borderRadius: "0.375rem",
            cursor: "pointer",
            fontSize: "0.875rem",
            fontWeight: 500,
          }}
        >
          Tentar novamente
        </button>
      </body>
    </html>
  );
}

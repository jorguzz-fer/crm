"use client";

/**
 * Error boundary para páginas dentro de (app)/.
 * Captura erros de Server Components (page.tsx) e os reporta ao Sentry.
 * Diferente do global-error.tsx, mantém o shell do app (sidebar, header).
 *
 * Em produção, mostra apenas o digest. Em development, mostra o stack completo
 * para facilitar o debug.
 */

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
    // Log no console para facilitar debug em produção (visível nos logs do Coolify)
    console.error("[AppError]", error.digest, error.message, error.stack);
  }, [error]);

  const isDev = process.env.NODE_ENV === "development";

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 p-8 text-center">
      <div className="rounded-full bg-destructive/10 p-4">
        <AlertTriangle className="h-8 w-8 text-destructive" />
      </div>

      <div className="space-y-2 max-w-md">
        <h2 className="text-xl font-semibold">Algo deu errado</h2>
        <p className="text-sm text-muted-foreground">
          Ocorreu um erro ao carregar esta página. Nossa equipe foi notificada automaticamente.
        </p>
        {error.digest && (
          <p className="font-mono text-xs text-muted-foreground/70">
            Código: {error.digest}
          </p>
        )}
        {/* Mostra detalhes completos apenas em desenvolvimento */}
        {isDev && error.message && (
          <pre className="mt-4 rounded-lg bg-muted p-4 text-left text-xs text-foreground overflow-auto max-h-60">
            {error.message}
            {error.stack ? `\n\n${error.stack}` : ""}
          </pre>
        )}
      </div>

      <div className="flex gap-3">
        <button
          onClick={reset}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Tentar novamente
        </button>
        <a
          href="/dashboard"
          className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
        >
          Ir para Dashboard
        </a>
      </div>
    </div>
  );
}

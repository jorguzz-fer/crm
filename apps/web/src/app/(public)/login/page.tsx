import type { Metadata } from "next";

export const metadata: Metadata = { title: "Entrar" };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold">Entrar</h1>
          <p className="text-muted-foreground text-sm">Acesse sua conta</p>
        </div>
        {/* Fase 1: formulário de login com Auth.js v5 */}
        <div className="rounded-lg border border-border p-6 text-center text-sm text-muted-foreground">
          Em construção — Fase 1
        </div>
      </div>
    </main>
  );
}

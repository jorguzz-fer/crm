import type { Metadata } from "next";

export const metadata: Metadata = { title: "Criar conta" };

export default function SignupPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold">Criar conta</h1>
          <p className="text-muted-foreground text-sm">Comece sua empresa no CRM</p>
        </div>
        {/* Fase 1: onboarding de tenant com Auth.js v5 */}
        <div className="rounded-lg border border-border p-6 text-center text-sm text-muted-foreground">
          Em construção — Fase 1
        </div>
      </div>
    </main>
  );
}

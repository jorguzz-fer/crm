import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-4xl font-bold tracking-tight">CRM</h1>
      <p className="text-muted-foreground text-center max-w-md">
        Plataforma CRM multi-tenant com IA para equipes comerciais.
      </p>
      <div className="flex gap-3 mt-4">
        <Link
          href="/login"
          className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-6 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Entrar
        </Link>
        <Link
          href="/signup"
          className="inline-flex items-center justify-center rounded-md border border-border px-6 py-2 text-sm font-medium hover:bg-accent transition-colors"
        >
          Criar conta
        </Link>
      </div>
    </main>
  );
}

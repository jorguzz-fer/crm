import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-2">
      <h1 className="text-6xl font-bold text-muted-foreground">404</h1>
      <p className="text-muted-foreground">Página não encontrada</p>
      <Link href="/" className="mt-4 text-sm underline underline-offset-4 hover:text-foreground">
        Voltar ao início
      </Link>
    </main>
  );
}

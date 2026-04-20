import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = { title: "Entrar" };

interface Props {
  searchParams: Promise<{ signup?: string }>;
}

export default async function LoginPage({ searchParams }: Props) {
  const params = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold">Entrar</h1>
          <p className="text-muted-foreground text-sm">Acesse sua conta</p>
        </div>
        <LoginForm signupSuccess={params.signup === "success"} />
      </div>
    </main>
  );
}

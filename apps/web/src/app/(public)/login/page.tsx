import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = { title: "Entrar" };

interface Props {
  searchParams: Promise<{ signup?: string; error?: string }>;
}

const AUTH_ERRORS: Record<string, string> = {
  CredentialsSignin: "E-mail ou senha incorretos",
  Default: "Erro ao fazer login. Tente novamente.",
};

export default async function LoginPage({ searchParams }: Props) {
  const params = await searchParams;

  const urlError = params.error ? (AUTH_ERRORS[params.error] ?? AUTH_ERRORS.Default) : undefined;

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold">Entrar</h1>
          <p className="text-muted-foreground text-sm">Acesse sua conta</p>
        </div>
        <LoginForm signupSuccess={params.signup === "success"} urlError={urlError} />
      </div>
    </main>
  );
}

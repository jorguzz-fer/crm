"use client";

import { useActionState, useState } from "react";
import { loginAction } from "@/app/actions/auth";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { ShieldCheck } from "lucide-react";

export function LoginForm({
  signupSuccess,
  urlError,
}: {
  signupSuccess?: boolean;
  urlError?: string;
}) {
  const [state, action, pending] = useActionState(loginAction, null);
  const [totpRequired, setTotpRequired] = useState(false);

  // Detecta o sinal de 2FA obrigatório e exibe o campo
  const needTotp =
    totpRequired ||
    (state != null && "requireTotp" in state && state.requireTotp === true);

  const errorMessage =
    (state && "error" in state ? state.error : null) ?? urlError ?? null;

  function wrappedAction(formData: FormData) {
    // Se o servidor retornou requireTotp, marca localmente antes de re-enviar
    return action(formData);
  }

  // Atualiza o estado local quando o servidor pede TOTP
  const formAction = async (formData: FormData) => {
    const result = await action(formData);
    if (result && "requireTotp" in result && result.requireTotp) {
      setTotpRequired(true);
    }
  };

  return (
    <div className="space-y-4">
      {signupSuccess && (
        <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-800">
          Conta criada com sucesso! Faça login para continuar.
        </div>
      )}

      {errorMessage && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
          {errorMessage}
        </div>
      )}

      {needTotp && !errorMessage && (
        <div className="rounded-md bg-blue-50 border border-blue-200 p-3 text-sm text-blue-800 flex items-center gap-2">
          <ShieldCheck size={15} className="shrink-0" />
          Insira o código de 6 dígitos do seu autenticador.
        </div>
      )}

      <form action={formAction} className="space-y-4">
        <div className="space-y-1">
          <label htmlFor="email" className="text-sm font-medium">
            E-mail
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="voce@empresa.com"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="password" className="text-sm font-medium">
            Senha
          </label>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="current-password"
            required
            placeholder="••••••••••"
          />
        </div>

        {/* Passo 2FA — aparece somente após o servidor pedir */}
        {needTotp && (
          <div className="space-y-1">
            <label htmlFor="totp" className="text-sm font-medium flex items-center gap-1.5">
              <ShieldCheck size={14} />
              Código 2FA
            </label>
            <input
              id="totp"
              name="totp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              pattern="\d{6}"
              required
              autoFocus
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm tracking-[0.3em] text-center ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="000000"
            />
            <p className="text-xs text-muted-foreground">
              Abra seu aplicativo autenticador e insira o código de 6 dígitos.
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        >
          {pending ? "Entrando..." : needTotp ? "Verificar código" : "Entrar"}
        </button>

        {needTotp && (
          <button
            type="button"
            onClick={() => setTotpRequired(false)}
            className="w-full text-center text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
          >
            ← Voltar ao login
          </button>
        )}
      </form>

      {!needTotp && (
        <>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs text-muted-foreground">
              <span className="bg-background px-2">ou</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
            className="w-full rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Continuar com Google
          </button>

          <p className="text-center text-sm text-muted-foreground">
            Não tem conta?{" "}
            <Link href="/signup" className="font-medium text-primary underline-offset-4 hover:underline">
              Criar conta grátis
            </Link>
          </p>
        </>
      )}
    </div>
  );
}

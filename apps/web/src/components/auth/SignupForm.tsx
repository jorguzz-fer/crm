"use client";

import { useActionState } from "react";
import { signupAction } from "@/app/actions/auth";
import Link from "next/link";

export function SignupForm() {
  const [state, action, pending] = useActionState(signupAction, null);

  return (
    <div className="space-y-4">
      {state && "error" in state && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
          {state.error}
        </div>
      )}

      <form action={action} className="space-y-4">
        <div className="space-y-1">
          <label htmlFor="tenantName" className="text-sm font-medium">
            Nome da empresa
          </label>
          <input
            id="tenantName"
            name="tenantName"
            type="text"
            required
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="Acme Ltda"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="tenantSlug" className="text-sm font-medium">
            Subdomínio
          </label>
          <div className="flex items-center">
            <input
              id="tenantSlug"
              name="tenantSlug"
              type="text"
              required
              pattern="[a-z0-9-]+"
              className="w-full rounded-l-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="acme"
            />
            <span className="rounded-r-md border border-l-0 border-input bg-muted px-3 py-2 text-sm text-muted-foreground">
              .crm.app
            </span>
          </div>
          <p className="text-xs text-muted-foreground">Somente letras minúsculas, números e hifens</p>
        </div>

        <div className="space-y-1">
          <label htmlFor="name" className="text-sm font-medium">
            Seu nome
          </label>
          <input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            required
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="João Silva"
          />
        </div>

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
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="Mín. 10 caracteres"
          />
          <p className="text-xs text-muted-foreground">
            Mínimo 10 caracteres combinando maiúsculas, minúsculas, números e símbolos
          </p>
        </div>

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        >
          {pending ? "Criando conta..." : "Criar conta grátis"}
        </button>
      </form>

      <p className="text-center text-xs text-muted-foreground">
        Ao criar uma conta, você concorda com nossos{" "}
        <Link href="/termos" className="underline underline-offset-4 hover:text-foreground">
          Termos de Uso
        </Link>{" "}
        e{" "}
        <Link href="/privacidade" className="underline underline-offset-4 hover:text-foreground">
          Política de Privacidade
        </Link>
        .
      </p>

      <p className="text-center text-sm text-muted-foreground">
        Já tem conta?{" "}
        <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  );
}

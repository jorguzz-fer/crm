"use client";

import { useActionState } from "react";
import { createCompanyAction } from "@/app/actions/companies";
import Link from "next/link";

const I = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function CreateCompanyForm() {
  const [state, action, pending] = useActionState(createCompanyAction, null);

  return (
    <form action={action} className="rounded-lg border border-border bg-card p-6 space-y-4">
      {state && "error" in state && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
          {state.error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2">
          <label htmlFor="name" className="text-sm font-medium">Nome *</label>
          <input id="name" name="name" required className={I} placeholder="Acme Ltda" />
        </div>
        <div className="space-y-1">
          <label htmlFor="cnpj" className="text-sm font-medium">CNPJ</label>
          <input id="cnpj" name="cnpj" className={I} placeholder="00.000.000/0001-00" />
        </div>
        <div className="space-y-1">
          <label htmlFor="industry" className="text-sm font-medium">Segmento</label>
          <input id="industry" name="industry" className={I} placeholder="Tecnologia, Saúde..." />
        </div>
        <div className="space-y-1">
          <label htmlFor="email" className="text-sm font-medium">E-mail</label>
          <input id="email" name="email" type="email" className={I} placeholder="contato@empresa.com" />
        </div>
        <div className="space-y-1">
          <label htmlFor="phone" className="text-sm font-medium">Telefone</label>
          <input id="phone" name="phone" className={I} placeholder="(11) 99999-9999" />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <label htmlFor="website" className="text-sm font-medium">Website</label>
          <input id="website" name="website" type="url" className={I} placeholder="https://empresa.com" />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Link href="/empresas" className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent">
          Cancelar
        </Link>
        <button type="submit" disabled={pending} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          {pending ? "Criando..." : "Criar empresa"}
        </button>
      </div>
    </form>
  );
}

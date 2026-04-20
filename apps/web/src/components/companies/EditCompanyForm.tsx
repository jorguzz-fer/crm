"use client";

import { useActionState } from "react";
import { updateCompanyAction } from "@/app/actions/companies";
import Link from "next/link";

const I = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

interface Company {
  id: string; name: string; cnpj: string | null; website: string | null;
  phone: string | null; email: string | null; industry: string | null;
}

export function EditCompanyForm({ company }: { company: Company }) {
  const [state, action, pending] = useActionState(updateCompanyAction, null);

  return (
    <form action={action} className="rounded-lg border border-border bg-card p-6 space-y-4">
      <input type="hidden" name="id" value={company.id} />

      {state && "error" in state && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
          {state.error}
        </div>
      )}
      {state && "success" in state && (
        <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-700">
          Salvo com sucesso.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2">
          <label htmlFor="name" className="text-sm font-medium">Nome *</label>
          <input id="name" name="name" required defaultValue={company.name} className={I} />
        </div>
        <div className="space-y-1">
          <label htmlFor="cnpj" className="text-sm font-medium">CNPJ</label>
          <input id="cnpj" name="cnpj" defaultValue={company.cnpj ?? ""} className={I} placeholder="00.000.000/0001-00" />
        </div>
        <div className="space-y-1">
          <label htmlFor="industry" className="text-sm font-medium">Segmento</label>
          <input id="industry" name="industry" defaultValue={company.industry ?? ""} className={I} />
        </div>
        <div className="space-y-1">
          <label htmlFor="email" className="text-sm font-medium">E-mail</label>
          <input id="email" name="email" type="email" defaultValue={company.email ?? ""} className={I} />
        </div>
        <div className="space-y-1">
          <label htmlFor="phone" className="text-sm font-medium">Telefone</label>
          <input id="phone" name="phone" defaultValue={company.phone ?? ""} className={I} />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <label htmlFor="website" className="text-sm font-medium">Website</label>
          <input id="website" name="website" type="url" defaultValue={company.website ?? ""} className={I} />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Link href={`/empresas/${company.id}`} className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent">
          Cancelar
        </Link>
        <button type="submit" disabled={pending} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          {pending ? "Salvando..." : "Salvar alterações"}
        </button>
      </div>
    </form>
  );
}

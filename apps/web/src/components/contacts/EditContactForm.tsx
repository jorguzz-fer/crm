"use client";

import { useActionState } from "react";
import { updateContactAction } from "@/app/actions/contacts";
import Link from "next/link";

const I = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

interface Contact {
  id: string; name: string; email: string | null;
  phone: string | null; role: string | null; companyId: string | null;
}
interface Company { id: string; name: string }

export function EditContactForm({ contact, companies }: { contact: Contact; companies: Company[] }) {
  const [state, action, pending] = useActionState(updateContactAction, null);

  return (
    <form action={action} className="rounded-lg border border-border bg-card p-6 space-y-4">
      <input type="hidden" name="id" value={contact.id} />

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
          <input id="name" name="name" required defaultValue={contact.name} className={I} />
        </div>
        <div className="space-y-1">
          <label htmlFor="email" className="text-sm font-medium">E-mail</label>
          <input id="email" name="email" type="email" defaultValue={contact.email ?? ""} className={I} />
        </div>
        <div className="space-y-1">
          <label htmlFor="phone" className="text-sm font-medium">Telefone</label>
          <input id="phone" name="phone" defaultValue={contact.phone ?? ""} className={I} />
        </div>
        <div className="space-y-1">
          <label htmlFor="role" className="text-sm font-medium">Cargo</label>
          <input id="role" name="role" defaultValue={contact.role ?? ""} className={I} />
        </div>
        <div className="space-y-1">
          <label htmlFor="companyId" className="text-sm font-medium">Empresa</label>
          <select id="companyId" name="companyId" defaultValue={contact.companyId ?? ""} className={I}>
            <option value="">Nenhuma</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Link href={`/contatos/${contact.id}`} className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent">
          Cancelar
        </Link>
        <button type="submit" disabled={pending} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          {pending ? "Salvando..." : "Salvar alterações"}
        </button>
      </div>
    </form>
  );
}

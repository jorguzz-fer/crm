"use client";

import { useActionState } from "react";
import { updateLeadAction } from "@/app/actions/leads";
import Link from "next/link";

interface User { id: string; name: string }
interface Lead {
  id: string; name: string; email: string | null; phone: string | null;
  company: string | null; source: string; status: string; assignedTo: string | null;
}

export function EditLeadForm({ lead, users }: { lead: Lead; users: User[] }) {
  const [state, action, pending] = useActionState(updateLeadAction, null);

  return (
    <form action={action} className="rounded-lg border border-border bg-card p-6 space-y-4">
      <input type="hidden" name="id" value={lead.id} />

      {state && "error" in state && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
          {state.error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2">
          <label htmlFor="name" className="text-sm font-medium">Nome *</label>
          <input id="name" name="name" required defaultValue={lead.name} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        </div>
        <div className="space-y-1">
          <label htmlFor="email" className="text-sm font-medium">E-mail</label>
          <input id="email" name="email" type="email" defaultValue={lead.email ?? ""} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        </div>
        <div className="space-y-1">
          <label htmlFor="phone" className="text-sm font-medium">Telefone</label>
          <input id="phone" name="phone" defaultValue={lead.phone ?? ""} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <label htmlFor="company" className="text-sm font-medium">Empresa</label>
          <input id="company" name="company" defaultValue={lead.company ?? ""} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        </div>
        <div className="space-y-1">
          <label htmlFor="source" className="text-sm font-medium">Origem</label>
          <select id="source" name="source" defaultValue={lead.source} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <option value="OUTRO">Outro</option>
            <option value="WEBSITE">Website</option>
            <option value="WHATSAPP">WhatsApp</option>
            <option value="INSTAGRAM">Instagram</option>
            <option value="FACEBOOK">Facebook</option>
            <option value="INDICACAO">Indicação</option>
            <option value="EVENTO">Evento</option>
            <option value="COLD_OUTREACH">Prospecção</option>
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="status" className="text-sm font-medium">Status</label>
          <select id="status" name="status" defaultValue={lead.status} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <option value="NOVO">Novo</option>
            <option value="EM_CONTATO">Em contato</option>
            <option value="QUALIFICADO">Qualificado</option>
            <option value="DESQUALIFICADO">Desqualificado</option>
            <option value="CONVERTIDO">Convertido</option>
          </select>
        </div>
        <div className="space-y-1 sm:col-span-2">
          <label htmlFor="assignedTo" className="text-sm font-medium">Responsável</label>
          <select id="assignedTo" name="assignedTo" defaultValue={lead.assignedTo ?? ""} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <option value="">Sem responsável</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Link href={`/leads/${lead.id}`} className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent">
          Cancelar
        </Link>
        <button type="submit" disabled={pending} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          {pending ? "Salvando..." : "Salvar alterações"}
        </button>
      </div>
    </form>
  );
}

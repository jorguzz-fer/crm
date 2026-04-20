"use client";

import { useActionState } from "react";
import { createLeadAction } from "@/app/actions/leads";
import Link from "next/link";

interface User { id: string; name: string }

export function CreateLeadForm({ users }: { users: User[] }) {
  const [state, action, pending] = useActionState(createLeadAction, null);

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
          <input id="name" name="name" required className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" placeholder="João Silva" />
        </div>
        <div className="space-y-1">
          <label htmlFor="email" className="text-sm font-medium">E-mail</label>
          <input id="email" name="email" type="email" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" placeholder="joao@empresa.com" />
        </div>
        <div className="space-y-1">
          <label htmlFor="phone" className="text-sm font-medium">Telefone</label>
          <input id="phone" name="phone" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" placeholder="(11) 99999-9999" />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <label htmlFor="company" className="text-sm font-medium">Empresa</label>
          <input id="company" name="company" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" placeholder="Acme Ltda" />
        </div>
        <div className="space-y-1">
          <label htmlFor="source" className="text-sm font-medium">Origem</label>
          <select id="source" name="source" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
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
          <select id="status" name="status" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <option value="NOVO">Novo</option>
            <option value="EM_CONTATO">Em contato</option>
            <option value="QUALIFICADO">Qualificado</option>
            <option value="DESQUALIFICADO">Desqualificado</option>
            <option value="CONVERTIDO">Convertido</option>
          </select>
        </div>
        <div className="space-y-1 sm:col-span-2">
          <label htmlFor="assignedTo" className="text-sm font-medium">Responsável</label>
          <select id="assignedTo" name="assignedTo" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <option value="">Sem responsável</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Link href="/leads" className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent">
          Cancelar
        </Link>
        <button type="submit" disabled={pending} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          {pending ? "Criando..." : "Criar lead"}
        </button>
      </div>
    </form>
  );
}

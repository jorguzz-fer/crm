"use client";

import { useActionState, useRef, useEffect } from "react";
import { createTaskAction } from "@/app/actions/tasks";

const I = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

interface Props {
  users: { id: string; name: string }[];
  currentUserId: string;
  leads?: { id: string; name: string }[];
  opportunities?: { id: string; title: string }[];
  defaultLeadId?: string;
  defaultOpportunityId?: string;
}

export function CreateTaskForm({
  users, currentUserId, leads = [], opportunities = [],
  defaultLeadId, defaultOpportunityId,
}: Props) {
  const [state, action, pending] = useActionState(createTaskAction, null);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state && "success" in state) ref.current?.reset();
  }, [state]);

  return (
    <form ref={ref} action={action} className="rounded-lg border border-border bg-card p-4 space-y-4">
      <h2 className="text-sm font-semibold">Nova tarefa</h2>

      {state && "error" in state && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
          {state.error}
        </div>
      )}
      {state && "success" in state && (
        <p className="text-sm text-green-600">Tarefa criada com sucesso!</p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2">
          <label className="text-sm font-medium">Título *</label>
          <input name="title" required className={I} placeholder="Ex: Ligar para cliente até sexta" />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Prazo</label>
          <input name="dueAt" type="datetime-local" className={I} />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Prioridade</label>
          <select name="priority" defaultValue="MEDIA" className={I}>
            <option value="BAIXA">Baixa</option>
            <option value="MEDIA">Média</option>
            <option value="ALTA">Alta</option>
            <option value="URGENTE">Urgente</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Responsável</label>
          <select name="assignedTo" defaultValue={currentUserId} className={I}>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>

        {leads.length > 0 && (
          <div className="space-y-1">
            <label className="text-sm font-medium">Lead</label>
            <select name="leadId" defaultValue={defaultLeadId ?? ""} className={I}>
              <option value="">Nenhum</option>
              {leads.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
        )}

        {opportunities.length > 0 && (
          <div className="space-y-1">
            <label className="text-sm font-medium">Oportunidade</label>
            <select name="opportunityId" defaultValue={defaultOpportunityId ?? ""} className={I}>
              <option value="">Nenhuma</option>
              {opportunities.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
            </select>
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {pending ? "Criando..." : "Criar tarefa"}
        </button>
      </div>
    </form>
  );
}

"use client";

import { useActionState, useRef, useEffect } from "react";
import { createActivityAction } from "@/app/actions/activities";

const I = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

interface Props {
  leads?: { id: string; name: string }[];
  opportunities?: { id: string; title: string }[];
  defaultLeadId?: string;
  defaultOpportunityId?: string;
}

// Formato datetime-local no fuso local
function localNow() {
  const d = new Date();
  d.setSeconds(0, 0);
  return d.toISOString().slice(0, 16);
}

export function CreateActivityForm({ leads = [], opportunities = [], defaultLeadId, defaultOpportunityId }: Props) {
  const [state, action, pending] = useActionState(createActivityAction, null);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state && "success" in state) ref.current?.reset();
  }, [state]);

  return (
    <form ref={ref} action={action} className="rounded-lg border border-border bg-card p-4 space-y-4">
      <h2 className="text-sm font-semibold">Registrar atividade</h2>

      {state && "error" in state && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
          {state.error}
        </div>
      )}
      {state && "success" in state && (
        <p className="text-sm text-green-600">Atividade registrada!</p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-sm font-medium">Tipo *</label>
          <select name="type" required className={I}>
            <option value="LIGACAO">Ligação</option>
            <option value="EMAIL">E-mail</option>
            <option value="REUNIAO">Reunião</option>
            <option value="WHATSAPP">WhatsApp</option>
            <option value="VISITA">Visita</option>
            <option value="OUTRO">Outro</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Data e hora *</label>
          <input
            name="occurredAt"
            type="datetime-local"
            className={I}
            defaultValue={localNow()}
          />
        </div>

        <div className="space-y-1 sm:col-span-2">
          <label className="text-sm font-medium">Assunto *</label>
          <input name="subject" required className={I} placeholder="Ex: Apresentação da proposta" />
        </div>

        <div className="space-y-1 sm:col-span-2">
          <label className="text-sm font-medium">Descrição</label>
          <textarea
            name="description"
            rows={2}
            className={`${I} resize-none`}
            placeholder="Detalhes sobre a atividade..."
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Duração (min)</label>
          <input name="duration" type="number" min="1" max="1440" className={I} placeholder="30" />
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
          {pending ? "Registrando..." : "Registrar"}
        </button>
      </div>
    </form>
  );
}

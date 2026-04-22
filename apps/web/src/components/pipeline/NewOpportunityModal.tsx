"use client";

import { useState, useActionState, useEffect } from "react";
import { createOpportunityAction } from "@/app/actions/opportunities";
import { X, Plus } from "lucide-react";

interface Props {
  pipelineId: string;
  stages: { id: string; name: string }[];
  users: { id: string; name: string }[];
  leads: { id: string; name: string }[];
}

// Formata dígitos como moeda BR enquanto o usuário digita: "1000050" → "10.000,50"
function formatCurrencyBR(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  const num = parseInt(digits, 10);
  return (num / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// Converte "10.000,50" de volta para "10000.50" (que Zod coerce.number() aceita)
function parseCurrencyBR(formatted: string): string {
  return formatted.replace(/\./g, "").replace(",", ".");
}

export function NewOpportunityModal({ pipelineId, stages, users, leads }: Props) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(createOpportunityAction, null);
  const [valueDisplay, setValueDisplay] = useState("");
  const [valueRaw, setValueRaw] = useState("");

  useEffect(() => {
    if (state && "success" in state) {
      setOpen(false);
      setValueDisplay("");
      setValueRaw("");
    }
  }, [state]);

  function handleValueChange(e: React.ChangeEvent<HTMLInputElement>) {
    const formatted = formatCurrencyBR(e.target.value);
    setValueDisplay(formatted);
    setValueRaw(formatted ? parseCurrencyBR(formatted) : "");
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        <Plus size={16} />
        Nova oportunidade
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative z-10 w-full max-w-md rounded-xl border border-border bg-card shadow-xl mx-4">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="text-base font-semibold">Nova oportunidade</h2>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X size={18} />
              </button>
            </div>

            <form action={action} className="p-5 space-y-4">
              {/* pipelineId obrigatório pelo schema */}
              <input type="hidden" name="pipelineId" value={pipelineId} />

              {state && "error" in state && (
                <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                  {state.error}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-sm font-medium">Título *</label>
                <input
                  name="title"
                  required
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="Ex: Proposta para Acme"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Estágio *</label>
                <select
                  name="stageId"
                  required
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Selecione...</option>
                  {stages.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Valor (R$)</label>
                  {/* Input visual BR — valor numérico enviado via hidden input */}
                  <input
                    type="text"
                    inputMode="numeric"
                    value={valueDisplay}
                    onChange={handleValueChange}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder="1.000,00"
                  />
                  <input type="hidden" name="value" value={valueRaw} />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Probabilidade %</label>
                  <input
                    name="probability"
                    type="number"
                    min="0"
                    max="100"
                    defaultValue="0"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Previsão de fechamento</label>
                {/* type="date" — conversão para ISO feita no action */}
                <input
                  name="expectedCloseAt"
                  type="date"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              {leads.length > 0 && (
                <div className="space-y-1">
                  <label className="text-sm font-medium">Lead relacionado</label>
                  <select
                    name="leadId"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">Nenhum</option>
                    {leads.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-sm font-medium">Responsável</label>
                <select
                  name="assignedTo"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Sem responsável</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {pending ? "Criando..." : "Criar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

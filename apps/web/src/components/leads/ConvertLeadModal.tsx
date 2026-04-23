"use client";

import { useState, useActionState } from "react";
import { convertLeadAction } from "@/app/actions/leads";
import { TrendingUp, X } from "lucide-react";

// Formata dígitos como moeda BR enquanto o usuário digita
function formatCurrencyBR(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  const num = parseInt(digits, 10);
  return (num / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parseCurrencyBR(formatted: string): string {
  return formatted.replace(/\./g, "").replace(",", ".");
}

interface Props {
  leadId: string;
  leadName: string;
  stages: { id: string; name: string; pipelineId: string }[];
}

export function ConvertLeadModal({ leadId, leadName, stages }: Props) {
  const [open, setOpen] = useState(false);
  const [valueDisplay, setValueDisplay] = useState("");
  const [valueRaw, setValueRaw] = useState("");
  const [state, action, pending] = useActionState(convertLeadAction, null);

  function handleValueChange(e: React.ChangeEvent<HTMLInputElement>) {
    const formatted = formatCurrencyBR(e.target.value);
    setValueDisplay(formatted);
    setValueRaw(formatted ? parseCurrencyBR(formatted) : "");
  }

  if (stages.length === 0) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md bg-green-600 hover:bg-green-700 px-3 py-1.5 text-sm font-medium text-white transition-colors"
      >
        <TrendingUp size={14} />
        Converter em oportunidade
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative z-10 w-full max-w-md rounded-xl border border-border bg-card shadow-xl mx-4">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="text-base font-semibold">Converter em oportunidade</h2>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X size={18} />
              </button>
            </div>

            <form action={action} className="p-5 space-y-4">
              <input type="hidden" name="leadId" value={leadId} />

              {state && "error" in state && (
                <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                  {state.error}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-sm font-medium">Título da oportunidade *</label>
                <input
                  name="title"
                  required
                  defaultValue={leadName}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Estágio *</label>
                <select
                  name="stageId"
                  required
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Selecione o estágio...</option>
                  {stages.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Valor estimado (R$)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={valueDisplay}
                  onChange={handleValueChange}
                  placeholder="1.000,00"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <input type="hidden" name="value" value={valueRaw} />
              </div>

              <div className="rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 p-3 text-xs text-amber-800 dark:text-amber-300">
                O status do lead será alterado para <strong>Convertido</strong> e você será redirecionado para a oportunidade criada.
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
                  className="rounded-md bg-green-600 hover:bg-green-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 transition-colors"
                >
                  {pending ? "Convertendo..." : "Converter"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

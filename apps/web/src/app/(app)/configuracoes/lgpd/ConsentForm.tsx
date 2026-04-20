"use client";

import { useActionState, useRef, useEffect } from "react";
import { registerConsentAction } from "@/app/actions/lgpd";

const I = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function ConsentForm() {
  const [state, action, pending] = useActionState(registerConsentAction, null);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state && "success" in state) ref.current?.reset();
  }, [state]);

  return (
    <form ref={ref} action={action} className="rounded-lg border border-border bg-card p-4 space-y-4">
      {state && "error" in state && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
          {state.error}
        </div>
      )}
      {state && "success" in state && (
        <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-700">
          {state.success}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-sm font-medium">Tipo de titular *</label>
          <select name="entityType" required className={I} defaultValue="LEAD">
            <option value="LEAD">Lead</option>
            <option value="CONTACT">Contato</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">ID do titular *</label>
          <input
            name="entityId"
            required
            className={I}
            placeholder="Copie da URL da ficha"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Base legal (art. 7º LGPD) *</label>
          <select name="basis" required className={I} defaultValue="CONTRATO">
            <option value="CONTRATO">Execução de contrato</option>
            <option value="LEGITIMO_INTERESSE">Legítimo interesse</option>
            <option value="CONSENTIMENTO">Consentimento explícito</option>
            <option value="OBRIGACAO_LEGAL">Obrigação legal</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Observações</label>
          <input
            name="notes"
            className={I}
            placeholder="Ex: consentiu via formulário do site em 01/04/2025"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {pending ? "Registrando..." : "Registrar consentimento"}
        </button>
      </div>
    </form>
  );
}

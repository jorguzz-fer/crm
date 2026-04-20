"use client";

import { useActionState, useRef, useEffect } from "react";
import { addOpportunityNoteAction } from "@/app/actions/opportunities";

export function AddOpportunityNoteForm({ opportunityId }: { opportunityId: string }) {
  const [state, action, pending] = useActionState(addOpportunityNoteAction, null);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state && "success" in state) ref.current?.reset();
  }, [state]);

  return (
    <form ref={ref} action={action} className="rounded-lg border border-border bg-card p-4 space-y-3">
      <input type="hidden" name="opportunityId" value={opportunityId} />
      <h2 className="text-sm font-semibold">Adicionar nota</h2>
      {state && "error" in state && (
        <p className="text-xs text-destructive">{state.error}</p>
      )}
      <textarea
        name="content"
        rows={3}
        required
        placeholder="Escreva uma nota sobre esta oportunidade..."
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
      />
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {pending ? "Salvando..." : "Salvar nota"}
        </button>
      </div>
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { updateOpportunityStatusAction } from "@/app/actions/opportunities";

export function OpportunityStatusForm({
  opportunityId,
  currentStatus,
}: {
  opportunityId: string;
  currentStatus: string;
}) {
  const [state, action, pending] = useActionState(updateOpportunityStatusAction, null);

  if (currentStatus !== "ABERTA") return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {state && "error" in state && (
        <p className="text-xs text-destructive">{state.error}</p>
      )}
      <form action={action}>
        <input type="hidden" name="id" value={opportunityId} />
        <input type="hidden" name="status" value="GANHA" />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
        >
          Marcar Ganha
        </button>
      </form>
      <form action={action}>
        <input type="hidden" name="id" value={opportunityId} />
        <input type="hidden" name="status" value="PERDIDA" />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
        >
          Marcar Perdida
        </button>
      </form>
    </div>
  );
}

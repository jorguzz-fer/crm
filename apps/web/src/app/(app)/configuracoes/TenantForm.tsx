"use client";

import { useActionState } from "react";
import { updateTenantAction } from "@/app/actions/settings";

const I = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function TenantForm({ name }: { name: string }) {
  const [state, action, pending] = useActionState(updateTenantAction, null);

  return (
    <form action={action} className="flex items-end gap-3">
      <div className="flex-1 space-y-1">
        <label htmlFor="tenant-name" className="text-sm font-medium">Nome da empresa</label>
        <input id="tenant-name" name="name" required defaultValue={name} className={I} />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 whitespace-nowrap"
      >
        {pending ? "Salvando..." : "Salvar"}
      </button>
      {state && "error" in state && <p className="text-xs text-destructive self-center">{state.error}</p>}
      {state && "success" in state && <p className="text-xs text-green-600 self-center">{state.success}</p>}
    </form>
  );
}

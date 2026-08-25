"use client";

import { useActionState } from "react";
import { Ban, RotateCcw } from "lucide-react";
import { setTenantActiveAction, setTenantPlanAction } from "@/app/actions/platform";
import { isPlan, PLAN_LABELS, PLANS } from "@/lib/platform";

interface Props {
  tenantId: string;
  tenantName: string;
  plan: string;
  active: boolean;
  /** O painel não deixa suspender o tenant de quem está logado. */
  isOwnTenant: boolean;
}

export function TenantRowActions({ tenantId, tenantName, plan, active, isOwnTenant }: Props) {
  const [planState, planAction, planPending] = useActionState(setTenantPlanAction, null);
  const [activeState, activeAction, activePending] = useActionState(setTenantActiveAction, null);

  const error =
    (planState && "error" in planState && planState.error) ||
    (activeState && "error" in activeState && activeState.error) ||
    null;

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center justify-end gap-2">
        {/* Troca de plano: o submit é disparado pelo próprio select */}
        <form action={planAction}>
          <input type="hidden" name="tenantId" value={tenantId} />
          <select
            name="plan"
            defaultValue={isPlan(plan) ? plan : PLANS[0]}
            disabled={planPending}
            aria-label={`Plano de ${tenantName}`}
            onChange={(e) => e.currentTarget.form?.requestSubmit()}
            className="rounded-md border border-input bg-background px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            {PLANS.map((p) => (
              <option key={p} value={p}>{PLAN_LABELS[p]}</option>
            ))}
          </select>
        </form>

        <form action={activeAction}>
          <input type="hidden" name="tenantId" value={tenantId} />
          <input type="hidden" name="active" value={active ? "false" : "true"} />
          <button
            type="submit"
            disabled={activePending || (active && isOwnTenant)}
            title={
              active && isOwnTenant
                ? "Você não pode suspender o tenant em que está logado"
                : active
                  ? "Suspender — bloqueia o login de todos os usuários"
                  : "Reativar"
            }
            className="inline-flex items-center gap-1 rounded-md border border-input px-2 py-1 text-xs font-medium hover:bg-accent disabled:opacity-40"
          >
            {active ? <Ban size={12} /> : <RotateCcw size={12} />}
            {activePending ? "..." : active ? "Suspender" : "Reativar"}
          </button>
        </form>
      </div>

      {error && <p className="text-[11px] text-destructive">{error}</p>}
    </div>
  );
}

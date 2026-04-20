"use client";

import { useActionState, useRef, useEffect } from "react";
import { inviteUserAction } from "@/app/actions/settings";
import { PasswordInput } from "@/components/ui/PasswordInput";

const I = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function InviteUserForm() {
  const [state, action, pending] = useActionState(inviteUserAction, null);
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
          <label className="text-sm font-medium">Nome *</label>
          <input name="name" required className={I} placeholder="João Silva" />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">E-mail *</label>
          <input name="email" type="email" required className={I} placeholder="joao@empresa.com" />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Senha temporária *</label>
          <PasswordInput id="password" name="password" placeholder="Mín. 10 caracteres" />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Papel</label>
          <select name="role" defaultValue="ANALYST" className={I}>
            <option value="ADMIN">Admin</option>
            <option value="SUPERVISOR">Supervisor</option>
            <option value="ANALYST">Analista</option>
            <option value="VIEWER">Visualizador</option>
          </select>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {pending ? "Criando..." : "Criar usuário"}
        </button>
      </div>
    </form>
  );
}

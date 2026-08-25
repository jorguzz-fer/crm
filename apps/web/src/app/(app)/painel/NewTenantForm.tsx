"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import { createTenantAction } from "@/app/actions/platform";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { normalizeSlug, PLAN_LABELS, PLANS } from "@/lib/platform";

const I =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function NewTenantForm() {
  const [open, setOpen] = useState(false);
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [state, action, pending] = useActionState(createTenantAction, null);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state && "success" in state) {
      ref.current?.reset();
      setSlug("");
      setSlugTouched(false);
    }
  }, [state]);

  return (
    <div className="rounded-lg border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-4 py-3 text-sm font-medium hover:bg-accent/50"
      >
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <Plus size={15} />
        Novo cliente
      </button>

      {open && (
        <form ref={ref} action={action} className="space-y-4 border-t border-border p-4">
          {state && "error" in state && (
            <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
              {state.error}
            </div>
          )}
          {state && "success" in state && (
            <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">
              {state.success}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">Nome do cliente *</label>
              <input
                name="tenantName"
                required
                className={I}
                placeholder="Clínica São Jorge"
                onChange={(e) => {
                  // Sugere o slug enquanto o usuário não editar o campo à mão
                  if (!slugTouched) setSlug(normalizeSlug(e.target.value));
                }}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Slug *</label>
              <input
                name="tenantSlug"
                required
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(e.target.value);
                }}
                className={`${I} font-mono`}
                placeholder="clinica-sao-jorge"
              />
              <p className="text-xs text-muted-foreground">
                Letras minúsculas, números e hifens. Identifica o cliente nas integrações.
              </p>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Plano</label>
              <select name="plan" defaultValue="FREE" className={I}>
                {PLANS.map((p) => (
                  <option key={p} value={p}>{PLAN_LABELS[p]}</option>
                ))}
              </select>
            </div>
            <div className="hidden sm:block" />
            <div className="space-y-1">
              <label className="text-sm font-medium">Nome do administrador *</label>
              <input name="adminName" required className={I} placeholder="Jorge Fernandes" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">E-mail do administrador *</label>
              <input name="adminEmail" type="email" required className={I} placeholder="jorge@clinica.com.br" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Senha inicial *</label>
              <PasswordInput id="adminPassword" name="adminPassword" placeholder="Mín. 10 caracteres" />
              <p className="text-xs text-muted-foreground">
                Combine ao menos 3 de: maiúscula, minúscula, número, símbolo.
              </p>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {pending ? "Criando..." : "Criar cliente"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

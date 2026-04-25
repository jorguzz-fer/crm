"use client";

import { useActionState } from "react";
import { updateTrackingConfigAction } from "@/app/actions/settings";

const I = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring font-mono";
const L = "block text-sm font-medium mb-1";

interface Props {
  metaPixelId: string | null;
  metaAccessToken: string | null;
  hotmartHottok: string | null;
  pagarmeWebhookSecret: string | null;
  tenantId: string;
}

export function TrackingConfigForm({
  metaPixelId,
  metaAccessToken,
  hotmartHottok,
  pagarmeWebhookSecret,
  tenantId,
}: Props) {
  const [state, action, pending] = useActionState(updateTrackingConfigAction, null);

  return (
    <form action={action} className="space-y-8">
      {/* Meta CAPI */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold border-b border-border pb-2">Meta Conversions API</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="metaPixelId" className={L}>Pixel ID</label>
            <input
              id="metaPixelId"
              name="metaPixelId"
              placeholder="1234567890"
              defaultValue={metaPixelId ?? ""}
              className={I}
            />
          </div>
          <div>
            <label htmlFor="metaAccessToken" className={L}>Access Token</label>
            <input
              id="metaAccessToken"
              name="metaAccessToken"
              type="password"
              placeholder="EAAxxxxxxxx"
              defaultValue={metaAccessToken ?? ""}
              className={I}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Encontre o Pixel ID e o token em{" "}
          <span className="font-mono bg-muted px-1 rounded">Gerenciador de Eventos → Configurações → API de Conversões</span>
          .
        </p>
      </section>

      {/* Hotmart */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold border-b border-border pb-2">Hotmart</h3>
        <div className="max-w-sm">
          <label htmlFor="hotmartHottok" className={L}>Hottok (token de assinatura)</label>
          <input
            id="hotmartHottok"
            name="hotmartHottok"
            type="password"
            placeholder="seu-hottok-secreto"
            defaultValue={hotmartHottok ?? ""}
            className={I}
          />
        </div>
        <div className="rounded-md bg-muted/50 border border-border p-3 text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">URL do webhook Hotmart</p>
          <p className="font-mono break-all select-all">
            {process.env.NEXT_PUBLIC_APP_URL ?? "https://sua-app.com"}/api/webhooks/hotmart?tenant={tenantId}
          </p>
          <p>Configure essa URL em <strong>Hotmart → Ferramentas → Webhooks</strong>.</p>
        </div>
      </section>

      {/* Pagar.me */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold border-b border-border pb-2">Pagar.me</h3>
        <div className="max-w-sm">
          <label htmlFor="pagarmeWebhookSecret" className={L}>Webhook Secret</label>
          <input
            id="pagarmeWebhookSecret"
            name="pagarmeWebhookSecret"
            type="password"
            placeholder="seu-webhook-secret"
            defaultValue={pagarmeWebhookSecret ?? ""}
            className={I}
          />
        </div>
        <div className="rounded-md bg-muted/50 border border-border p-3 text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">URL do webhook Pagar.me</p>
          <p className="font-mono break-all select-all">
            {process.env.NEXT_PUBLIC_APP_URL ?? "https://sua-app.com"}/api/webhooks/pagarme?tenant={tenantId}
          </p>
          <p>Configure em <strong>Pagar.me Dashboard → Configurações → Webhooks</strong>.</p>
        </div>
      </section>

      <div className="flex items-center gap-4 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {pending ? "Salvando..." : "Salvar integrações"}
        </button>
        {state && "error" in state && (
          <p className="text-xs text-destructive">{state.error}</p>
        )}
        {state && "success" in state && (
          <p className="text-xs text-green-600">{state.success}</p>
        )}
      </div>
    </form>
  );
}

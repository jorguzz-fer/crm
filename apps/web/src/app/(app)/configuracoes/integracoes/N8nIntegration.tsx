"use client";

import { useState } from "react";
import { Copy, Check, ExternalLink, Eye, EyeOff, Workflow } from "lucide-react";

interface Props {
  webhookUrl: string;
  apiToken:   string;
  tenantSlug: string;
}

const SOURCE_OPTIONS = ["FACEBOOK", "INSTAGRAM", "WHATSAPP", "LINKEDIN", "OUTRO"] as const;

export function N8nIntegration({ webhookUrl, apiToken, tenantSlug }: Props) {
  const [revealToken, setRevealToken] = useState(false);
  const [copied, setCopied]           = useState<string | null>(null);

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  const samplePayload = JSON.stringify(
    {
      tenantSlug,
      name:    "{{ $json.full_name }}",
      email:   "{{ $json.email }}",
      phone:   "{{ $json.phone_number }}",
      source:  "FACEBOOK",
      ad_name: "{{ $json.ad_name }}",
      form_id: "{{ $json.form_id }}",
    },
    null, 2,
  );

  const tokenDisplay = revealToken ? apiToken : "•".repeat(apiToken.length);

  return (
    <div className="space-y-4">
      {/* Credenciais da integração */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="bg-muted/40 px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
          <Workflow size={13} />
          Credenciais para n8n / Make / Zapier
        </div>
        <div className="divide-y divide-border">
          {/* Webhook URL */}
          <div className="p-4 space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <label className="text-xs font-medium text-foreground">
                URL do webhook (HTTP Request node)
              </label>
              <button
                onClick={() => copy(webhookUrl, "url")}
                className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded border border-border hover:bg-muted transition-colors shrink-0"
              >
                {copied === "url" ? <Check size={11} className="text-green-600" /> : <Copy size={11} />}
                {copied === "url" ? "Copiado" : "Copiar"}
              </button>
            </div>
            <code className="block break-all rounded bg-muted px-2.5 py-1.5 font-mono text-[11px] text-foreground">
              {webhookUrl}
            </code>
            <p className="text-[11px] text-muted-foreground">
              Método: <code className="font-mono">POST</code> · Content-Type: <code className="font-mono">application/json</code>
            </p>
          </div>

          {/* Token */}
          <div className="p-4 space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <label className="text-xs font-medium text-foreground">
                API Token (header <code className="font-mono text-[11px]">X-API-Token</code>)
              </label>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => setRevealToken((v) => !v)}
                  className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border border-border hover:bg-muted transition-colors"
                >
                  {revealToken ? <EyeOff size={11} /> : <Eye size={11} />}
                  {revealToken ? "Ocultar" : "Mostrar"}
                </button>
                <button
                  onClick={() => copy(apiToken, "token")}
                  className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded border border-border hover:bg-muted transition-colors"
                >
                  {copied === "token" ? <Check size={11} className="text-green-600" /> : <Copy size={11} />}
                  {copied === "token" ? "Copiado" : "Copiar"}
                </button>
              </div>
            </div>
            <code className="block break-all rounded bg-muted px-2.5 py-1.5 font-mono text-[11px] text-foreground select-all">
              {tokenDisplay}
            </code>
            <p className="text-[11px] text-muted-foreground">
              Obrigatório para integrações externas (n8n, Make, Zapier). Não compartilhe publicamente.
            </p>
          </div>

          {/* tenantSlug */}
          <div className="p-4 space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <label className="text-xs font-medium text-foreground">tenantSlug (campo no body)</label>
              <button
                onClick={() => copy(tenantSlug, "slug")}
                className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded border border-border hover:bg-muted transition-colors shrink-0"
              >
                {copied === "slug" ? <Check size={11} className="text-green-600" /> : <Copy size={11} />}
                {copied === "slug" ? "Copiado" : "Copiar"}
              </button>
            </div>
            <code className="block rounded bg-muted px-2.5 py-1.5 font-mono text-[11px] text-foreground">
              {tenantSlug}
            </code>
          </div>
        </div>
      </div>

      {/* Tutorial n8n */}
      <details className="group rounded-lg border border-border overflow-hidden" open>
        <summary className="flex cursor-pointer items-center justify-between bg-muted/40 px-4 py-2.5 text-xs font-semibold select-none">
          <span>Passo a passo no n8n</span>
          <span className="text-muted-foreground group-open:rotate-180 transition-transform">▾</span>
        </summary>
        <div className="p-4 space-y-3 text-xs leading-relaxed">
          <ol className="space-y-2.5 list-decimal pl-4 text-foreground">
            <li>
              No n8n, crie um novo workflow e adicione o trigger{" "}
              <strong>Facebook Lead Ads Trigger</strong>.
            </li>
            <li>
              Conecte sua conta do Facebook e selecione a <strong>Página</strong> e o{" "}
              <strong>formulário</strong> que vai capturar os leads.
            </li>
            <li>
              Adicione um nó <strong>HTTP Request</strong>:
              <ul className="mt-1 ml-3 list-disc text-muted-foreground space-y-0.5">
                <li>Method: <code className="font-mono">POST</code></li>
                <li>URL: cole a URL acima</li>
                <li>Authentication: <em>None</em></li>
                <li>Send Headers: <code className="font-mono">X-API-Token</code> = token acima</li>
                <li>Send Body: JSON (veja exemplo abaixo)</li>
              </ul>
            </li>
            <li>
              Mapeie os campos do lead no body usando expressões{" "}
              <code className="font-mono">{`{{ $json.campo }}`}</code> do nó anterior.
            </li>
            <li>Ative o workflow e teste enviando um lead de teste pelo Meta Lead Center.</li>
          </ol>
        </div>
      </details>

      {/* Payload exemplo */}
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="flex items-center justify-between bg-muted/40 px-4 py-2">
          <span className="text-xs font-medium text-muted-foreground">
            Body JSON (exemplo para Facebook Lead Ads)
          </span>
          <button
            onClick={() => copy(samplePayload, "payload")}
            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded border border-border hover:bg-muted transition-colors"
          >
            {copied === "payload" ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
            {copied === "payload" ? "Copiado!" : "Copiar"}
          </button>
        </div>
        <pre className="overflow-x-auto p-4 text-[11px] leading-relaxed bg-[#1a1a2e] text-[#e2e8f0]">
          {samplePayload}
        </pre>
      </div>

      {/* Sources aceitas */}
      <div className="rounded-md bg-muted/50 border border-border p-4 text-xs space-y-2">
        <p className="font-semibold text-foreground text-sm">Campos aceitos no body</p>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {[
            ["tenantSlug",   "obrigatório — identifica seu CRM"],
            ["name",         "obrigatório — nome do lead"],
            ["email",        "e-mail do lead"],
            ["phone",        "telefone do lead"],
            ["company",      "empresa"],
            ["source",       `${SOURCE_OPTIONS.join(" | ")}`],
            ["ad_name",      "nome do anúncio (vira nota)"],
            ["form_id",      "ID do formulário (vira nota)"],
            ["message",      "mensagem livre (vira nota)"],
            ["utm_source",   "atribuição"],
            ["utm_campaign", "atribuição"],
            ["fbclid",       "Facebook Click ID (CAPI)"],
          ].map(([field, desc]) => (
            <div key={field} className="flex gap-2">
              <code className="shrink-0 bg-muted rounded px-1 font-mono text-[11px] text-foreground">
                {field}
              </code>
              <span className="text-muted-foreground">{desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Links úteis */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <a
          href="https://docs.n8n.io/integrations/builtin/trigger-nodes/n8n-nodes-base.facebookleadadstrigger/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
        >
          <ExternalLink size={11} />
          Doc do nó Facebook Lead Ads no n8n
        </a>
        <a
          href="https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.httprequest/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
        >
          <ExternalLink size={11} />
          Doc do nó HTTP Request
        </a>
      </div>
    </div>
  );
}

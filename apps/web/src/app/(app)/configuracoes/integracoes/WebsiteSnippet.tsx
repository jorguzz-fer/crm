"use client";

import { useState } from "react";
import { Copy, Check, Code2 } from "lucide-react";

interface Props {
  tenantSlug: string;
}

export function WebsiteSnippet({ tenantSlug }: Props) {
  const [copied, setCopied] = useState(false);

  const origin = typeof window !== "undefined" ? window.location.origin : "https://seucrm.com";

  const snippet = `<!-- CRM Lead Capture — ${tenantSlug} -->
<script>
(function() {
  var CRM_URL = "${origin}";
  var TENANT  = "${tenantSlug}";

  function getUTM(key) {
    return new URLSearchParams(window.location.search).get(key) || undefined;
  }

  window.CRMLead = function(data) {
    return fetch(CRM_URL + "/api/public/leads", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.assign({
        tenantSlug:   TENANT,
        source:       "WEBSITE",
        utm_source:   getUTM("utm_source"),
        utm_medium:   getUTM("utm_medium"),
        utm_campaign: getUTM("utm_campaign"),
        utm_content:  getUTM("utm_content"),
        fbclid:       getUTM("fbclid"),
        gclid:        getUTM("gclid"),
      }, data))
    }).then(function(r) { return r.json(); });
  };
})();
</script>`;

  const exampleUsage = `<!-- Exemplo de uso no seu formulário -->
<form id="form-contato">
  <input name="nome"     placeholder="Seu nome"  required />
  <input name="email"    placeholder="E-mail"    type="email" />
  <input name="telefone" placeholder="Telefone"  />
  <textarea name="mensagem" placeholder="Mensagem"></textarea>
  <button type="submit">Enviar</button>
</form>

<script>
document.getElementById("form-contato").addEventListener("submit", function(e) {
  e.preventDefault();
  var f = new FormData(e.target);
  CRMLead({
    name:    f.get("nome"),
    email:   f.get("email"),
    phone:   f.get("telefone"),
    message: f.get("mensagem"),
  }).then(function() {
    alert("Mensagem enviada!");
    e.target.reset();
  });
});
</script>`;

  function copy(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-4">
      {/* Snippet principal */}
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="flex items-center justify-between bg-muted/40 px-4 py-2">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Code2 size={13} />
            Cole no <code className="font-mono">&lt;head&gt;</code> do seu site
          </div>
          <button
            onClick={() => copy(snippet)}
            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded border border-border hover:bg-muted transition-colors"
          >
            {copied ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
            {copied ? "Copiado!" : "Copiar"}
          </button>
        </div>
        <pre className="overflow-x-auto p-4 text-[11px] leading-relaxed bg-[#1a1a2e] text-[#e2e8f0]">
          {snippet}
        </pre>
      </div>

      {/* Exemplo de uso */}
      <details className="group rounded-lg border border-border overflow-hidden">
        <summary className="flex cursor-pointer items-center justify-between bg-muted/40 px-4 py-2.5 text-xs font-medium select-none">
          <span>Ver exemplo de uso no formulário</span>
          <span className="text-muted-foreground group-open:rotate-180 transition-transform">▾</span>
        </summary>
        <pre className="overflow-x-auto p-4 text-[11px] leading-relaxed bg-[#1a1a2e] text-[#e2e8f0]">
          {exampleUsage}
        </pre>
      </details>

      {/* Campos disponíveis */}
      <div className="rounded-md bg-muted/50 border border-border p-4 text-xs space-y-2">
        <p className="font-semibold text-foreground text-sm">Campos aceitos por CRMLead()</p>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {[
            ["name", "Nome completo (obrigatório)"],
            ["email", "E-mail"],
            ["phone", "Telefone"],
            ["company", "Empresa"],
            ["message", "Mensagem / observação"],
            ["source", "Origem (default: WEBSITE)"],
            ["utm_source", "Capturado automaticamente"],
            ["utm_campaign", "Capturado automaticamente"],
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
    </div>
  );
}

import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { headers } from "next/headers";
import { generatePublicApiToken } from "@/lib/publicApiToken";
import { N8nIntegration } from "./N8nIntegration";
import { WebsiteSnippet } from "./WebsiteSnippet";
import { CsvImport } from "./CsvImport";

export const metadata: Metadata = { title: "Integrações" };

export default async function IntegracoesPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const tenantId = session.user.tenantId;

  const tenant = await prisma.tenant.findUnique({
    where:  { id: tenantId },
    select: { slug: true, name: true },
  });
  if (!tenant) redirect("/dashboard");

  // URL absoluta do webhook (usa o host real do request)
  const h          = await headers();
  const proto      = h.get("x-forwarded-proto") ?? "https";
  const host       = h.get("host") ?? "localhost:3000";
  const origin     = `${proto}://${host}`;
  const webhookUrl = `${origin}/api/public/leads`;

  const apiToken = generatePublicApiToken(tenantId);

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Integrações</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Conecte canais externos para capturar leads automaticamente.
        </p>
      </div>

      {/* n8n / Make / Zapier */}
      <section className="space-y-4">
        <div className="border-b border-border pb-2">
          <h2 className="text-base font-semibold">Captura via n8n / Make / Zapier</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Use seu n8n (ou Make/Zapier) como ponte entre Facebook/Instagram Lead Ads,
            LinkedIn, e qualquer outra fonte → CRM.
          </p>
        </div>
        <N8nIntegration
          webhookUrl={webhookUrl}
          apiToken={apiToken}
          tenantSlug={tenant.slug}
        />
      </section>

      {/* Formulário do site */}
      <section className="space-y-4">
        <div className="border-b border-border pb-2">
          <h2 className="text-base font-semibold">Formulário do site / Landing page</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Cole o snippet no seu site para capturar leads do formulário diretamente.
          </p>
        </div>
        <WebsiteSnippet tenantSlug={tenant.slug} />
      </section>

      {/* Import CSV */}
      <section className="space-y-4">
        <div className="border-b border-border pb-2">
          <h2 className="text-base font-semibold">Importar CSV</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Importe uma base existente. Útil também como fallback do Meta Lead Center
            (exporte os leads de lá e suba aqui). Máx. 5.000 linhas por arquivo.
          </p>
        </div>
        <CsvImport />
      </section>
    </div>
  );
}

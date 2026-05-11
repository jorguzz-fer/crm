import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { MetaIntegration } from "./MetaIntegration";
import { WebsiteSnippet } from "./WebsiteSnippet";
import { CsvImport } from "./CsvImport";

export const metadata: Metadata = { title: "Integrações" };

interface Props {
  searchParams: Promise<{ success?: string; error?: string }>;
}

export default async function IntegracoesPage({ searchParams }: Props) {
  const session = await auth();
  if (!session) redirect("/login");

  const tenantId = session.user.tenantId;
  const isAdmin  = ["SUPERADMIN", "ADMIN"].includes(session.user.role);
  const params   = await searchParams;

  const [tenant, metaPages] = await Promise.all([
    prisma.tenant.findUnique({
      where:  { id: tenantId },
      select: { slug: true, name: true },
    }),
    prisma.metaLeadForm.findMany({
      where:   { tenantId },
      select:  { id: true, pageId: true, pageName: true, active: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (!tenant) redirect("/dashboard");

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Integrações</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure a captura automática de leads de diferentes canais.
        </p>
      </div>

      {/* Feedback de OAuth */}
      {params.success && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-300">
          <span>✅</span>
          <span>
            {Number(params.success)} página(s) do Facebook conectada(s) com sucesso!
          </span>
        </div>
      )}
      {params.error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          <span>⚠️</span>
          <span>{decodeURIComponent(params.error)}</span>
        </div>
      )}

      {/* Meta Lead Ads */}
      <section className="space-y-4">
        <div className="border-b border-border pb-2">
          <h2 className="text-base font-semibold">Meta Lead Ads</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Recebe leads automaticamente de anúncios no Facebook e Instagram.
          </p>
        </div>
        <MetaIntegration
          pages={metaPages}
          isAdmin={isAdmin}
        />
      </section>

      {/* Formulário do site */}
      <section className="space-y-4">
        <div className="border-b border-border pb-2">
          <h2 className="text-base font-semibold">Formulário do site / Landing page</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Cole o snippet no seu site para capturar leads automaticamente.
          </p>
        </div>
        <WebsiteSnippet tenantSlug={tenant.slug} />
      </section>

      {/* Import CSV */}
      <section className="space-y-4">
        <div className="border-b border-border pb-2">
          <h2 className="text-base font-semibold">Importar CSV</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Importe uma base de leads existente. Máx. 5.000 linhas por arquivo.
          </p>
        </div>
        <CsvImport />
      </section>
    </div>
  );
}

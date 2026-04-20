import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { AuditLogSection } from "./AuditLogSection";
import { DataRequestsSection } from "./DataRequestsSection";
import { CreateRequestForm } from "./CreateRequestForm";
import { ConsentForm } from "./ConsentForm";

export const metadata: Metadata = { title: "LGPD — Privacidade e Dados" };

export default async function LGPDPage() {
  const session = await auth();
  const isAdmin = ["SUPERADMIN", "ADMIN"].includes(session!.user.role);
  if (!isAdmin) redirect("/configuracoes");

  const tenantId = session!.user.tenantId;

  const [auditLogs, dataRequests, consentRecords] = await Promise.all([
    prisma.auditLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 40,
      select: {
        id: true,
        action: true,
        entity: true,
        entityId: true,
        meta: true,
        ip: true,
        createdAt: true,
        user: { select: { name: true } },
      },
    }),
    prisma.dataRequest.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        id: true,
        type: true,
        entityType: true,
        entityName: true,
        status: true,
        createdAt: true,
        processedAt: true,
        requester: { select: { name: true } },
        processor: { select: { name: true } },
      },
    }),
    prisma.consentRecord.findMany({
      where: { tenantId },
      orderBy: { collectedAt: "desc" },
      take: 20,
      select: {
        id: true,
        entityType: true,
        entityName: true,
        basis: true,
        notes: true,
        collectedAt: true,
        revokedAt: true,
        collector: { select: { name: true } },
      },
    }),
  ]);

  return (
    <div className="max-w-4xl space-y-10">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <a href="/configuracoes" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Configurações
          </a>
          <span className="text-muted-foreground">/</span>
          <span className="text-sm font-medium">LGPD</span>
        </div>
        <h1 className="text-2xl font-bold">Privacidade e Dados (LGPD)</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie solicitações dos titulares, registros de consentimento e trilha de auditoria.
        </p>
      </div>

      {/* Cards de resumo */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4 text-sm">
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide mb-1">Solicitações pendentes</p>
          <p className="text-2xl font-bold">
            {dataRequests.filter((r) => r.status === "PENDENTE").length}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 text-sm">
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide mb-1">Consentimentos registrados</p>
          <p className="text-2xl font-bold">{consentRecords.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 text-sm">
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide mb-1">Eventos de auditoria</p>
          <p className="text-2xl font-bold">{auditLogs.length}</p>
        </div>
      </div>

      {/* Solicitações LGPD */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold border-b border-border pb-2">
          Solicitações de titulares (art. 18 LGPD)
        </h2>
        <DataRequestsSection requests={dataRequests} />
      </section>

      {/* Nova solicitação */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold border-b border-border pb-2">
          Registrar nova solicitação
        </h2>
        <p className="text-sm text-muted-foreground">
          Informe o ID do lead ou contato (disponível na URL da ficha) e o tipo de solicitação.
        </p>
        <CreateRequestForm />
      </section>

      {/* Consentimentos */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold border-b border-border pb-2">
          Registrar consentimento
        </h2>
        <p className="text-sm text-muted-foreground">
          Registre a base legal de tratamento de dados de um lead ou contato (art. 7º LGPD).
        </p>
        <ConsentForm />
        {consentRecords.length > 0 && (
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Titular</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Base legal</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">Coletado por</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Data</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {consentRecords.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-2.5">
                      <span className="font-medium">{c.entityName}</span>
                      <span className="ml-1 text-xs text-muted-foreground">({c.entityType})</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700">
                        {BASIS_LABELS[c.basis] ?? c.basis}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 hidden md:table-cell text-muted-foreground">{c.collector.name}</td>
                    <td className="px-4 py-2.5 text-muted-foreground text-xs">
                      {new Date(c.collectedAt).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-4 py-2.5">
                      {c.revokedAt ? (
                        <span className="text-xs text-red-600">Revogado</span>
                      ) : (
                        <span className="text-xs text-green-600">Ativo</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Trilha de auditoria */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold border-b border-border pb-2">
          Trilha de auditoria (últimos 40 eventos)
        </h2>
        <AuditLogSection logs={auditLogs} />
      </section>
    </div>
  );
}

const BASIS_LABELS: Record<string, string> = {
  CONTRATO: "Execução de contrato",
  LEGITIMO_INTERESSE: "Legítimo interesse",
  CONSENTIMENTO: "Consentimento",
  OBRIGACAO_LEGAL: "Obrigação legal",
};

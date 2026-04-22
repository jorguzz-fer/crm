import { auth } from "@/lib/auth";
import { prisma } from "@crm/db";
import type { Metadata } from "next";
import { KanbanBoard } from "@/components/pipeline/KanbanBoard";
import { NewOpportunityModal } from "@/components/pipeline/NewOpportunityModal";
import { CreatePipelineForm } from "@/components/pipeline/CreatePipelineForm";

export const metadata: Metadata = { title: "Pipeline" };

export default async function PipelinePage() {
  const session = await auth();
  const tenantId = session!.user.tenantId;

  // Busca o pipeline padrão (ou o primeiro)
  const pipeline = await prisma.pipeline.findFirst({
    where: { tenantId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    include: {
      stages: {
        orderBy: { order: "asc" },
        include: {
          opportunities: {
            where: { status: "ABERTA" },
            include: {
              assignee: { select: { name: true } },
              lead: { select: { name: true } },
            },
            orderBy: { createdAt: "desc" },
          },
        },
      },
    },
  });

  const users = await prisma.user.findMany({
    where: { tenantId, active: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const leads = await prisma.lead.findMany({
    where: { tenantId, status: { in: ["NOVO", "EM_CONTATO", "QUALIFICADO"] } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
    take: 100,
  });

  if (!pipeline) {
    return <CreatePipelineForm />;
  }

  const totalValue = pipeline.stages.flatMap((s) => s.opportunities).reduce(
    (sum, o) => sum + (o.value ? Number(o.value) : 0),
    0
  );

  const totalOpen = pipeline.stages.flatMap((s) => s.opportunities).length;

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold">{pipeline.name}</h1>
          <p className="text-sm text-muted-foreground">
            {totalOpen} oportunidade{totalOpen !== 1 ? "s" : ""} abertas
            {totalValue > 0 && (
              <> · {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totalValue)}</>
            )}
          </p>
        </div>
        <NewOpportunityModal
          stages={pipeline.stages.map((s) => ({ id: s.id, name: s.name }))}
          users={users}
          leads={leads}
        />
      </div>

      <KanbanBoard pipeline={pipeline} />
    </div>
  );
}

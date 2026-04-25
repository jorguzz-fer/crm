import { auth } from "@/lib/auth";
import { prisma } from "@crm/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowLeft, DollarSign, Calendar, User, Target, Kanban, CheckSquare,
} from "lucide-react";
import { deleteOpportunityAction } from "@/app/actions/opportunities";
import { OpportunityStatusForm } from "@/components/pipeline/OpportunityStatusForm";
import { AddOpportunityNoteForm } from "@/components/pipeline/AddOpportunityNoteForm";
import { SummarizeButton } from "@/components/ai/SummarizeButton";
import { summarizeOpportunityAction } from "@/app/actions/ai";
import { EntityAttachments } from "@/components/attachments/EntityAttachments";
import type { AttachmentItem } from "@/components/attachments/AttachmentList";

const ACTIVITY_LABELS: Record<string, string> = {
  LIGACAO: "Ligação", EMAIL: "E-mail", REUNIAO: "Reunião",
  WHATSAPP: "WhatsApp", VISITA: "Visita", OUTRO: "Outro",
};

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  ABERTA:  { label: "Aberta",  className: "bg-blue-100 text-blue-700" },
  GANHA:   { label: "Ganha",   className: "bg-green-100 text-green-700" },
  PERDIDA: { label: "Perdida", className: "bg-red-100 text-red-700" },
};

const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const opp = await prisma.opportunity.findUnique({ where: { id }, select: { title: true } });
  return { title: opp?.title ?? "Oportunidade" };
}

export default async function OpportunityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const { id } = await params;

  const opp = await prisma.opportunity.findFirst({
    where: { id, tenantId: session!.user.tenantId },
    include: {
      stage:   { select: { id: true, name: true, color: true } },
      lead:    { select: { id: true, name: true } },
      company: { select: { id: true, name: true } },
      contact: { select: { id: true, name: true } },
      assignee:{ select: { name: true } },
      notes: {
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      },
      activities: {
        include: { user: { select: { name: true } } },
        orderBy: { occurredAt: "desc" },
        take: 30,
      },
      tasks: {
        include: { assignee: { select: { name: true } } },
        where: { completedAt: null },
        orderBy: { dueAt: "asc" },
      },
      attachments: {
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!opp) notFound();

  const status = STATUS_STYLES[opp.status] ?? STATUS_STYLES.ABERTA;

  // Merge notes + activities into a single timeline sorted by date desc
  type TimelineItem =
    | { kind: "note"; id: string; content: string; author: string; date: Date }
    | { kind: "activity"; id: string; subject: string; description: string | null; type: string; author: string; date: Date };

  const timeline: TimelineItem[] = [
    ...opp.notes.map((n) => ({
      kind: "note" as const,
      id: n.id,
      content: n.content,
      author: n.user.name,
      date: n.createdAt,
    })),
    ...opp.activities.map((a) => ({
      kind: "activity" as const,
      id: a.id,
      subject: a.subject,
      description: a.description,
      type: a.type,
      author: a.user.name,
      date: a.occurredAt,
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  const isOverdue =
    opp.status === "ABERTA" &&
    opp.expectedCloseAt &&
    opp.expectedCloseAt < new Date();

  const canManage = ["SUPERADMIN", "ADMIN", "SUPERVISOR"].includes(session!.user.role);
  const isOwner   = opp.assignedTo === session!.user.id;

  const attachmentItems: AttachmentItem[] = opp.attachments.map((a) => ({
    id:        a.id,
    filename:  a.filename,
    mimeType:  a.mimeType,
    size:      a.size,
    createdAt: a.createdAt.toISOString(),
    user:      a.user ? { name: a.user.name } : undefined,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <Link href="/pipeline" className="mt-1 text-muted-foreground hover:text-foreground">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold">{opp.title}</h1>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${status.className}`}>
                {status.label}
              </span>
            </div>
            {opp.stage && (
              <div className="flex items-center gap-1.5 mt-1">
                <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: opp.stage.color }} />
                <span className="text-sm text-muted-foreground">{opp.stage.name}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <OpportunityStatusForm opportunityId={opp.id} currentStatus={opp.status} />
          <form action={deleteOpportunityAction}>
            <input type="hidden" name="id" value={opp.id} />
            <button
              type="submit"
              className="rounded-md border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              Excluir
            </button>
          </form>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: info cards */}
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Informações</h2>

            {opp.value && (
              <div className="flex items-center gap-2 text-sm">
                <DollarSign size={14} className="text-muted-foreground shrink-0" />
                <span className="font-semibold text-green-600">{fmt.format(Number(opp.value))}</span>
              </div>
            )}

            {opp.probability > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  <Target size={14} className="text-muted-foreground shrink-0" />
                  <span>{opp.probability}% probabilidade</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary/70"
                    style={{ width: `${opp.probability}%` }}
                  />
                </div>
              </div>
            )}

            {opp.expectedCloseAt && (
              <div className={`flex items-center gap-2 text-sm ${isOverdue ? "text-amber-600" : ""}`}>
                <Calendar size={14} className="shrink-0" />
                <span>
                  Previsto:{" "}
                  {opp.expectedCloseAt.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
                  {isOverdue && " · vencida"}
                </span>
              </div>
            )}

            {opp.closedAt && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar size={14} className="shrink-0" />
                <span>
                  Fechada em{" "}
                  {opp.closedAt.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
                </span>
              </div>
            )}

            {opp.lead && (
              <div className="flex items-center gap-2 text-sm">
                <User size={14} className="text-muted-foreground shrink-0" />
                <Link href={`/leads/${opp.lead.id}`} className="hover:text-primary">
                  {opp.lead.name}
                </Link>
              </div>
            )}

            {opp.assignee && (
              <div className="flex items-center gap-2 text-sm">
                <User size={14} className="text-muted-foreground shrink-0" />
                <span>{opp.assignee.name}</span>
              </div>
            )}

            {opp.stage && (
              <div className="flex items-center gap-2 text-sm">
                <Kanban size={14} className="text-muted-foreground shrink-0" />
                <span>{opp.stage.name}</span>
              </div>
            )}

            <div className="pt-1 border-t border-border text-xs text-muted-foreground">
              Criada em {opp.createdAt.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
            </div>
          </div>

          {opp.tasks.length > 0 && (
            <div className="rounded-lg border border-border bg-card p-4 space-y-2">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tarefas pendentes</h2>
              {opp.tasks.map((task) => (
                <div key={task.id} className="flex items-start gap-2 text-sm">
                  <CheckSquare size={14} className="mt-0.5 text-primary shrink-0" />
                  <div>
                    <p>{task.title}</p>
                    {task.dueAt && (
                      <p className="text-xs text-muted-foreground">Vence {task.dueAt.toLocaleDateString("pt-BR")}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Anexos */}
          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Anexos</h2>
            <EntityAttachments
              entityType="opportunity"
              entityId={opp.id}
              initialAttachments={attachmentItems}
              canDelete={canManage || isOwner}
            />
          </div>
        </div>

        {/* Right: timeline */}
        <div className="lg:col-span-2 space-y-4">
          <SummarizeButton
            action={summarizeOpportunityAction}
            fieldName="opportunityId"
            entityId={opp.id}
          />
          <AddOpportunityNoteForm opportunityId={opp.id} />

          <div className="rounded-lg border border-border bg-card">
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold">Timeline</h2>
            </div>
            {timeline.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Nenhuma atividade ainda. Adicione uma nota acima.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {timeline.map((item) =>
                  item.kind === "note" ? (
                    <div key={item.id} className="px-4 py-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium">{item.author}</span>
                        <span className="text-xs text-muted-foreground">
                          {item.date.toLocaleDateString("pt-BR", {
                            day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{item.content}</p>
                    </div>
                  ) : (
                    <div key={item.id} className="px-4 py-3 bg-muted/20">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-muted-foreground">
                          {ACTIVITY_LABELS[item.type] ?? item.type} · {item.author}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {item.date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                        </span>
                      </div>
                      <p className="text-sm font-medium">{item.subject}</p>
                      {item.description && (
                        <p className="text-sm text-muted-foreground mt-0.5">{item.description}</p>
                      )}
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

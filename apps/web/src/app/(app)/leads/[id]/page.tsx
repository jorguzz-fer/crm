import { auth } from "@/lib/auth";
import { prisma } from "@crm/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, Pencil, Mail, Phone, Building2, Tag, User } from "lucide-react";
import { LeadStatusBadge } from "@/components/leads/LeadStatusBadge";
import { AddNoteForm } from "@/components/leads/AddNoteForm";
import { deleteLeadAction } from "@/app/actions/leads";
import { SummarizeButton } from "@/components/ai/SummarizeButton";
import { summarizeLeadAction } from "@/app/actions/ai";

const SOURCE_LABELS: Record<string, string> = {
  WEBSITE: "Website", WHATSAPP: "WhatsApp", INSTAGRAM: "Instagram",
  FACEBOOK: "Facebook", INDICACAO: "Indicação", EVENTO: "Evento",
  COLD_OUTREACH: "Prospecção", OUTRO: "Outro",
};

const ACTIVITY_LABELS: Record<string, string> = {
  LIGACAO: "Ligação", EMAIL: "E-mail", REUNIAO: "Reunião",
  WHATSAPP: "WhatsApp", VISITA: "Visita", OUTRO: "Outro",
};

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const lead = await prisma.lead.findUnique({ where: { id }, select: { name: true } });
  return { title: lead?.name ?? "Lead" };
}

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const { id } = await params;

  const lead = await prisma.lead.findFirst({
    where: { id, tenantId: session!.user.tenantId },
    include: {
      assignee: { select: { name: true } },
      notes: {
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      },
      activities: {
        include: { user: { select: { name: true } } },
        orderBy: { occurredAt: "desc" },
        take: 20,
      },
      tasks: {
        include: { assignee: { select: { name: true } } },
        orderBy: { dueAt: "asc" },
        where: { completedAt: null },
      },
    },
  });

  if (!lead) notFound();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Link href="/leads" className="mt-1 text-muted-foreground hover:text-foreground">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold">{lead.name}</h1>
              <LeadStatusBadge status={lead.status} />
            </div>
            {lead.company && <p className="text-sm text-muted-foreground">{lead.company}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href={`/leads/${lead.id}/edit`}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-accent"
          >
            <Pencil size={14} />
            Editar
          </Link>
          <form action={deleteLeadAction}>
            <input type="hidden" name="id" value={lead.id} />
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
        {/* Info */}
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Informações</h2>
            {lead.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail size={14} className="text-muted-foreground shrink-0" />
                <a href={`mailto:${lead.email}`} className="hover:text-primary truncate">{lead.email}</a>
              </div>
            )}
            {lead.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone size={14} className="text-muted-foreground shrink-0" />
                <a href={`tel:${lead.phone}`} className="hover:text-primary">{lead.phone}</a>
              </div>
            )}
            {lead.company && (
              <div className="flex items-center gap-2 text-sm">
                <Building2 size={14} className="text-muted-foreground shrink-0" />
                <span>{lead.company}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm">
              <Tag size={14} className="text-muted-foreground shrink-0" />
              <span>{SOURCE_LABELS[lead.source] ?? lead.source}</span>
            </div>
            {lead.assignee && (
              <div className="flex items-center gap-2 text-sm">
                <User size={14} className="text-muted-foreground shrink-0" />
                <span>{lead.assignee.name}</span>
              </div>
            )}
            <div className="pt-1 border-t border-border text-xs text-muted-foreground">
              Criado em {lead.createdAt.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
            </div>
          </div>

          {lead.tasks.length > 0 && (
            <div className="rounded-lg border border-border bg-card p-4 space-y-2">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tarefas pendentes</h2>
              {lead.tasks.map((task) => (
                <div key={task.id} className="flex items-start gap-2 text-sm">
                  <div className="mt-0.5 h-3.5 w-3.5 rounded-sm border-2 border-primary shrink-0" />
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
        </div>

        {/* Timeline */}
        <div className="lg:col-span-2 space-y-4">
          <SummarizeButton
            action={summarizeLeadAction}
            fieldName="leadId"
            entityId={lead.id}
          />
          <AddNoteForm leadId={lead.id} />

          <div className="rounded-lg border border-border bg-card">
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold">Timeline</h2>
            </div>
            {lead.notes.length === 0 && lead.activities.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Nenhuma atividade ainda. Adicione uma nota acima.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {lead.notes.map((note) => (
                  <div key={note.id} className="px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium">{note.user.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {note.createdAt.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                  </div>
                ))}
                {lead.activities.map((act) => (
                  <div key={act.id} className="px-4 py-3 bg-muted/20">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-muted-foreground">
                        {ACTIVITY_LABELS[act.type] ?? act.type} · {act.user.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {act.occurredAt.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                      </span>
                    </div>
                    <p className="text-sm font-medium">{act.subject}</p>
                    {act.description && <p className="text-sm text-muted-foreground mt-0.5">{act.description}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

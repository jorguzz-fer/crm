import { auth } from "@/lib/auth";
import { prisma } from "@crm/db";
import type { Metadata } from "next";
import { CalendarView } from "@/components/agenda/CalendarView";
import type { CalendarEvent } from "@/components/agenda/CalendarView";

export const metadata: Metadata = { title: "Agenda" };

// Cores por tipo de atividade
const ACTIVITY_COLOR: Record<string, string> = {
  LIGACAO:  "#8b5cf6",
  EMAIL:    "#6366f1",
  REUNIAO:  "#0ea5e9",
  WHATSAPP: "#22c55e",
  VISITA:   "#f59e0b",
  OUTRO:    "#94a3b8",
};

const PRIORITY_COLOR: Record<string, string> = {
  URGENTE: "#ef4444",
  ALTA:    "#f97316",
  MEDIA:   "#3b82f6",
  BAIXA:   "#94a3b8",
};

export default async function AgendaPage() {
  const session = await auth();
  const tenantId = session!.user.tenantId;

  const now = new Date();
  const past = new Date(now);
  past.setDate(past.getDate() - 60);
  const future = new Date(now);
  future.setDate(future.getDate() + 90);

  const [tasks, activities] = await Promise.all([
    prisma.task.findMany({
      where: {
        tenantId,
        dueAt: { gte: past, lte: future },
        completedAt: null,
      },
      include: {
        assignee: { select: { name: true } },
        lead: { select: { id: true, name: true } },
        opportunity: { select: { id: true, title: true } },
      },
      orderBy: { dueAt: "asc" },
    }),
    prisma.activity.findMany({
      where: {
        tenantId,
        occurredAt: { gte: past, lte: future },
      },
      include: {
        user: { select: { name: true } },
        lead: { select: { id: true, name: true } },
        opportunity: { select: { id: true, title: true } },
      },
      orderBy: { occurredAt: "asc" },
      take: 500,
    }),
  ]);

  const events: CalendarEvent[] = [
    ...tasks.map((task) => {
      const overdue = task.dueAt ? task.dueAt < now : false;
      const related = task.lead?.name ?? task.opportunity?.title;
      const url = task.lead
        ? `/leads/${task.lead.id}`
        : task.opportunity
          ? `/pipeline/${task.opportunity.id}`
          : undefined;

      return {
        id: `task-${task.id}`,
        title: task.title,
        start: (task.dueAt ?? now).toISOString(),
        allDay: true,
        color: overdue ? "#ef4444" : PRIORITY_COLOR[task.priority] ?? "#3b82f6",
        textColor: "#ffffff",
        url,
        extendedProps: {
          type: "task" as const,
          subType: task.priority,
          relatedName: related ?? undefined,
          overdue,
        },
      };
    }),

    ...activities.map((act) => {
      const related = act.lead?.name ?? act.opportunity?.title;
      const url = act.lead
        ? `/leads/${act.lead.id}`
        : act.opportunity
          ? `/pipeline/${act.opportunity.id}`
          : undefined;

      return {
        id: `activity-${act.id}`,
        title: act.subject,
        start: act.occurredAt.toISOString(),
        allDay: false,
        color: ACTIVITY_COLOR[act.type] ?? "#94a3b8",
        textColor: "#ffffff",
        url,
        extendedProps: {
          type: "activity" as const,
          subType: act.type,
          relatedName: related ?? undefined,
        },
      };
    }),
  ];

  const tasksDueToday = tasks.filter((t) => {
    if (!t.dueAt) return false;
    const d = t.dueAt;
    return d.getFullYear() === now.getFullYear()
      && d.getMonth() === now.getMonth()
      && d.getDate() === now.getDate();
  }).length;

  const tasksOverdue = tasks.filter((t) => t.dueAt && t.dueAt < now).length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Agenda</h1>
          <p className="text-sm text-muted-foreground">
            {tasksDueToday > 0
              ? `${tasksDueToday} tarefa${tasksDueToday > 1 ? "s" : ""} para hoje`
              : "Sem tarefas para hoje"}
            {tasksOverdue > 0 && ` · ${tasksOverdue} em atraso`}
          </p>
        </div>

        {/* Legenda */}
        <div className="hidden lg:flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {[
            { label: "Reunião", color: "#0ea5e9" },
            { label: "Ligação", color: "#8b5cf6" },
            { label: "WhatsApp", color: "#22c55e" },
            { label: "Visita", color: "#f59e0b" },
            { label: "Tarefa", color: "#3b82f6" },
            { label: "Atrasada", color: "#ef4444" },
          ].map(({ label, color }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color }} />
              {label}
            </div>
          ))}
        </div>
      </div>

      <CalendarView events={events} />
    </div>
  );
}

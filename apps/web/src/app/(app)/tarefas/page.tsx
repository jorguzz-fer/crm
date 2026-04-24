import { auth } from "@/lib/auth";
import { prisma } from "@crm/db";
import Link from "next/link";
import type { Metadata } from "next";
import { CheckSquare, AlertCircle, Clock } from "lucide-react";
import { completeTaskAction, deleteTaskAction } from "@/app/actions/tasks";
import { CreateTaskForm } from "@/components/tarefas/CreateTaskForm";
import { TaskFilters } from "@/components/tarefas/TaskFilters";

export const metadata: Metadata = { title: "Tarefas" };

const PRIORITY_STYLE: Record<string, string> = {
  URGENTE: "bg-red-100 text-red-700",
  ALTA:    "bg-orange-100 text-orange-700",
  MEDIA:   "bg-blue-100 text-blue-700",
  BAIXA:   "bg-zinc-100 text-zinc-500",
};

const PRIORITY_LABEL: Record<string, string> = {
  URGENTE: "Urgente", ALTA: "Alta", MEDIA: "Média", BAIXA: "Baixa",
};

interface Props {
  searchParams: Promise<{ status?: string; priority?: string; assignedTo?: string }>;
}

export default async function TarefasPage({ searchParams }: Props) {
  const session = await auth();
  const params = await searchParams;
  const tenantId = session!.user.tenantId;

  const filterStatus = params.status ?? "pendentes";
  const filterPriority = params.priority ?? "";
  const filterAssignedTo = params.assignedTo ?? "";

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const where = {
    tenantId,
    ...(filterStatus === "pendentes" && { completedAt: null }),
    ...(filterStatus === "concluidas" && { completedAt: { not: null } }),
    ...(filterStatus === "atrasadas" && { completedAt: null, dueAt: { lt: startOfToday } }),
    ...(filterStatus === "hoje" && {
      completedAt: null,
      dueAt: { gte: startOfToday, lt: new Date(startOfToday.getTime() + 86400000) },
    }),
    ...(filterPriority && { priority: filterPriority as never }),
    ...(filterAssignedTo && { assignedTo: filterAssignedTo }),
  };

  const [tasks, users, leads, opportunities] = await Promise.all([
    prisma.task.findMany({
      where,
      include: {
        assignee: { select: { name: true } },
        lead: { select: { id: true, name: true } },
        opportunity: { select: { id: true, title: true } },
      },
      orderBy: [{ completedAt: "asc" }, { dueAt: "asc" }, { createdAt: "desc" }],
      take: 100,
    }),
    prisma.user.findMany({
      where: { tenantId, active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.lead.findMany({
      where: { tenantId, status: { not: "CONVERTIDO" } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 100,
    }),
    prisma.opportunity.findMany({
      where: { tenantId, status: "ABERTA" },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
      take: 100,
    }),
  ]);

  const counts = await Promise.all([
    prisma.task.count({ where: { tenantId, completedAt: null } }),
    prisma.task.count({ where: { tenantId, completedAt: null, dueAt: { lt: startOfToday } } }),
    prisma.task.count({
      where: {
        tenantId, completedAt: null,
        dueAt: { gte: startOfToday, lt: new Date(startOfToday.getTime() + 86400000) },
      },
    }),
  ]);

  const [totalPendentes, totalAtrasadas, totalHoje] = counts;

  const FILTERS = [
    { value: "pendentes", label: "Pendentes", count: totalPendentes },
    { value: "hoje",      label: "Hoje",      count: totalHoje },
    { value: "atrasadas", label: "Atrasadas", count: totalAtrasadas },
    { value: "concluidas",label: "Concluídas",count: null },
  ];

  function buildUrl(overrides: Record<string, string>) {
    const p = new URLSearchParams({
      status: filterStatus,
      ...(filterPriority && { priority: filterPriority }),
      ...(filterAssignedTo && { assignedTo: filterAssignedTo }),
      ...overrides,
    });
    return `/tarefas?${p.toString()}`;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Tarefas</h1>
        <p className="text-sm text-muted-foreground">
          {totalPendentes} pendente{totalPendentes !== 1 ? "s" : ""}
          {totalAtrasadas > 0 && (
            <span className="text-amber-600"> · {totalAtrasadas} em atraso</span>
          )}
        </p>
      </div>

      {/* Status tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={buildUrl({ status: f.value })}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              filterStatus === f.value
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.label}
            {f.count !== null && f.count > 0 && (
              <span className={`rounded-full px-1.5 py-0.5 text-xs ${
                f.value === "atrasadas"
                  ? "bg-amber-100 text-amber-700"
                  : "bg-muted text-muted-foreground"
              }`}>
                {f.count}
              </span>
            )}
          </Link>
        ))}

        <div className="ml-auto flex items-center gap-2 pb-1">
          <TaskFilters
            users={users}
            filterPriority={filterPriority}
            filterAssignedTo={filterAssignedTo}
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Lista */}
        <div className="lg:col-span-2 space-y-2">
          {tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border p-12 text-center">
              <CheckSquare size={32} className="text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">
                {filterStatus === "concluidas" ? "Nenhuma tarefa concluída." : "Nenhuma tarefa encontrada."}
              </p>
            </div>
          ) : (
            tasks.map((task) => {
              const overdue = !task.completedAt && task.dueAt && task.dueAt < startOfToday;
              const dueToday = !task.completedAt && task.dueAt
                && task.dueAt >= startOfToday
                && task.dueAt < new Date(startOfToday.getTime() + 86400000);

              return (
                <div
                  key={task.id}
                  className={`group rounded-lg border bg-card p-4 transition-colors ${
                    task.completedAt
                      ? "border-border opacity-60"
                      : overdue
                        ? "border-amber-200 bg-amber-50/30"
                        : "border-border hover:border-primary/30"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Complete button */}
                    <form action={completeTaskAction} className="mt-0.5 shrink-0">
                      <input type="hidden" name="id" value={task.id} />
                      <button
                        type="submit"
                        title={task.completedAt ? "Reabrir" : "Concluir"}
                        className={`h-4.5 w-4.5 rounded border-2 transition-colors flex items-center justify-center ${
                          task.completedAt
                            ? "border-primary bg-primary"
                            : "border-muted-foreground/40 hover:border-primary"
                        }`}
                      >
                        {task.completedAt && (
                          <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 10 10" fill="none">
                            <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </button>
                    </form>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2 flex-wrap">
                        <p className={`text-sm font-medium ${task.completedAt ? "line-through text-muted-foreground" : ""}`}>
                          {task.title}
                        </p>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_STYLE[task.priority]}`}>
                          {PRIORITY_LABEL[task.priority]}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                        {task.dueAt && (
                          <span className={`flex items-center gap-1 ${overdue ? "text-amber-600 font-medium" : dueToday ? "text-blue-600 font-medium" : ""}`}>
                            {overdue ? <AlertCircle size={11} /> : <Clock size={11} />}
                            {overdue ? "Venceu " : dueToday ? "Vence hoje " : ""}
                            {task.dueAt.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                            {" "}
                            {task.dueAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        )}
                        <span>{task.assignee.name}</span>
                        {task.lead && (
                          <Link href={`/leads/${task.lead.id}`} className="hover:text-primary">
                            {task.lead.name}
                          </Link>
                        )}
                        {task.opportunity && (
                          <Link href={`/pipeline/${task.opportunity.id}`} className="hover:text-primary">
                            {task.opportunity.title}
                          </Link>
                        )}
                      </div>
                    </div>

                    {/* Delete */}
                    <form action={deleteTaskAction} className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <input type="hidden" name="id" value={task.id} />
                      <button
                        type="submit"
                        title="Excluir tarefa"
                        className="text-muted-foreground/50 hover:text-destructive text-xs px-1"
                      >
                        ×
                      </button>
                    </form>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Form de nova tarefa */}
        <div>
          <CreateTaskForm
            users={users}
            currentUserId={session!.user.id}
            leads={leads}
            opportunities={opportunities}
          />
        </div>
      </div>
    </div>
  );
}

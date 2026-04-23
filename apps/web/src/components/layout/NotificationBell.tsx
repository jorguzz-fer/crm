import { auth } from "@/lib/auth";
import { prisma } from "@crm/db";
import { NotificationDropdown, type AlertNotif, type TaskNotif } from "./NotificationDropdown";

export async function NotificationBell() {
  const session = await auth();
  if (!session) return null;

  const tenantId = session.user.tenantId;
  const userId   = session.user.id;
  const isManager = ["SUPERADMIN", "ADMIN", "SUPERVISOR"].includes(session.user.role);

  const now        = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo    = new Date(now.getTime() - 7 * 86400000);

  const [rawAlerts, rawTasks] = await Promise.all([
    // Follow-up alerts não dispensados (últimos 7 dias)
    prisma.aiFollowUpAlert.findMany({
      where: {
        tenantId,
        dismissed: false,
        createdAt: { gte: weekAgo },
        // vendedores só veem alertas dos seus próprios leads
        ...(isManager ? {} : { lead: { assignedTo: userId } }),
      },
      orderBy: [{ daysStale: "desc" }, { createdAt: "desc" }],
      take: 10,
      select: {
        id: true,
        leadId: true,
        message: true,
        daysStale: true,
        lead: { select: { name: true } },
      },
    }),
    // Tarefas atrasadas
    prisma.task.findMany({
      where: {
        tenantId,
        completedAt: null,
        dueAt: { lt: todayStart },
        // vendedores só veem as próprias tarefas atrasadas
        ...(isManager ? {} : { assignedTo: userId }),
      },
      orderBy: { dueAt: "asc" },
      take: 10,
      select: {
        id: true,
        title: true,
        dueAt: true,
        leadId: true,
        opportunityId: true,
      },
    }),
  ]);

  const alerts: AlertNotif[] = rawAlerts
    .filter((a): a is typeof a & { leadId: string; daysStale: number } =>
      a.leadId !== null && a.daysStale !== null
    )
    .map((a) => ({
      id:        a.id,
      type:      "follow_up" as const,
      leadId:    a.leadId,
      leadName:  a.lead?.name ?? null,
      message:   a.message,
      daysStale: a.daysStale,
    }));

  const overdueTasks: TaskNotif[] = rawTasks.map((t) => ({
    id:            t.id,
    type:          "overdue_task",
    title:         t.title,
    dueAt:         t.dueAt ? t.dueAt.toISOString() : new Date().toISOString(),
    leadId:        t.leadId,
    opportunityId: t.opportunityId,
  }));

  return <NotificationDropdown alerts={alerts} overdueTasks={overdueTasks} />;
}

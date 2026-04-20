"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@crm/db";
import { requireRole, ROLES_WRITE, ROLES_MANAGE } from "@/lib/authz";
import { logAudit } from "@/lib/audit";
import { createTaskSchema } from "@crm/validators";

export type ActionState = { error: string } | { success: true } | null;

export async function createTaskAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { session, error } = await requireRole(ROLES_WRITE);
  if (error) return { error: "Sem permissão" };

  const raw = {
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    dueAt: formData.get("dueAt") || undefined,
    priority: formData.get("priority") || "MEDIA",
    assignedTo: formData.get("assignedTo") || session!.user.id,
    leadId: formData.get("leadId") || undefined,
    opportunityId: formData.get("opportunityId") || undefined,
  };

  const parsed = createTaskSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const data = parsed.data;
  const tenantId = session!.user.tenantId;

  // Valida assignedTo pertence ao tenant
  const assignee = await prisma.user.findFirst({
    where: { id: data.assignedTo, tenantId },
    select: { id: true },
  });
  if (!assignee) return { error: "Responsável inválido" };

  const task = await prisma.task.create({
    data: {
      tenantId,
      title: data.title,
      description: data.description || null,
      dueAt: data.dueAt ? new Date(data.dueAt) : null,
      priority: data.priority,
      assignedTo: data.assignedTo,
      leadId: data.leadId || null,
      opportunityId: data.opportunityId || null,
    },
  });

  await logAudit({
    tenantId,
    userId: session!.user.id,
    action: "task.create",
    entity: "Task",
    entityId: task.id,
    meta: { title: task.title, priority: task.priority },
  });

  revalidatePath("/tarefas");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function completeTaskAction(formData: FormData): Promise<void> {
  const { session, error } = await requireRole(ROLES_WRITE);
  if (error) return;

  const id = formData.get("id") as string;
  if (!id) return;

  const tenantId = session!.user.tenantId;
  const task = await prisma.task.findFirst({
    where: { id, tenantId },
    select: { id: true, title: true, completedAt: true },
  });
  if (!task) return;

  await prisma.task.update({
    where: { id },
    data: { completedAt: task.completedAt ? null : new Date() }, // toggle
  });

  await logAudit({
    tenantId,
    userId: session!.user.id,
    action: task.completedAt ? "task.reopen" : "task.complete",
    entity: "Task",
    entityId: id,
    meta: { title: task.title },
  });

  revalidatePath("/tarefas");
  revalidatePath("/dashboard");
}

export async function deleteTaskAction(formData: FormData): Promise<void> {
  const { session, error } = await requireRole(ROLES_MANAGE);
  if (error) return;

  const id = formData.get("id") as string;
  const returnTo = (formData.get("returnTo") as string) || "/tarefas";
  if (!id) return;

  const tenantId = session!.user.tenantId;
  const task = await prisma.task.findFirst({
    where: { id, tenantId },
    select: { id: true, title: true },
  });
  if (!task) return;

  await prisma.task.delete({ where: { id } });

  await logAudit({
    tenantId,
    userId: session!.user.id,
    action: "task.delete",
    entity: "Task",
    entityId: id,
    meta: { title: task.title },
  });

  revalidatePath("/tarefas");
  revalidatePath("/dashboard");
  if (returnTo !== "/tarefas") redirect(returnTo);
}

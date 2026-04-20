"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@crm/db";
import { requireRole, ROLES_WRITE, ROLES_MANAGE } from "@/lib/authz";
import { logAudit } from "@/lib/audit";
import { createActivitySchema } from "@crm/validators";

export type ActionState = { error: string } | { success: true } | null;

export async function createActivityAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { session, error } = await requireRole(ROLES_WRITE);
  if (error) return { error: "Sem permissão" };

  const raw = {
    type: formData.get("type"),
    subject: formData.get("subject"),
    description: formData.get("description") || undefined,
    duration: formData.get("duration") || undefined,
    occurredAt: formData.get("occurredAt") || new Date().toISOString(),
    leadId: formData.get("leadId") || undefined,
    opportunityId: formData.get("opportunityId") || undefined,
    companyId: formData.get("companyId") || undefined,
  };

  const parsed = createActivitySchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const data = parsed.data;
  const tenantId = session!.user.tenantId;

  // Validações cross-tenant
  if (data.leadId) {
    const lead = await prisma.lead.findFirst({ where: { id: data.leadId, tenantId }, select: { id: true } });
    if (!lead) return { error: "Lead inválido" };
  }
  if (data.opportunityId) {
    const opp = await prisma.opportunity.findFirst({ where: { id: data.opportunityId, tenantId }, select: { id: true } });
    if (!opp) return { error: "Oportunidade inválida" };
  }

  const activity = await prisma.activity.create({
    data: {
      tenantId,
      userId: session!.user.id,
      type: data.type,
      subject: data.subject,
      description: data.description || null,
      duration: data.duration ?? null,
      occurredAt: data.occurredAt ? new Date(data.occurredAt) : new Date(),
      leadId: data.leadId || null,
      opportunityId: data.opportunityId || null,
      companyId: data.companyId || null,
    },
  });

  await logAudit({
    tenantId,
    userId: session!.user.id,
    action: "activity.create",
    entity: "Activity",
    entityId: activity.id,
    meta: { type: activity.type, subject: activity.subject },
  });

  revalidatePath("/atividades");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function deleteActivityAction(formData: FormData): Promise<void> {
  const { session, error } = await requireRole(ROLES_MANAGE);
  if (error) return;

  const id = formData.get("id") as string;
  if (!id) return;

  const tenantId = session!.user.tenantId;
  const activity = await prisma.activity.findFirst({
    where: { id, tenantId },
    select: { id: true, type: true, subject: true },
  });
  if (!activity) return;

  await prisma.activity.delete({ where: { id } });

  await logAudit({
    tenantId,
    userId: session!.user.id,
    action: "activity.delete",
    entity: "Activity",
    entityId: id,
    meta: { type: activity.type, subject: activity.subject },
  });

  revalidatePath("/atividades");
  revalidatePath("/dashboard");
}

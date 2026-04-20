"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@crm/db";
import { requireRole, ROLES_WRITE, ROLES_MANAGE } from "@/lib/authz";
import { logAudit } from "@/lib/audit";
import { createOpportunitySchema, moveOpportunitySchema } from "@crm/validators";

export type ActionState = { error: string } | { success: true } | null;

export async function createOpportunityAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { session, error } = await requireRole(ROLES_WRITE);
  if (error) return { error: "Sem permissão" };

  const raw = {
    title: formData.get("title"),
    pipelineId: formData.get("pipelineId"),
    stageId: formData.get("stageId"),
    value: formData.get("value") || undefined,
    probability: formData.get("probability") || 0,
    expectedCloseAt: formData.get("expectedCloseAt") || undefined,
    leadId: formData.get("leadId") || undefined,
    companyId: formData.get("companyId") || undefined,
    contactId: formData.get("contactId") || undefined,
    assignedTo: formData.get("assignedTo") || undefined,
  };

  const parsed = createOpportunitySchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const data = parsed.data;
  const tenantId = session!.user.tenantId;

  // Valida stage pertence ao tenant
  const stage = await prisma.stage.findFirst({
    where: { id: data.stageId, tenantId },
    select: { id: true, pipelineId: true },
  });
  if (!stage) return { error: "Estágio inválido" };

  if (data.leadId) {
    const lead = await prisma.lead.findFirst({ where: { id: data.leadId, tenantId }, select: { id: true } });
    if (!lead) return { error: "Lead inválido" };
  }

  const opp = await prisma.opportunity.create({
    data: {
      tenantId,
      pipelineId: stage.pipelineId,
      stageId: data.stageId,
      title: data.title,
      value: data.value ?? null,
      probability: data.probability,
      expectedCloseAt: data.expectedCloseAt ? new Date(data.expectedCloseAt) : null,
      leadId: data.leadId || null,
      companyId: data.companyId || null,
      contactId: data.contactId || null,
      assignedTo: data.assignedTo || null,
    },
  });

  await logAudit({
    tenantId,
    userId: session!.user.id,
    action: "opportunity.create",
    entity: "Opportunity",
    entityId: opp.id,
    meta: { title: opp.title, stageId: opp.stageId },
  });

  revalidatePath("/pipeline");
  return { success: true };
}

export async function moveOpportunityAction(
  opportunityId: string,
  stageId: string
): Promise<void> {
  const { session, error } = await requireRole(ROLES_WRITE);
  if (error) return;

  const tenantId = session!.user.tenantId;

  const [opp, stage] = await Promise.all([
    prisma.opportunity.findFirst({ where: { id: opportunityId, tenantId }, select: { id: true, stageId: true } }),
    prisma.stage.findFirst({ where: { id: stageId, tenantId }, select: { id: true } }),
  ]);

  if (!opp || !stage || opp.stageId === stageId) return;

  await prisma.opportunity.update({
    where: { id: opportunityId },
    data: { stageId },
  });

  await logAudit({
    tenantId,
    userId: session!.user.id,
    action: "opportunity.move",
    entity: "Opportunity",
    entityId: opportunityId,
    meta: { fromStage: opp.stageId, toStage: stageId },
  });

  revalidatePath("/pipeline");
}

export async function deleteOpportunityAction(formData: FormData): Promise<void> {
  const { session, error } = await requireRole(ROLES_MANAGE);
  if (error) return;

  const id = formData.get("id") as string;
  if (!id) return;

  const opp = await prisma.opportunity.findFirst({
    where: { id, tenantId: session!.user.tenantId },
    select: { id: true, title: true },
  });
  if (!opp) return;

  await prisma.opportunity.delete({ where: { id } });

  await logAudit({
    tenantId: session!.user.tenantId,
    userId: session!.user.id,
    action: "opportunity.delete",
    entity: "Opportunity",
    entityId: id,
    meta: { title: opp.title },
  });

  revalidatePath("/pipeline");
  redirect("/pipeline");
}

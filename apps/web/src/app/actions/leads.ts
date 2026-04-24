"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@crm/db";
import { requireRole, ROLES_WRITE, ROLES_MANAGE } from "@/lib/authz";
import { logAudit } from "@/lib/audit";
import { createLeadSchema, updateLeadSchema } from "@crm/validators";

export type ActionState = { error: string } | { success: true } | null;

export async function createLeadAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { session, error } = await requireRole(ROLES_WRITE);
  if (error) return { error: "Sem permissão" };

  const raw = {
    name: formData.get("name"),
    email: formData.get("email") || undefined,
    phone: formData.get("phone") || undefined,
    company: formData.get("company") || undefined,
    source: formData.get("source") || "OUTRO",
    status: formData.get("status") || "NOVO",
    assignedTo: formData.get("assignedTo") || undefined,
    companyId: formData.get("companyId") || undefined,
  };

  const parsed = createLeadSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const data = parsed.data;

  if (data.assignedTo) {
    const user = await prisma.user.findFirst({
      where: { id: data.assignedTo, tenantId: session!.user.tenantId },
      select: { id: true },
    });
    if (!user) return { error: "Usuário inválido" };
  }

  if (data.companyId) {
    const co = await prisma.company.findFirst({
      where: { id: data.companyId, tenantId: session!.user.tenantId },
      select: { id: true },
    });
    if (!co) return { error: "Empresa inválida" };
  }

  const lead = await prisma.lead.create({
    data: {
      tenantId: session!.user.tenantId,
      name: data.name,
      email: data.email || null,
      phone: data.phone || null,
      company: data.company || null,
      source: data.source,
      status: data.status,
      assignedTo: data.assignedTo || null,
      companyId: data.companyId || null,
    },
  });

  await logAudit({
    tenantId: session!.user.tenantId,
    userId: session!.user.id,
    action: "lead.create",
    entity: "Lead",
    entityId: lead.id,
    meta: { name: lead.name, source: lead.source },
  });

  revalidatePath("/leads");
  redirect(`/leads/${lead.id}`);
}

export async function updateLeadAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { session, error } = await requireRole(ROLES_WRITE);
  if (error) return { error: "Sem permissão" };

  const id = formData.get("id") as string;
  if (!id) return { error: "ID inválido" };

  const existing = await prisma.lead.findFirst({
    where: { id, tenantId: session!.user.tenantId },
    select: { id: true },
  });
  if (!existing) return { error: "Lead não encontrado" };

  const raw = {
    name: formData.get("name") || undefined,
    email: formData.get("email") || undefined,
    phone: formData.get("phone") || undefined,
    company: formData.get("company") || undefined,
    source: formData.get("source") || undefined,
    status: formData.get("status") || undefined,
    assignedTo: formData.get("assignedTo") || undefined,
  };

  const parsed = updateLeadSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const data = parsed.data;

  if (data.assignedTo) {
    const user = await prisma.user.findFirst({
      where: { id: data.assignedTo, tenantId: session!.user.tenantId },
      select: { id: true },
    });
    if (!user) return { error: "Usuário inválido" };
  }

  const lead = await prisma.lead.update({
    where: { id },
    data: {
      ...(data.name && { name: data.name }),
      email: data.email || null,
      phone: data.phone || null,
      company: data.company || null,
      ...(data.source && { source: data.source }),
      ...(data.status && { status: data.status }),
      assignedTo: data.assignedTo || null,
    },
  });

  await logAudit({
    tenantId: session!.user.tenantId,
    userId: session!.user.id,
    action: "lead.update",
    entity: "Lead",
    entityId: lead.id,
    meta: { status: lead.status },
  });

  revalidatePath(`/leads/${id}`);
  revalidatePath("/leads");
  redirect(`/leads/${id}`);
}

export async function deleteLeadAction(formData: FormData): Promise<void> {
  const { session, error } = await requireRole(ROLES_MANAGE);
  if (error) return;

  const id = formData.get("id") as string;
  if (!id) return;

  const existing = await prisma.lead.findFirst({
    where: { id, tenantId: session!.user.tenantId },
    select: { id: true, name: true },
  });
  if (!existing) return;

  await prisma.lead.delete({ where: { id } });

  await logAudit({
    tenantId: session!.user.tenantId,
    userId: session!.user.id,
    action: "lead.delete",
    entity: "Lead",
    entityId: id,
    meta: { name: existing.name },
  });

  revalidatePath("/leads");
  redirect("/leads");
}

export async function createNoteAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { session, error } = await requireRole(ROLES_WRITE);
  if (error) return { error: "Sem permissão" };

  const leadId = formData.get("leadId") as string;
  const content = (formData.get("content") as string)?.trim();

  if (!leadId || !content) return { error: "Conteúdo obrigatório" };

  const lead = await prisma.lead.findFirst({
    where: { id: leadId, tenantId: session!.user.tenantId },
    select: { id: true },
  });
  if (!lead) return { error: "Lead não encontrado" };

  await prisma.note.create({
    data: {
      tenantId: session!.user.tenantId,
      userId: session!.user.id,
      content,
      leadId,
    },
  });

  await logAudit({
    tenantId: session!.user.tenantId,
    userId: session!.user.id,
    action: "note.create",
    entity: "Note",
    meta: { leadId },
  });

  revalidatePath(`/leads/${leadId}`);
  return { success: true };
}

export async function convertLeadAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState & { opportunityId?: string }> {
  const { session, error } = await requireRole(ROLES_WRITE);
  if (error) return { error: "Sem permissão" };

  const leadId  = formData.get("leadId") as string;
  const stageId = formData.get("stageId") as string;
  const title   = (formData.get("title") as string)?.trim();
  const rawValue = formData.get("value") as string;
  const tenantId = session!.user.tenantId;

  if (!leadId || !stageId || !title) return { error: "Dados obrigatórios ausentes" };

  // Valida lead pertence ao tenant e ainda não convertido
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, tenantId },
    select: { id: true, name: true, status: true },
  });
  if (!lead) return { error: "Lead não encontrado" };
  if (lead.status === "CONVERTIDO") return { error: "Lead já foi convertido" };

  // Valida stage pertence ao tenant
  const stage = await prisma.stage.findFirst({
    where: { id: stageId, tenantId },
    select: { id: true, pipelineId: true },
  });
  if (!stage) return { error: "Estágio inválido" };

  const value = rawValue ? parseFloat(rawValue) : null;

  // Cria oportunidade + atualiza status do lead em transação
  const opportunity = await prisma.$transaction(async (tx) => {
    const opp = await tx.opportunity.create({
      data: {
        tenantId,
        pipelineId: stage.pipelineId,
        stageId,
        title,
        value: value && !isNaN(value) ? value : null,
        leadId,
        assignedTo: session!.user.id,
      },
    });

    await tx.lead.update({
      where: { id: leadId },
      data: { status: "CONVERTIDO" },
    });

    return opp;
  });

  await logAudit({
    tenantId,
    userId: session!.user.id,
    action: "lead.convert",
    entity: "Lead",
    entityId: leadId,
    meta: { opportunityId: opportunity.id, title, stageId },
  });

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/pipeline");
  revalidatePath("/leads");

  redirect(`/pipeline/${opportunity.id}`);
}

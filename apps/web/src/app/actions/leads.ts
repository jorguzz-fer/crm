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

  revalidatePath(`/leads/${leadId}`);
  return { success: true };
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@crm/db";
import { requireRole, ROLES_WRITE, ROLES_MANAGE } from "@/lib/authz";
import { logAudit } from "@/lib/audit";
import { createContactSchema, updateContactSchema } from "@crm/validators";

export type ActionState = { error: string } | { success: true } | null;

export async function createContactAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { session, error } = await requireRole(ROLES_WRITE);
  if (error) return { error: "Sem permissão" };

  const raw = {
    name: formData.get("name"),
    email: formData.get("email") || undefined,
    phone: formData.get("phone") || undefined,
    role: formData.get("role") || undefined,
    companyId: formData.get("companyId") || undefined,
  };

  const parsed = createContactSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const data = parsed.data;
  const tenantId = session!.user.tenantId;

  if (data.companyId) {
    const company = await prisma.company.findFirst({ where: { id: data.companyId, tenantId }, select: { id: true } });
    if (!company) return { error: "Empresa inválida" };
  }

  const contact = await prisma.contact.create({
    data: {
      tenantId,
      name: data.name,
      email: data.email || null,
      phone: data.phone || null,
      role: data.role || null,
      companyId: data.companyId || null,
    },
  });

  await logAudit({
    tenantId,
    userId: session!.user.id,
    action: "contact.create",
    entity: "Contact",
    entityId: contact.id,
    meta: { name: contact.name },
  });

  redirect(`/contatos/${contact.id}`);
}

export async function updateContactAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { session, error } = await requireRole(ROLES_WRITE);
  if (error) return { error: "Sem permissão" };

  const id = formData.get("id") as string;
  if (!id) return { error: "ID inválido" };

  const raw = {
    name: formData.get("name"),
    email: formData.get("email") || undefined,
    phone: formData.get("phone") || undefined,
    role: formData.get("role") || undefined,
    companyId: formData.get("companyId") || undefined,
  };

  const parsed = updateContactSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const tenantId = session!.user.tenantId;
  const existing = await prisma.contact.findFirst({ where: { id, tenantId }, select: { id: true } });
  if (!existing) return { error: "Contato não encontrado" };

  const data = parsed.data;

  if (data.companyId) {
    const company = await prisma.company.findFirst({ where: { id: data.companyId, tenantId }, select: { id: true } });
    if (!company) return { error: "Empresa inválida" };
  }

  await prisma.contact.update({
    where: { id },
    data: {
      name: data.name,
      email: data.email ?? null,
      phone: data.phone ?? null,
      role: data.role ?? null,
      companyId: data.companyId ?? null,
    },
  });

  await logAudit({
    tenantId,
    userId: session!.user.id,
    action: "contact.update",
    entity: "Contact",
    entityId: id,
    meta: { name: data.name },
  });

  revalidatePath(`/contatos/${id}`);
  return { success: true };
}

export async function deleteContactAction(formData: FormData): Promise<void> {
  const { session, error } = await requireRole(ROLES_MANAGE);
  if (error) return;

  const id = formData.get("id") as string;
  if (!id) return;

  const contact = await prisma.contact.findFirst({
    where: { id, tenantId: session!.user.tenantId },
    select: { id: true, name: true },
  });
  if (!contact) return;

  await prisma.contact.delete({ where: { id } });

  await logAudit({
    tenantId: session!.user.tenantId,
    userId: session!.user.id,
    action: "contact.delete",
    entity: "Contact",
    entityId: id,
    meta: { name: contact.name },
  });

  redirect("/contatos");
}

export async function addContactNoteAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { session, error } = await requireRole(ROLES_WRITE);
  if (error) return { error: "Sem permissão" };

  const contactId = formData.get("contactId") as string;
  const content = (formData.get("content") as string)?.trim();

  if (!contactId || !content) return { error: "Conteúdo obrigatório" };

  const tenantId = session!.user.tenantId;
  const contact = await prisma.contact.findFirst({ where: { id: contactId, tenantId }, select: { id: true } });
  if (!contact) return { error: "Contato não encontrado" };

  await prisma.note.create({
    data: { tenantId, userId: session!.user.id, content, contactId },
  });

  await logAudit({
    tenantId,
    userId: session!.user.id,
    action: "note.create",
    entity: "Note",
    meta: { contactId },
  });

  revalidatePath(`/contatos/${contactId}`);
  return { success: true };
}

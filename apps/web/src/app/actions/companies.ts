"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@crm/db";
import { requireRole, ROLES_WRITE, ROLES_MANAGE } from "@/lib/authz";
import { logAudit } from "@/lib/audit";
import { createCompanySchema, updateCompanySchema } from "@crm/validators";

export type ActionState = { error: string } | { success: true } | null;

export async function createCompanyAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { session, error } = await requireRole(ROLES_WRITE);
  if (error) return { error: "Sem permissão" };

  const raw = {
    name: formData.get("name"),
    cnpj: formData.get("cnpj") || undefined,
    website: formData.get("website") || undefined,
    phone: formData.get("phone") || undefined,
    email: formData.get("email") || undefined,
    industry: formData.get("industry") || undefined,
  };

  const parsed = createCompanySchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const data = parsed.data;
  const tenantId = session!.user.tenantId;

  const company = await prisma.company.create({
    data: {
      tenantId,
      name: data.name,
      cnpj: data.cnpj || null,
      website: data.website || null,
      phone: data.phone || null,
      email: data.email || null,
      industry: data.industry || null,
    },
  });

  await logAudit({
    tenantId,
    userId: session!.user.id,
    action: "company.create",
    entity: "Company",
    entityId: company.id,
    meta: { name: company.name },
  });

  redirect(`/empresas/${company.id}`);
}

export async function updateCompanyAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { session, error } = await requireRole(ROLES_WRITE);
  if (error) return { error: "Sem permissão" };

  const id = formData.get("id") as string;
  if (!id) return { error: "ID inválido" };

  const raw = {
    name: formData.get("name"),
    cnpj: formData.get("cnpj") || undefined,
    website: formData.get("website") || undefined,
    phone: formData.get("phone") || undefined,
    email: formData.get("email") || undefined,
    industry: formData.get("industry") || undefined,
  };

  const parsed = updateCompanySchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const tenantId = session!.user.tenantId;
  const existing = await prisma.company.findFirst({ where: { id, tenantId }, select: { id: true } });
  if (!existing) return { error: "Empresa não encontrada" };

  const data = parsed.data;
  await prisma.company.update({
    where: { id },
    data: {
      name: data.name,
      cnpj: data.cnpj ?? null,
      website: data.website ?? null,
      phone: data.phone ?? null,
      email: data.email ?? null,
      industry: data.industry ?? null,
    },
  });

  await logAudit({
    tenantId,
    userId: session!.user.id,
    action: "company.update",
    entity: "Company",
    entityId: id,
    meta: { name: data.name },
  });

  revalidatePath(`/empresas/${id}`);
  return { success: true };
}

export async function deleteCompanyAction(formData: FormData): Promise<void> {
  const { session, error } = await requireRole(ROLES_MANAGE);
  if (error) return;

  const id = formData.get("id") as string;
  if (!id) return;

  const company = await prisma.company.findFirst({
    where: { id, tenantId: session!.user.tenantId },
    select: { id: true, name: true },
  });
  if (!company) return;

  await prisma.company.delete({ where: { id } });

  await logAudit({
    tenantId: session!.user.tenantId,
    userId: session!.user.id,
    action: "company.delete",
    entity: "Company",
    entityId: id,
    meta: { name: company.name },
  });

  redirect("/empresas");
}

export async function addCompanyNoteAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { session, error } = await requireRole(ROLES_WRITE);
  if (error) return { error: "Sem permissão" };

  const companyId = formData.get("companyId") as string;
  const content = (formData.get("content") as string)?.trim();

  if (!companyId || !content) return { error: "Conteúdo obrigatório" };

  const tenantId = session!.user.tenantId;
  const company = await prisma.company.findFirst({ where: { id: companyId, tenantId }, select: { id: true } });
  if (!company) return { error: "Empresa não encontrada" };

  await prisma.note.create({
    data: { tenantId, userId: session!.user.id, content, companyId },
  });

  await logAudit({
    tenantId,
    userId: session!.user.id,
    action: "note.create",
    entity: "Note",
    meta: { companyId },
  });

  revalidatePath(`/empresas/${companyId}`);
  return { success: true };
}

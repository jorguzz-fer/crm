"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@crm/db";
import type { Role } from "@crm/db";
import { requireRole, ROLES_ADMIN } from "@/lib/authz";
import { logAudit } from "@/lib/audit";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { validatePassword } from "@/lib/password";

export type ActionState = { error: string } | { success: string } | null;

const updateTenantSchema = z.object({
  name: z.string().min(2).max(100),
});

const inviteUserSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email().max(200),
  password: z.string().min(10).max(200),
  role: z.enum(["ADMIN", "SUPERVISOR", "ANALYST", "VIEWER"]),
});

const updateUserRoleSchema = z.object({
  userId: z.string().cuid(),
  role: z.enum(["ADMIN", "SUPERVISOR", "ANALYST", "VIEWER"]),
});

export async function updateTenantAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { session, error } = await requireRole(ROLES_ADMIN);
  if (error) return { error: "Apenas administradores podem editar o tenant" };

  const raw = { name: formData.get("name") };
  const parsed = updateTenantSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const tenantId = session!.user.tenantId;
  await prisma.tenant.update({ where: { id: tenantId }, data: { name: parsed.data.name } });

  await logAudit({
    tenantId,
    userId: session!.user.id,
    action: "tenant.update",
    entity: "Tenant",
    entityId: tenantId,
    meta: { name: parsed.data.name },
  });

  revalidatePath("/configuracoes");
  return { success: "Configurações salvas." };
}

export async function inviteUserAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { session, error } = await requireRole(ROLES_ADMIN);
  if (error) return { error: "Apenas administradores podem convidar usuários" };

  const raw = {
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role"),
  };

  const parsed = inviteUserSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const { name, email, password, role } = parsed.data;
  const passwordCheck = validatePassword(password);
  if (!passwordCheck.ok) return { error: passwordCheck.error! };

  const emailLower = email.toLowerCase();
  const tenantId = session!.user.tenantId;

  const exists = await prisma.user.findUnique({ where: { email: emailLower }, select: { id: true } });
  if (exists) return { error: "E-mail já cadastrado" };

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { tenantId, name, email: emailLower, passwordHash, role: role as Role, active: true },
  });

  await prisma.membership.create({
    data: { tenantId, userId: user.id, role: role as Role },
  });

  await logAudit({
    tenantId,
    userId: session!.user.id,
    action: "user.invite",
    entity: "User",
    entityId: user.id,
    meta: { email: emailLower, role },
  });

  revalidatePath("/configuracoes");
  return { success: `Usuário ${name} criado com sucesso.` };
}

export async function updateUserRoleAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { session, error } = await requireRole(ROLES_ADMIN);
  if (error) return { error: "Apenas administradores podem alterar roles" };

  const raw = { userId: formData.get("userId"), role: formData.get("role") };
  const parsed = updateUserRoleSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const tenantId = session!.user.tenantId;
  const { userId, role } = parsed.data;

  // Não pode alterar o próprio role
  if (userId === session!.user.id) return { error: "Você não pode alterar seu próprio papel" };

  const target = await prisma.user.findFirst({ where: { id: userId, tenantId }, select: { id: true, name: true } });
  if (!target) return { error: "Usuário não encontrado" };

  await prisma.user.update({ where: { id: userId }, data: { role: role as Role } });

  await logAudit({
    tenantId,
    userId: session!.user.id,
    action: "user.role_change",
    entity: "User",
    entityId: userId,
    meta: { role },
  });

  revalidatePath("/configuracoes");
  return { success: `Role de ${target.name} atualizado.` };
}

const updateTrackingConfigSchema = z.object({
  metaPixelId: z.string().max(50).optional(),
  metaAccessToken: z.string().max(500).optional(),
  hotmartHottok: z.string().max(200).optional(),
  pagarmeWebhookSecret: z.string().max(200).optional(),
});

export async function updateTrackingConfigAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { session, error } = await requireRole(ROLES_ADMIN);
  if (error) return { error: "Apenas administradores podem editar integrações" };

  const raw = {
    metaPixelId: formData.get("metaPixelId") || undefined,
    metaAccessToken: formData.get("metaAccessToken") || undefined,
    hotmartHottok: formData.get("hotmartHottok") || undefined,
    pagarmeWebhookSecret: formData.get("pagarmeWebhookSecret") || undefined,
  };

  const parsed = updateTrackingConfigSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const tenantId = session!.user.tenantId;

  await prisma.tenantTrackingConfig.upsert({
    where: { tenantId },
    create: { tenantId, ...parsed.data },
    update: parsed.data,
  });

  await logAudit({
    tenantId,
    userId: session!.user.id,
    action: "tracking_config.update",
    entity: "TenantTrackingConfig",
    meta: { fields: Object.keys(parsed.data).filter((k) => parsed.data[k as keyof typeof parsed.data]) },
  });

  revalidatePath("/configuracoes/tracking");
  return { success: "Integrações de tracking salvas." };
}

export async function toggleUserActiveAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { session, error } = await requireRole(ROLES_ADMIN);
  if (error) return { error: "Apenas administradores podem ativar/desativar usuários" };

  const userId = formData.get("userId") as string;
  if (!userId) return { error: "ID inválido" };

  const tenantId = session!.user.tenantId;
  if (userId === session!.user.id) return { error: "Você não pode desativar sua própria conta" };

  const user = await prisma.user.findFirst({ where: { id: userId, tenantId }, select: { id: true, active: true, name: true } });
  if (!user) return { error: "Usuário não encontrado" };

  await prisma.user.update({ where: { id: userId }, data: { active: !user.active } });

  await logAudit({
    tenantId,
    userId: session!.user.id,
    action: user.active ? "user.deactivate" : "user.activate",
    entity: "User",
    entityId: userId,
    meta: { name: user.name },
  });

  revalidatePath("/configuracoes");
  return { success: `${user.name} ${user.active ? "desativado" : "reativado"}.` };
}

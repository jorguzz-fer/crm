"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@crm/db";
import bcrypt from "bcryptjs";
import { logAudit } from "@/lib/audit";
import { validatePassword } from "@/lib/password";
import { getPlatformAdmin } from "@/lib/platformAuth";
import { createTenantSchema, setActiveSchema, setPlanSchema } from "@/lib/platform";

export type ActionState = { error: string } | { success: string } | null;

const FORBIDDEN = "Acesso restrito aos administradores da plataforma.";

/**
 * Cria um tenant novo já com o primeiro usuário ADMIN — o caminho de venda:
 * cliente fecha, você cadastra aqui e entrega o login pronto.
 */
export async function createTenantAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await getPlatformAdmin();
  if (!admin) return { error: FORBIDDEN };

  const parsed = createTenantSchema.safeParse({
    tenantName: formData.get("tenantName"),
    tenantSlug: formData.get("tenantSlug"),
    plan: formData.get("plan"),
    adminName: formData.get("adminName"),
    adminEmail: formData.get("adminEmail"),
    adminPassword: formData.get("adminPassword"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { tenantName, tenantSlug, plan, adminName, adminEmail, adminPassword } = parsed.data;

  // Mesma política de senha do resto do app
  const pwCheck = validatePassword(adminPassword);
  if (!pwCheck.ok) return { error: pwCheck.error! };

  const normalizedEmail = adminEmail.toLowerCase();

  const [existingSlug, existingEmail] = await Promise.all([
    prisma.tenant.findUnique({ where: { slug: tenantSlug }, select: { id: true } }),
    prisma.user.findUnique({ where: { email: normalizedEmail }, select: { id: true } }),
  ]);
  if (existingSlug) return { error: `O slug "${tenantSlug}" já está em uso` };
  if (existingEmail) return { error: "Este e-mail já está cadastrado em outro tenant" };

  const passwordHash = await bcrypt.hash(adminPassword, 12);

  const tenant = await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: { name: tenantName, slug: tenantSlug, plan },
    });

    const user = await tx.user.create({
      data: {
        tenantId: tenant.id,
        name: adminName,
        email: normalizedEmail,
        passwordHash,
        role: "ADMIN",
      },
    });

    await tx.membership.create({
      data: { tenantId: tenant.id, userId: user.id, role: "ADMIN" },
    });

    return tenant;
  });

  await logAudit({
    tenantId: tenant.id,
    userId: admin.id,
    action: "platform.tenant.create",
    entity: "Tenant",
    entityId: tenant.id,
    meta: { tenantSlug, tenantName, plan, adminEmail: normalizedEmail },
  });

  revalidatePath("/painel");
  return { success: `Tenant "${tenantName}" criado. O admin já pode entrar com ${normalizedEmail}.` };
}

/** Suspende ou reativa um cliente. Tenant inativo derruba o login de todo mundo dele. */
export async function setTenantActiveAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await getPlatformAdmin();
  if (!admin) return { error: FORBIDDEN };

  const parsed = setActiveSchema.safeParse({
    tenantId: formData.get("tenantId"),
    active: formData.get("active") === "true",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { tenantId, active } = parsed.data;

  // O painel não pode desligar o tenant de quem está operando o painel
  if (!active && tenantId === admin.tenantId) {
    return { error: "Você não pode suspender o tenant em que está logado." };
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, name: true },
  });
  if (!tenant) return { error: "Tenant não encontrado" };

  await prisma.tenant.update({ where: { id: tenantId }, data: { active } });

  await logAudit({
    tenantId,
    userId: admin.id,
    action: active ? "platform.tenant.activate" : "platform.tenant.suspend",
    entity: "Tenant",
    entityId: tenantId,
    meta: { name: tenant.name },
  });

  revalidatePath("/painel");
  return {
    success: active ? `"${tenant.name}" reativado.` : `"${tenant.name}" suspenso — ninguém do tenant consegue entrar.`,
  };
}

/** Troca o plano do cliente (usado no upgrade/downgrade da venda). */
export async function setTenantPlanAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await getPlatformAdmin();
  if (!admin) return { error: FORBIDDEN };

  const parsed = setPlanSchema.safeParse({
    tenantId: formData.get("tenantId"),
    plan: formData.get("plan"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { tenantId, plan } = parsed.data;

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, name: true, plan: true },
  });
  if (!tenant) return { error: "Tenant não encontrado" };
  if (tenant.plan === plan) return { success: `"${tenant.name}" já está no plano ${plan}.` };

  await prisma.tenant.update({ where: { id: tenantId }, data: { plan } });

  await logAudit({
    tenantId,
    userId: admin.id,
    action: "platform.tenant.plan",
    entity: "Tenant",
    entityId: tenantId,
    meta: { name: tenant.name, from: tenant.plan, to: plan },
  });

  revalidatePath("/painel");
  return { success: `"${tenant.name}": plano ${tenant.plan} → ${plan}.` };
}

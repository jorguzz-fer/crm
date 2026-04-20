"use server";

import { signIn, signOut } from "@/lib/auth";
import { prisma } from "@crm/db";
import { AuthError } from "next-auth";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { redirect } from "next/navigation";
import { validatePassword } from "@/lib/password";
import { logAudit } from "@/lib/audit";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const signupSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email().max(200),
  password: z.string().min(10).max(200),
  tenantName: z.string().min(2).max(100),
  tenantSlug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/, "Use apenas letras minúsculas, números e hifens"),
});

export type ActionResult = { error: string } | { success: true };

export async function loginAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const raw = {
    email: formData.get("email"),
    password: formData.get("password"),
  };

  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: "Dados inválidos" };
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email.toLowerCase(),
      password: parsed.data.password,
      redirectTo: "/dashboard",
    });
  } catch (err) {
    if (err instanceof AuthError) {
      switch (err.type) {
        case "CredentialsSignin":
          return { error: "E-mail ou senha incorretos" };
        default:
          return { error: "Erro ao fazer login. Tente novamente." };
      }
    }
    // signIn redireciona jogando NEXT_REDIRECT — relança para o Next.js processar
    throw err;
  }

  return { success: true };
}

export async function signupAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const raw = {
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    tenantName: formData.get("tenantName"),
    tenantSlug: formData.get("tenantSlug"),
  };

  const parsed = signupSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { error: first?.message ?? "Dados inválidos" };
  }

  const { name, email, password, tenantName, tenantSlug } = parsed.data;

  const pwCheck = validatePassword(password);
  if (!pwCheck.ok) {
    return { error: pwCheck.error! };
  }

  const normalizedEmail = email.toLowerCase();

  // Verifica duplicatas
  const [existingSlug, existingEmail] = await Promise.all([
    prisma.tenant.findUnique({ where: { slug: tenantSlug }, select: { id: true } }),
    prisma.user.findUnique({ where: { email: normalizedEmail }, select: { id: true } }),
  ]);

  if (existingSlug) return { error: "Este subdomínio já está em uso" };
  if (existingEmail) return { error: "Este e-mail já está cadastrado" };

  const passwordHash = await bcrypt.hash(password, 12);

  const { tenant, user } = await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: { name: tenantName, slug: tenantSlug },
    });

    const user = await tx.user.create({
      data: {
        tenantId: tenant.id,
        name,
        email: normalizedEmail,
        passwordHash,
        role: "ADMIN",
      },
    });

    await tx.membership.create({
      data: { tenantId: tenant.id, userId: user.id, role: "ADMIN" },
    });

    return { tenant, user };
  });

  await logAudit({
    tenantId: tenant.id,
    userId: user.id,
    action: "tenant.signup",
    entity: "Tenant",
    entityId: tenant.id,
    meta: { tenantSlug, tenantName },
  });

  redirect("/login?signup=success");
}

export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}

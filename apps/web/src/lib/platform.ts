/**
 * Regras puras do painel da plataforma (/painel).
 *
 * Sem Prisma e sem Next — só validação e normalização, para poder ser testado
 * isoladamente e reutilizado tanto nas server actions quanto na UI.
 */
import { z } from "zod";

export const PLANS = ["FREE", "PRO", "ENTERPRISE"] as const;
export type Plan = (typeof PLANS)[number];

export const PLAN_LABELS: Record<Plan, string> = {
  FREE: "Free",
  PRO: "Pro",
  ENTERPRISE: "Enterprise",
};

export function isPlan(value: string): value is Plan {
  return (PLANS as readonly string[]).includes(value);
}

/**
 * Converte um nome de empresa em slug utilizável como subdomínio.
 * "Clínica São Jorge!" → "clinica-sao-jorge"
 */
export function normalizeSlug(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // qualquer coisa que não seja alfanumérico vira hífen
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50)
    .replace(/-$/, ""); // o slice pode ter deixado um hífen na ponta
}

/** Mesmas regras do signup público — slug é subdomínio, então é restrito. */
export const slugSchema = z
  .string()
  .min(2, "O slug precisa de ao menos 2 caracteres")
  .max(50, "O slug pode ter no máximo 50 caracteres")
  .regex(/^[a-z0-9-]+$/, "Use apenas letras minúsculas, números e hifens");

export const createTenantSchema = z.object({
  tenantName: z.string().min(2, "Informe o nome do cliente").max(100),
  tenantSlug: slugSchema,
  plan: z.enum(PLANS),
  adminName: z.string().min(2, "Informe o nome do administrador").max(100),
  adminEmail: z.string().email("E-mail inválido").max(200),
  adminPassword: z.string().min(10, "A senha precisa de ao menos 10 caracteres").max(200),
});

export const setPlanSchema = z.object({
  tenantId: z.string().cuid(),
  plan: z.enum(PLANS),
});

export const setActiveSchema = z.object({
  tenantId: z.string().cuid(),
  active: z.boolean(),
});

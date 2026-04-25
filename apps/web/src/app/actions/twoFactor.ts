"use server";

/**
 * Ações de 2FA TOTP
 *
 * Fluxo de ativação:
 *   1. setup2FAAction()   → gera secret, salva temporariamente, retorna QR code URL
 *   2. enable2FAAction()  → verifica código, marca twoFactorEnabled = true
 *
 * Fluxo de desativação:
 *   1. disable2FAAction() → verifica código atual, limpa secret e desabilita
 */

import { auth } from "@/lib/auth";
import { prisma } from "@crm/db";
import { generateSecret, generateURI, verifySync } from "otplib";
import QRCode from "qrcode";
import { logAudit } from "@/lib/audit";

export type TwoFactorSetupResult =
  | { error: string }
  | { qrDataUrl: string; secret: string; otpAuthUrl: string };

export type TwoFactorActionResult = { error: string } | { success: true };

// ─── Setup: gera o secret e retorna o QR code ─────────────────────────────────
export async function setup2FAAction(): Promise<TwoFactorSetupResult> {
  const session = await auth();
  if (!session) return { error: "Não autenticado" };

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, twoFactorEnabled: true },
  });
  if (!user) return { error: "Usuário não encontrado" };
  if (user.twoFactorEnabled) return { error: "2FA já está ativo" };

  const secret = generateSecret({ length: 20 });

  // Salva o secret temporariamente (sem marcar twoFactorEnabled = true)
  // Só será confirmado após verificação do código
  await prisma.user.update({
    where: { id: user.id },
    data: { twoFactorSecret: secret },
  });

  const otpAuthUrl = generateURI({ issuer: "CRM", label: user.email, secret });
  const qrDataUrl  = await QRCode.toDataURL(otpAuthUrl, { width: 256, margin: 2 });

  return { qrDataUrl, secret, otpAuthUrl };
}

// ─── Ativar: confirma com o primeiro código e habilita 2FA ────────────────────
export async function enable2FAAction(
  _prev: TwoFactorActionResult | null,
  formData: FormData
): Promise<TwoFactorActionResult> {
  const session = await auth();
  if (!session) return { error: "Não autenticado" };

  const code = (formData.get("code") as string | null)?.trim() ?? "";
  if (!code || !/^\d{6}$/.test(code)) {
    return { error: "Código deve ter 6 dígitos numéricos" };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, twoFactorSecret: true, twoFactorEnabled: true, tenantId: true },
  });
  if (!user) return { error: "Usuário não encontrado" };
  if (user.twoFactorEnabled) return { error: "2FA já está ativo" };
  if (!user.twoFactorSecret) return { error: "Inicie a configuração primeiro" };

  const valid = verifySync({ token: code, secret: user.twoFactorSecret }).valid;
  if (!valid) return { error: "Código inválido ou expirado. Tente novamente." };

  await prisma.user.update({
    where: { id: user.id },
    data: { twoFactorEnabled: true },
  });

  await logAudit({
    tenantId: user.tenantId,
    userId:   user.id,
    action:   "user.2fa.enable",
    entity:   "User",
    entityId: user.id,
  });

  return { success: true };
}

// ─── Desativar: verifica código atual e remove 2FA ────────────────────────────
export async function disable2FAAction(
  _prev: TwoFactorActionResult | null,
  formData: FormData
): Promise<TwoFactorActionResult> {
  const session = await auth();
  if (!session) return { error: "Não autenticado" };

  const code = (formData.get("code") as string | null)?.trim() ?? "";
  if (!code || !/^\d{6}$/.test(code)) {
    return { error: "Código deve ter 6 dígitos numéricos" };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, twoFactorSecret: true, twoFactorEnabled: true, tenantId: true },
  });
  if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
    return { error: "2FA não está ativo" };
  }

  const valid = verifySync({ token: code, secret: user.twoFactorSecret }).valid;
  if (!valid) return { error: "Código inválido ou expirado" };

  await prisma.user.update({
    where: { id: user.id },
    data: { twoFactorEnabled: false, twoFactorSecret: null },
  });

  await logAudit({
    tenantId: user.tenantId,
    userId:   user.id,
    action:   "user.2fa.disable",
    entity:   "User",
    entityId: user.id,
  });

  return { success: true };
}

// ─── Personal Access Tokens ──────────────────────────────────────────────────
import crypto from "crypto";
import bcrypt from "bcryptjs";

export async function createPersonalTokenAction(
  _prev: { error: string } | { token: string; id: string } | null,
  formData: FormData
): Promise<{ error: string } | { token: string; id: string }> {
  const session = await auth();
  if (!session) return { error: "Não autenticado" };

  const name = (formData.get("name") as string | null)?.trim();
  if (!name || name.length < 2) return { error: "Nome do token é obrigatório" };

  const rawToken  = `crm_${crypto.randomBytes(32).toString("hex")}`;
  const tokenHash = await bcrypt.hash(rawToken, 10);

  const pt = await prisma.personalAccessToken.create({
    data: {
      tenantId:  session.user.tenantId,
      userId:    session.user.id,
      name,
      tokenHash,
    },
  });

  await logAudit({
    tenantId: session.user.tenantId,
    userId:   session.user.id,
    action:   "user.token.create",
    entity:   "PersonalAccessToken",
    entityId: pt.id,
    meta:     { name },
  });

  // rawToken é mostrado UMA VEZ — não é armazenável em texto plano
  return { token: rawToken, id: pt.id };
}

export async function revokePersonalTokenAction(
  _prev: { error: string } | { success: true } | null,
  formData: FormData
): Promise<{ error: string } | { success: true }> {
  const session = await auth();
  if (!session) return { error: "Não autenticado" };

  const id = formData.get("id") as string | null;
  if (!id) return { error: "ID inválido" };

  const token = await prisma.personalAccessToken.findFirst({
    where: { id, userId: session.user.id, tenantId: session.user.tenantId },
    select: { id: true },
  });
  if (!token) return { error: "Token não encontrado" };

  await prisma.personalAccessToken.delete({ where: { id } });

  await logAudit({
    tenantId: session.user.tenantId,
    userId:   session.user.id,
    action:   "user.token.revoke",
    entity:   "PersonalAccessToken",
    entityId: id,
  });

  return { success: true };
}

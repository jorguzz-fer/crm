/**
 * Autenticação de Personal Access Tokens para a extensão Chrome e API.
 *
 * O token é enviado como: Authorization: Bearer crm_<hex>
 * O hash bcrypt é comparado contra os registros de PersonalAccessToken.
 */

import { NextResponse } from "next/server";
import { prisma } from "@crm/db";
import bcrypt from "bcryptjs";

export interface ExtensionSession {
  userId:   string;
  tenantId: string;
  name:     string;
  email:    string;
  role:     string;
  tokenId:  string;
}

/**
 * Valida o Bearer token da extensão.
 * Retorna a session ou um NextResponse de erro.
 */
export async function requireExtensionAuth(req: Request): Promise<
  | { session: ExtensionSession; error: null }
  | { session: null; error: NextResponse }
> {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer crm_")) {
    return {
      session: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const rawToken = auth.slice(7); // Remove "Bearer "

  // Busca todos os tokens ativos (sem expiração ou não expirados)
  // bcrypt.compare é lento — em escala real usar Redis como cache
  const tokens = await prisma.personalAccessToken.findMany({
    where: {
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
    include: {
      user: { select: { id: true, name: true, email: true, role: true, tenantId: true, active: true } },
    },
    take: 100, // Limita para não fazer bcrypt em todos os tokens de todos os tenants
  });

  let matched: (typeof tokens)[0] | null = null;
  for (const token of tokens) {
    const valid = await bcrypt.compare(rawToken, token.tokenHash);
    if (valid) { matched = token; break; }
  }

  if (!matched) {
    return {
      session: null,
      error: NextResponse.json({ error: "Token inválido ou expirado" }, { status: 401 }),
    };
  }

  if (!matched.user.active) {
    return {
      session: null,
      error: NextResponse.json({ error: "Conta desativada" }, { status: 403 }),
    };
  }

  // Atualiza lastUsedAt (fire-and-forget)
  prisma.personalAccessToken
    .update({ where: { id: matched.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});

  return {
    session: {
      userId:   matched.user.id,
      tenantId: matched.user.tenantId,
      name:     matched.user.name,
      email:    matched.user.email,
      role:     matched.user.role,
      tokenId:  matched.id,
    },
    error: null,
  };
}

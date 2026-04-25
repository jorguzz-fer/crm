/**
 * GET /api/extension/me
 * Valida o token e retorna dados do usuário autenticado.
 */

import { NextResponse } from "next/server";
import { requireExtensionAuth } from "@/lib/extensionAuth";

export async function GET(req: Request) {
  const { session, error } = await requireExtensionAuth(req);
  if (error) return error;

  return NextResponse.json({
    id:       session.userId,
    name:     session.name,
    email:    session.email,
    tenantId: session.tenantId,
    role:     session.role,
  });
}

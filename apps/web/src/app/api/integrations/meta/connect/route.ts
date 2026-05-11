/**
 * GET /api/integrations/meta/connect
 * Inicia o fluxo OAuth com o Meta (Facebook).
 * Redireciona para a tela de autorização do Facebook.
 */

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { requireRole, ROLES_ADMIN } from "@/lib/authz";
import { buildAuthUrl, createOAuthState } from "@/lib/metaOAuth";

export async function GET() {
  const { session, error } = await requireRole(ROLES_ADMIN);
  if (error) return error;

  const state   = createOAuthState(session.user.tenantId, session.user.id);
  const authUrl = buildAuthUrl(state);

  redirect(authUrl);
}

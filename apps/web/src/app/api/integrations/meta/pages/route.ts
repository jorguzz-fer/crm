/**
 * GET  /api/integrations/meta/pages  — lista páginas conectadas do tenant
 * POST /api/integrations/meta/pages  — ativa/desativa uma página
 *
 * DELETE /api/integrations/meta/pages?pageId=xxx — desconecta
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole, ROLES_ADMIN } from "@/lib/authz";
import { logAudit } from "@/lib/audit";
import { unsubscribePageFromApp } from "@/lib/metaOAuth";

export async function GET(req: Request) {
  const { session, error } = await requireRole(ROLES_ADMIN);
  if (error) return error;

  const pages = await prisma.metaLeadForm.findMany({
    where:   { tenantId: session.user.tenantId },
    select:  { id: true, pageId: true, pageName: true, active: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(pages);
}

export async function DELETE(req: Request) {
  const { session, error } = await requireRole(ROLES_ADMIN);
  if (error) return error;

  const url    = new URL(req.url);
  const pageId = url.searchParams.get("pageId");
  if (!pageId) return NextResponse.json({ error: "pageId obrigatório" }, { status: 400 });

  // Valida que pertence ao tenant
  const record = await prisma.metaLeadForm.findFirst({
    where:  { pageId, tenantId: session.user.tenantId },
    select: { id: true, pageName: true, accessToken: true },
  });
  if (!record) return NextResponse.json({ error: "Página não encontrada" }, { status: 404 });

  // Remove subscrição do app na página antes de deletar do banco
  if (record.accessToken) {
    await unsubscribePageFromApp(pageId, record.accessToken);
  }

  await prisma.metaLeadForm.delete({ where: { id: record.id } });

  await logAudit({
    tenantId: session.user.tenantId,
    userId:   session.user.id,
    action:   "integration.meta.disconnect",
    entity:   "MetaLeadForm",
    entityId: record.id,
    meta:     { pageName: record.pageName },
  });

  return NextResponse.json({ ok: true });
}

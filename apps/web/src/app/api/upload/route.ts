/**
 * POST /api/upload
 * Body: { filename, mimeType, size, entityType, entityId }
 *
 * Retorna: { attachmentId, uploadUrl, key }
 * O cliente deve fazer um PUT direto para `uploadUrl` com o arquivo como body.
 *
 * Segurança:
 *  - requireRole(ROLES_WRITE) — pelo menos ANALYST
 *  - Valida mimeType + tamanho no servidor
 *  - entityId validado contra o tenant (cross-tenant FK check)
 *  - tenantId sempre do session (nunca do body)
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@crm/db";
import { requireRole, ROLES_WRITE } from "@/lib/authz";
import { logAudit } from "@/lib/audit";
import {
  buildObjectKey,
  generateUploadUrl,
  isAllowedMime,
  MAX_FILE_SIZE,
} from "@/lib/storage";

const bodySchema = z.object({
  filename:   z.string().min(1).max(255),
  mimeType:   z.string().min(1).max(100),
  size:       z.number().int().positive().max(MAX_FILE_SIZE),
  entityType: z.enum(["note", "visit", "lead", "opportunity"]),
  entityId:   z.string().cuid(),
});

export async function POST(req: Request) {
  const { session, error } = await requireRole(ROLES_WRITE);
  if (error) return error;

  const body = await req.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const { filename, mimeType, size, entityType, entityId } = parsed.data;
  const tenantId = session.user.tenantId;

  // Valida MIME type
  if (!isAllowedMime(mimeType)) {
    return NextResponse.json({ error: "Tipo de arquivo não permitido" }, { status: 400 });
  }

  // Valida que a entidade pertence ao tenant (cross-tenant FK check)
  const entityOk = await validateEntityBelongsToTenant(entityType, entityId, tenantId);
  if (!entityOk) {
    return NextResponse.json({ error: "Entidade não encontrada" }, { status: 404 });
  }

  // Gera a chave R2 e o registro no banco atomicamente
  const key = buildObjectKey({ tenantId, entityType, entityId, filename, mimeType });

  const attachment = await prisma.attachment.create({
    data: {
      tenantId,
      userId:        session.user.id,
      key,
      filename,
      mimeType,
      size,
      noteId:        entityType === "note"        ? entityId : null,
      visitId:       entityType === "visit"       ? entityId : null,
      leadId:        entityType === "lead"        ? entityId : null,
      opportunityId: entityType === "opportunity" ? entityId : null,
    },
    select: { id: true, key: true },
  });

  // Signed PUT URL (15 min TTL)
  const uploadUrl = await generateUploadUrl(key, mimeType, size);

  await logAudit({
    tenantId,
    userId:   session.user.id,
    action:   "attachment.upload_requested",
    entity:   "Attachment",
    entityId: attachment.id,
    meta:     { filename, mimeType, size, entityType, entityId },
  });

  return NextResponse.json(
    { attachmentId: attachment.id, uploadUrl, key },
    { status: 201 },
  );
}

// ─── Helper ───────────────────────────────────────────────────────────────────

async function validateEntityBelongsToTenant(
  entityType: string,
  entityId: string,
  tenantId: string,
): Promise<boolean> {
  switch (entityType) {
    case "note":
      return !!(await prisma.note.findFirst({ where: { id: entityId, tenantId }, select: { id: true } }));
    case "visit":
      return !!(await prisma.visit.findFirst({ where: { id: entityId, tenantId }, select: { id: true } }));
    case "lead":
      return !!(await prisma.lead.findFirst({ where: { id: entityId, tenantId }, select: { id: true } }));
    case "opportunity":
      return !!(await prisma.opportunity.findFirst({ where: { id: entityId, tenantId }, select: { id: true } }));
    default:
      return false;
  }
}

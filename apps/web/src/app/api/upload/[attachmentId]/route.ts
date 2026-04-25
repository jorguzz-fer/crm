/**
 * GET /api/upload/[attachmentId]
 * Retorna uma signed GET URL (1h TTL) para download seguro do arquivo.
 *
 * DELETE /api/upload/[attachmentId]
 * Remove o objeto do R2 e o registro do banco.
 */

import { NextResponse } from "next/server";
import { prisma } from "@crm/db";
import { requireRole, ROLES_WRITE } from "@/lib/authz";
import { logAudit } from "@/lib/audit";
import { generateDownloadUrl, deleteObject } from "@/lib/storage";

// GET → signed download URL
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ attachmentId: string }> },
) {
  const { session, error } = await requireRole(ROLES_WRITE);
  if (error) return error;

  const { attachmentId } = await params;
  const tenantId = session.user.tenantId;

  const attachment = await prisma.attachment.findFirst({
    where: { id: attachmentId, tenantId },
    select: { id: true, key: true, filename: true, mimeType: true },
  });
  if (!attachment) {
    return NextResponse.json({ error: "Anexo não encontrado" }, { status: 404 });
  }

  const url = await generateDownloadUrl(attachment.key);

  return NextResponse.json({
    url,
    filename: attachment.filename,
    mimeType: attachment.mimeType,
  });
}

// DELETE → remove do R2 + banco
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ attachmentId: string }> },
) {
  const { session, error } = await requireRole(ROLES_WRITE);
  if (error) return error;

  const { attachmentId } = await params;
  const tenantId = session.user.tenantId;

  // Verifica que o anexo pertence ao tenant
  const attachment = await prisma.attachment.findFirst({
    where: { id: attachmentId, tenantId },
    select: { id: true, key: true, filename: true, userId: true },
  });
  if (!attachment) {
    return NextResponse.json({ error: "Anexo não encontrado" }, { status: 404 });
  }

  // Só quem fez upload ou admin pode deletar
  const isOwner = attachment.userId === session.user.id;
  const isAdmin = ["SUPERADMIN", "ADMIN"].includes(session.user.role);
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: "Sem permissão para excluir este anexo" }, { status: 403 });
  }

  // Remove do R2 primeiro (se falhar, não remove do banco — idempotente)
  await deleteObject(attachment.key);

  await prisma.attachment.delete({ where: { id: attachmentId } });

  await logAudit({
    tenantId,
    userId:   session.user.id,
    action:   "attachment.delete",
    entity:   "Attachment",
    entityId: attachmentId,
    meta:     { filename: attachment.filename },
  });

  return new NextResponse(null, { status: 204 });
}

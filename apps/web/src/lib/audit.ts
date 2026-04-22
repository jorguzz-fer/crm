import { prisma, Prisma } from "@crm/db";
import { redactObject } from "@crm/validators";

interface AuditEntry {
  tenantId: string;
  userId: string;
  action: string;
  entity: string;
  entityId?: string | null;
  meta?: Record<string, unknown>;
  ip?: string | null;
}

export async function logAudit(entry: AuditEntry) {
  try {
    // Sanitiza `meta` antes de persistir: chaves sensíveis (password, token,
    // apikey...) viram "[redacted]" e PII embutida (CPF, e-mail, telefone)
    // é mascarada. Garante que o histórico de auditoria não vire vetor de
    // vazamento (LGPD art. 46).
    const safeMeta = entry.meta
      ? (redactObject(
          JSON.parse(JSON.stringify(entry.meta)) as Record<string, unknown>,
        ) as Prisma.InputJsonValue)
      : undefined;

    await prisma.auditLog.create({
      data: {
        tenantId: entry.tenantId,
        userId: entry.userId,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId ?? null,
        meta: safeMeta,
        ip: entry.ip ?? null,
      },
    });
  } catch (err) {
    // Nunca deixa auditoria quebrar a request
    console.error("[audit] failed to write audit log", err);
  }
}

export function getClientIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return null;
}

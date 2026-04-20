// TODO Fase 1: substituir pelo logAudit com prisma.auditLog.create()
// quando o modelo AuditLog for adicionado ao schema (Fase 1)

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
    // Fase 0: log estruturado no console até AuditLog ser criado no schema
    if (process.env.NODE_ENV !== "production") {
      console.log("[audit]", JSON.stringify(entry));
    }
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

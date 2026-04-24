/**
 * GET /api/health/migrations?secret=<CRON_SECRET>
 *
 * Diagnóstico de migrations — mostra quais tabelas e colunas existem no banco.
 * Útil para debug em produção sem precisar de acesso ao Sentry ou logs do Coolify.
 *
 * Autenticação: ?secret=<CRON_SECRET>  (mesma variável do cron)
 * Se CRON_SECRET não estiver configurado, retorna 503.
 */
import { NextResponse } from "next/server";
import { prisma } from "@crm/db";

const CHECKS = [
  { name: "0001_init",              sql: `SELECT COUNT(*)::int AS cnt FROM information_schema.tables WHERE table_schema='public' AND table_name='Tenant'` },
  { name: "0002_auth_models",       sql: `SELECT COUNT(*)::int AS cnt FROM information_schema.tables WHERE table_schema='public' AND table_name='User'` },
  { name: "0003_crm_core",          sql: `SELECT COUNT(*)::int AS cnt FROM information_schema.tables WHERE table_schema='public' AND table_name='Lead'` },
  { name: "0004_lgpd",              sql: `SELECT COUNT(*)::int AS cnt FROM information_schema.tables WHERE table_schema='public' AND table_name='ConsentRecord'` },
  { name: "0005_ai",                sql: `SELECT COUNT(*)::int AS cnt FROM information_schema.tables WHERE table_schema='public' AND table_name='AiFollowUpAlert'` },
  { name: "0006_whatsapp",          sql: `SELECT COUNT(*)::int AS cnt FROM information_schema.tables WHERE table_schema='public' AND table_name='WhatsAppInstance'` },
  { name: "0007_audit_nullable_user", sql: `SELECT COUNT(*)::int AS cnt FROM information_schema.columns WHERE table_schema='public' AND table_name='AuditLog' AND column_name='userId' AND is_nullable='YES'` },
  { name: "0008_visits",            sql: `SELECT COUNT(*)::int AS cnt FROM information_schema.tables WHERE table_schema='public' AND table_name='Visit'` },
  { name: "0009_lead_scoring",      sql: `SELECT COUNT(*)::int AS cnt FROM information_schema.columns WHERE table_schema='public' AND table_name='Lead' AND column_name='score'` },
  { name: "0010_whatsapp_provider", sql: `SELECT COUNT(*)::int AS cnt FROM information_schema.columns WHERE table_schema='public' AND table_name='WhatsAppInstance' AND column_name='provider'` },
];

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret");

  // Requer CRON_SECRET para não expor info do banco publicamente
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: Record<string, boolean | string> = {};

  for (const { name, sql } of CHECKS) {
    try {
      const rows = await prisma.$queryRawUnsafe<{ cnt: number }[]>(sql);
      results[name] = (rows?.[0]?.cnt ?? 0) > 0;
    } catch (e) {
      results[name] = `error: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  const allApplied = Object.values(results).every((v) => v === true);

  return NextResponse.json({
    ok: allApplied,
    migrations: results,
    timestamp: new Date().toISOString(),
  });
}

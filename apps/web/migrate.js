"use strict";
const { PrismaClient } = require("@prisma/client");
const { readFileSync, existsSync } = require("fs");
const { join } = require("path");

/**
 * Checks de migração — usam $queryRawUnsafe para ler information_schema.
 *
 * Formato: { sql, key }
 *   sql  → SELECT COUNT(*) as cnt FROM information_schema.<...>
 *   key  → campo retornado: "cnt" (BigInt no Postgres)
 *
 * A função migrationApplied() retorna true se cnt > 0 (já aplicada).
 *
 * Por que information_schema + $queryRawUnsafe?
 *   – information_schema.tables / .columns NUNCA lança erro (sempre existem).
 *   – $queryRawUnsafe retorna os dados como array — podemos inspecionar o valor.
 *   – $executeRawUnsafe tem comportamento indefinido para SELECTs no Prisma v6:
 *     pode retornar 0 mesmo quando a coluna não existe, fazendo a migration
 *     nunca rodar.
 */
const MIGRATIONS = [
  {
    name: "0001_init",
    check: `SELECT COUNT(*)::int AS cnt FROM information_schema.tables WHERE table_schema='public' AND table_name='Tenant'`,
  },
  {
    name: "0002_auth_models",
    check: `SELECT COUNT(*)::int AS cnt FROM information_schema.tables WHERE table_schema='public' AND table_name='User'`,
  },
  {
    name: "0003_crm_core",
    check: `SELECT COUNT(*)::int AS cnt FROM information_schema.tables WHERE table_schema='public' AND table_name='Lead'`,
  },
  {
    name: "0004_lgpd",
    check: `SELECT COUNT(*)::int AS cnt FROM information_schema.tables WHERE table_schema='public' AND table_name='ConsentRecord'`,
  },
  {
    name: "0005_ai",
    check: `SELECT COUNT(*)::int AS cnt FROM information_schema.tables WHERE table_schema='public' AND table_name='AiFollowUpAlert'`,
  },
  {
    name: "0006_whatsapp",
    check: `SELECT COUNT(*)::int AS cnt FROM information_schema.tables WHERE table_schema='public' AND table_name='WhatsAppInstance'`,
  },
  {
    // 0007 tornou AuditLog.userId nullable.
    // Checa se a coluna ACEITA null (is_nullable = 'YES').
    name: "0007_audit_nullable_user",
    check: `SELECT COUNT(*)::int AS cnt FROM information_schema.columns WHERE table_schema='public' AND table_name='AuditLog' AND column_name='userId' AND is_nullable='YES'`,
  },
  {
    name: "0008_visits",
    check: `SELECT COUNT(*)::int AS cnt FROM information_schema.tables WHERE table_schema='public' AND table_name='Visit'`,
  },
  {
    name: "0009_lead_scoring",
    check: `SELECT COUNT(*)::int AS cnt FROM information_schema.columns WHERE table_schema='public' AND table_name='Lead' AND column_name='score'`,
  },
  {
    name: "0010_whatsapp_provider",
    check: `SELECT COUNT(*)::int AS cnt FROM information_schema.columns WHERE table_schema='public' AND table_name='WhatsAppInstance' AND column_name='provider'`,
  },
  {
    name: "0011_tracking",
    check: `SELECT COUNT(*)::int AS cnt FROM information_schema.tables WHERE table_schema='public' AND table_name='Attribution'`,
  },
  {
    name: "0012_tracking_config",
    check: `SELECT COUNT(*)::int AS cnt FROM information_schema.tables WHERE table_schema='public' AND table_name='TenantTrackingConfig'`,
  },
  {
    name: "0013_campaign_spend",
    check: `SELECT COUNT(*)::int AS cnt FROM information_schema.tables WHERE table_schema='public' AND table_name='CampaignSpend'`,
  },
  {
    name: "0014_membership_capacity",
    check: `SELECT COUNT(*)::int AS cnt FROM information_schema.columns WHERE table_schema='public' AND table_name='Membership' AND column_name='acceptingLeads'`,
  },
  {
    name: "0011_attachments",
    check: `SELECT COUNT(*)::int AS cnt FROM information_schema.tables WHERE table_schema='public' AND table_name='Attachment'`,
  },
  {
    name: "0015_v2_features",
    check: `SELECT COUNT(*)::int AS cnt FROM information_schema.tables WHERE table_schema='public' AND table_name='PersonalAccessToken'`,
  },
];

/**
 * Retorna true se a migration já foi aplicada (cnt > 0), false se precisar rodar.
 * Usa $queryRawUnsafe para obter o COUNT real — nunca depende de throw/no-throw.
 */
async function migrationApplied(prisma, sql) {
  try {
    const rows = await prisma.$queryRawUnsafe(sql);
    const cnt = Array.isArray(rows) && rows.length > 0 ? Number(rows[0].cnt ?? 0) : 0;
    return cnt > 0;
  } catch (e) {
    // Se information_schema falhar por algum motivo incomum, assume não aplicada.
    console.warn("[migrate] check error (assumindo não aplicada):", e.message);
    return false;
  }
}

async function applyMigration(prisma, name) {
  // Em produção (Docker/Coolify): migrations em __dirname/prisma/migrations/
  // Em desenvolvimento local (monorepo): migrations em packages/db/prisma/migrations/
  const sqlPathProd = join(__dirname, `prisma/migrations/${name}/migration.sql`);
  const sqlPathDev  = join(__dirname, `../../packages/db/prisma/migrations/${name}/migration.sql`);
  const sqlPath = existsSync(sqlPathProd) ? sqlPathProd : sqlPathDev;

  if (!existsSync(sqlPath)) {
    console.warn(`⚠ Migration ${name} não encontrada — pulando`);
    return;
  }

  console.log(`→ Aplicando ${name}...`);
  const sql = readFileSync(sqlPath, "utf8");

  // Remove comentários de linha, divide em statements
  const statements = sql
    .replace(/--[^\n]*/g, "")
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 4);

  for (const stmt of statements) {
    try {
      await prisma.$executeRawUnsafe(stmt);
    } catch (e) {
      // Ignora "already exists" para idempotência
      if (!e.message.includes("already exists")) throw e;
    }
  }
  console.log(`✓ ${name} aplicada`);
}

async function main() {
  const prisma = new PrismaClient();

  try {
    for (const { name, check } of MIGRATIONS) {
      const applied = await migrationApplied(prisma, check);

      if (!applied) {
        await applyMigration(prisma, name);
      } else {
        console.log(`✓ ${name} já aplicada`);
      }
    }
    console.log("✓ Todas as migrations concluídas");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("❌ Migration falhou:", e.message);
  process.exit(1);
});

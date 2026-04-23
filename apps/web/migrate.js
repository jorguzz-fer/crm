"use strict";
const { PrismaClient } = require("@prisma/client");
const { readFileSync, existsSync } = require("fs");
const { join } = require("path");

// Lista ordenada de migrations — adicione novas entradas ao final
const MIGRATIONS = [
  { name: "0001_init", check: `SELECT 1 FROM "Tenant" LIMIT 1` },
  { name: "0002_auth_models", check: `SELECT 1 FROM "User" LIMIT 1` },
  { name: "0003_crm_core", check: `SELECT 1 FROM "Lead" LIMIT 1` },
  { name: "0004_lgpd", check: `SELECT 1 FROM "ConsentRecord" LIMIT 1` },
  { name: "0005_ai",   check: `SELECT 1 FROM "AiFollowUpAlert" LIMIT 1` },
  { name: "0006_whatsapp", check: `SELECT 1 FROM "WhatsAppInstance" LIMIT 1` },
  // 0007: AuditLog.userId virou nullable. Check usa divisão por zero pra
  // forçar erro quando a coluna AINDA é NOT NULL (= migration pendente).
  {
    name: "0007_audit_nullable_user",
    check: `SELECT 1 / (CASE WHEN is_nullable = 'YES' THEN 1 ELSE 0 END) FROM information_schema.columns WHERE table_name = 'AuditLog' AND column_name = 'userId'`,
  },
  { name: "0008_visits", check: `SELECT 1 FROM "Visit" LIMIT 1` },
];

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
      let exists = false;
      try {
        await prisma.$executeRawUnsafe(check);
        exists = true;
      } catch (_) {}

      if (!exists) {
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

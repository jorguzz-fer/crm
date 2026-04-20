"use strict";
const { PrismaClient } = require("@prisma/client");
const { readFileSync } = require("fs");
const { join } = require("path");

async function main() {
  const prisma = new PrismaClient();
  try {
    await prisma.$queryRaw`SELECT 1 FROM "Tenant" LIMIT 1`;
    console.log("✓ Schema já existe — pulando migration");
    await prisma.$disconnect();
    return;
  } catch (_) {}

  console.log("→ Aplicando schema inicial...");
  const sql = readFileSync(
    join(__dirname, "prisma/migrations/0001_init/migration.sql"),
    "utf8"
  );
  const statements = sql
    .replace(/--[^\n]*/g, "")
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 4);

  for (const stmt of statements) {
    try {
      await prisma.$executeRawUnsafe(stmt);
    } catch (e) {
      if (!e.message.includes("already exists")) throw e;
    }
  }
  console.log("✓ Schema aplicado");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("❌ Migration falhou:", e.message);
  process.exit(1);
});

"use strict";
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  // Tenant
  const tenant = await prisma.tenant.upsert({
    where: { slug: "demo" },
    update: {},
    create: { name: "Demo CRM", slug: "demo", plan: "PRO" },
  });

  // Admin user
  const passwordHash = await bcrypt.hash("Admin@2025!", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@demo.com" },
    update: {},
    create: {
      tenantId: tenant.id,
      name: "Admin Demo",
      email: "admin@demo.com",
      passwordHash,
      role: "ADMIN",
    },
  });

  await prisma.membership.upsert({
    where: { tenantId_userId: { tenantId: tenant.id, userId: admin.id } },
    update: {},
    create: { tenantId: tenant.id, userId: admin.id, role: "ADMIN" },
  });

  // Pipeline padrão com estágios
  const pipeline = await prisma.pipeline.upsert({
    where: { id: "pipeline-default-demo" },
    update: {},
    create: {
      id: "pipeline-default-demo",
      tenantId: tenant.id,
      name: "Pipeline Principal",
      isDefault: true,
    },
  });

  const stages = [
    { name: "Prospecção", order: 0, color: "#8b5cf6" },
    { name: "Qualificação", order: 1, color: "#3b82f6" },
    { name: "Proposta", order: 2, color: "#f59e0b" },
    { name: "Negociação", order: 3, color: "#f97316" },
    { name: "Fechamento", order: 4, color: "#10b981" },
  ];

  for (const stage of stages) {
    await prisma.stage.upsert({
      where: { id: `stage-${stage.order}-demo` },
      update: {},
      create: {
        id: `stage-${stage.order}-demo`,
        tenantId: tenant.id,
        pipelineId: pipeline.id,
        ...stage,
      },
    });
  }

  console.log("✓ Seed concluído");
  console.log(`  Tenant: ${tenant.slug}`);
  console.log(`  Admin: admin@demo.com / Admin@2025!`);
  console.log(`  Pipeline: ${pipeline.name} com ${stages.length} estágios`);
}

main()
  .catch((e) => {
    console.error("❌ Seed falhou:", e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

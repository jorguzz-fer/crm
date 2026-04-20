"use strict";
// Uso: ADMIN_EMAIL=x@x.com ADMIN_PASSWORD='senha' ADMIN_NAME='Nome' TENANT_SLUG=demo node /app/create-superadmin.js
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME || "Super Admin";
  const tenantSlug = process.env.TENANT_SLUG || "demo";

  if (!email || !password) {
    console.error("❌ ADMIN_EMAIL e ADMIN_PASSWORD são obrigatórios");
    process.exit(1);
  }

  if (password.length < 10) {
    console.error("❌ Senha deve ter pelo menos 10 caracteres");
    process.exit(1);
  }

  let tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: { name: tenantSlug, slug: tenantSlug, plan: "PRO" },
    });
    console.log(`✓ Tenant '${tenantSlug}' criado`);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, role: "SUPERADMIN", active: true },
    create: {
      tenantId: tenant.id,
      name,
      email,
      passwordHash,
      role: "SUPERADMIN",
      active: true,
    },
  });

  await prisma.membership.upsert({
    where: { tenantId_userId: { tenantId: tenant.id, userId: user.id } },
    update: { role: "SUPERADMIN" },
    create: { tenantId: tenant.id, userId: user.id, role: "SUPERADMIN" },
  });

  console.log(`✓ SuperAdmin criado: ${email} (tenant: ${tenantSlug})`);
}

main()
  .catch((e) => {
    console.error("❌ Falhou:", e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

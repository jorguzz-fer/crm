"use strict";
// Habilita (ou revoga) o acesso ao painel da plataforma (/painel) para um usuário.
//
// Uso no container (Coolify → Terminal):
//   ADMIN_EMAIL=voce@empresa.com node /app/set-platform-admin.js
//   ADMIN_EMAIL=voce@empresa.com REVOKE=1 node /app/set-platform-admin.js
//
// O acesso é cross-tenant e não depende do Role — por isso só é concedido aqui,
// nunca pela interface.
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const revoke = process.env.REVOKE === "1";

  if (!email) {
    console.error("❌ ADMIN_EMAIL é obrigatório");
    process.exit(1);
  }

  const normalized = email.toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email: normalized },
    select: { id: true, name: true, tenantId: true },
  });

  if (!user) {
    console.error(`❌ Usuário '${normalized}' não encontrado`);
    process.exit(1);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { isPlatformAdmin: !revoke },
  });

  console.log(
    revoke
      ? `✓ Acesso ao painel REVOGADO de ${normalized} (${user.name})`
      : `✓ Acesso ao painel CONCEDIDO a ${normalized} (${user.name}) — abra /painel`
  );
}

main()
  .catch((e) => {
    console.error("❌ Falhou:", e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

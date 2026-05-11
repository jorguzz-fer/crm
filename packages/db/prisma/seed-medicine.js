"use strict";
/**
 * Seed de produção — Medicine Cursos
 *
 * Cria o tenant, usuário ADMIN e dados iniciais realistas
 * para a área de cursos médicos/saúde.
 *
 * Uso no Coolify (Terminal do serviço):
 *   node /app/prisma/seed-medicine.js
 *
 * Credenciais criadas:
 *   admin@medicinecursos.com.br / Medicine@2025!  (ADMIN)
 *
 * Execute novamente a qualquer momento — é 100% idempotente (upsert).
 */

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

const daysAgo     = (n) => new Date(Date.now() - n * 86400000);
const daysFromNow = (n) => new Date(Date.now() + n * 86400000);

const ID = {
  tenant:   "medicine-cursos-tenant",
  users: {
    admin:  "medicine-user-admin",
    vendas: "medicine-user-vendas",
  },
  pipeline: "medicine-pipeline-principal",
  stages:   ["medicine-st-0", "medicine-st-1", "medicine-st-2", "medicine-st-3", "medicine-st-4"],

  companies: {
    hosp1: "medicine-co-hosp1",
    hosp2: "medicine-co-hosp2",
    clin1: "medicine-co-clin1",
  },
  contacts: {
    c1: "medicine-ct-1",
    c2: "medicine-ct-2",
    c3: "medicine-ct-3",
  },
  leads: Array.from({ length: 8 }, (_, i) => `medicine-lead-${i}`),
  opps:  Array.from({ length: 4 }, (_, i) => `medicine-opp-${i}`),
};

async function main() {
  console.log("→ Iniciando seed Medicine Cursos...\n");

  // ── Tenant ──────────────────────────────────────────────────────────────
  const tenant = await prisma.tenant.upsert({
    where:  { id: ID.tenant },
    update: { name: "Medicine Cursos" },
    create: {
      id:     ID.tenant,
      name:   "Medicine Cursos",
      slug:   "medicine-cursos",
      plan:   "PRO",
      active: true,
    },
  });
  console.log(`✓ Tenant: ${tenant.name} (slug: ${tenant.slug})`);

  // ── Usuários ─────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash("Medicine@2025!", 12);

  const [admin, vendas] = await Promise.all([
    prisma.user.upsert({
      where:  { id: ID.users.admin },
      update: {},
      create: {
        id:           ID.users.admin,
        tenantId:     tenant.id,
        name:         "Fernando Jorge",
        email:        "admin@medicinecursos.com.br",
        passwordHash,
        role:         "ADMIN",
        active:       true,
      },
    }),
    prisma.user.upsert({
      where:  { id: ID.users.vendas },
      update: {},
      create: {
        id:           ID.users.vendas,
        tenantId:     tenant.id,
        name:         "Equipe Comercial",
        email:        "vendas@medicinecursos.com.br",
        passwordHash,
        role:         "ANALYST",
        active:       true,
      },
    }),
  ]);

  for (const u of [admin, vendas]) {
    await prisma.membership.upsert({
      where:  { tenantId_userId: { tenantId: tenant.id, userId: u.id } },
      update: {},
      create: { tenantId: tenant.id, userId: u.id, role: u.role, acceptingLeads: true },
    });
  }
  console.log(`✓ Usuários criados`);
  console.log(`  admin@medicinecursos.com.br  → ADMIN`);
  console.log(`  vendas@medicinecursos.com.br → ANALYST`);
  console.log(`  Senha: Medicine@2025!`);

  // ── Empresas (clientes institucionais) ───────────────────────────────────
  const [hosp1, hosp2, clin1] = await Promise.all([
    prisma.company.upsert({
      where:  { id: ID.companies.hosp1 },
      update: {},
      create: {
        id: ID.companies.hosp1, tenantId: tenant.id,
        name: "Hospital São Camilo — Rede SP",
        website: "https://saocamilo-sp.br",
        phone: "(11) 3172-8000",
        email: "educacao@saocamilo-sp.br",
        industry: "Saúde / Hospital",
      },
    }),
    prisma.company.upsert({
      where:  { id: ID.companies.hosp2 },
      update: {},
      create: {
        id: ID.companies.hosp2, tenantId: tenant.id,
        name: "UPA Zona Norte — Prefeitura SP",
        website: "https://prefeitura.sp.gov.br",
        phone: "(11) 3397-2000",
        email: "treinamento@upa.sp.gov.br",
        industry: "Saúde / Pública",
      },
    }),
    prisma.company.upsert({
      where:  { id: ID.companies.clin1 },
      update: {},
      create: {
        id: ID.companies.clin1, tenantId: tenant.id,
        name: "Clínica Dra. Renata Vieira",
        website: "https://clinicavieira.com.br",
        phone: "(11) 98881-2233",
        email: "contato@clinicavieira.com.br",
        industry: "Saúde / Clínica Privada",
      },
    }),
  ]);
  console.log(`✓ Empresas: ${[hosp1, hosp2, clin1].map(c => c.name).join(", ")}`);

  // ── Contatos ─────────────────────────────────────────────────────────────
  await Promise.all([
    prisma.contact.upsert({
      where:  { id: ID.contacts.c1 },
      update: {},
      create: {
        id: ID.contacts.c1, tenantId: tenant.id, companyId: hosp1.id,
        name: "Dr. Marcelo Ribeiro", email: "m.ribeiro@saocamilo-sp.br",
        phone: "(11) 99111-0001", role: "Diretor de Educação Médica Continuada",
      },
    }),
    prisma.contact.upsert({
      where:  { id: ID.contacts.c2 },
      update: {},
      create: {
        id: ID.contacts.c2, tenantId: tenant.id, companyId: hosp2.id,
        name: "Enf. Carla Moura", email: "c.moura@upa.sp.gov.br",
        phone: "(11) 99222-0002", role: "Coordenadora de Treinamentos",
      },
    }),
    prisma.contact.upsert({
      where:  { id: ID.contacts.c3 },
      update: {},
      create: {
        id: ID.contacts.c3, tenantId: tenant.id, companyId: clin1.id,
        name: "Dra. Renata Vieira", email: "renata@clinicavieira.com.br",
        phone: "(11) 98881-2233", role: "Proprietária / Clínico Geral",
      },
    }),
  ]);
  console.log(`✓ Contatos: 3`);

  // ── Pipeline ─────────────────────────────────────────────────────────────
  const pipeline = await prisma.pipeline.upsert({
    where:  { id: ID.pipeline },
    update: {},
    create: { id: ID.pipeline, tenantId: tenant.id, name: "Pipeline Comercial", isDefault: true },
  });

  const stagesData = [
    { name: "Interesse Inicial", color: "#8b5cf6" },
    { name: "Proposta Enviada",  color: "#3b82f6" },
    { name: "Em Negociação",     color: "#f59e0b" },
    { name: "Aguardando Aprovação", color: "#f97316" },
    { name: "Fechado",           color: "#10b981" },
  ];

  const stages = await Promise.all(
    stagesData.map((data, i) =>
      prisma.stage.upsert({
        where:  { id: ID.stages[i] },
        update: {},
        create: { id: ID.stages[i], tenantId: tenant.id, pipelineId: pipeline.id, order: i, ...data },
      })
    )
  );
  console.log(`✓ Pipeline "${pipeline.name}" com ${stages.length} estágios`);

  // ── Leads iniciais ────────────────────────────────────────────────────────
  const leadsData = [
    { name: "Dr. Paulo Henrique",  email: "ph.lima@gmail.com",        phone: "(11) 99300-0001", source: "WEBSITE",       status: "NOVO",        assignedTo: vendas.id, score: 45, scoreLabel: "morno",  createdAt: daysAgo(2)  },
    { name: "Enf. Luciana Torres", email: "lu.torres@hotmail.com",    phone: "(21) 99300-0002", source: "INDICACAO",     status: "EM_CONTATO",  assignedTo: admin.id,  score: 72, scoreLabel: "quente", createdAt: daysAgo(5)  },
    { name: "Dr. Rodrigo Castro",  email: "r.castro@ubs.rj.gov.br",  phone: "(21) 99300-0003", source: "INSTAGRAM",     status: "QUALIFICADO", assignedTo: vendas.id, score: 68, scoreLabel: "quente", createdAt: daysAgo(10) },
    { name: "Dra. Ana Beatriz",    email: "anabeatriz@clinicab.com",  phone: "(31) 99300-0004", source: "COLD_OUTREACH", status: "NOVO",        assignedTo: vendas.id, score: 28, scoreLabel: "frio",   createdAt: daysAgo(1)  },
    { name: "Dr. Felipe Andrade",  email: "fandrade@hospital.com",    phone: "(11) 99300-0005", source: "WHATSAPP",      status: "EM_CONTATO",  assignedTo: admin.id,  score: 55, scoreLabel: "morno",  createdAt: daysAgo(7)  },
    { name: "Enf. Patrícia Luz",   email: "p.luz@upa.fortaleza.com",  phone: "(85) 99300-0006", source: "WEBSITE",       status: "NOVO",        assignedTo: vendas.id, score: 31, scoreLabel: "frio",   createdAt: daysAgo(0)  },
    { name: "Dr. Carlos Braga",    email: "cbraga@medico.com.br",     phone: "(41) 99300-0007", source: "INDICACAO",     status: "QUALIFICADO", assignedTo: admin.id,  score: 80, scoreLabel: "quente", createdAt: daysAgo(14) },
    { name: "Dra. Isabela Fontes", email: "isa.fontes@gmail.com",     phone: "(61) 99300-0008", source: "EVENTO",        status: "CONVERTIDO",  assignedTo: vendas.id, score: 95, scoreLabel: "quente", createdAt: daysAgo(30) },
  ];

  await Promise.all(
    leadsData.map((data, i) =>
      prisma.lead.upsert({
        where:  { id: ID.leads[i] },
        update: { score: data.score, scoreLabel: data.scoreLabel, scoreUpdatedAt: daysAgo(1) },
        create: { id: ID.leads[i], tenantId: tenant.id, scoreUpdatedAt: daysAgo(1), ...data },
      })
    )
  );
  console.log(`✓ Leads: ${leadsData.length}`);

  // ── Oportunidades ─────────────────────────────────────────────────────────
  const oppsData = [
    {
      title:           "Pacote Residência Médica 2025 — Hosp. São Camilo",
      stageIdx:        2,
      value:           38400,
      probability:     70,
      assignedTo:      admin.id,
      companyId:       hosp1.id,
      contactId:       ID.contacts.c1,
      expectedCloseAt: daysFromNow(20),
    },
    {
      title:           "Curso ACLS/BLS — UPA Zona Norte (60 profissionais)",
      stageIdx:        1,
      value:           12000,
      probability:     50,
      assignedTo:      vendas.id,
      companyId:       hosp2.id,
      contactId:       ID.contacts.c2,
      expectedCloseAt: daysFromNow(35),
    },
    {
      title:           "Assinatura Anual — Clínica Dra. Renata Vieira",
      stageIdx:        3,
      value:           4800,
      probability:     90,
      assignedTo:      admin.id,
      companyId:       clin1.id,
      contactId:       ID.contacts.c3,
      expectedCloseAt: daysFromNow(5),
    },
    {
      title:           "Treinamento de Equipe — Dr. Carlos Braga (Grupo)",
      stageIdx:        0,
      value:           8500,
      probability:     35,
      assignedTo:      vendas.id,
      companyId:       null,
      contactId:       null,
      expectedCloseAt: daysFromNow(60),
    },
  ];

  await Promise.all(
    oppsData.map(({ stageIdx, contactId, ...data }, i) =>
      prisma.opportunity.upsert({
        where:  { id: ID.opps[i] },
        update: {},
        create: {
          id: ID.opps[i], tenantId: tenant.id,
          pipelineId: pipeline.id, stageId: stages[stageIdx].id,
          currency: "BRL", status: "ABERTA",
          contactId: contactId ?? undefined,
          ...data,
        },
      })
    )
  );
  const totalValue = oppsData.reduce((s, o) => s + o.value, 0);
  console.log(`✓ Oportunidades: ${oppsData.length} — Pipeline: R$ ${totalValue.toLocaleString("pt-BR")}`);

  // ── Tarefas iniciais ──────────────────────────────────────────────────────
  await prisma.task.upsert({
    where: { id: "medicine-task-1" },
    update: {},
    create: {
      id: "medicine-task-1", tenantId: tenant.id,
      title: "Enviar proposta de Residência para Dr. Marcelo Ribeiro",
      assignedTo: admin.id, priority: "ALTA",
      dueAt: daysFromNow(3), opportunityId: ID.opps[0],
    },
  });
  await prisma.task.upsert({
    where: { id: "medicine-task-2" },
    update: {},
    create: {
      id: "medicine-task-2", tenantId: tenant.id,
      title: "Follow-up Dr. Paulo Henrique — aguardando resposta",
      assignedTo: vendas.id, priority: "MEDIA",
      dueAt: daysFromNow(1), leadId: ID.leads[0],
    },
  });
  console.log(`✓ Tarefas: 2`);

  // ── Resumo ───────────────────────────────────────────────────────────────
  console.log("\n╔══════════════════════════════════════════════════╗");
  console.log("║   ✓  Seed Medicine Cursos concluído!             ║");
  console.log("╠══════════════════════════════════════════════════╣");
  console.log("║  Tenant:  Medicine Cursos (medicine-cursos)      ║");
  console.log("║  ─────────────────────────────────────────────  ║");
  console.log("║  Credenciais (senha: Medicine@2025!)             ║");
  console.log("║    admin@medicinecursos.com.br  → ADMIN          ║");
  console.log("║    vendas@medicinecursos.com.br → ANALYST        ║");
  console.log("║  ─────────────────────────────────────────────  ║");
  console.log("║  Dados criados:                                  ║");
  console.log("║    • 3 empresas (hospitais + clínica)            ║");
  console.log("║    • 3 contatos institucionais                   ║");
  console.log("║    • 8 leads de médicos/enfermeiros              ║");
  console.log("║    • 4 oportunidades no pipeline                 ║");
  console.log("║    • 2 tarefas com prazo                         ║");
  console.log("╚══════════════════════════════════════════════════╝\n");
}

main()
  .catch((e) => {
    console.error("\n❌ Seed falhou:", e.message);
    console.error(e.stack);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

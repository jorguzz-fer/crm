"use strict";
/**
 * Seed de dados demo para onboarding.
 *
 * Cria um tenant "Acme Vendas" com:
 *   - 4 usuários (admin, supervisor, 2 analistas)
 *   - 5 empresas com contatos
 *   - 12 leads em diferentes status e origens
 *   - 1 pipeline com 5 estágios e 6 oportunidades
 *   - 10 atividades (ligações, reuniões, e-mails)
 *   - 6 tarefas com prioridades variadas
 *   - Notas espalhadas em leads e oportunidades
 *
 * Uso (no terminal do Coolify ou localmente):
 *   node /app/prisma/seed.js
 *   # ou localmente:
 *   DATABASE_URL="..." node packages/db/prisma/seed.js
 */

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

// ─── Helpers ──────────────────────────────────────────────────────────────────

const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);
const daysFromNow = (n) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);
const hoursAgo = (n) => new Date(Date.now() - n * 60 * 60 * 1000);

async function main() {
  console.log("→ Iniciando seed demo...\n");

  // ─── Tenant ───────────────────────────────────────────────────────────────

  const tenant = await prisma.tenant.upsert({
    where: { slug: "acme-vendas" },
    update: { name: "Acme Vendas" },
    create: { name: "Acme Vendas", slug: "acme-vendas", plan: "PRO", active: true },
  });
  console.log(`✓ Tenant: ${tenant.name} (${tenant.slug})`);

  // ─── Usuários ─────────────────────────────────────────────────────────────

  const passwordHash = await bcrypt.hash("Admin@2025!", 12);

  const users = await Promise.all([
    prisma.user.upsert({
      where: { email: "admin@acme.com" },
      update: {},
      create: { tenantId: tenant.id, name: "Ana Costa", email: "admin@acme.com", passwordHash, role: "ADMIN", active: true },
    }),
    prisma.user.upsert({
      where: { email: "supervisor@acme.com" },
      update: {},
      create: { tenantId: tenant.id, name: "Bruno Oliveira", email: "supervisor@acme.com", passwordHash, role: "SUPERVISOR", active: true },
    }),
    prisma.user.upsert({
      where: { email: "joao@acme.com" },
      update: {},
      create: { tenantId: tenant.id, name: "João Lima", email: "joao@acme.com", passwordHash, role: "ANALYST", active: true },
    }),
    prisma.user.upsert({
      where: { email: "maria@acme.com" },
      update: {},
      create: { tenantId: tenant.id, name: "Maria Santos", email: "maria@acme.com", passwordHash, role: "ANALYST", active: true },
    }),
  ]);

  const [admin, supervisor, joao, maria] = users;

  for (const u of users) {
    await prisma.membership.upsert({
      where: { tenantId_userId: { tenantId: tenant.id, userId: u.id } },
      update: {},
      create: { tenantId: tenant.id, userId: u.id, role: u.role },
    });
  }
  console.log(`✓ Usuários: ${users.map((u) => u.name).join(", ")}`);
  console.log(`  Senha de todos: Admin@2025!`);

  // ─── Empresas ─────────────────────────────────────────────────────────────

  const companiesData = [
    { name: "TechBrasil Software LTDA", cnpj: "12.345.678/0001-90", website: "https://techbrasil.com.br", phone: "(11) 3000-1000", email: "contato@techbrasil.com.br", industry: "Tecnologia" },
    { name: "Varejo Certo Comércio S.A.", cnpj: "98.765.432/0001-10", website: "https://varejocerto.com.br", phone: "(21) 3500-2000", email: "comercial@varejocerto.com.br", industry: "Varejo" },
    { name: "Construtora Alpha LTDA", cnpj: "11.222.333/0001-44", website: "https://alphaconstrucoes.com.br", phone: "(31) 3200-4000", email: "obras@alphaconstrucoes.com.br", industry: "Construção Civil" },
    { name: "Clínica Saúde Plena", cnpj: "55.666.777/0001-88", website: "https://saudeplena.com.br", phone: "(41) 3100-5000", email: "agendamento@saudeplena.com.br", industry: "Saúde" },
    { name: "Agro Insumos do Brasil", cnpj: "33.444.555/0001-22", website: "https://agroinsumos.com.br", phone: "(67) 3800-6000", email: "vendas@agroinsumos.com.br", industry: "Agronegócio" },
  ];

  const companies = [];
  for (const data of companiesData) {
    const company = await prisma.company.upsert({
      where: { id: `seed-company-${data.cnpj.replace(/\D/g, "")}` },
      update: {},
      create: { id: `seed-company-${data.cnpj.replace(/\D/g, "")}`, tenantId: tenant.id, ...data },
    });
    companies.push(company);
  }
  console.log(`✓ Empresas: ${companies.length} criadas`);

  // ─── Contatos ─────────────────────────────────────────────────────────────

  const contactsData = [
    { name: "Carlos Mendes", email: "carlos@techbrasil.com.br", phone: "(11) 99001-1111", role: "CTO", companyIdx: 0 },
    { name: "Fernanda Rocha", email: "fernanda@techbrasil.com.br", phone: "(11) 99002-2222", role: "Diretora de Operações", companyIdx: 0 },
    { name: "Roberto Alves", email: "roberto@varejocerto.com.br", phone: "(21) 99003-3333", role: "Gerente Comercial", companyIdx: 1 },
    { name: "Patrícia Lima", email: "patricia@varejocerto.com.br", phone: "(21) 99004-4444", role: "Compradora", companyIdx: 1 },
    { name: "Eduardo Barros", email: "eduardo@alphaconstrucoes.com.br", phone: "(31) 99005-5555", role: "Engenheiro Chefe", companyIdx: 2 },
    { name: "Juliana Ferreira", email: "juliana@saudeplena.com.br", phone: "(41) 99006-6666", role: "Diretora Médica", companyIdx: 3 },
    { name: "Marcos Nunes", email: "marcos@agroinsumos.com.br", phone: "(67) 99007-7777", role: "Gerente de Vendas", companyIdx: 4 },
    { name: "Luciana Pinto", email: "luciana@agroinsumos.com.br", phone: "(67) 99008-8888", role: "Analista de Compras", companyIdx: 4 },
  ];

  const contacts = [];
  for (const { companyIdx, ...data } of contactsData) {
    const contact = await prisma.contact.upsert({
      where: { id: `seed-contact-${data.email}` },
      update: {},
      create: { id: `seed-contact-${data.email}`, tenantId: tenant.id, companyId: companies[companyIdx].id, ...data },
    });
    contacts.push(contact);
  }
  console.log(`✓ Contatos: ${contacts.length} criados`);

  // ─── Pipeline e Estágios ──────────────────────────────────────────────────

  const pipeline = await prisma.pipeline.upsert({
    where: { id: "seed-pipeline-principal" },
    update: {},
    create: { id: "seed-pipeline-principal", tenantId: tenant.id, name: "Pipeline Principal", isDefault: true },
  });

  const stagesData = [
    { id: "seed-stage-0", name: "Prospecção",   order: 0, color: "#8b5cf6" },
    { id: "seed-stage-1", name: "Qualificação", order: 1, color: "#3b82f6" },
    { id: "seed-stage-2", name: "Proposta",     order: 2, color: "#f59e0b" },
    { id: "seed-stage-3", name: "Negociação",   order: 3, color: "#f97316" },
    { id: "seed-stage-4", name: "Fechamento",   order: 4, color: "#10b981" },
  ];

  const stages = [];
  for (const data of stagesData) {
    const stage = await prisma.stage.upsert({
      where: { id: data.id },
      update: {},
      create: { ...data, tenantId: tenant.id, pipelineId: pipeline.id },
    });
    stages.push(stage);
  }
  console.log(`✓ Pipeline "${pipeline.name}" com ${stages.length} estágios`);

  // ─── Leads ────────────────────────────────────────────────────────────────

  const leadsData = [
    { name: "Rafael Augusto",    email: "rafael@startup.io",       phone: "(11) 98000-0001", source: "WEBSITE",       status: "NOVO",           assignedTo: joao.id,  companyId: null,           createdAt: daysAgo(3) },
    { name: "Camila Dias",       email: "camila@loja-moda.com.br", phone: "(21) 98000-0002", source: "INSTAGRAM",     status: "EM_CONTATO",     assignedTo: maria.id, companyId: null,           createdAt: daysAgo(7) },
    { name: "Thiago Cavalcante", email: "thiago@indústria.com",    phone: "(11) 98000-0003", source: "INDICACAO",     status: "QUALIFICADO",    assignedTo: joao.id,  companyId: companies[0].id, createdAt: daysAgo(14) },
    { name: "Renata Bittencourt",email: "renata@consultoria.com",  phone: "(31) 98000-0004", source: "COLD_OUTREACH", status: "EM_CONTATO",     assignedTo: supervisor.id, companyId: null,      createdAt: daysAgo(10) },
    { name: "Diego Fonseca",     email: "diego@logística.com",     phone: "(41) 98000-0005", source: "EVENTO",        status: "QUALIFICADO",    assignedTo: maria.id, companyId: companies[1].id, createdAt: daysAgo(20) },
    { name: "Aline Nogueira",    email: "aline@ecommerce.com",     phone: "(85) 98000-0006", source: "WHATSAPP",      status: "NOVO",           assignedTo: joao.id,  companyId: null,           createdAt: daysAgo(2) },
    { name: "Gustavo Monteiro",  email: "gustavo@fintech.com",     phone: "(11) 98000-0007", source: "WEBSITE",       status: "CONVERTIDO",     assignedTo: supervisor.id, companyId: companies[2].id, createdAt: daysAgo(45) },
    { name: "Tatiane Correia",   email: "tatiane@saude.com",       phone: "(61) 98000-0008", source: "INDICACAO",     status: "DESQUALIFICADO", assignedTo: maria.id, companyId: null,           createdAt: daysAgo(30) },
    { name: "Fabio Neto",        email: "fabio@agro.com",          phone: "(65) 98000-0009", source: "FACEBOOK",      status: "NOVO",           assignedTo: joao.id,  companyId: companies[4].id, createdAt: daysAgo(1) },
    { name: "Simone Barbosa",    email: "simone@rh.com",           phone: "(11) 98000-0010", source: "WEBSITE",       status: "EM_CONTATO",     assignedTo: supervisor.id, companyId: null,      createdAt: daysAgo(5) },
    { name: "Paulo Meirelles",   email: "paulo@educação.com",      phone: "(71) 98000-0011", source: "EVENTO",        status: "QUALIFICADO",    assignedTo: maria.id, companyId: companies[3].id, createdAt: daysAgo(18) },
    { name: "Cristina Araújo",   email: "cristina@imob.com",       phone: "(41) 98000-0012", source: "COLD_OUTREACH", status: "NOVO",           assignedTo: joao.id,  companyId: null,           createdAt: daysAgo(0) },
  ];

  const leads = [];
  for (const data of leadsData) {
    const lead = await prisma.lead.upsert({
      where: { id: `seed-lead-${data.email}` },
      update: {},
      create: { id: `seed-lead-${data.email}`, tenantId: tenant.id, ...data },
    });
    leads.push(lead);
  }
  console.log(`✓ Leads: ${leads.length} criados`);

  // ─── Oportunidades ────────────────────────────────────────────────────────

  const opportunitiesData = [
    { title: "Implantação CRM — TechBrasil",    stageIdx: 3, value: 48000,  probability: 80, assignedTo: supervisor.id, leadId: leads[2].id, companyId: companies[0].id, contactId: contacts[0].id, expectedCloseAt: daysFromNow(15) },
    { title: "Licenças Software — Varejo Certo", stageIdx: 2, value: 24000,  probability: 60, assignedTo: joao.id,       leadId: leads[4].id, companyId: companies[1].id, contactId: contacts[2].id, expectedCloseAt: daysFromNow(30) },
    { title: "Consultoria Alpha Construtora",    stageIdx: 1, value: 85000,  probability: 40, assignedTo: maria.id,      leadId: null,        companyId: companies[2].id, contactId: contacts[4].id, expectedCloseAt: daysFromNow(45) },
    { title: "Sistema Clínica Saúde Plena",      stageIdx: 4, value: 32000,  probability: 95, assignedTo: supervisor.id, leadId: leads[10].id, companyId: companies[3].id, contactId: contacts[5].id, expectedCloseAt: daysFromNow(7) },
    { title: "Pacote Agro Insumos — Safra 2025", stageIdx: 2, value: 120000, probability: 55, assignedTo: joao.id,       leadId: leads[8].id, companyId: companies[4].id, contactId: contacts[6].id, expectedCloseAt: daysFromNow(60) },
    { title: "Suporte Premium — TechBrasil",     stageIdx: 0, value: 18000,  probability: 20, assignedTo: maria.id,      leadId: null,        companyId: companies[0].id, contactId: contacts[1].id, expectedCloseAt: daysFromNow(90) },
  ];

  const opportunities = [];
  for (const { stageIdx, ...data } of opportunitiesData) {
    const opp = await prisma.opportunity.upsert({
      where: { id: `seed-opp-${data.title.slice(0, 30).replace(/\s+/g, "-")}` },
      update: {},
      create: {
        id: `seed-opp-${data.title.slice(0, 30).replace(/\s+/g, "-")}`,
        tenantId: tenant.id,
        pipelineId: pipeline.id,
        stageId: stages[stageIdx].id,
        currency: "BRL",
        status: "ABERTA",
        ...data,
      },
    });
    opportunities.push(opp);
  }
  console.log(`✓ Oportunidades: ${opportunities.length} criadas`);

  // ─── Atividades ───────────────────────────────────────────────────────────

  const activitiesData = [
    { userId: joao.id,       type: "LIGACAO",  subject: "Apresentação inicial do produto",          leadId: leads[0].id,  occurredAt: daysAgo(3),  duration: 20 },
    { userId: maria.id,      type: "EMAIL",    subject: "Envio de proposta comercial",               leadId: leads[1].id,  occurredAt: daysAgo(6),  duration: null },
    { userId: supervisor.id, type: "REUNIAO",  subject: "Demo técnica — TechBrasil",                 opportunityId: opportunities[0].id, companyId: companies[0].id, occurredAt: daysAgo(5), duration: 60 },
    { userId: joao.id,       type: "WHATSAPP", subject: "Follow-up pós proposta",                    leadId: leads[4].id,  occurredAt: daysAgo(4),  duration: null },
    { userId: maria.id,      type: "LIGACAO",  subject: "Qualificação de necessidades",              leadId: leads[3].id,  occurredAt: daysAgo(9),  duration: 30 },
    { userId: supervisor.id, type: "REUNIAO",  subject: "Reunião de alinhamento estratégico",        companyId: companies[2].id, opportunityId: opportunities[2].id, occurredAt: daysAgo(8), duration: 90 },
    { userId: joao.id,       type: "EMAIL",    subject: "Envio de case de sucesso",                  leadId: leads[9].id,  occurredAt: daysAgo(2),  duration: null },
    { userId: maria.id,      type: "VISITA",   subject: "Visita técnica na Clínica Saúde Plena",     companyId: companies[3].id, opportunityId: opportunities[3].id, occurredAt: daysAgo(7), duration: 120 },
    { userId: joao.id,       type: "LIGACAO",  subject: "Negociação de condições — Agro Insumos",   opportunityId: opportunities[4].id, leadId: leads[8].id, occurredAt: daysAgo(3), duration: 45 },
    { userId: supervisor.id, type: "EMAIL",    subject: "Proposta revisada com desconto aplicado",   opportunityId: opportunities[1].id, companyId: companies[1].id, occurredAt: daysAgo(1), duration: null },
  ];

  for (const data of activitiesData) {
    await prisma.activity.create({
      data: { tenantId: tenant.id, ...data },
    });
  }
  console.log(`✓ Atividades: ${activitiesData.length} criadas`);

  // ─── Tarefas ──────────────────────────────────────────────────────────────

  const tasksData = [
    { title: "Enviar contrato revisado para TechBrasil",      assignedTo: supervisor.id, priority: "URGENTE", dueAt: daysFromNow(2),  opportunityId: opportunities[0].id },
    { title: "Agendar demo com Varejo Certo",                  assignedTo: joao.id,       priority: "ALTA",    dueAt: daysFromNow(5),  opportunityId: opportunities[1].id },
    { title: "Levantar requisitos Alpha Construtora",          assignedTo: maria.id,      priority: "MEDIA",   dueAt: daysFromNow(10), opportunityId: opportunities[2].id },
    { title: "Confirmar kickoff Clínica Saúde Plena",          assignedTo: supervisor.id, priority: "ALTA",    dueAt: daysFromNow(3),  opportunityId: opportunities[3].id },
    { title: "Preparar apresentação safra 2025",               assignedTo: joao.id,       priority: "MEDIA",   dueAt: daysFromNow(14), opportunityId: opportunities[4].id },
    { title: "Follow-up com Rafael Augusto (lead frio)",       assignedTo: joao.id,       priority: "BAIXA",   dueAt: daysFromNow(7),  leadId: leads[0].id },
  ];

  for (const data of tasksData) {
    await prisma.task.create({
      data: { tenantId: tenant.id, ...data },
    });
  }
  console.log(`✓ Tarefas: ${tasksData.length} criadas`);

  // ─── Notas ────────────────────────────────────────────────────────────────

  const notesData = [
    { userId: supervisor.id, content: "Cliente muito receptivo durante a demo. Pediu referências de clientes do setor de tecnologia. Enviar lista com 3 cases.", opportunityId: opportunities[0].id, leadId: leads[2].id },
    { userId: joao.id,       content: "Lead veio via formulário do site. Interessado na integração com ERP SAP. Verificar compatibilidade antes da próxima reunião.", leadId: leads[0].id },
    { userId: maria.id,      content: "Responsável por compras está em período de férias até o dia 20. Retomar contato na semana seguinte com nova proposta.", leadId: leads[4].id },
    { userId: supervisor.id, content: "Oportunidade com alta probabilidade de fechamento. Cliente já aprovou budget internamente. Aguarda apenas validação jurídica do contrato.", opportunityId: opportunities[3].id },
    { userId: joao.id,       content: "Agro Insumos tem interesse em expandir o pacote para incluir módulo de rastreabilidade. Explorar na próxima reunião.", opportunityId: opportunities[4].id },
    { userId: maria.id,      content: "Construtora Alpha opera em 5 estados. Precisarão de treinamento regional. Estimar custo adicional de R$ 8k para capacitação presencial.", opportunityId: opportunities[2].id },
  ];

  for (const data of notesData) {
    await prisma.note.create({
      data: { tenantId: tenant.id, ...data },
    });
  }
  console.log(`✓ Notas: ${notesData.length} criadas`);

  // ─── Resumo final ─────────────────────────────────────────────────────────

  console.log("\n══════════════════════════════════════════");
  console.log("  ✓ Seed demo concluído com sucesso!");
  console.log("══════════════════════════════════════════");
  console.log(`  Tenant:   ${tenant.name} (slug: ${tenant.slug})`);
  console.log(`  Login:    admin@acme.com`);
  console.log(`  Senha:    Admin@2025!`);
  console.log("  Outros usuários (mesma senha):");
  console.log("    supervisor@acme.com  (Supervisor)");
  console.log("    joao@acme.com        (Analista)");
  console.log("    maria@acme.com       (Analista)");
  console.log("══════════════════════════════════════════\n");
}

main()
  .catch((e) => {
    console.error("❌ Seed falhou:", e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

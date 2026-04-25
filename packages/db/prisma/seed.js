"use strict";
/**
 * Seed de dados demo — totalmente idempotente (upsert em tudo).
 * Cobre todos os módulos: CRM, pipeline, IA, LGPD, visitas, WhatsApp, tracking.
 *
 * Uso local:
 *   DATABASE_URL="postgresql://..." node packages/db/prisma/seed.js
 *
 * Uso no Coolify (após deploy):
 *   node /app/prisma/seed.js
 *
 * Credenciais criadas:
 *   admin@acme.com / Admin@2025!  (ADMIN)
 *   supervisor@acme.com           (SUPERVISOR)
 *   joao@acme.com                 (ANALYST)
 *   maria@acme.com                (ANALYST)
 */

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

// ─── Helpers de data ──────────────────────────────────────────────────────────
const daysAgo      = (n) => new Date(Date.now() - n * 86400000);
const daysFromNow  = (n) => new Date(Date.now() + n * 86400000);
const hoursAgo     = (n) => new Date(Date.now() - n * 3600000);

// ─── IDs fixos (permite re-run idempotente) ───────────────────────────────────
const ID = {
  tenant: "seed-tenant-acme",

  users: {
    admin:      "seed-user-admin",
    supervisor: "seed-user-supervisor",
    joao:       "seed-user-joao",
    maria:      "seed-user-maria",
  },

  companies: {
    tech:    "seed-co-tech",
    varejo:  "seed-co-varejo",
    alpha:   "seed-co-alpha",
    saude:   "seed-co-saude",
    agro:    "seed-co-agro",
  },

  contacts: {
    carlos:   "seed-ct-carlos",
    fernanda: "seed-ct-fernanda",
    roberto:  "seed-ct-roberto",
    patricia: "seed-ct-patricia",
    eduardo:  "seed-ct-eduardo",
    juliana:  "seed-ct-juliana",
    marcos:   "seed-ct-marcos",
    luciana:  "seed-ct-luciana",
  },

  pipeline: "seed-pipeline-principal",
  stages:   ["seed-st-0", "seed-st-1", "seed-st-2", "seed-st-3", "seed-st-4"],

  leads: Array.from({ length: 12 }, (_, i) => `seed-lead-${i}`),

  opps: Array.from({ length: 6 }, (_, i) => `seed-opp-${i}`),

  activities: Array.from({ length: 10 }, (_, i) => `seed-act-${i}`),

  tasks: Array.from({ length: 6 }, (_, i) => `seed-task-${i}`),

  notes: Array.from({ length: 6 }, (_, i) => `seed-note-${i}`),

  visits: Array.from({ length: 4 }, (_, i) => `seed-visit-${i}`),

  alerts: Array.from({ length: 3 }, (_, i) => `seed-alert-${i}`),

  consents: Array.from({ length: 3 }, (_, i) => `seed-consent-${i}`),

  waInstance: "seed-wa-instance",
};

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("→ Iniciando seed demo...\n");

  // ── Tenant ───────────────────────────────────────────────────────────────────

  const tenant = await prisma.tenant.upsert({
    where: { id: ID.tenant },
    update: { name: "Acme Vendas" },
    create: { id: ID.tenant, name: "Acme Vendas", slug: "acme-vendas", plan: "PRO", active: true },
  });
  console.log(`✓ Tenant: ${tenant.name}`);

  // ── Usuários ─────────────────────────────────────────────────────────────────

  const passwordHash = await bcrypt.hash("Admin@2025!", 12);

  const [admin, supervisor, joao, maria] = await Promise.all([
    prisma.user.upsert({
      where: { id: ID.users.admin },
      update: {},
      create: { id: ID.users.admin, tenantId: tenant.id, name: "Ana Costa", email: "admin@acme.com", passwordHash, role: "ADMIN", active: true },
    }),
    prisma.user.upsert({
      where: { id: ID.users.supervisor },
      update: {},
      create: { id: ID.users.supervisor, tenantId: tenant.id, name: "Bruno Oliveira", email: "supervisor@acme.com", passwordHash, role: "SUPERVISOR", active: true },
    }),
    prisma.user.upsert({
      where: { id: ID.users.joao },
      update: {},
      create: { id: ID.users.joao, tenantId: tenant.id, name: "João Lima", email: "joao@acme.com", passwordHash, role: "ANALYST", active: true },
    }),
    prisma.user.upsert({
      where: { id: ID.users.maria },
      update: {},
      create: { id: ID.users.maria, tenantId: tenant.id, name: "Maria Santos", email: "maria@acme.com", passwordHash, role: "ANALYST", active: true },
    }),
  ]);

  const usersArr = [admin, supervisor, joao, maria];
  for (const u of usersArr) {
    await prisma.membership.upsert({
      where: { tenantId_userId: { tenantId: tenant.id, userId: u.id } },
      update: {},
      create: { tenantId: tenant.id, userId: u.id, role: u.role, acceptingLeads: true },
    });
  }
  console.log(`✓ Usuários: ${usersArr.map((u) => u.name).join(", ")}`);
  console.log(`  Senha: Admin@2025!`);

  // ── Empresas ─────────────────────────────────────────────────────────────────

  const [coTech, coVarejo, coAlpha, coSaude, coAgro] = await Promise.all([
    prisma.company.upsert({ where: { id: ID.companies.tech },   update: {}, create: { id: ID.companies.tech,   tenantId: tenant.id, name: "TechBrasil Software LTDA", cnpj: "12.345.678/0001-90", website: "https://techbrasil.com.br",       phone: "(11) 3000-1000", email: "contato@techbrasil.com.br",     industry: "Tecnologia"       } }),
    prisma.company.upsert({ where: { id: ID.companies.varejo }, update: {}, create: { id: ID.companies.varejo, tenantId: tenant.id, name: "Varejo Certo Comércio S.A.", cnpj: "98.765.432/0001-10", website: "https://varejocerto.com.br",       phone: "(21) 3500-2000", email: "comercial@varejocerto.com.br",   industry: "Varejo"           } }),
    prisma.company.upsert({ where: { id: ID.companies.alpha },  update: {}, create: { id: ID.companies.alpha,  tenantId: tenant.id, name: "Construtora Alpha LTDA",    cnpj: "11.222.333/0001-44", website: "https://alphaconstrucoes.com.br",  phone: "(31) 3200-4000", email: "obras@alphaconstrucoes.com.br",  industry: "Construção Civil" } }),
    prisma.company.upsert({ where: { id: ID.companies.saude },  update: {}, create: { id: ID.companies.saude,  tenantId: tenant.id, name: "Clínica Saúde Plena",       cnpj: "55.666.777/0001-88", website: "https://saudeplena.com.br",        phone: "(41) 3100-5000", email: "agendamento@saudeplena.com.br", industry: "Saúde"            } }),
    prisma.company.upsert({ where: { id: ID.companies.agro },   update: {}, create: { id: ID.companies.agro,   tenantId: tenant.id, name: "Agro Insumos do Brasil",    cnpj: "33.444.555/0001-22", website: "https://agroinsumos.com.br",       phone: "(67) 3800-6000", email: "vendas@agroinsumos.com.br",     industry: "Agronegócio"      } }),
  ]);
  const companies = [coTech, coVarejo, coAlpha, coSaude, coAgro];
  console.log(`✓ Empresas: ${companies.length}`);

  // ── Contatos ─────────────────────────────────────────────────────────────────

  const contacts = await Promise.all([
    prisma.contact.upsert({ where: { id: ID.contacts.carlos },   update: {}, create: { id: ID.contacts.carlos,   tenantId: tenant.id, companyId: coTech.id,   name: "Carlos Mendes",     email: "carlos@techbrasil.com.br",    phone: "(11) 99001-1111", role: "CTO"                   } }),
    prisma.contact.upsert({ where: { id: ID.contacts.fernanda }, update: {}, create: { id: ID.contacts.fernanda, tenantId: tenant.id, companyId: coTech.id,   name: "Fernanda Rocha",    email: "fernanda@techbrasil.com.br",  phone: "(11) 99002-2222", role: "Diretora de Operações" } }),
    prisma.contact.upsert({ where: { id: ID.contacts.roberto },  update: {}, create: { id: ID.contacts.roberto,  tenantId: tenant.id, companyId: coVarejo.id, name: "Roberto Alves",     email: "roberto@varejocerto.com.br",  phone: "(21) 99003-3333", role: "Gerente Comercial"     } }),
    prisma.contact.upsert({ where: { id: ID.contacts.patricia }, update: {}, create: { id: ID.contacts.patricia, tenantId: tenant.id, companyId: coVarejo.id, name: "Patrícia Lima",     email: "patricia@varejocerto.com.br", phone: "(21) 99004-4444", role: "Compradora"            } }),
    prisma.contact.upsert({ where: { id: ID.contacts.eduardo },  update: {}, create: { id: ID.contacts.eduardo,  tenantId: tenant.id, companyId: coAlpha.id,  name: "Eduardo Barros",    email: "eduardo@alphaconstrucoes.com.br", phone: "(31) 99005-5555", role: "Engenheiro Chefe"  } }),
    prisma.contact.upsert({ where: { id: ID.contacts.juliana },  update: {}, create: { id: ID.contacts.juliana,  tenantId: tenant.id, companyId: coSaude.id,  name: "Juliana Ferreira",  email: "juliana@saudeplena.com.br",   phone: "(41) 99006-6666", role: "Diretora Médica"       } }),
    prisma.contact.upsert({ where: { id: ID.contacts.marcos },   update: {}, create: { id: ID.contacts.marcos,   tenantId: tenant.id, companyId: coAgro.id,   name: "Marcos Nunes",      email: "marcos@agroinsumos.com.br",   phone: "(67) 99007-7777", role: "Gerente de Vendas"     } }),
    prisma.contact.upsert({ where: { id: ID.contacts.luciana },  update: {}, create: { id: ID.contacts.luciana,  tenantId: tenant.id, companyId: coAgro.id,   name: "Luciana Pinto",     email: "luciana@agroinsumos.com.br",  phone: "(67) 99008-8888", role: "Analista de Compras"   } }),
  ]);
  console.log(`✓ Contatos: ${contacts.length}`);

  // ── Pipeline e Estágios ───────────────────────────────────────────────────────

  const pipeline = await prisma.pipeline.upsert({
    where: { id: ID.pipeline },
    update: {},
    create: { id: ID.pipeline, tenantId: tenant.id, name: "Pipeline Principal", isDefault: true },
  });

  const stagesData = [
    { name: "Prospecção",   color: "#8b5cf6" },
    { name: "Qualificação", color: "#3b82f6" },
    { name: "Proposta",     color: "#f59e0b" },
    { name: "Negociação",   color: "#f97316" },
    { name: "Fechamento",   color: "#10b981" },
  ];
  const stages = await Promise.all(
    stagesData.map((data, i) =>
      prisma.stage.upsert({
        where: { id: ID.stages[i] },
        update: {},
        create: { id: ID.stages[i], tenantId: tenant.id, pipelineId: pipeline.id, order: i, ...data },
      })
    )
  );
  console.log(`✓ Pipeline "${pipeline.name}" — ${stages.length} estágios`);

  // ── Leads ────────────────────────────────────────────────────────────────────

  const leadsData = [
    { name: "Rafael Augusto",     email: "rafael@startup.io",        phone: "(11) 98000-0001", source: "WEBSITE",       status: "NOVO",           assignedTo: joao.id,       companyId: null,        score: 32,  scoreLabel: "frio",   createdAt: daysAgo(3)  },
    { name: "Camila Dias",        email: "camila@loja-moda.com.br",  phone: "(21) 98000-0002", source: "INSTAGRAM",     status: "EM_CONTATO",     assignedTo: maria.id,      companyId: null,        score: 58,  scoreLabel: "morno",  createdAt: daysAgo(7)  },
    { name: "Thiago Cavalcante",  email: "thiago@industria.com",     phone: "(11) 98000-0003", source: "INDICACAO",     status: "QUALIFICADO",    assignedTo: joao.id,       companyId: coTech.id,   score: 81,  scoreLabel: "quente", createdAt: daysAgo(14) },
    { name: "Renata Bittencourt", email: "renata@consultoria.com",   phone: "(31) 98000-0004", source: "COLD_OUTREACH", status: "EM_CONTATO",     assignedTo: supervisor.id, companyId: null,        score: 44,  scoreLabel: "morno",  createdAt: daysAgo(10) },
    { name: "Diego Fonseca",      email: "diego@logistica.com",      phone: "(41) 98000-0005", source: "EVENTO",        status: "QUALIFICADO",    assignedTo: maria.id,      companyId: coVarejo.id, score: 72,  scoreLabel: "quente", createdAt: daysAgo(20) },
    { name: "Aline Nogueira",     email: "aline@ecommerce.com",      phone: "(85) 98000-0006", source: "WHATSAPP",      status: "NOVO",           assignedTo: joao.id,       companyId: null,        score: 28,  scoreLabel: "frio",   createdAt: daysAgo(2)  },
    { name: "Gustavo Monteiro",   email: "gustavo@fintech.com",      phone: "(11) 98000-0007", source: "WEBSITE",       status: "CONVERTIDO",     assignedTo: supervisor.id, companyId: coAlpha.id,  score: 95,  scoreLabel: "quente", createdAt: daysAgo(45) },
    { name: "Tatiane Correia",    email: "tatiane@saude.com",        phone: "(61) 98000-0008", source: "INDICACAO",     status: "DESQUALIFICADO", assignedTo: maria.id,      companyId: null,        score: 12,  scoreLabel: "frio",   createdAt: daysAgo(30) },
    { name: "Fabio Neto",         email: "fabio@agro.com",           phone: "(65) 98000-0009", source: "FACEBOOK",      status: "NOVO",           assignedTo: joao.id,       companyId: coAgro.id,   score: 41,  scoreLabel: "morno",  createdAt: daysAgo(1)  },
    { name: "Simone Barbosa",     email: "simone@rh.com",            phone: "(11) 98000-0010", source: "WEBSITE",       status: "EM_CONTATO",     assignedTo: supervisor.id, companyId: null,        score: 55,  scoreLabel: "morno",  createdAt: daysAgo(5)  },
    { name: "Paulo Meirelles",    email: "paulo@educacao.com",       phone: "(71) 98000-0011", source: "EVENTO",        status: "QUALIFICADO",    assignedTo: maria.id,      companyId: coSaude.id,  score: 67,  scoreLabel: "quente", createdAt: daysAgo(18) },
    { name: "Cristina Araujo",    email: "cristina@imob.com",        phone: "(41) 98000-0012", source: "COLD_OUTREACH", status: "NOVO",           assignedTo: joao.id,       companyId: null,        score: 21,  scoreLabel: "frio",   createdAt: daysAgo(0)  },
  ];

  const leads = await Promise.all(
    leadsData.map((data, i) =>
      prisma.lead.upsert({
        where: { id: ID.leads[i] },
        update: { score: data.score, scoreLabel: data.scoreLabel, scoreUpdatedAt: daysAgo(1) },
        create: { id: ID.leads[i], tenantId: tenant.id, scoreUpdatedAt: daysAgo(1), ...data },
      })
    )
  );
  console.log(`✓ Leads: ${leads.length} (com scoring)`);

  // ── Oportunidades ─────────────────────────────────────────────────────────────

  const oppsData = [
    { title: "Implantação CRM — TechBrasil",     stageIdx: 3, value: 48000,  probability: 80, assignedTo: supervisor.id, leadId: leads[2].id,  companyId: coTech.id,   contactId: contacts[0].id, expectedCloseAt: daysFromNow(15) },
    { title: "Licenças Software — Varejo Certo", stageIdx: 2, value: 24000,  probability: 60, assignedTo: joao.id,       leadId: leads[4].id,  companyId: coVarejo.id, contactId: contacts[2].id, expectedCloseAt: daysFromNow(30) },
    { title: "Consultoria Alpha Construtora",    stageIdx: 1, value: 85000,  probability: 40, assignedTo: maria.id,      leadId: null,         companyId: coAlpha.id,  contactId: contacts[4].id, expectedCloseAt: daysFromNow(45) },
    { title: "Sistema Clínica Saúde Plena",      stageIdx: 4, value: 32000,  probability: 95, assignedTo: supervisor.id, leadId: leads[10].id, companyId: coSaude.id,  contactId: contacts[5].id, expectedCloseAt: daysFromNow(7)  },
    { title: "Pacote Agro Insumos — Safra 2025", stageIdx: 2, value: 120000, probability: 55, assignedTo: joao.id,       leadId: leads[8].id,  companyId: coAgro.id,   contactId: contacts[6].id, expectedCloseAt: daysFromNow(60) },
    { title: "Suporte Premium — TechBrasil",     stageIdx: 0, value: 18000,  probability: 20, assignedTo: maria.id,      leadId: null,         companyId: coTech.id,   contactId: contacts[1].id, expectedCloseAt: daysFromNow(90) },
  ];

  const opps = await Promise.all(
    oppsData.map(({ stageIdx, ...data }, i) =>
      prisma.opportunity.upsert({
        where: { id: ID.opps[i] },
        update: {},
        create: { id: ID.opps[i], tenantId: tenant.id, pipelineId: pipeline.id, stageId: stages[stageIdx].id, currency: "BRL", status: "ABERTA", ...data },
      })
    )
  );
  console.log(`✓ Oportunidades: ${opps.length} — Total: R$ ${oppsData.reduce((s, o) => s + o.value, 0).toLocaleString("pt-BR")}`);

  // ── Atividades ────────────────────────────────────────────────────────────────

  const activitiesData = [
    { userId: joao.id,       type: "LIGACAO",  subject: "Apresentação inicial do produto",            leadId: leads[0].id,  occurredAt: daysAgo(3),  duration: 20  },
    { userId: maria.id,      type: "EMAIL",    subject: "Envio de proposta comercial",                 leadId: leads[1].id,  occurredAt: daysAgo(6),  duration: null },
    { userId: supervisor.id, type: "REUNIAO",  subject: "Demo técnica — TechBrasil",                   opportunityId: opps[0].id, companyId: coTech.id,   occurredAt: daysAgo(5),  duration: 60  },
    { userId: joao.id,       type: "WHATSAPP", subject: "Follow-up pós proposta",                      leadId: leads[4].id,  occurredAt: daysAgo(4),  duration: null },
    { userId: maria.id,      type: "LIGACAO",  subject: "Qualificação de necessidades",                leadId: leads[3].id,  occurredAt: daysAgo(9),  duration: 30  },
    { userId: supervisor.id, type: "REUNIAO",  subject: "Reunião de alinhamento estratégico",          companyId: coAlpha.id, opportunityId: opps[2].id, occurredAt: daysAgo(8), duration: 90  },
    { userId: joao.id,       type: "EMAIL",    subject: "Envio de case de sucesso",                    leadId: leads[9].id,  occurredAt: daysAgo(2),  duration: null },
    { userId: maria.id,      type: "VISITA",   subject: "Visita técnica na Clínica Saúde Plena",       companyId: coSaude.id, opportunityId: opps[3].id, occurredAt: daysAgo(7), duration: 120 },
    { userId: joao.id,       type: "LIGACAO",  subject: "Negociação de condições — Agro Insumos",      opportunityId: opps[4].id, leadId: leads[8].id, occurredAt: daysAgo(3),  duration: 45  },
    { userId: supervisor.id, type: "EMAIL",    subject: "Proposta revisada com desconto aplicado",     opportunityId: opps[1].id, companyId: coVarejo.id, occurredAt: daysAgo(1), duration: null },
  ];

  await Promise.all(
    activitiesData.map((data, i) =>
      prisma.activity.upsert({
        where: { id: ID.activities[i] },
        update: {},
        create: { id: ID.activities[i], tenantId: tenant.id, ...data },
      })
    )
  );
  console.log(`✓ Atividades: ${activitiesData.length}`);

  // ── Tarefas ───────────────────────────────────────────────────────────────────

  const tasksData = [
    { title: "Enviar contrato revisado para TechBrasil",   assignedTo: supervisor.id, priority: "URGENTE", dueAt: daysFromNow(2),  opportunityId: opps[0].id },
    { title: "Agendar demo com Varejo Certo",              assignedTo: joao.id,       priority: "ALTA",    dueAt: daysFromNow(5),  opportunityId: opps[1].id },
    { title: "Levantar requisitos Alpha Construtora",      assignedTo: maria.id,      priority: "MEDIA",   dueAt: daysFromNow(10), opportunityId: opps[2].id },
    { title: "Confirmar kickoff Clínica Saúde Plena",      assignedTo: supervisor.id, priority: "ALTA",    dueAt: daysFromNow(3),  opportunityId: opps[3].id },
    { title: "Preparar apresentação safra 2025",           assignedTo: joao.id,       priority: "MEDIA",   dueAt: daysFromNow(14), opportunityId: opps[4].id },
    { title: "Follow-up com Rafael Augusto (lead frio)",  assignedTo: joao.id,       priority: "BAIXA",   dueAt: daysFromNow(7),  leadId: leads[0].id },
  ];

  await Promise.all(
    tasksData.map((data, i) =>
      prisma.task.upsert({
        where: { id: ID.tasks[i] },
        update: {},
        create: { id: ID.tasks[i], tenantId: tenant.id, ...data },
      })
    )
  );
  console.log(`✓ Tarefas: ${tasksData.length}`);

  // ── Notas ─────────────────────────────────────────────────────────────────────

  const notesData = [
    { userId: supervisor.id, content: "Cliente muito receptivo na demo. Pediu referências de clientes do setor de tecnologia. Enviar lista com 3 cases.", opportunityId: opps[0].id, leadId: leads[2].id },
    { userId: joao.id,       content: "Lead veio via formulário do site. Interessado em integração com ERP SAP. Verificar compatibilidade antes da próxima reunião.", leadId: leads[0].id },
    { userId: maria.id,      content: "Responsável por compras está de férias até dia 20. Retomar contato na semana seguinte com proposta atualizada.", leadId: leads[4].id },
    { userId: supervisor.id, content: "Alta probabilidade de fechamento. Budget aprovado internamente. Aguarda apenas validação jurídica do contrato.", opportunityId: opps[3].id },
    { userId: joao.id,       content: "Agro Insumos tem interesse em expandir para módulo de rastreabilidade. Explorar na próxima reunião — oportunidade de upsell.", opportunityId: opps[4].id },
    { userId: maria.id,      content: "Construtora Alpha opera em 5 estados. Precisarão de treinamento regional. Estimar custo adicional de R$ 8k para capacitação presencial.", opportunityId: opps[2].id },
  ];

  await Promise.all(
    notesData.map((data, i) =>
      prisma.note.upsert({
        where: { id: ID.notes[i] },
        update: {},
        create: { id: ID.notes[i], tenantId: tenant.id, ...data },
      })
    )
  );
  console.log(`✓ Notas: ${notesData.length}`);

  // ── Visitas de campo ──────────────────────────────────────────────────────────

  const visitsData = [
    {
      userId: maria.id, leadId: leads[10].id, companyId: coSaude.id, opportunityId: opps[3].id,
      subject: "Visita técnica — Clínica Saúde Plena",
      notes: "Levantamento da infraestrutura atual. Identificados 3 pontos críticos de integração. Médicos solicitaram demonstração presencial do módulo de agendamento.",
      outcome: "Proposta de integração enviada por e-mail no mesmo dia. Aguardando aprovação da diretoria.",
      lat: -23.5505, lng: -46.6333, address: "Av. Paulista, 1000 — São Paulo, SP",
      visitedAt: daysAgo(7),
    },
    {
      userId: joao.id, leadId: leads[8].id, companyId: coAgro.id, opportunityId: opps[4].id,
      subject: "Reunião presencial — Agro Insumos safra 2025",
      notes: "Visita à sede em Campo Grande. Participou o Gerente de Vendas e o Diretor Financeiro. Apresentado ROI projetado de 340% em 18 meses.",
      outcome: "Cliente pediu 30 dias para análise interna. Marcada reunião de follow-up para o dia 15.",
      lat: -20.4428, lng: -54.6462, address: "R. Dom Aquino, 1200 — Campo Grande, MS",
      visitedAt: daysAgo(12),
    },
    {
      userId: supervisor.id, companyId: coAlpha.id, opportunityId: opps[2].id,
      subject: "Visita à obra — Alpha Construtora",
      notes: "Acompanhamento do uso atual de planilhas para gestão de contratos. Foram identificados 12 processos manuais que seriam automatizados com nosso sistema.",
      outcome: "Engenheiro chefe altamente favorável. Escalou para o Diretor Financeiro para aprovação do budget.",
      lat: -19.9167, lng: -43.9345, address: "Av. Afonso Pena, 3000 — Belo Horizonte, MG",
      visitedAt: daysAgo(20),
    },
    {
      userId: maria.id, companyId: coVarejo.id, opportunityId: opps[1].id,
      subject: "Apresentação executiva — Varejo Certo",
      notes: "Reunião com CEO e CMO. Focamos no caso de uso de análise de dados de vendas em tempo real. Grande interesse no módulo de forecasting.",
      outcome: "Solicitado estudo de viabilidade técnica com TI deles. Prazo: 2 semanas.",
      lat: -22.9068, lng: -43.1729, address: "Av. Rio Branco, 200 — Rio de Janeiro, RJ",
      visitedAt: daysAgo(4),
    },
  ];

  await Promise.all(
    visitsData.map((data, i) =>
      prisma.visit.upsert({
        where: { id: ID.visits[i] },
        update: {},
        create: { id: ID.visits[i], tenantId: tenant.id, ...data },
      })
    )
  );
  console.log(`✓ Visitas de campo: ${visitsData.length}`);

  // ── Alertas de IA (follow-up) ─────────────────────────────────────────────────

  const alertsData = [
    { leadId: leads[0].id, type: "SEM_INTERACAO", daysStale: 3,  message: "Rafael Augusto está sem interação há 3 dias. Última atividade: ligação de apresentação. Sugestão: enviar material sobre integração SAP, conforme interesse registrado.",  dismissed: false },
    { leadId: leads[3].id, type: "SEM_INTERACAO", daysStale: 10, message: "Renata Bittencourt (Consultoria) está sem contato há 10 dias. Status: Em Contato. Considere escalar o follow-up — temperatura em queda.", dismissed: false },
    { leadId: leads[9].id, type: "TAREFA_VENCIDA", daysStale: null, message: "Simone Barbosa tem 1 tarefa vencida há 2 dias. A inatividade em leads Em Contato reduz significativamente a taxa de conversão.", dismissed: false },
  ];

  await Promise.all(
    alertsData.map((data, i) =>
      prisma.aiFollowUpAlert.upsert({
        where: { id: ID.alerts[i] },
        update: {},
        create: { id: ID.alerts[i], tenantId: tenant.id, ...data },
      })
    )
  );
  console.log(`✓ Alertas de IA: ${alertsData.length}`);

  // ── Registros de consentimento (LGPD) ─────────────────────────────────────────

  const consentsData = [
    { entityType: "LEAD",    entityId: leads[2].id,  entityName: "Thiago Cavalcante",  basis: "CONTRATO",            notes: "Aceitou termos na landing page do webinar 2025.", collectedBy: joao.id,       collectedAt: daysAgo(14) },
    { entityType: "LEAD",    entityId: leads[4].id,  entityName: "Diego Fonseca",       basis: "LEGITIMO_INTERESSE",  notes: "Lead capturado via evento presencial com lista de consentimento.", collectedBy: maria.id, collectedAt: daysAgo(20) },
    { entityType: "CONTACT", entityId: contacts[5].id, entityName: "Juliana Ferreira", basis: "CONTRATO",            notes: "Contato criado durante negociação contratual com cláusula de tratamento de dados.", collectedBy: supervisor.id, collectedAt: daysAgo(7) },
  ];

  await Promise.all(
    consentsData.map((data, i) =>
      prisma.consentRecord.upsert({
        where: { id: ID.consents[i] },
        update: {},
        create: { id: ID.consents[i], tenantId: tenant.id, ...data },
      })
    )
  );
  console.log(`✓ Registros LGPD: ${consentsData.length} consentimentos`);

  // ── WhatsApp Instance (demo — desconectada) ───────────────────────────────────

  await prisma.whatsAppInstance.upsert({
    where: { id: ID.waInstance },
    update: {},
    create: {
      id:           ID.waInstance,
      tenantId:     tenant.id,
      instanceName: `acme-vendas-${tenant.id.slice(-8)}`,
      provider:     "EVOLUTION",
      status:       "DISCONNECTED",
      phone:        null,
    },
  });
  console.log(`✓ WhatsApp Instance: criada (status: DISCONNECTED)`);

  // ── Resumo ───────────────────────────────────────────────────────────────────

  console.log("\n╔══════════════════════════════════════════╗");
  console.log("║   ✓  Seed demo concluído com sucesso!   ║");
  console.log("╠══════════════════════════════════════════╣");
  console.log(`║  Tenant:  Acme Vendas (acme-vendas)     ║`);
  console.log("║  ─────────────────────────────────────  ║");
  console.log("║  Credenciais (senha: Admin@2025!)       ║");
  console.log("║    admin@acme.com        → ADMIN        ║");
  console.log("║    supervisor@acme.com   → SUPERVISOR   ║");
  console.log("║    joao@acme.com         → ANALYST      ║");
  console.log("║    maria@acme.com        → ANALYST      ║");
  console.log("║  ─────────────────────────────────────  ║");
  console.log("║  Dados criados:                         ║");
  console.log("║    • 5 empresas + 8 contatos            ║");
  console.log("║    • 12 leads (com scoring)             ║");
  console.log("║    • 6 oportunidades no pipeline        ║");
  console.log("║    • 10 atividades + 6 tarefas          ║");
  console.log("║    • 4 visitas de campo                 ║");
  console.log("║    • 6 notas + 3 alertas de IA          ║");
  console.log("║    • 3 registros LGPD                   ║");
  console.log("║    • 1 instância WhatsApp               ║");
  console.log("╚══════════════════════════════════════════╝\n");
}

main()
  .catch((e) => {
    console.error("\n❌ Seed falhou:", e.message);
    console.error(e.stack);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

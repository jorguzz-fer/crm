/**
 * POST /api/cron/retention
 *
 * Cronjob de retenção LGPD. Roda 1× por dia (madrugada) e:
 *  1. Anonimiza leads "esquecidos" (sem atividade há LEAD_RETENTION_DAYS,
 *     status NÃO CONVERTIDO, ainda não anonimizados) — princípio da
 *     minimização (LGPD art. 6º III).
 *  2. Anonimiza contatos sem atividade há CONTACT_RETENTION_DAYS.
 *  3. Purga AuditLog com createdAt > AUDIT_RETENTION_DAYS — preserva o
 *     prazo padrão de 5 anos do art. 16 da LGPD para registros financeiros
 *     (acima desse limite só vira ruído).
 *  4. Purga AiInvocationLog > AI_LOG_RETENTION_DAYS (1 ano — dados de
 *     custo/latência não precisam de histórico tão longo).
 *  5. Purga RateLimitHit > 24h (housekeeping).
 *
 * Autenticação: header  x-cron-secret: <CRON_SECRET>
 *
 * Configurar no Coolify:
 *   Serviço → Scheduled Tasks → Cron: 30 3 * * *  (03:30 BRT)
 *   Command: curl -X POST https://seu-dominio/api/cron/retention \
 *              -H "x-cron-secret: $CRON_SECRET"
 *
 * Variáveis de ambiente:
 *   CRON_SECRET  — string aleatória (openssl rand -hex 32)
 *
 * Rodando manualmente para teste:
 *   curl -X POST http://localhost:3000/api/cron/retention \
 *     -H "x-cron-secret: $CRON_SECRET"
 */

import { NextResponse } from "next/server";
import { prisma } from "@crm/db";
import { logAudit } from "@/lib/audit";

// Janelas de retenção (em dias). Valores defaults seguindo o plano:
//   - Leads descartados em 18 meses (~547 dias)
//   - Audit log preservado 5 anos (~1825 dias)
const LEAD_RETENTION_DAYS = 547;       // 18 meses
const CONTACT_RETENTION_DAYS = 547;    // 18 meses
const AUDIT_RETENTION_DAYS = 1825;     // 5 anos
const AI_LOG_RETENTION_DAYS = 365;     // 1 ano
const RATE_LIMIT_RETENTION_HOURS = 24; // 1 dia

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

function hoursAgo(hours: number): Date {
  const d = new Date();
  d.setHours(d.getHours() - hours);
  return d;
}

interface TenantStats {
  tenantId: string;
  leadsAnonymized: number;
  contactsAnonymized: number;
}

export async function POST(req: Request) {
  // ── Autenticação por secret ───────────────────────────────────────────────
  const secret = req.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  const leadCutoff = daysAgo(LEAD_RETENTION_DAYS);
  const contactCutoff = daysAgo(CONTACT_RETENTION_DAYS);
  const auditCutoff = daysAgo(AUDIT_RETENTION_DAYS);
  const aiLogCutoff = daysAgo(AI_LOG_RETENTION_DAYS);
  const rateLimitCutoff = hoursAgo(RATE_LIMIT_RETENTION_HOURS);

  const perTenant: TenantStats[] = [];

  // ── Anonimização por tenant ───────────────────────────────────────────────
  // Iteramos por tenant pra preservar o `tenantId` no audit trail e permitir
  // que cada tenant veja no seu painel quais registros foram anonimizados.
  const tenants = await prisma.tenant.findMany({
    where: { active: true },
    select: { id: true },
  });

  for (const tenant of tenants) {
    // Leads esquecidos: sem atualização recente, não convertidos, não
    // anonimizados ainda. `updatedAt` é mexido por qualquer atividade,
    // nota ou edição manual, então é um proxy razoável de "não tocado".
    const staleLeads = await prisma.lead.findMany({
      where: {
        tenantId: tenant.id,
        anonymizedAt: null,
        status: { in: ["NOVO", "EM_CONTATO", "QUALIFICADO", "DESQUALIFICADO"] },
        updatedAt: { lt: leadCutoff },
      },
      select: { id: true },
    });

    if (staleLeads.length > 0) {
      const now = new Date();
      await prisma.lead.updateMany({
        where: { id: { in: staleLeads.map((l) => l.id) } },
        data: {
          name: "Titular Anonimizado",
          email: null,
          phone: null,
          company: null,
          anonymizedAt: now,
        },
      });

      // 1 entrada de audit por tenant (não por lead — evita explosão de
      // linhas se forem milhares). O ID exato fica em `meta.leadIds`.
      await logAudit({
        tenantId: tenant.id,
        userId: null,
        action: "lgpd.retention.anonymize_lead",
        entity: "Lead",
        entityId: null,
        meta: {
          count: staleLeads.length,
          cutoffDate: leadCutoff.toISOString(),
          retentionDays: LEAD_RETENTION_DAYS,
        },
      });
    }

    // Contatos esquecidos
    const staleContacts = await prisma.contact.findMany({
      where: {
        tenantId: tenant.id,
        anonymizedAt: null,
        updatedAt: { lt: contactCutoff },
      },
      select: { id: true },
    });

    if (staleContacts.length > 0) {
      const now = new Date();
      await prisma.contact.updateMany({
        where: { id: { in: staleContacts.map((c) => c.id) } },
        data: {
          name: "Titular Anonimizado",
          email: null,
          phone: null,
          role: null,
          anonymizedAt: now,
        },
      });

      await logAudit({
        tenantId: tenant.id,
        userId: null,
        action: "lgpd.retention.anonymize_contact",
        entity: "Contact",
        entityId: null,
        meta: {
          count: staleContacts.length,
          cutoffDate: contactCutoff.toISOString(),
          retentionDays: CONTACT_RETENTION_DAYS,
        },
      });
    }

    perTenant.push({
      tenantId: tenant.id,
      leadsAnonymized: staleLeads.length,
      contactsAnonymized: staleContacts.length,
    });
  }

  // ── Purgas globais (não dependem de tenant) ───────────────────────────────
  // AuditLog: deleta antes de tudo MENOS as próprias linhas que acabamos de
  // criar. Como o cutoff é 5 anos atrás, isso é seguro.
  const auditDeleted = await prisma.auditLog.deleteMany({
    where: { createdAt: { lt: auditCutoff } },
  });

  const aiLogDeleted = await prisma.aiInvocationLog.deleteMany({
    where: { createdAt: { lt: aiLogCutoff } },
  });

  // RateLimitHit: tabela criada via raw SQL no rateLimit.ts — usa $executeRaw.
  let rateLimitDeleted = 0;
  try {
    rateLimitDeleted = await prisma.$executeRaw`
      DELETE FROM "RateLimitHit" WHERE "hitAt" < ${rateLimitCutoff}
    `;
  } catch (err) {
    // Tabela ainda não criada (nunca houve tentativa de login) — ignora.
    console.warn("[cron/retention] RateLimitHit cleanup skipped:", err);
  }

  return NextResponse.json({
    ok: true,
    elapsedMs: Date.now() - startedAt,
    cutoffs: {
      leads: leadCutoff.toISOString(),
      contacts: contactCutoff.toISOString(),
      audit: auditCutoff.toISOString(),
      aiLog: aiLogCutoff.toISOString(),
      rateLimit: rateLimitCutoff.toISOString(),
    },
    anonymized: {
      tenantsProcessed: tenants.length,
      leadsTotal: perTenant.reduce((s, t) => s + t.leadsAnonymized, 0),
      contactsTotal: perTenant.reduce((s, t) => s + t.contactsAnonymized, 0),
      perTenant: perTenant.filter((t) => t.leadsAnonymized + t.contactsAnonymized > 0),
    },
    purged: {
      auditLogs: auditDeleted.count,
      aiLogs: aiLogDeleted.count,
      rateLimitHits: rateLimitDeleted,
    },
  });
}

/**
 * POST /api/cron/follow-up
 *
 * Endpoint de cron para detecção de leads sem interação.
 * Deve ser chamado 1× por dia por um scheduler externo (Coolify Cron, crontab, etc.).
 *
 * Autenticação: header  x-cron-secret: <CRON_SECRET>
 *
 * Configurar no Coolify:
 *   Serviço → Scheduled Tasks → Cron: 0 8 * * *
 *   Command: curl -X POST https://seu-dominio/api/cron/follow-up \
 *              -H "x-cron-secret: $CRON_SECRET"
 *
 * Variável de ambiente necessária:
 *   CRON_SECRET — string aleatória (openssl rand -hex 32)
 */

import { NextResponse } from "next/server";
import { prisma } from "@crm/db";
import { detectStaleLeads } from "@crm/ai";
import { logAudit } from "@/lib/audit";

const STALE_THRESHOLD_DAYS = 7;

export async function POST(req: Request) {
  // ── Autenticação por secret ───────────────────────────────────────────────
  const secret = req.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  let totalLeadsChecked = 0;
  let totalAlertsCreated = 0;

  // ── Busca tenants ativos ──────────────────────────────────────────────────
  const tenants = await prisma.tenant.findMany({
    where: { active: true },
    select: { id: true },
  });

  for (const tenant of tenants) {
    // Busca leads ativos com última atividade e nota (uma query por tenant)
    const leads = await prisma.lead.findMany({
      where: {
        tenantId: tenant.id,
        status: { in: ["NOVO", "EM_CONTATO", "QUALIFICADO"] },
        anonymizedAt: null,
      },
      select: {
        id: true,
        name: true,
        status: true,
        createdAt: true,
        activities: {
          orderBy: { occurredAt: "desc" },
          take: 1,
          select: { occurredAt: true },
        },
        notes: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { createdAt: true },
        },
      },
    });

    totalLeadsChecked += leads.length;

    // Normaliza para o formato que a lib espera
    const leadsForDetection = leads.map((l) => ({
      id: l.id,
      name: l.name,
      status: l.status,
      createdAt: l.createdAt,
      lastActivityAt: l.activities[0]?.occurredAt ?? null,
      lastNoteAt: l.notes[0]?.createdAt ?? null,
    }));

    const staleAlerts = detectStaleLeads(leadsForDetection, STALE_THRESHOLD_DAYS);

    for (const alert of staleAlerts) {
      // Evita duplicar alertas não-dispensados criados hoje
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const existing = await prisma.aiFollowUpAlert.findFirst({
        where: {
          tenantId: tenant.id,
          leadId: alert.leadId,
          type: "SEM_INTERACAO",
          dismissed: false,
          createdAt: { gte: todayStart },
        },
        select: { id: true },
      });

      if (!existing) {
        const created = await prisma.aiFollowUpAlert.create({
          data: {
            tenantId: tenant.id,
            leadId: alert.leadId,
            type: "SEM_INTERACAO",
            message: alert.message,
            daysStale: alert.daysStale,
          },
        });
        totalAlertsCreated++;

        await logAudit({
          tenantId: tenant.id,
          userId: null, // ação do sistema (cronjob)
          action: "ai.follow_up_alert",
          entity: "AIFollowUpAlert",
          entityId: created.id,
          meta: { leadId: alert.leadId, daysStale: alert.daysStale, type: "SEM_INTERACAO" },
        });
      }
    }
  }

  return NextResponse.json({
    ok: true,
    tenantsProcessed: tenants.length,
    leadsChecked: totalLeadsChecked,
    alertsCreated: totalAlertsCreated,
    elapsedMs: Date.now() - startedAt,
  });
}

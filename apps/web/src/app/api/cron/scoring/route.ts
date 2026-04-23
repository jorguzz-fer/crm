/**
 * GET /api/cron/scoring
 *
 * Recalcula o score de temperatura de todos os leads ativos.
 * Chamado por cron externo (ex: Coolify Cron ou crontab) 1x/dia.
 *
 * Protegido por CRON_SECRET no header Authorization.
 */
import { NextResponse } from "next/server";
import { prisma } from "@crm/db";
import { scoreLeadHeuristic } from "@crm/ai";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 min — suficiente para 10k leads

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Busca apenas leads não-anonimizados, em lotes de 200
  const PAGE = 200;
  let cursor: string | undefined;
  let processed = 0;
  let errors = 0;

  while (true) {
    const leads = await prisma.lead.findMany({
      where: { anonymizedAt: null, status: { not: "DESQUALIFICADO" } },
      select: {
        id: true,
        tenantId: true,
        status: true,
        activities: {
          orderBy: { occurredAt: "desc" },
          take: 1,
          select: { occurredAt: true },
        },
        _count: { select: { activities: true } },
        opportunities: {
          where: { status: "ABERTA" },
          select: { id: true },
          take: 1,
        },
      },
      take: PAGE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: "asc" },
    });

    if (leads.length === 0) break;
    cursor = leads[leads.length - 1].id;

    // Calcula e atualiza em paralelo (lotes de 50)
    const BATCH = 50;
    for (let i = 0; i < leads.length; i += BATCH) {
      const batch = leads.slice(i, i + BATCH);
      await Promise.allSettled(
        batch.map(async (lead) => {
          try {
            const result = scoreLeadHeuristic({
              leadId: lead.id,
              status: lead.status,
              lastActivityAt: lead.activities[0]?.occurredAt ?? null,
              activityCount: lead._count.activities,
              hasOpenOpportunity: lead.opportunities.length > 0,
            });

            await prisma.lead.update({
              where: { id: lead.id },
              data: {
                score: result.score,
                scoreLabel: result.label,
                scoreUpdatedAt: new Date(),
              },
            });
            processed++;
          } catch {
            errors++;
          }
        })
      );
    }

    if (leads.length < PAGE) break;
  }

  return NextResponse.json({ ok: true, processed, errors });
}

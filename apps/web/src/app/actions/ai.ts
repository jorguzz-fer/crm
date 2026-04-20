"use server";

import { prisma } from "@crm/db";
import { requireRole, ROLES_WRITE } from "@/lib/authz";
import { logAudit } from "@/lib/audit";
import { summarize } from "@crm/ai";
import type { SummaryResult } from "@crm/ai";

export type AISummaryState = { error: string } | { result: SummaryResult } | null;

export async function summarizeLeadAction(
  _prev: AISummaryState,
  formData: FormData
): Promise<AISummaryState> {
  const { session, error } = await requireRole(ROLES_WRITE);
  if (error) return { error: "Sem permissão" };

  const leadId = formData.get("leadId") as string;
  if (!leadId) return { error: "ID inválido" };

  const tenantId = session!.user.tenantId;

  const lead = await prisma.lead.findFirst({
    where: { id: leadId, tenantId },
    include: {
      notes: {
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      activities: {
        include: { user: { select: { name: true } } },
        orderBy: { occurredAt: "desc" },
        take: 10,
      },
    },
  });

  if (!lead) return { error: "Lead não encontrado" };

  if (!process.env.OPENROUTER_API_KEY) {
    return { error: "OPENROUTER_API_KEY não configurada. Adicione a chave nas variáveis de ambiente." };
  }

  try {
    const result = await summarize({
      entityType: "lead",
      entityName: lead.name,
      notes: lead.notes.map((n) => ({ content: n.content, author: n.user.name, date: n.createdAt })),
      activities: lead.activities.map((a) => ({
        type: a.type, subject: a.subject, description: a.description, date: a.occurredAt,
      })),
    });

    await logAudit({
      tenantId,
      userId: session!.user.id,
      action: "ai.summarize",
      entity: "Lead",
      entityId: leadId,
    });

    return { result };
  } catch {
    return { error: "Falha ao gerar resumo. Verifique a chave da API e tente novamente." };
  }
}

export async function summarizeOpportunityAction(
  _prev: AISummaryState,
  formData: FormData
): Promise<AISummaryState> {
  const { session, error } = await requireRole(ROLES_WRITE);
  if (error) return { error: "Sem permissão" };

  const opportunityId = formData.get("opportunityId") as string;
  if (!opportunityId) return { error: "ID inválido" };

  const tenantId = session!.user.tenantId;

  const opp = await prisma.opportunity.findFirst({
    where: { id: opportunityId, tenantId },
    include: {
      notes: {
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      activities: {
        include: { user: { select: { name: true } } },
        orderBy: { occurredAt: "desc" },
        take: 10,
      },
    },
  });

  if (!opp) return { error: "Oportunidade não encontrada" };

  if (!process.env.OPENROUTER_API_KEY) {
    return { error: "OPENROUTER_API_KEY não configurada. Adicione a chave nas variáveis de ambiente." };
  }

  try {
    const result = await summarize({
      entityType: "oportunidade",
      entityName: opp.title,
      notes: opp.notes.map((n) => ({ content: n.content, author: n.user.name, date: n.createdAt })),
      activities: opp.activities.map((a) => ({
        type: a.type, subject: a.subject, description: a.description, date: a.occurredAt,
      })),
    });

    await logAudit({
      tenantId,
      userId: session!.user.id,
      action: "ai.summarize",
      entity: "Opportunity",
      entityId: opportunityId,
    });

    return { result };
  } catch {
    return { error: "Falha ao gerar resumo. Verifique a chave da API e tente novamente." };
  }
}

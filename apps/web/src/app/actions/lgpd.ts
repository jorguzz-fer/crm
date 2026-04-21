"use server";

import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { requireRole, ROLES_ADMIN } from "@/lib/authz";
import { revalidatePath } from "next/cache";
import type { ConsentBasis } from "@crm/db";

// ─── Criar solicitação LGPD (export ou delete) ────────────────────────────────

export async function createDataRequestAction(
  _prev: unknown,
  formData: FormData
) {
  const { session, error } = await requireRole(ROLES_ADMIN);
  if (error) return { error: "Acesso negado" };

  const type = formData.get("type") as "EXPORT" | "DELETE";
  const entityType = formData.get("entityType") as "LEAD" | "CONTACT";
  const entityId = (formData.get("entityId") as string)?.trim();

  if (!type || !entityType || !entityId) {
    return { error: "Preencha todos os campos obrigatórios" };
  }

  // Valida que a entidade existe e pertence ao tenant
  let entityName = "";
  if (entityType === "LEAD") {
    const lead = await prisma.lead.findFirst({
      where: { id: entityId, tenantId: session.user.tenantId },
      select: { name: true },
    });
    if (!lead) return { error: "Lead não encontrado neste tenant" };
    entityName = lead.name;
  } else {
    const contact = await prisma.contact.findFirst({
      where: { id: entityId, tenantId: session.user.tenantId },
      select: { name: true },
    });
    if (!contact) return { error: "Contato não encontrado neste tenant" };
    entityName = contact.name;
  }

  // Verifica solicitação pendente duplicada
  const existing = await prisma.dataRequest.findFirst({
    where: { tenantId: session.user.tenantId, entityId, status: "PENDENTE" },
  });
  if (existing) {
    return { error: "Já existe uma solicitação pendente para este titular" };
  }

  const request = await prisma.dataRequest.create({
    data: {
      tenantId: session.user.tenantId,
      type,
      entityType,
      entityId,
      entityName,
      requestedBy: session.user.id,
    },
  });

  await logAudit({
    tenantId: session.user.tenantId,
    userId: session.user.id,
    action: `lgpd.request.${type.toLowerCase()}`,
    entity: entityType,
    entityId,
    meta: { requestId: request.id, entityName, type },
  });

  revalidatePath("/configuracoes/lgpd");
  return { success: `Solicitação de ${type === "EXPORT" ? "exportação" : "exclusão"} registrada para ${entityName}` };
}

// ─── Aprovar solicitação (processa export ou anonimiza) ───────────────────────

export async function approveDataRequestAction(
  _prev: { error: string } | { success: string } | null,
  formData: FormData
) {
  const { session, error } = await requireRole(ROLES_ADMIN);
  if (error) return { error: "Acesso negado" };

  const requestId = (formData.get("requestId") as string)?.trim();
  if (!requestId) return { error: "ID da solicitação inválido" };

  // Cross-tenant check
  const request = await prisma.dataRequest.findFirst({
    where: { id: requestId, tenantId: session.user.tenantId, status: "PENDENTE" },
  });
  if (!request) return { error: "Solicitação não encontrada ou já processada" };

  const now = new Date();

  if (request.type === "EXPORT") {
    // Gera o pacote de dados do titular
    let exportData: Record<string, unknown> = {};

    if (request.entityType === "LEAD") {
      const lead = await prisma.lead.findUnique({
        where: { id: request.entityId },
        include: {
          notes: { select: { content: true, createdAt: true } },
          activities: { select: { type: true, subject: true, description: true, occurredAt: true } },
          tasks: { select: { title: true, dueAt: true, completedAt: true, priority: true } },
          opportunities: { select: { title: true, status: true, value: true, currency: true } },
          assignee: { select: { name: true } },
        },
      });
      exportData = {
        type: "LEAD",
        exportedAt: now.toISOString(),
        requestId,
        data: lead,
      };
    } else {
      const contact = await prisma.contact.findUnique({
        where: { id: request.entityId },
        include: {
          notes: { select: { content: true, createdAt: true } },
          activities: { select: { type: true, subject: true, description: true, occurredAt: true } },
          company: { select: { name: true, cnpj: true } },
          opportunities: { select: { title: true, status: true, value: true, currency: true } },
        },
      });
      exportData = {
        type: "CONTACT",
        exportedAt: now.toISOString(),
        requestId,
        data: contact,
      };
    }

    await prisma.dataRequest.update({
      where: { id: requestId },
      data: {
        status: "CONCLUIDO",
        processedBy: session.user.id,
        processedAt: now,
        // JSON.parse(JSON.stringify()) converte para tipo compatível com Prisma Json
        exportData: JSON.parse(JSON.stringify(exportData)),
      },
    });
  } else {
    // DELETE → anonimiza (preserva o registro para integridade do audit trail)
    if (request.entityType === "LEAD") {
      await prisma.lead.update({
        where: { id: request.entityId },
        data: {
          name: "Titular Anonimizado",
          email: null,
          phone: null,
          company: null,
          anonymizedAt: now,
        },
      });
    } else {
      await prisma.contact.update({
        where: { id: request.entityId },
        data: {
          name: "Titular Anonimizado",
          email: null,
          phone: null,
          role: null,
          anonymizedAt: now,
        },
      });
    }

    await prisma.dataRequest.update({
      where: { id: requestId },
      data: {
        status: "CONCLUIDO",
        processedBy: session.user.id,
        processedAt: now,
      },
    });
  }

  await logAudit({
    tenantId: session.user.tenantId,
    userId: session.user.id,
    action: "lgpd.request.approve",
    entity: "DataRequest",
    entityId: requestId,
    meta: {
      type: request.type,
      entityType: request.entityType,
      entityId: request.entityId,
      entityName: request.entityName,
    },
  });

  revalidatePath("/configuracoes/lgpd");

  return {
    success:
      request.type === "EXPORT"
        ? "Export gerado com sucesso — disponível para download"
        : `Dados de "${request.entityName}" anonimizados com sucesso`,
  };
}

// ─── Rejeitar solicitação ─────────────────────────────────────────────────────

export async function rejectDataRequestAction(
  _prev: { error: string } | { success: string } | null,
  formData: FormData
) {
  const { session, error } = await requireRole(ROLES_ADMIN);
  if (error) return { error: "Acesso negado" };

  const requestId = (formData.get("requestId") as string)?.trim();
  if (!requestId) return { error: "ID inválido" };

  const request = await prisma.dataRequest.findFirst({
    where: { id: requestId, tenantId: session.user.tenantId, status: "PENDENTE" },
  });
  if (!request) return { error: "Solicitação não encontrada ou já processada" };

  await prisma.dataRequest.update({
    where: { id: requestId },
    data: {
      status: "REJEITADO",
      processedBy: session.user.id,
      processedAt: new Date(),
    },
  });

  await logAudit({
    tenantId: session.user.tenantId,
    userId: session.user.id,
    action: "lgpd.request.reject",
    entity: "DataRequest",
    entityId: requestId,
    meta: { entityName: request.entityName, type: request.type },
  });

  revalidatePath("/configuracoes/lgpd");
  return { success: "Solicitação rejeitada" };
}

// ─── Registrar consentimento ──────────────────────────────────────────────────

export async function registerConsentAction(
  _prev: unknown,
  formData: FormData
) {
  const { session, error } = await requireRole(ROLES_ADMIN);
  if (error) return { error: "Acesso negado" };

  const entityType = formData.get("entityType") as string;
  const entityId = (formData.get("entityId") as string)?.trim();
  const basis = formData.get("basis") as ConsentBasis;
  const notes = (formData.get("notes") as string) || undefined;

  if (!entityType || !entityId || !basis) {
    return { error: "Preencha todos os campos obrigatórios" };
  }

  // Valida entidade
  let entityName = "";
  if (entityType === "LEAD") {
    const lead = await prisma.lead.findFirst({
      where: { id: entityId, tenantId: session.user.tenantId },
      select: { name: true },
    });
    if (!lead) return { error: "Lead não encontrado" };
    entityName = lead.name;
  } else {
    const contact = await prisma.contact.findFirst({
      where: { id: entityId, tenantId: session.user.tenantId },
      select: { name: true },
    });
    if (!contact) return { error: "Contato não encontrado" };
    entityName = contact.name;
  }

  await prisma.consentRecord.create({
    data: {
      tenantId: session.user.tenantId,
      entityType,
      entityId,
      entityName,
      basis,
      notes,
      collectedBy: session.user.id,
    },
  });

  await logAudit({
    tenantId: session.user.tenantId,
    userId: session.user.id,
    action: "lgpd.consent.register",
    entity: entityType,
    entityId,
    meta: { basis, entityName },
  });

  revalidatePath("/configuracoes/lgpd");
  return { success: `Consentimento registrado para ${entityName}` };
}

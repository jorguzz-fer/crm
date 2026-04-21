"use server";

import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { requireRole, ROLES_ADMIN, ROLES_WRITE } from "@/lib/authz";
import * as evo from "@/lib/evolution";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

// ─── Conectar instância WhatsApp ──────────────────────────────────────────────

export async function connectWhatsAppAction(): Promise<
  { error: string } | { success: string; qrCode?: string }
> {
  const { session, error } = await requireRole(ROLES_ADMIN);
  if (error) return { error: "Acesso negado" };

  if (!evo.isConfigured()) {
    return { error: "EVOLUTION_API_URL e EVOLUTION_API_KEY não configurados" };
  }

  const tenantId     = session.user.tenantId;
  const instanceName = `crm-${session.user.tenantId.slice(-8)}`;

  // Obtém URL base da app para o webhook
  const hdrs       = await headers();
  const host       = hdrs.get("x-forwarded-host") ?? hdrs.get("host") ?? "localhost:3000";
  const proto      = hdrs.get("x-forwarded-proto") ?? "http";
  const webhookUrl = `${proto}://${host}/api/webhooks/whatsapp`;

  try {
    // Cria instância na Evolution API (ou reutiliza se já existir)
    await evo.createInstance(instanceName, webhookUrl).catch(() => {
      // Pode falhar se já existir — tudo bem, seguimos
    });

    // Busca QR code atual
    const qr = await evo.connectInstance(instanceName);

    // Upsert no banco
    const instance = await prisma.whatsAppInstance.upsert({
      where: { tenantId },
      update: {
        instanceName,
        status: "CONNECTING",
        qrCode: qr.base64 ?? null,
        updatedAt: new Date(),
      },
      create: {
        tenantId,
        instanceName,
        status: "CONNECTING",
        qrCode: qr.base64 ?? null,
      },
    });

    await logAudit({
      tenantId,
      userId: session.user.id,
      action: "whatsapp.connect",
      entity: "WhatsAppInstance",
      entityId: instance.id,
    });

    revalidatePath("/configuracoes/whatsapp");
    return { success: "Instância criada — escaneie o QR Code", qrCode: qr.base64 };
  } catch (err) {
    console.error("[connectWhatsApp]", err);
    return { error: "Erro ao conectar com Evolution API. Verifique as configurações." };
  }
}

// ─── Desconectar/remover instância ───────────────────────────────────────────

export async function disconnectWhatsAppAction(): Promise<{ error: string } | { success: string }> {
  const { session, error } = await requireRole(ROLES_ADMIN);
  if (error) return { error: "Acesso negado" };

  const tenantId = session.user.tenantId;
  const instance = await prisma.whatsAppInstance.findUnique({ where: { tenantId } });
  if (!instance) return { error: "Nenhuma instância configurada" };

  try {
    if (evo.isConfigured()) {
      await evo.logoutInstance(instance.instanceName).catch(() => {});
      await evo.deleteInstance(instance.instanceName).catch(() => {});
    }

    await prisma.whatsAppInstance.update({
      where: { tenantId },
      data: { status: "DISCONNECTED", qrCode: null, phone: null, updatedAt: new Date() },
    });

    await logAudit({
      tenantId,
      userId: session.user.id,
      action: "whatsapp.disconnect",
      entity: "WhatsAppInstance",
      entityId: instance.id,
    });

    revalidatePath("/configuracoes/whatsapp");
    return { success: "WhatsApp desconectado" };
  } catch (err) {
    console.error("[disconnectWhatsApp]", err);
    return { error: "Erro ao desconectar" };
  }
}

// ─── Atualizar QR code (polling) ──────────────────────────────────────────────

export async function refreshQrAction(): Promise<{ qrCode?: string; status: string }> {
  const { session, error } = await requireRole(ROLES_ADMIN);
  if (error) return { status: "ERROR" };

  const instance = await prisma.whatsAppInstance.findUnique({
    where: { tenantId: session.user.tenantId },
    select: { instanceName: true, status: true, qrCode: true },
  });
  if (!instance) return { status: "NO_INSTANCE" };
  if (instance.status === "CONNECTED") return { status: "CONNECTED" };

  // Tenta buscar QR fresco da Evolution API
  try {
    const qr = await evo.connectInstance(instance.instanceName);
    if (qr.base64) {
      await prisma.whatsAppInstance.updateMany({
        where: { tenantId: session.user.tenantId },
        data: { qrCode: qr.base64, updatedAt: new Date() },
      });
      return { qrCode: qr.base64, status: instance.status };
    }
  } catch {
    // Usa o QR do DB se disponível
  }

  return { qrCode: instance.qrCode ?? undefined, status: instance.status };
}

// ─── Enviar mensagem ──────────────────────────────────────────────────────────

export async function sendWhatsAppMessageAction(
  conversationId: string,
  text: string
): Promise<{ error: string } | { success: true }> {
  const { session, error } = await requireRole(ROLES_WRITE);
  if (error) return { error: "Acesso negado" };

  if (!text.trim()) return { error: "Mensagem vazia" };

  const tenantId = session.user.tenantId;

  const conv = await prisma.whatsAppConversation.findFirst({
    where: { id: conversationId, tenantId },
    include: { instance: true },
  });
  if (!conv) return { error: "Conversa não encontrada" };
  if (conv.instance.status !== "CONNECTED") return { error: "WhatsApp não conectado" };

  if (!evo.isConfigured()) return { error: "Evolution API não configurada" };

  try {
    const result = await evo.sendText(conv.instance.instanceName, conv.remotePhone, text.trim());

    await prisma.whatsAppMessage.create({
      data: {
        tenantId,
        conversationId,
        waMessageId: result.key.id,
        fromMe: true,
        body: text.trim(),
        mediaType: "TEXT",
        timestamp: new Date(result.messageTimestamp * 1000),
        status: "SENT",
      },
    });

    await prisma.whatsAppConversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date(), updatedAt: new Date() },
    });

    revalidatePath("/whatsapp");
    return { success: true };
  } catch (err) {
    console.error("[sendWhatsApp]", err);
    return { error: "Erro ao enviar mensagem" };
  }
}

// ─── Marcar conversa como lida ────────────────────────────────────────────────

export async function markConversationReadAction(conversationId: string) {
  const { session, error } = await requireRole(ROLES_WRITE);
  if (error) return;

  await prisma.whatsAppConversation.updateMany({
    where: { id: conversationId, tenantId: session.user.tenantId },
    data: { unreadCount: 0, updatedAt: new Date() },
  });

  revalidatePath("/whatsapp");
}

// ─── Vincular conversa a lead ─────────────────────────────────────────────────

export async function linkConversationToLeadAction(
  conversationId: string,
  leadId: string
): Promise<{ error: string } | { success: string }> {
  const { session, error } = await requireRole(ROLES_WRITE);
  if (error) return { error: "Acesso negado" };

  const tenantId = session.user.tenantId;

  const [conv, lead] = await Promise.all([
    prisma.whatsAppConversation.findFirst({ where: { id: conversationId, tenantId } }),
    prisma.lead.findFirst({ where: { id: leadId, tenantId }, select: { id: true, name: true } }),
  ]);

  if (!conv) return { error: "Conversa não encontrada" };
  if (!lead) return { error: "Lead não encontrado" };

  await prisma.whatsAppConversation.update({
    where: { id: conversationId },
    data: { leadId, contactId: null, updatedAt: new Date() },
  });

  await logAudit({
    tenantId,
    userId: session.user.id,
    action: "whatsapp.link_lead",
    entity: "WhatsAppConversation",
    entityId: conversationId,
    meta: { leadId, leadName: lead.name },
  });

  revalidatePath("/whatsapp");
  return { success: `Conversa vinculada a ${lead.name}` };
}

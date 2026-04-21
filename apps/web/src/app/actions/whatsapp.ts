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

  const tenantId = session.user.tenantId;

  // Usa instanceName já salvo no DB, ou gera um novo a partir do slug do tenant
  const existing = await prisma.whatsAppInstance.findUnique({ where: { tenantId } });

  // Busca o slug do tenant para nome legível
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { slug: true } });
  const instanceName = existing?.instanceName ?? `crm-${(tenant?.slug ?? tenantId.slice(-8)).slice(0, 20)}`;

  // Obtém URL base da app para o webhook
  const hdrs       = await headers();
  const host       = hdrs.get("x-forwarded-host") ?? hdrs.get("host") ?? "localhost:3000";
  const proto      = hdrs.get("x-forwarded-proto") ?? "http";
  const webhookUrl = `${proto}://${host}/api/webhooks/whatsapp`;

  // Passo 1: Criar instância (ignora erro "já existe")
  // A v2 pode retornar o QR já na resposta de criação quando qrcode:true
  let qrBase64: string | undefined;
  try {
    const created = await evo.createInstance(instanceName, webhookUrl);
    console.log("[connectWhatsApp] createInstance response keys:", Object.keys(created));
    console.log("[connectWhatsApp] createInstance qrcode:", JSON.stringify(created.qrcode)?.slice(0, 100));
    qrBase64 = created.qrcode?.base64;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Só ignora se a instância já existir (400/409). Outros erros propagamos.
    if (!msg.includes("400") && !msg.includes("409") && !msg.includes("already")) {
      console.error("[connectWhatsApp] createInstance:", msg);
      return { error: `Evolution API: ${msg.slice(0, 120)}` };
    }
    console.log("[connectWhatsApp] createInstance ignorado (instância já existe)");
  }

  // Passo 2: Se não veio QR no create, buscar via connect endpoint com retries
  if (!qrBase64) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      // Aguarda Baileys inicializar o QR (cresce com cada tentativa)
      await new Promise(r => setTimeout(r, attempt * 1500));
      try {
        const raw = await evo.connectInstance(instanceName);
        console.log(`[connectWhatsApp] connectInstance attempt ${attempt}:`, JSON.stringify(raw)?.slice(0, 200));
        if (raw.base64) {
          qrBase64 = raw.base64;
          break;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[connectWhatsApp] connectInstance attempt ${attempt}:`, msg);
        if (attempt === 3) {
          return { error: `Erro ao buscar QR Code: ${msg.slice(0, 120)}` };
        }
      }
    }
  }

  // Passo 3: Salvar no banco
  const instance = await prisma.whatsAppInstance.upsert({
    where: { tenantId },
    update: {
      instanceName,
      status: "CONNECTING",
      qrCode: qrBase64 ?? null,
      updatedAt: new Date(),
    },
    create: {
      tenantId,
      instanceName,
      status: "CONNECTING",
      qrCode: qrBase64 ?? null,
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

  if (!qrBase64) {
    return { error: "Instância criada mas QR Code não retornado. Tente novamente em 5 segundos." };
  }

  return { success: "Escaneie o QR Code com seu WhatsApp", qrCode: qrBase64 };
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

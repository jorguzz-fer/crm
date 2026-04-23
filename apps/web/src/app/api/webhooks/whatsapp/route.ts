import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createEvolutionAdapter, handleWebhook } from "@crm/whatsapp";

/**
 * POST /api/webhooks/whatsapp
 *
 * Receptor para Evolution API e Z-API.
 * Verificação + parsing delegados ao adapter @crm/whatsapp.
 * Esta rota cuida de: lookup tenant → dedup DB → persistência conversa.
 * TODO Fase 3: emitir inngest event `message/received` após persistência.
 */
export async function POST(req: Request) {
  const rawBody = await req.text();
  const headers = Object.fromEntries(req.headers.entries());

  // Extrai instanceName para lookup
  let instanceName: string | undefined;
  let parsedEvent: string | undefined;
  let parsedData: unknown;
  try {
    const b = JSON.parse(rawBody) as Record<string, unknown>;
    instanceName = b.instance as string | undefined;
    parsedEvent = (b.event as string | undefined)?.toUpperCase().replace(".", "_");
    parsedData = b.data;
  } catch {
    return NextResponse.json({ ok: true });
  }

  if (!instanceName) return NextResponse.json({ ok: true });

  const instance = await prisma.whatsAppInstance.findUnique({
    where: { instanceName },
    select: { id: true, tenantId: true, phone: true },
  });
  if (!instance) return NextResponse.json({ ok: true });

  // Eventos de sistema (connection + QR) tratados diretamente
  if (parsedEvent === "CONNECTION_UPDATE") {
    await handleConnectionUpdate(instanceName, parsedData);
    return NextResponse.json({ ok: true });
  }
  if (parsedEvent === "QRCODE_UPDATED") {
    await handleQrcodeUpdated(instanceName, parsedData);
    return NextResponse.json({ ok: true });
  }

  const secret = process.env.EVOLUTION_WEBHOOK_SECRET ?? "";
  const adapter = createEvolutionAdapter({
    baseUrl: process.env.EVOLUTION_API_URL ?? "",
    apiKey: secret,
    instanceName,
    instancePhone: instance.phone ?? "+5500000000000",
  });

  const result = await handleWebhook({
    adapter,
    rawBody,
    headers,
    secret,
    tenantId: instance.tenantId,
  });

  if (result.status !== 200) {
    if (result.status === 401)
      console.warn("[webhook/whatsapp] assinatura inválida, instância:", instanceName);
    else
      console.error("[webhook/whatsapp] erro interno");
    return NextResponse.json({ ok: true });
  }

  for (const msg of result.messages) {
    const phone = msg.from.phoneE164.replace("+", "");
    const normalizedPhone = phone.slice(-8);

    const existingConv = await prisma.whatsAppConversation.findUnique({
      where: {
        instanceId_remoteJid: { instanceId: instance.id, remoteJid: `${phone}@s.whatsapp.net` },
      },
    });

    let convId: string;
    if (existingConv) {
      convId = existingConv.id;
      await prisma.whatsAppConversation.update({
        where: { id: convId },
        data: {
          remoteName: msg.from.name ?? existingConv.remoteName,
          lastMessageAt: msg.receivedAt,
          unreadCount: existingConv.unreadCount + 1,
          updatedAt: new Date(),
        },
      });
    } else {
      const [lead, contact] = await Promise.all([
        prisma.lead.findFirst({
          where: { tenantId: instance.tenantId, phone: { contains: normalizedPhone } },
          select: { id: true },
        }),
        prisma.contact.findFirst({
          where: { tenantId: instance.tenantId, phone: { contains: normalizedPhone } },
          select: { id: true },
        }),
      ]);

      const conv = await prisma.whatsAppConversation.create({
        data: {
          tenantId: instance.tenantId,
          instanceId: instance.id,
          remoteJid: `${phone}@s.whatsapp.net`,
          remotePhone: phone,
          remoteName: msg.from.name ?? null,
          leadId: lead?.id ?? null,
          contactId: contact?.id ?? null,
          unreadCount: 1,
          lastMessageAt: msg.receivedAt,
        },
      });
      convId = conv.id;
    }

    const mediaType = msg.message.type.toUpperCase() as
      | "TEXT"
      | "IMAGE"
      | "AUDIO"
      | "VIDEO"
      | "DOCUMENT"
      | "STICKER"
      | "UNKNOWN";

    try {
      await prisma.whatsAppMessage.create({
        data: {
          tenantId: instance.tenantId,
          conversationId: convId,
          waMessageId: msg.externalMessageId,
          fromMe: false,
          body: msg.message.type === "text" ? msg.message.text : null,
          mediaType,
          timestamp: msg.receivedAt,
        },
      });
    } catch {
      // waMessageId duplicado — idempotência via DB constraint
    }

    // TODO Fase 3: inngest.send("message/received", { tenantId: msg.tenantId, ...msg })
  }

  return NextResponse.json({ ok: true });
}

async function handleConnectionUpdate(instanceName: string, data: unknown) {
  const d = data as Record<string, unknown>;
  const state = d?.state as string;
  const status =
    state === "open" ? "CONNECTED" : state === "connecting" ? "CONNECTING" : "DISCONNECTED";

  await prisma.whatsAppInstance.updateMany({
    where: { instanceName },
    data: {
      status: status as "CONNECTED" | "CONNECTING" | "DISCONNECTED",
      qrCode: status === "CONNECTED" ? null : undefined,
      updatedAt: new Date(),
    },
  });
}

async function handleQrcodeUpdated(instanceName: string, data: unknown) {
  const d = data as Record<string, unknown>;
  const qrcode = d?.qrcode as Record<string, unknown> | undefined;
  const base64 = qrcode?.base64 as string | undefined;
  if (!base64) return;

  await prisma.whatsAppInstance.updateMany({
    where: { instanceName },
    data: { qrCode: base64, status: "CONNECTING", updatedAt: new Date() },
  });
}

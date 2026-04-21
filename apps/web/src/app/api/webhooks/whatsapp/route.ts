import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Rota pública — não requer sessão (Evolution API não usa cookies)
// Segurança: valida apikey no body contra EVOLUTION_API_KEY

function extractText(message: Record<string, unknown>): string | null {
  if (typeof message.conversation === "string") return message.conversation;
  if (typeof (message.extendedTextMessage as Record<string, unknown>)?.text === "string")
    return (message.extendedTextMessage as Record<string, unknown>).text as string;
  if (message.imageMessage)   return `[Imagem]${(message.imageMessage as Record<string,unknown>).caption ? " " + (message.imageMessage as Record<string,unknown>).caption : ""}`;
  if (message.videoMessage)   return `[Vídeo]${(message.videoMessage as Record<string,unknown>).caption ? " " + (message.videoMessage as Record<string,unknown>).caption : ""}`;
  if (message.audioMessage)   return "[Áudio]";
  if (message.stickerMessage) return "[Figurinha]";
  if (message.documentMessage) {
    const doc = message.documentMessage as Record<string, unknown>;
    return `[Documento] ${doc.fileName ?? doc.caption ?? ""}`.trim();
  }
  return null;
}

function extractMediaType(message: Record<string, unknown>): string {
  if (message.imageMessage)    return "IMAGE";
  if (message.audioMessage)    return "AUDIO";
  if (message.videoMessage)    return "VIDEO";
  if (message.documentMessage) return "DOCUMENT";
  if (message.stickerMessage)  return "STICKER";
  return "TEXT";
}

function phoneFromJid(jid: string): string {
  return jid.replace("@s.whatsapp.net", "").replace("@g.us", "");
}

async function handleMessagesUpsert(
  instanceName: string,
  data: unknown
) {
  const messages = Array.isArray(data) ? data : [data];

  const instance = await prisma.whatsAppInstance.findUnique({
    where: { instanceName },
    select: { id: true, tenantId: true },
  });
  if (!instance) return;

  for (const msg of messages) {
    const key       = (msg as Record<string, unknown>).key as Record<string, unknown>;
    const remoteJid = key?.remoteJid as string;
    const fromMe    = Boolean(key?.fromMe);
    const msgId     = key?.id as string;

    if (!remoteJid || !msgId) continue;
    // Ignorar mensagens de grupo por enquanto
    if (remoteJid.endsWith("@g.us")) continue;
    // Ignorar status broadcasts
    if (remoteJid === "status@broadcast") continue;

    const message   = (msg as Record<string, unknown>).message as Record<string, unknown> | undefined;
    const pushName  = (msg as Record<string, unknown>).pushName as string | undefined;
    const tsRaw     = (msg as Record<string, unknown>).messageTimestamp;
    const timestamp = tsRaw ? new Date(Number(tsRaw) * 1000) : new Date();

    const body      = message ? extractText(message) : null;
    const mediaType = message ? extractMediaType(message) : "TEXT";
    const phone     = phoneFromJid(remoteJid);

    // Upsert conversation
    const existingConv = await prisma.whatsAppConversation.findUnique({
      where: { instanceId_remoteJid: { instanceId: instance.id, remoteJid } },
    });

    let convId: string;

    if (existingConv) {
      convId = existingConv.id;
      await prisma.whatsAppConversation.update({
        where: { id: convId },
        data: {
          remoteName: pushName ?? existingConv.remoteName,
          lastMessageAt: timestamp,
          unreadCount: fromMe ? existingConv.unreadCount : existingConv.unreadCount + 1,
          updatedAt: new Date(),
        },
      });
    } else {
      // Tenta encontrar lead ou contato pelo telefone
      const normalizedPhone = phone.replace(/\D/g, "");
      const [lead, contact] = await Promise.all([
        prisma.lead.findFirst({
          where: {
            tenantId: instance.tenantId,
            phone: { contains: normalizedPhone.slice(-8) },
          },
          select: { id: true },
        }),
        prisma.contact.findFirst({
          where: {
            tenantId: instance.tenantId,
            phone: { contains: normalizedPhone.slice(-8) },
          },
          select: { id: true },
        }),
      ]);

      const conv = await prisma.whatsAppConversation.create({
        data: {
          tenantId: instance.tenantId,
          instanceId: instance.id,
          remoteJid,
          remotePhone: phone,
          remoteName: pushName ?? null,
          leadId: lead?.id ?? null,
          contactId: contact?.id ?? null,
          unreadCount: fromMe ? 0 : 1,
          lastMessageAt: timestamp,
        },
      });
      convId = conv.id;
    }

    // Salva a mensagem (ignora duplicatas pelo waMessageId único)
    try {
      await prisma.whatsAppMessage.create({
        data: {
          tenantId: instance.tenantId,
          conversationId: convId,
          waMessageId: msgId,
          fromMe,
          body,
          mediaType: mediaType as "TEXT" | "IMAGE" | "AUDIO" | "VIDEO" | "DOCUMENT" | "STICKER" | "UNKNOWN",
          timestamp,
        },
      });
    } catch {
      // Ignora duplicata de waMessageId (unique constraint)
    }
  }
}

async function handleConnectionUpdate(instanceName: string, data: unknown) {
  const d = data as Record<string, unknown>;
  const state = d?.state as string;

  const status =
    state === "open"       ? "CONNECTED"    :
    state === "connecting" ? "CONNECTING"   :
    "DISCONNECTED";

  await prisma.whatsAppInstance.updateMany({
    where: { instanceName },
    data: {
      status: status as "CONNECTED" | "CONNECTING" | "DISCONNECTED",
      // Limpa QR quando conectado
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
    data: {
      qrCode: base64,
      status: "CONNECTING",
      updatedAt: new Date(),
    },
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as Record<string, unknown>;

    // Valida a API key enviada pela Evolution API no payload
    const apikey = body.apikey as string | undefined;
    if (apikey && process.env.EVOLUTION_API_KEY && apikey !== process.env.EVOLUTION_API_KEY) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const event        = (body.event as string | undefined)?.toUpperCase().replace(".", "_");
    const instanceName = body.instance as string | undefined;
    const data         = body.data;

    if (!instanceName) {
      return NextResponse.json({ ok: true });
    }

    switch (event) {
      case "MESSAGES_UPSERT":
        await handleMessagesUpsert(instanceName, data);
        break;
      case "CONNECTION_UPDATE":
        await handleConnectionUpdate(instanceName, data);
        break;
      case "QRCODE_UPDATED":
        await handleQrcodeUpdated(instanceName, data);
        break;
      // Outros eventos ignorados
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[webhook/whatsapp]", err);
    // Retorna 200 para não fazer Evolution API retentar infinitamente
    return NextResponse.json({ ok: true });
  }
}

/**
 * Evolution API adapter (self-hosted, Baileys/WhatsApp Web multi-device).
 * Também compatível com Z-API: mesma base Baileys, basta apontar baseUrl diferente.
 *
 * Limitações conhecidas vs Meta Cloud:
 * - Sem suporte a templates oficiais
 * - ctwaClid (Click-to-WhatsApp Ads) indisponível via WhatsApp Web protocol
 * - Risco de ban em envio em massa
 */

import type {
  RawInboundMessage,
  OutboundMessage,
  SendResult,
  WhatsAppAdapter,
} from "../types";

export interface EvolutionAdapterConfig {
  baseUrl: string;       // ex: https://evo.mycrm.com
  apiKey: string;        // header "apikey" da instância
  instanceName: string;  // nome da instância no Evolution
  instancePhone: string; // número da conta em E.164, ex: +5511999990000
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function jidToE164(jid: string): string | null {
  const digits = jid.replace(/@.*$/, "").replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) return null;
  return `+${digits}`;
}

function parseMessageContent(
  message: Record<string, unknown>,
): RawInboundMessage["message"] | null {
  if (typeof message.conversation === "string" && message.conversation.length > 0) {
    return { type: "text", text: message.conversation };
  }

  const ext = message.extendedTextMessage as Record<string, unknown> | undefined;
  if (typeof ext?.text === "string" && ext.text.length > 0) {
    return { type: "text", text: ext.text };
  }

  const img = message.imageMessage as Record<string, unknown> | undefined;
  if (img?.url) {
    return {
      type: "image",
      mediaUrl: img.url as string,
      caption: typeof img.caption === "string" ? img.caption : undefined,
    };
  }

  const audio = message.audioMessage as Record<string, unknown> | undefined;
  if (audio?.url) {
    return {
      type: "audio",
      mediaUrl: audio.url as string,
      durationSec: typeof audio.seconds === "number" ? audio.seconds : undefined,
    };
  }

  const doc = message.documentMessage as Record<string, unknown> | undefined;
  if (doc?.url) {
    return {
      type: "document",
      mediaUrl: doc.url as string,
      filename: (doc.fileName ?? doc.caption ?? "arquivo") as string,
    };
  }

  const btn = message.buttonsResponseMessage as Record<string, unknown> | undefined;
  if (btn?.selectedButtonId) {
    return { type: "button", payload: btn.selectedButtonId as string };
  }

  const interactive = message.listResponseMessage as Record<string, unknown> | undefined;
  if (interactive?.singleSelectReply) {
    const reply = interactive.singleSelectReply as Record<string, unknown>;
    return { type: "interactive", payload: (reply.selectedRowId ?? "") as string };
  }

  return null;
}

// ── Factory ───────────────────────────────────────────────────────────────────

export function createEvolutionAdapter(
  config: EvolutionAdapterConfig,
): WhatsAppAdapter {
  return {
    provider: "evolution",

    // ── verifyWebhookSignature ────────────────────────────────────────────────

    async verifyWebhookSignature({ rawBody, headers, secret }) {
      // Header takes priority
      const headerKey = headers["apikey"] ?? headers["Apikey"] ?? headers["APIKEY"];
      if (headerKey !== undefined) {
        if (headerKey === secret) return { ok: true };
        return { ok: false, reason: "apikey header inválido" };
      }

      // Fallback: apikey in body (Evolution v1 compat)
      try {
        const body = JSON.parse(rawBody) as Record<string, unknown>;
        if (body.apikey === secret) return { ok: true };
        return { ok: false, reason: "apikey ausente ou inválido" };
      } catch {
        return { ok: false, reason: "apikey ausente e body não é JSON válido" };
      }
    },

    // ── parseInbound ─────────────────────────────────────────────────────────

    async parseInbound(rawBody) {
      let payload: Record<string, unknown>;
      try {
        payload = JSON.parse(rawBody) as Record<string, unknown>;
      } catch {
        return [];
      }

      // Só processa messages.upsert
      const event = (payload.event as string | undefined)?.toLowerCase();
      if (event !== "messages.upsert") return [];

      const data = Array.isArray(payload.data) ? payload.data : [payload.data];
      const results: RawInboundMessage[] = [];

      for (const raw of data) {
        const msg = raw as Record<string, unknown>;
        const key = msg.key as Record<string, unknown> | undefined;
        if (!key) continue;

        const remoteJid = key.remoteJid as string | undefined;
        const fromMe = Boolean(key.fromMe);
        const messageId = key.id as string | undefined;

        if (!remoteJid || !messageId) continue;
        if (fromMe) continue;
        if (remoteJid.endsWith("@g.us")) continue;
        if (remoteJid === "status@broadcast") continue;

        const fromPhone = jidToE164(remoteJid);
        if (!fromPhone) continue;

        const message = msg.message as Record<string, unknown> | undefined;
        if (!message) continue;

        const content = parseMessageContent(message);
        if (!content) continue;

        const ts = msg.messageTimestamp as number | undefined;

        results.push({
          providerInstanceId: config.instanceName,
          externalMessageId: messageId,
          from: {
            phoneE164: fromPhone,
            name: (msg.pushName as string | undefined) ?? null,
          },
          to: { phoneE164: config.instancePhone },
          message: content,
          ctwaClid: null, // Evolution/Z-API não expõe ctwa_clid
          receivedAt: ts ? new Date(ts * 1000) : new Date(),
        });
      }

      return results;
    },

    // ── sendMessage ───────────────────────────────────────────────────────────

    async sendMessage(msg: OutboundMessage): Promise<SendResult> {
      if (msg.content.type === "template") {
        throw new Error(
          "Template messages not supported in Evolution/Z-API adapter. Use Meta Cloud API.",
        );
      }

      const number = msg.toPhoneE164.replace("+", "");
      const url = `${config.baseUrl}/message/sendText/${config.instanceName}`;

      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: config.apiKey,
          },
          body: JSON.stringify({ number, text: msg.content.text }),
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => String(res.status));
          return {
            providerMessageId: "",
            status: "failed",
            error: `Evolution API ${res.status}: ${errText}`,
          };
        }

        const data = (await res.json()) as Record<string, unknown>;
        const key = data.key as Record<string, unknown> | undefined;
        const id = (key?.id as string | undefined) ?? "";

        return { providerMessageId: id, status: "sent" };
      } catch (err) {
        return {
          providerMessageId: "",
          status: "failed",
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
  };
}

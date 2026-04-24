import { describe, it, expect } from "vitest";
import { createEvolutionAdapter } from "../adapters/evolution";

const adapter = createEvolutionAdapter({
  baseUrl: "https://evo.example.com",
  apiKey: "k",
  instanceName: "test-instance",
  instancePhone: "+5511000000000",
});

// ── Fixtures ─────────────────────────────────────────────────────────────────

function makePayload(messages: unknown[]) {
  return JSON.stringify({
    event: "messages.upsert",
    instance: "test-instance",
    data: messages,
  });
}

function makeMsg(overrides: Record<string, unknown> = {}) {
  return {
    key: {
      remoteJid: "5511999990000@s.whatsapp.net",
      fromMe: false,
      id: "WAMID001",
    },
    pushName: "João",
    messageTimestamp: 1714000000,
    message: { conversation: "oi, quero informações" },
    ...overrides,
  };
}

// ── Testes ───────────────────────────────────────────────────────────────────

describe("evolution — parseInbound", () => {
  it("parseia mensagem text (conversation)", async () => {
    const msgs = await adapter.parseInbound(makePayload([makeMsg()]));
    expect(msgs).toHaveLength(1);
    const m = msgs[0];
    expect(m.message.type).toBe("text");
    if (m.message.type === "text") expect(m.message.text).toBe("oi, quero informações");
  });

  it("parseia mensagem text (extendedTextMessage)", async () => {
    const msgs = await adapter.parseInbound(
      makePayload([
        makeMsg({
          message: { extendedTextMessage: { text: "mensagem longa com formatação" } },
        }),
      ]),
    );
    expect(msgs[0].message.type).toBe("text");
    if (msgs[0].message.type === "text")
      expect(msgs[0].message.text).toBe("mensagem longa com formatação");
  });

  it("extrai externalMessageId do key.id", async () => {
    const msgs = await adapter.parseInbound(makePayload([makeMsg()]));
    expect(msgs[0].externalMessageId).toBe("WAMID001");
  });

  it("converte remoteJid para E.164", async () => {
    const msgs = await adapter.parseInbound(makePayload([makeMsg()]));
    expect(msgs[0].from.phoneE164).toBe("+5511999990000");
  });

  it("popula from.name com pushName quando presente", async () => {
    const msgs = await adapter.parseInbound(makePayload([makeMsg()]));
    expect(msgs[0].from.name).toBe("João");
  });

  it("popula to com instancePhone do config", async () => {
    const msgs = await adapter.parseInbound(makePayload([makeMsg()]));
    expect(msgs[0].to.phoneE164).toBe("+5511000000000");
  });

  it("popula providerInstanceId com instanceName do config", async () => {
    const msgs = await adapter.parseInbound(makePayload([makeMsg()]));
    expect(msgs[0].providerInstanceId).toBe("test-instance");
  });

  it("parseia imageMessage", async () => {
    const msgs = await adapter.parseInbound(
      makePayload([
        makeMsg({
          message: {
            imageMessage: {
              url: "https://cdn.evolution.io/img.jpg",
              caption: "tabela de preços",
            },
          },
        }),
      ]),
    );
    expect(msgs[0].message.type).toBe("image");
    if (msgs[0].message.type === "image") {
      expect(msgs[0].message.mediaUrl).toBe("https://cdn.evolution.io/img.jpg");
      expect(msgs[0].message.caption).toBe("tabela de preços");
    }
  });

  it("parseia audioMessage", async () => {
    const msgs = await adapter.parseInbound(
      makePayload([
        makeMsg({
          message: {
            audioMessage: { url: "https://cdn.evolution.io/audio.ogg", seconds: 12 },
          },
        }),
      ]),
    );
    expect(msgs[0].message.type).toBe("audio");
    if (msgs[0].message.type === "audio")
      expect(msgs[0].message.durationSec).toBe(12);
  });

  it("parseia documentMessage", async () => {
    const msgs = await adapter.parseInbound(
      makePayload([
        makeMsg({
          message: {
            documentMessage: {
              url: "https://cdn.evolution.io/doc.pdf",
              fileName: "contrato.pdf",
            },
          },
        }),
      ]),
    );
    expect(msgs[0].message.type).toBe("document");
    if (msgs[0].message.type === "document")
      expect(msgs[0].message.filename).toBe("contrato.pdf");
  });

  it("filtra mensagens fromMe=true", async () => {
    const msgs = await adapter.parseInbound(
      makePayload([makeMsg({ key: { remoteJid: "5511999990000@s.whatsapp.net", fromMe: true, id: "X" } })]),
    );
    expect(msgs).toHaveLength(0);
  });

  it("filtra mensagens de grupo (@g.us)", async () => {
    const msgs = await adapter.parseInbound(
      makePayload([makeMsg({ key: { remoteJid: "120363000000@g.us", fromMe: false, id: "X" } })]),
    );
    expect(msgs).toHaveLength(0);
  });

  it("filtra status@broadcast", async () => {
    const msgs = await adapter.parseInbound(
      makePayload([makeMsg({ key: { remoteJid: "status@broadcast", fromMe: false, id: "X" } })]),
    );
    expect(msgs).toHaveLength(0);
  });

  it("retorna [] para eventos que não são messages.upsert", async () => {
    const body = JSON.stringify({
      event: "connection.update",
      instance: "test-instance",
      data: { state: "open" },
    });
    const msgs = await adapter.parseInbound(body);
    expect(msgs).toHaveLength(0);
  });

  it("retorna [] para body JSON inválido", async () => {
    const msgs = await adapter.parseInbound("not-json");
    expect(msgs).toHaveLength(0);
  });

  it("parseia batch de múltiplas mensagens", async () => {
    const msgs = await adapter.parseInbound(
      makePayload([
        makeMsg({ key: { remoteJid: "5511111110000@s.whatsapp.net", fromMe: false, id: "A" } }),
        makeMsg({ key: { remoteJid: "5511222220000@s.whatsapp.net", fromMe: false, id: "B" } }),
      ]),
    );
    expect(msgs).toHaveLength(2);
    expect(msgs.map((m) => m.externalMessageId)).toEqual(["A", "B"]);
  });

  it("ctwaClid é null (Evolution não suporta Click-to-WhatsApp Ads)", async () => {
    const msgs = await adapter.parseInbound(makePayload([makeMsg()]));
    expect(msgs[0].ctwaClid).toBeNull();
  });

  it("converte messageTimestamp (unix) para Date", async () => {
    const msgs = await adapter.parseInbound(makePayload([makeMsg()]));
    expect(msgs[0].receivedAt).toBeInstanceOf(Date);
    expect(msgs[0].receivedAt.getTime()).toBe(1714000000 * 1000);
  });
});

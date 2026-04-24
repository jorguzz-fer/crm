import { describe, it, expect, vi } from "vitest";
import { handleWebhook } from "../webhooks";
import { createEvolutionAdapter } from "../adapters/evolution";

const adapter = createEvolutionAdapter({
  baseUrl: "https://evo.example.com",
  apiKey: "secret",
  instanceName: "inst-1",
  instancePhone: "+5511000000000",
});

const VALID_BODY = JSON.stringify({
  event: "messages.upsert",
  instance: "inst-1",
  data: [
    {
      key: { remoteJid: "5511999990000@s.whatsapp.net", fromMe: false, id: "WAMID001" },
      pushName: "João",
      messageTimestamp: 1714000000,
      message: { conversation: "oi" },
    },
  ],
});

describe("handleWebhook", () => {
  it("retorna 401 quando assinatura inválida", async () => {
    const result = await handleWebhook({
      adapter,
      rawBody: VALID_BODY,
      headers: { apikey: "wrong-key" },
      secret: "secret",
      tenantId: "t1",
    });
    expect(result.status).toBe(401);
    expect(result.processed).toBe(0);
  });

  it("retorna 200 com mensagens parseadas quando assinatura válida", async () => {
    const result = await handleWebhook({
      adapter,
      rawBody: VALID_BODY,
      headers: { apikey: "secret" },
      secret: "secret",
      tenantId: "t1",
    });
    expect(result.status).toBe(200);
    expect(result.processed).toBe(1);
    expect(result.messages).toHaveLength(1);
  });

  it("adiciona tenantId às mensagens parseadas", async () => {
    const result = await handleWebhook({
      adapter,
      rawBody: VALID_BODY,
      headers: { apikey: "secret" },
      secret: "secret",
      tenantId: "tenant-abc",
    });
    expect(result.messages[0].tenantId).toBe("tenant-abc");
  });

  it("retorna 200 com processed=0 para body sem mensagens (health probe)", async () => {
    const emptyBody = JSON.stringify({
      event: "messages.upsert",
      instance: "inst-1",
      data: [],
    });
    const result = await handleWebhook({
      adapter,
      rawBody: emptyBody,
      headers: { apikey: "secret" },
      secret: "secret",
      tenantId: "t1",
    });
    expect(result.status).toBe(200);
    expect(result.processed).toBe(0);
  });

  it("retorna 200 com processed=0 para eventos não-message (connection.update)", async () => {
    const connBody = JSON.stringify({
      event: "connection.update",
      instance: "inst-1",
      data: { state: "open" },
    });
    const result = await handleWebhook({
      adapter,
      rawBody: connBody,
      headers: { apikey: "secret" },
      secret: "secret",
      tenantId: "t1",
    });
    expect(result.status).toBe(200);
    expect(result.processed).toBe(0);
  });

  it("não vaza error stack em body (status 500 seguro)", async () => {
    // Adapter que explode internamente
    const brokenAdapter = {
      ...adapter,
      parseInbound: vi.fn().mockRejectedValueOnce(new Error("internal db crash")),
    };
    const result = await handleWebhook({
      adapter: brokenAdapter,
      rawBody: VALID_BODY,
      headers: { apikey: "secret" },
      secret: "secret",
      tenantId: "t1",
    });
    expect(result.status).toBe(500);
    expect(result.error).not.toMatch(/db crash/);
  });
});

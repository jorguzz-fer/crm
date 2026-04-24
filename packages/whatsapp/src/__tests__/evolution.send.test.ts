import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createEvolutionAdapter } from "../adapters/evolution";

const adapter = createEvolutionAdapter({
  baseUrl: "https://evo.example.com",
  apiKey: "secret-key",
  instanceName: "test-instance",
  instancePhone: "+5511000000000",
});

const BASE_MSG = {
  tenantId: "t1",
  providerInstanceId: "test-instance",
  toPhoneE164: "+5511999990000",
  externalEventId: "msg-uuid-1",
};

describe("evolution — sendMessage", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("chama endpoint correto da Evolution API para text", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ key: { id: "WAMID999" } }), { status: 200 }),
    );

    await adapter.sendMessage({
      ...BASE_MSG,
      content: { type: "text", text: "Olá João!" },
    });

    expect(fetch).toHaveBeenCalledWith(
      "https://evo.example.com/message/sendText/test-instance",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ apikey: "secret-key" }),
      }),
    );
  });

  it("envia number sem + (Evolution espera só dígitos)", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ key: { id: "X" } }), { status: 200 }),
    );

    await adapter.sendMessage({
      ...BASE_MSG,
      content: { type: "text", text: "oi" },
    });

    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.number).toBe("5511999990000");
  });

  it("retorna status:sent com providerMessageId em sucesso", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ key: { id: "WAMID123" } }), { status: 200 }),
    );

    const result = await adapter.sendMessage({
      ...BASE_MSG,
      content: { type: "text", text: "oi" },
    });

    expect(result.status).toBe("sent");
    expect(result.providerMessageId).toBe("WAMID123");
  });

  it("retorna status:failed em 4xx", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "Not found" }), { status: 404 }),
    );

    const result = await adapter.sendMessage({
      ...BASE_MSG,
      content: { type: "text", text: "oi" },
    });

    expect(result.status).toBe("failed");
    expect(result.error).toBeDefined();
  });

  it("retorna status:failed em 5xx", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response("Internal Server Error", { status: 500 }),
    );

    const result = await adapter.sendMessage({
      ...BASE_MSG,
      content: { type: "text", text: "oi" },
    });

    expect(result.status).toBe("failed");
  });

  it("retorna status:failed quando fetch lança (timeout/network error)", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("network timeout"));

    const result = await adapter.sendMessage({
      ...BASE_MSG,
      content: { type: "text", text: "oi" },
    });

    expect(result.status).toBe("failed");
    expect(result.error).toMatch(/timeout/);
  });

  it("rejeita template (não suportado em Evolution/Z-API)", async () => {
    await expect(
      adapter.sendMessage({
        ...BASE_MSG,
        content: { type: "template", templateName: "welcome_v1", locale: "pt_BR", variables: [] },
      }),
    ).rejects.toThrow(/template.*not supported/i);
  });
});

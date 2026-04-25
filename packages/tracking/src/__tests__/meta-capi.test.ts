import { vi, describe, it, expect, beforeEach, afterEach, type MockInstance } from "vitest";

vi.mock("@crm/db", () => ({
  prisma: {
    conversionEvent: { create: vi.fn(), update: vi.fn() },
  },
}));

import { sendMetaCapiEvent } from "../server/meta-capi";
import { prisma } from "@crm/db";

const basePayload = {
  tenantId: "t1",
  leadId: "lead-1",
  eventType: "lead" as const,
  externalEventId: "evt-abc-001",
  userData: {
    email: "ana@example.com",
    phone: "+5511999990000",
    firstName: "Ana",
  },
  attribution: {
    fbclid: "IwAR1test",
    fbp: "_fbp_test",
    fbc: "_fbc_test",
    ctwaClid: null,
  },
};

const tenantConfig = {
  pixelId: "1234567890",
  accessToken: "EAAtest123",
};

describe("sendMetaCapiEvent", () => {
  beforeEach(() => {
    vi.mocked(prisma.conversionEvent.create).mockReset();
    vi.mocked(prisma.conversionEvent.update).mockReset();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("hasheia email com SHA-256 antes de enviar (nunca envia em claro)", async () => {
    vi.mocked(fetch as unknown as MockInstance).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ events_received: 1 }),
    });
    vi.mocked(prisma.conversionEvent.create).mockResolvedValueOnce({} as never);
    vi.mocked(prisma.conversionEvent.update).mockResolvedValueOnce({} as never);

    await sendMetaCapiEvent(basePayload, tenantConfig);

    const body = JSON.parse((vi.mocked(fetch as unknown as MockInstance).mock.calls[0][1] as RequestInit).body as string);
    const em = body.data[0].user_data.em;

    // SHA-256 de "ana@example.com" — não pode ser o email em claro
    expect(em).not.toContain("@");
    expect(em).toHaveLength(64); // hex SHA-256
  });

  it("hasheia phone com SHA-256 (normalizado: só dígitos, sem +)", async () => {
    vi.mocked(fetch as unknown as MockInstance).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ events_received: 1 }),
    });
    vi.mocked(prisma.conversionEvent.create).mockResolvedValueOnce({} as never);
    vi.mocked(prisma.conversionEvent.update).mockResolvedValueOnce({} as never);

    await sendMetaCapiEvent(basePayload, tenantConfig);

    const body = JSON.parse((vi.mocked(fetch as unknown as MockInstance).mock.calls[0][1] as RequestInit).body as string);
    const ph = body.data[0].user_data.ph;

    expect(ph).not.toContain("+");
    expect(ph).toHaveLength(64);
  });

  it("inclui event_id para dedup com pixel browser", async () => {
    vi.mocked(fetch as unknown as MockInstance).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ events_received: 1 }),
    });
    vi.mocked(prisma.conversionEvent.create).mockResolvedValueOnce({} as never);
    vi.mocked(prisma.conversionEvent.update).mockResolvedValueOnce({} as never);

    await sendMetaCapiEvent(basePayload, tenantConfig);

    const body = JSON.parse((vi.mocked(fetch as unknown as MockInstance).mock.calls[0][1] as RequestInit).body as string);
    expect(body.data[0].event_id).toBe("evt-abc-001");
  });

  it("inclui ctwa_clid quando presente na attribution", async () => {
    vi.mocked(fetch as unknown as MockInstance).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ events_received: 1 }),
    });
    vi.mocked(prisma.conversionEvent.create).mockResolvedValueOnce({} as never);
    vi.mocked(prisma.conversionEvent.update).mockResolvedValueOnce({} as never);

    await sendMetaCapiEvent(
      { ...basePayload, attribution: { ...basePayload.attribution, ctwaClid: "ARB-CTWA-123" } },
      tenantConfig,
    );

    const body = JSON.parse((vi.mocked(fetch as unknown as MockInstance).mock.calls[0][1] as RequestInit).body as string);
    expect(body.data[0].user_data.ctwa_clid).toBe("ARB-CTWA-123");
  });

  it("usa endpoint correto da Graph API v21.0", async () => {
    vi.mocked(fetch as unknown as MockInstance).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ events_received: 1 }),
    });
    vi.mocked(prisma.conversionEvent.create).mockResolvedValueOnce({} as never);
    vi.mocked(prisma.conversionEvent.update).mockResolvedValueOnce({} as never);

    await sendMetaCapiEvent(basePayload, tenantConfig);

    const url = vi.mocked(fetch as unknown as MockInstance).mock.calls[0][0] as string;
    expect(url).toContain("graph.facebook.com/v21.0");
    expect(url).toContain("1234567890"); // pixelId
    expect(url).toContain("/events");
  });

  it("salva ConversionEvent no DB com status=success quando API responde ok", async () => {
    vi.mocked(fetch as unknown as MockInstance).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ events_received: 1 }),
    });
    vi.mocked(prisma.conversionEvent.create).mockResolvedValueOnce({ id: "ce-1" } as never);
    vi.mocked(prisma.conversionEvent.update).mockResolvedValueOnce({} as never);

    await sendMetaCapiEvent(basePayload, tenantConfig);

    expect(prisma.conversionEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "success" }),
      }),
    );
  });

  it("salva ConversionEvent com status=failed quando API retorna 4xx", async () => {
    vi.mocked(fetch as unknown as MockInstance).mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: { message: "Invalid pixel" } }),
    });
    vi.mocked(prisma.conversionEvent.create).mockResolvedValueOnce({ id: "ce-2" } as never);
    vi.mocked(prisma.conversionEvent.update).mockResolvedValueOnce({} as never);

    const result = await sendMetaCapiEvent(basePayload, tenantConfig);

    expect(result.status).toBe("failed");
    expect(prisma.conversionEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "failed" }),
      }),
    );
  });

  it("não faz retry em erro 4xx (exceto 429)", async () => {
    vi.mocked(fetch as unknown as MockInstance).mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: { message: "bad request" } }),
    });
    vi.mocked(prisma.conversionEvent.create).mockResolvedValueOnce({ id: "ce-3" } as never);
    vi.mocked(prisma.conversionEvent.update).mockResolvedValueOnce({} as never);

    await sendMetaCapiEvent(basePayload, tenantConfig);

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("faz retry até 3x em erro 5xx", async () => {
    vi.mocked(fetch as unknown as MockInstance)
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ events_received: 1 }) });
    vi.mocked(prisma.conversionEvent.create).mockResolvedValueOnce({ id: "ce-4" } as never);
    vi.mocked(prisma.conversionEvent.update).mockResolvedValue({} as never);

    const result = await sendMetaCapiEvent(basePayload, tenantConfig);

    expect(fetch).toHaveBeenCalledTimes(3);
    expect(result.status).toBe("success");
  });
});

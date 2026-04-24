import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@crm/db", () => ({
  prisma: {
    whatsAppMessage: { findMany: vi.fn() },
    lead: { update: vi.fn() },
  },
}));

vi.mock("@crm/ai", () => ({
  classifyLead: vi.fn(),
  MODELS: { scoring: "anthropic/claude-haiku-4-5" },
}));

vi.mock("../client", () => ({
  inngest: {
    send: vi.fn(),
    createFunction: vi.fn(() => ({})),
  },
}));

import { handleClassifyOnMessage } from "../functions/classify-on-message";
import { prisma } from "@crm/db";
import { classifyLead } from "@crm/ai";
import { inngest } from "../client";

const baseEvent = {
  tenantId: "tenant-1",
  conversationId: "conv-abc",
  messageId: "msg-1",
  leadId: "lead-1",
  channel: "whatsapp" as const,
  content: { type: "text" as const, body: "quanto custa?" },
  from: "+5511999990000",
  receivedAt: new Date().toISOString(),
};

const hotClassification = {
  classification: "hot" as const,
  confidence: 0.91,
  rationale: "Perguntou preço diretamente",
  recommendedNextAction: "route_to_human" as const,
};

const warmClassification = {
  classification: "warm" as const,
  confidence: 0.65,
  rationale: "Engajado mas explorando",
  recommendedNextAction: "send_education" as const,
};

function makeMessages(count: number, fromMe = false) {
  return Array.from({ length: count }, (_, i) => ({
    fromMe,
    body: `mensagem ${i + 1}`,
    timestamp: new Date(Date.now() + i * 60_000),
  }));
}

describe("handleClassifyOnMessage", () => {
  beforeEach(() => {
    vi.mocked(prisma.whatsAppMessage.findMany).mockReset();
    vi.mocked(prisma.lead.update).mockReset();
    vi.mocked(classifyLead).mockReset();
    vi.mocked(inngest.send).mockReset();
  });

  it("retorna skipped=true quando leadId ausente (mensagem sem lead vinculado)", async () => {
    const result = await handleClassifyOnMessage({ ...baseEvent, leadId: undefined });
    expect(result.skipped).toBe(true);
    expect(prisma.whatsAppMessage.findMany).not.toHaveBeenCalled();
  });

  it("retorna skipped=true quando histórico não tem mensagens com texto", async () => {
    vi.mocked(prisma.whatsAppMessage.findMany).mockResolvedValueOnce([]);

    const result = await handleClassifyOnMessage(baseEvent);
    expect(result.skipped).toBe(true);
    expect(classifyLead).not.toHaveBeenCalled();
  });

  it("retorna skipped=true quando todas mensagens são mídia sem texto", async () => {
    vi.mocked(prisma.whatsAppMessage.findMany).mockResolvedValueOnce([
      { fromMe: false, body: null, timestamp: new Date() },
      { fromMe: false, body: null, timestamp: new Date() },
    ]);

    const result = await handleClassifyOnMessage(baseEvent);
    expect(result.skipped).toBe(true);
  });

  it("chama classifyLead com tenantId + leadId + mensagens do histórico", async () => {
    vi.mocked(prisma.whatsAppMessage.findMany).mockResolvedValueOnce(makeMessages(3));
    vi.mocked(classifyLead).mockResolvedValueOnce(hotClassification);
    vi.mocked(prisma.lead.update).mockResolvedValueOnce({} as never);
    vi.mocked(inngest.send).mockResolvedValueOnce({} as never);

    await handleClassifyOnMessage(baseEvent);

    expect(classifyLead).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-1",
        leadId: "lead-1",
        messages: expect.arrayContaining([
          expect.objectContaining({ role: "lead", content: expect.any(String) }),
        ]),
      }),
    );
  });

  it("atualiza score=85 quando hot", async () => {
    vi.mocked(prisma.whatsAppMessage.findMany).mockResolvedValueOnce(makeMessages(1));
    vi.mocked(classifyLead).mockResolvedValueOnce(hotClassification);
    vi.mocked(prisma.lead.update).mockResolvedValueOnce({} as never);
    vi.mocked(inngest.send).mockResolvedValueOnce({} as never);

    await handleClassifyOnMessage(baseEvent);

    expect(prisma.lead.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "lead-1", tenantId: "tenant-1" },
        data: expect.objectContaining({ score: 85, scoreLabel: "hot" }),
      }),
    );
  });

  it("atualiza score=60 quando warm", async () => {
    vi.mocked(prisma.whatsAppMessage.findMany).mockResolvedValueOnce(makeMessages(2));
    vi.mocked(classifyLead).mockResolvedValueOnce(warmClassification);
    vi.mocked(prisma.lead.update).mockResolvedValueOnce({} as never);
    vi.mocked(inngest.send).mockResolvedValueOnce({} as never);

    await handleClassifyOnMessage(baseEvent);

    expect(prisma.lead.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ score: 60, scoreLabel: "warm" }),
      }),
    );
  });

  it("emite lead/classified com tenantId + leadId após atualizar", async () => {
    vi.mocked(prisma.whatsAppMessage.findMany).mockResolvedValueOnce(makeMessages(1));
    vi.mocked(classifyLead).mockResolvedValueOnce(hotClassification);
    vi.mocked(prisma.lead.update).mockResolvedValueOnce({} as never);
    vi.mocked(inngest.send).mockResolvedValueOnce({} as never);

    await handleClassifyOnMessage(baseEvent);

    expect(inngest.send).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "lead/classified",
        data: expect.objectContaining({
          tenantId: "tenant-1",
          leadId: "lead-1",
          score: "HOT",
          confidence: expect.any(Number),
        }),
      }),
    );
  });

  it("tenant isolation: update sempre inclui tenantId no where", async () => {
    vi.mocked(prisma.whatsAppMessage.findMany).mockResolvedValueOnce(makeMessages(1));
    vi.mocked(classifyLead).mockResolvedValueOnce(hotClassification);
    vi.mocked(prisma.lead.update).mockResolvedValueOnce({} as never);
    vi.mocked(inngest.send).mockResolvedValueOnce({} as never);

    await handleClassifyOnMessage({ ...baseEvent, tenantId: "tenant-Z" });

    expect(prisma.lead.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: "tenant-Z" }),
      }),
    );
  });

  it("propaga erro do classifier sem engolir", async () => {
    vi.mocked(prisma.whatsAppMessage.findMany).mockResolvedValueOnce(makeMessages(1));
    vi.mocked(classifyLead).mockRejectedValueOnce(new Error("classifier timeout"));

    await expect(handleClassifyOnMessage(baseEvent)).rejects.toThrow(/classifier timeout/);
    expect(prisma.lead.update).not.toHaveBeenCalled();
  });
});

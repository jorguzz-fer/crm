import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@crm/db", () => ({
  prisma: {
    lead: { findUnique: vi.fn() },
    whatsAppInstance: { findUnique: vi.fn() },
    whatsAppConversation: { findFirst: vi.fn(), create: vi.fn() },
    whatsAppMessage: { create: vi.fn() },
  },
}));

vi.mock("@crm/ai", () => ({
  generateFirstContact: vi.fn(),
}));

vi.mock("@crm/whatsapp", () => ({
  createEvolutionAdapter: vi.fn(() => ({
    provider: "evolution",
    sendMessage: vi.fn().mockResolvedValue({ providerMessageId: "wamid-test", status: "sent" }),
    verifyWebhookSignature: vi.fn(),
    parseInbound: vi.fn(),
  })),
}));

vi.mock("../client", () => ({
  inngest: {
    send: vi.fn(),
    createFunction: vi.fn(() => ({})),
  },
}));

import { handleFirstContact } from "../functions/first-contact";
import { prisma } from "@crm/db";
import { generateFirstContact } from "@crm/ai";
import { createEvolutionAdapter } from "@crm/whatsapp";
import { inngest } from "../client";

const baseEvent = {
  tenantId: "tenant-1",
  leadId: "lead-1",
  source: "WHATSAPP" as const,
  channel: "whatsapp" as const,
};

const mockLead = {
  id: "lead-1",
  name: "Ana Silva",
  phone: "+5511999990000",
  tenantId: "tenant-1",
};

const mockInstance = {
  id: "inst-1",
  instanceName: "inst-tenant-1",
  phone: "+5511000000001",
  status: "CONNECTED",
  tenantId: "tenant-1",
};

const mockFirstContact = {
  message: "Oi Ana! Vi que você tem interesse em nossa pós-graduação. Posso te ajudar?",
  suggestedFollowUpMinutes: 120,
  intent: "qualify" as const,
};

describe("handleFirstContact", () => {
  beforeEach(() => {
    vi.mocked(prisma.lead.findUnique).mockReset();
    vi.mocked(prisma.whatsAppInstance.findUnique).mockReset();
    vi.mocked(prisma.whatsAppConversation.findFirst).mockReset();
    vi.mocked(prisma.whatsAppConversation.create).mockReset();
    vi.mocked(prisma.whatsAppMessage.create).mockReset();
    vi.mocked(generateFirstContact).mockReset();
    vi.mocked(inngest.send).mockReset();
  });

  it("retorna skipped=true quando lead não existe no tenant (tenant isolation)", async () => {
    vi.mocked(prisma.lead.findUnique).mockResolvedValueOnce(null);

    const result = await handleFirstContact(baseEvent);
    expect(result.skipped).toBe(true);
  });

  it("retorna skipped=true quando lead não tem phone", async () => {
    vi.mocked(prisma.lead.findUnique).mockResolvedValueOnce({ ...mockLead, phone: null } as never);

    const result = await handleFirstContact(baseEvent);
    expect(result.skipped).toBe(true);
    expect(generateFirstContact).not.toHaveBeenCalled();
  });

  it("retorna skipped=true quando tenant não tem instância WhatsApp conectada", async () => {
    vi.mocked(prisma.lead.findUnique).mockResolvedValueOnce(mockLead as never);
    vi.mocked(prisma.whatsAppInstance.findUnique).mockResolvedValueOnce(null);

    const result = await handleFirstContact({ ...baseEvent, channel: "whatsapp" });
    expect(result.skipped).toBe(true);
    expect(generateFirstContact).not.toHaveBeenCalled();
  });

  it("retorna skipped=true quando instância está DISCONNECTED", async () => {
    vi.mocked(prisma.lead.findUnique).mockResolvedValueOnce(mockLead as never);
    vi.mocked(prisma.whatsAppInstance.findUnique).mockResolvedValueOnce({
      ...mockInstance,
      status: "DISCONNECTED",
    } as never);

    const result = await handleFirstContact(baseEvent);
    expect(result.skipped).toBe(true);
  });

  it("chama generateFirstContact com leadName e productContext", async () => {
    vi.mocked(prisma.lead.findUnique).mockResolvedValueOnce(mockLead as never);
    vi.mocked(prisma.whatsAppInstance.findUnique).mockResolvedValueOnce(mockInstance as never);
    vi.mocked(prisma.whatsAppConversation.findFirst).mockResolvedValueOnce(null);
    vi.mocked(prisma.whatsAppConversation.create).mockResolvedValueOnce({ id: "conv-new" } as never);
    vi.mocked(prisma.whatsAppMessage.create).mockResolvedValueOnce({} as never);
    vi.mocked(generateFirstContact).mockResolvedValueOnce(mockFirstContact);
    vi.mocked(inngest.send).mockResolvedValueOnce({} as never);

    await handleFirstContact(baseEvent);

    expect(generateFirstContact).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-1",
        leadId: "lead-1",
        leadName: "Ana Silva",
        channel: "whatsapp",
        productContext: expect.objectContaining({
          name: expect.any(String),
          priceBrl: expect.any(Number),
          highlights: expect.arrayContaining([expect.any(String)]),
        }),
      }),
    );
  });

  it("usa productContext do evento quando fornecido", async () => {
    const customProduct = {
      name: "Pós Cardiologia Intensiva",
      priceBrl: 19997,
      highlights: ["Live semanal", "Plantão dúvidas"],
    };

    vi.mocked(prisma.lead.findUnique).mockResolvedValueOnce(mockLead as never);
    vi.mocked(prisma.whatsAppInstance.findUnique).mockResolvedValueOnce(mockInstance as never);
    vi.mocked(prisma.whatsAppConversation.findFirst).mockResolvedValueOnce(null);
    vi.mocked(prisma.whatsAppConversation.create).mockResolvedValueOnce({ id: "conv-new" } as never);
    vi.mocked(prisma.whatsAppMessage.create).mockResolvedValueOnce({} as never);
    vi.mocked(generateFirstContact).mockResolvedValueOnce(mockFirstContact);
    vi.mocked(inngest.send).mockResolvedValueOnce({} as never);

    await handleFirstContact({ ...baseEvent, productContext: customProduct });

    expect(generateFirstContact).toHaveBeenCalledWith(
      expect.objectContaining({ productContext: customProduct }),
    );
  });

  it("salva mensagem no DB após envio via WhatsApp", async () => {
    vi.mocked(prisma.lead.findUnique).mockResolvedValueOnce(mockLead as never);
    vi.mocked(prisma.whatsAppInstance.findUnique).mockResolvedValueOnce(mockInstance as never);
    vi.mocked(prisma.whatsAppConversation.findFirst).mockResolvedValueOnce(null);
    vi.mocked(prisma.whatsAppConversation.create).mockResolvedValueOnce({ id: "conv-abc" } as never);
    vi.mocked(prisma.whatsAppMessage.create).mockResolvedValueOnce({} as never);
    vi.mocked(generateFirstContact).mockResolvedValueOnce(mockFirstContact);
    vi.mocked(inngest.send).mockResolvedValueOnce({} as never);

    await handleFirstContact(baseEvent);

    expect(prisma.whatsAppMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: "tenant-1",
          fromMe: true,
          body: mockFirstContact.message,
        }),
      }),
    );
  });

  it("emite followup/scheduled após envio bem-sucedido", async () => {
    vi.mocked(prisma.lead.findUnique).mockResolvedValueOnce(mockLead as never);
    vi.mocked(prisma.whatsAppInstance.findUnique).mockResolvedValueOnce(mockInstance as never);
    vi.mocked(prisma.whatsAppConversation.findFirst).mockResolvedValueOnce(null);
    vi.mocked(prisma.whatsAppConversation.create).mockResolvedValueOnce({ id: "conv-abc" } as never);
    vi.mocked(prisma.whatsAppMessage.create).mockResolvedValueOnce({} as never);
    vi.mocked(generateFirstContact).mockResolvedValueOnce(mockFirstContact);
    vi.mocked(inngest.send).mockResolvedValueOnce({} as never);

    await handleFirstContact(baseEvent);

    expect(inngest.send).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "followup/scheduled",
        data: expect.objectContaining({
          tenantId: "tenant-1",
          leadId: "lead-1",
        }),
      }),
    );
  });

  it("tenant isolation: findUnique do lead usa tenantId", async () => {
    vi.mocked(prisma.lead.findUnique).mockResolvedValueOnce(null);

    await handleFirstContact({ ...baseEvent, tenantId: "tenant-X" });

    expect(prisma.lead.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "lead-1", tenantId: "tenant-X" }),
      }),
    );
  });
});

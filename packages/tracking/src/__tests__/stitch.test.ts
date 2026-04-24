import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@crm/db", () => ({
  prisma: {
    lead: { findFirst: vi.fn() },
    conversionEvent: { create: vi.fn() },
    attribution: { findUnique: vi.fn() },
  },
}));

import { stitchPaymentToLead } from "../attribution/stitch";
import { prisma } from "@crm/db";

const tenantId = "tenant-1";

const approvedPayment = {
  gateway: "hotmart" as const,
  externalId: "HP-001",
  status: "approved" as const,
  amount: 9997.0,
  currency: "BRL",
  buyerEmail: "joao@example.com",
  productExternalId: "prod_1",
  occurredAt: new Date("2024-04-24T20:00:00Z"),
  rawPayload: {},
};

describe("stitchPaymentToLead", () => {
  beforeEach(() => {
    vi.mocked(prisma.lead.findFirst).mockReset();
    vi.mocked(prisma.conversionEvent.create).mockReset();
    vi.mocked(prisma.attribution.findUnique).mockReset();
  });

  it("encontra lead pelo email e cria ConversionEvent", async () => {
    vi.mocked(prisma.lead.findFirst).mockResolvedValueOnce({ id: "lead-1", tenantId } as never);
    vi.mocked(prisma.conversionEvent.create).mockResolvedValueOnce({ id: "ce-1" } as never);

    const result = await stitchPaymentToLead(tenantId, approvedPayment);

    expect(result.matched).toBe(true);
    expect(result.leadId).toBe("lead-1");
    expect(prisma.conversionEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId,
          leadId: "lead-1",
          platform: "hotmart",
          externalEventId: "HP-001",
          status: "success",
          value: 9997.0,
          currency: "BRL",
        }),
      }),
    );
  });

  it("retorna matched=false quando nenhum lead encontrado pelo email", async () => {
    vi.mocked(prisma.lead.findFirst).mockResolvedValueOnce(null);

    const result = await stitchPaymentToLead(tenantId, approvedPayment);

    expect(result.matched).toBe(false);
    expect(prisma.conversionEvent.create).not.toHaveBeenCalled();
  });

  it("ignora eventos com status != approved (refund, chargeback)", async () => {
    const refunded = { ...approvedPayment, status: "refunded" as const };

    const result = await stitchPaymentToLead(tenantId, refunded);

    expect(prisma.lead.findFirst).not.toHaveBeenCalled();
    expect(result.matched).toBe(false);
    expect(result.skipped).toBe(true);
  });

  it("usa isolamento de tenant ao buscar lead (where.tenantId)", async () => {
    vi.mocked(prisma.lead.findFirst).mockResolvedValueOnce({ id: "lead-2", tenantId } as never);
    vi.mocked(prisma.conversionEvent.create).mockResolvedValueOnce({} as never);

    await stitchPaymentToLead(tenantId, approvedPayment);

    expect(prisma.lead.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId }),
      }),
    );
  });

  it("inclui atribuição de fbclid quando lead tem Attribution com fbclid", async () => {
    vi.mocked(prisma.lead.findFirst).mockResolvedValueOnce({ id: "lead-3", tenantId } as never);
    vi.mocked(prisma.attribution.findUnique).mockResolvedValueOnce({
      fbclid: "IwAR1test",
      fbp: "_fbp_test",
      fbc: "_fbc_test",
    } as never);
    vi.mocked(prisma.conversionEvent.create).mockResolvedValueOnce({} as never);

    const result = await stitchPaymentToLead(tenantId, approvedPayment);

    expect(result.matched).toBe(true);
    expect(result.attribution).toMatchObject({ fbclid: "IwAR1test" });
  });
});

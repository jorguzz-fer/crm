import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@crm/db", () => ({
  prisma: {
    campaignSpend: { findMany: vi.fn() },
    conversionEvent: { findMany: vi.fn() },
    lead: { count: vi.fn() },
  },
}));

import { getCplByCampaign, getRoasByCampaign, getConversionFunnel } from "../analytics/queries";
import { prisma } from "@crm/db";

const TENANT = "tenant-1";
const DATE_FROM = new Date("2024-04-01");
const DATE_TO = new Date("2024-04-30");

describe("getCplByCampaign", () => {
  beforeEach(() => {
    vi.mocked(prisma.campaignSpend.findMany).mockReset();
    vi.mocked(prisma.lead.count).mockReset();
  });

  it("retorna CPL correto: spend / leads gerados no período", async () => {
    vi.mocked(prisma.campaignSpend.findMany).mockResolvedValueOnce([
      { campaignId: "camp-1", campaignName: "Pós Med Abril", platform: "meta", spend: 1000, clicks: 200 },
    ] as never);
    vi.mocked(prisma.lead.count).mockResolvedValueOnce(10);

    const result = await getCplByCampaign(TENANT, DATE_FROM, DATE_TO);

    expect(result).toHaveLength(1);
    expect(result[0].campaignId).toBe("camp-1");
    expect(result[0].campaignName).toBe("Pós Med Abril");
    expect(result[0].totalSpend).toBe(1000);
    expect(result[0].leads).toBe(10);
    expect(result[0].cpl).toBe(100); // 1000 / 10
  });

  it("retorna CPL=null quando leads=0 (evita divisão por zero)", async () => {
    vi.mocked(prisma.campaignSpend.findMany).mockResolvedValueOnce([
      { campaignId: "camp-2", campaignName: "Sem leads", platform: "meta", spend: 500, clicks: 50 },
    ] as never);
    vi.mocked(prisma.lead.count).mockResolvedValueOnce(0);

    const result = await getCplByCampaign(TENANT, DATE_FROM, DATE_TO);

    expect(result[0].cpl).toBeNull();
  });

  it("agrega spend de múltiplos dias para a mesma campanha", async () => {
    vi.mocked(prisma.campaignSpend.findMany).mockResolvedValueOnce([
      { campaignId: "camp-1", campaignName: "Camp A", platform: "meta", spend: 300, clicks: 30 },
      { campaignId: "camp-1", campaignName: "Camp A", platform: "meta", spend: 700, clicks: 70 },
    ] as never);
    vi.mocked(prisma.lead.count).mockResolvedValueOnce(5);

    const result = await getCplByCampaign(TENANT, DATE_FROM, DATE_TO);

    expect(result).toHaveLength(1);
    expect(result[0].totalSpend).toBe(1000);
    expect(result[0].cpl).toBe(200);
  });

  it("filtra por tenantId (isolamento)", async () => {
    vi.mocked(prisma.campaignSpend.findMany).mockResolvedValueOnce([] as never);
    vi.mocked(prisma.lead.count).mockResolvedValueOnce(0);

    await getCplByCampaign(TENANT, DATE_FROM, DATE_TO);

    expect(prisma.campaignSpend.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: TENANT }) }),
    );
  });
});

describe("getRoasByCampaign", () => {
  beforeEach(() => {
    vi.mocked(prisma.campaignSpend.findMany).mockReset();
    vi.mocked(prisma.conversionEvent.findMany).mockReset();
  });

  it("calcula ROAS correto: receita / spend", async () => {
    vi.mocked(prisma.campaignSpend.findMany).mockResolvedValueOnce([
      { campaignId: "camp-1", campaignName: "Camp A", platform: "meta", spend: 1000, clicks: 100 },
    ] as never);
    vi.mocked(prisma.conversionEvent.findMany).mockResolvedValueOnce([
      { value: 9997, leadId: "l1" },
      { value: 9997, leadId: "l2" },
    ] as never);

    const result = await getRoasByCampaign(TENANT, DATE_FROM, DATE_TO);

    expect(result[0].totalSpend).toBe(1000);
    expect(result[0].totalRevenue).toBe(19994);
    expect(result[0].roas).toBeCloseTo(19.994);
  });

  it("retorna ROAS=null quando spend=0", async () => {
    vi.mocked(prisma.campaignSpend.findMany).mockResolvedValueOnce([
      { campaignId: "camp-1", campaignName: "Camp A", platform: "meta", spend: 0, clicks: 0 },
    ] as never);
    vi.mocked(prisma.conversionEvent.findMany).mockResolvedValueOnce([] as never);

    const result = await getRoasByCampaign(TENANT, DATE_FROM, DATE_TO);

    expect(result[0].roas).toBeNull();
  });

  it("retorna ROAS=0 quando receita=0 mas spend>0", async () => {
    vi.mocked(prisma.campaignSpend.findMany).mockResolvedValueOnce([
      { campaignId: "camp-1", campaignName: "Camp A", platform: "meta", spend: 500, clicks: 50 },
    ] as never);
    vi.mocked(prisma.conversionEvent.findMany).mockResolvedValueOnce([] as never);

    const result = await getRoasByCampaign(TENANT, DATE_FROM, DATE_TO);

    expect(result[0].roas).toBe(0);
  });
});

describe("getConversionFunnel", () => {
  beforeEach(() => {
    vi.mocked(prisma.lead.count).mockReset();
    vi.mocked(prisma.conversionEvent.findMany).mockReset();
  });

  it("retorna funil com leads, qualificados e convertidos", async () => {
    vi.mocked(prisma.lead.count)
      .mockResolvedValueOnce(100)  // total leads
      .mockResolvedValueOnce(40);  // qualified (score >= 60)
    vi.mocked(prisma.conversionEvent.findMany).mockResolvedValueOnce([
      { value: 9997 },
      { value: 9997 },
      { value: 9997 },
    ] as never);

    const result = await getConversionFunnel(TENANT, DATE_FROM, DATE_TO);

    expect(result.totalLeads).toBe(100);
    expect(result.qualifiedLeads).toBe(40);
    expect(result.conversions).toBe(3);
    expect(result.totalRevenue).toBe(29991);
    expect(result.conversionRate).toBeCloseTo(3); // 3/100 * 100
  });

  it("conversionRate=0 quando totalLeads=0", async () => {
    vi.mocked(prisma.lead.count).mockResolvedValue(0);
    vi.mocked(prisma.conversionEvent.findMany).mockResolvedValueOnce([] as never);

    const result = await getConversionFunnel(TENANT, DATE_FROM, DATE_TO);

    expect(result.conversionRate).toBe(0);
  });
});

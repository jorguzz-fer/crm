import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@crm/db", () => ({
  prisma: {
    membership: { findMany: vi.fn() },
    lead: { count: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
  },
}));

vi.mock("../client", () => ({
  inngest: { send: vi.fn(), createFunction: vi.fn(() => ({})) },
}));

import { handleAutoAssign, handleReAssignHot } from "../functions/auto-assign";
import { prisma } from "@crm/db";
import { inngest } from "../client";

const TENANT = "tenant-1";

const makeMember = (userId: string, overrides = {}) => ({
  userId,
  role: "ANALYST",
  acceptingLeads: true,
  maxLeads: null,
  user: { id: userId, name: `User ${userId}`, active: true },
  ...overrides,
});

describe("handleAutoAssign", () => {
  beforeEach(() => {
    vi.mocked(prisma.membership.findMany).mockReset();
    vi.mocked(prisma.lead.count).mockReset();
    vi.mocked(prisma.lead.update).mockReset();
    vi.mocked(inngest.send).mockReset();
  });

  it("atribui lead ao vendedor com menos leads abertos (least-loaded)", async () => {
    vi.mocked(prisma.membership.findMany).mockResolvedValueOnce([
      makeMember("u1"),
      makeMember("u2"),
      makeMember("u3"),
    ] as never);
    // u1=5, u2=2, u3=8 leads abertos
    vi.mocked(prisma.lead.count)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(8);
    vi.mocked(prisma.lead.update).mockResolvedValueOnce({} as never);

    const result = await handleAutoAssign({ tenantId: TENANT, leadId: "lead-1" });

    if (result.skipped) throw new Error("esperava atribuição, veio skipped");
    expect(result.assignedTo).toBe("u2");
    expect(prisma.lead.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ assignedTo: "u2" }) }),
    );
  });

  it("respeita maxLeads — exclui vendedor no limite", async () => {
    vi.mocked(prisma.membership.findMany).mockResolvedValueOnce([
      makeMember("u1", { maxLeads: 3 }),
      makeMember("u2", { maxLeads: 10 }),
    ] as never);
    // u1 já está no limite (3), u2 tem 1
    vi.mocked(prisma.lead.count)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(1);
    vi.mocked(prisma.lead.update).mockResolvedValueOnce({} as never);

    const result = await handleAutoAssign({ tenantId: TENANT, leadId: "lead-2" });

    if (result.skipped) throw new Error("esperava atribuição, veio skipped");
    expect(result.assignedTo).toBe("u2");
  });

  it("ignora membros com acceptingLeads=false (WHERE clause os filtra)", async () => {
    // findMany já recebe acceptingLeads:true no WHERE — retorna só u2
    vi.mocked(prisma.membership.findMany).mockResolvedValueOnce([
      makeMember("u2"),
    ] as never);
    vi.mocked(prisma.lead.count).mockResolvedValueOnce(0);
    vi.mocked(prisma.lead.update).mockResolvedValueOnce({} as never);

    const result = await handleAutoAssign({ tenantId: TENANT, leadId: "lead-3" });

    if (result.skipped) throw new Error("esperava atribuição, veio skipped");
    expect(result.assignedTo).toBe("u2");
  });

  it("retorna skipped=true quando nenhum vendedor disponível", async () => {
    // Nenhum membro retornado (todos com acceptingLeads=false foram filtrados)
    vi.mocked(prisma.membership.findMany).mockResolvedValueOnce([] as never);

    const result = await handleAutoAssign({ tenantId: TENANT, leadId: "lead-4" });

    expect(result.skipped).toBe(true);
    expect(prisma.lead.update).not.toHaveBeenCalled();
  });

  it("emite evento lead/assigned após atribuição", async () => {
    vi.mocked(prisma.membership.findMany).mockResolvedValueOnce([makeMember("u1")] as never);
    vi.mocked(prisma.lead.count).mockResolvedValueOnce(0);
    vi.mocked(prisma.lead.update).mockResolvedValueOnce({} as never);
    vi.mocked(inngest.send).mockResolvedValueOnce({} as never);

    await handleAutoAssign({ tenantId: TENANT, leadId: "lead-5" });

    expect(inngest.send).toHaveBeenCalledWith(
      expect.objectContaining({ name: "lead/assigned" }),
    );
  });

  it("busca apenas membros ANALYST e SUPERVISOR (não ADMIN)", async () => {
    vi.mocked(prisma.membership.findMany).mockResolvedValueOnce([] as never);

    await handleAutoAssign({ tenantId: TENANT, leadId: "lead-6" });

    expect(prisma.membership.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          role: { in: ["ANALYST", "SUPERVISOR"] },
        }),
      }),
    );
  });
});

describe("handleReAssignHot", () => {
  beforeEach(() => {
    vi.mocked(prisma.lead.findUnique).mockReset();
    vi.mocked(prisma.membership.findMany).mockReset();
    vi.mocked(prisma.lead.count).mockReset();
    vi.mocked(prisma.lead.update).mockReset();
    vi.mocked(inngest.send).mockReset();
  });

  it("reatribui lead quente ao vendedor com maior taxa de conversão", async () => {
    vi.mocked(prisma.lead.findUnique).mockResolvedValueOnce({
      id: "lead-1", scoreLabel: "hot", assignedTo: "u1",
    } as never);
    vi.mocked(prisma.membership.findMany).mockResolvedValueOnce([
      makeMember("u1"),
      makeMember("u2"),
    ] as never);
    // u1: 10 total / 2 convertidos = 20%, u2: 10 total / 5 convertidos = 50%
    vi.mocked(prisma.lead.count)
      .mockResolvedValueOnce(10).mockResolvedValueOnce(2)  // u1
      .mockResolvedValueOnce(10).mockResolvedValueOnce(5); // u2
    vi.mocked(prisma.lead.update).mockResolvedValueOnce({} as never);

    const result = await handleReAssignHot({ tenantId: TENANT, leadId: "lead-1" });

    if (result.skipped) throw new Error("esperava reatribuição, veio skipped");
    expect(result.reassigned).toBe(true);
    expect(result.assignedTo).toBe("u2");
  });

  it("não reatribui se o lead não é hot", async () => {
    vi.mocked(prisma.lead.findUnique).mockResolvedValueOnce({
      id: "lead-2", scoreLabel: "warm", assignedTo: "u1",
    } as never);

    const result = await handleReAssignHot({ tenantId: TENANT, leadId: "lead-2" });

    expect(result.skipped).toBe(true);
    expect(prisma.lead.update).not.toHaveBeenCalled();
  });

  it("não reatribui se já está com o melhor vendedor", async () => {
    vi.mocked(prisma.lead.findUnique).mockResolvedValueOnce({
      id: "lead-3", scoreLabel: "hot", assignedTo: "u1",
    } as never);
    vi.mocked(prisma.membership.findMany).mockResolvedValueOnce([
      makeMember("u1"),
      makeMember("u2"),
    ] as never);
    // u1 tem maior taxa: 10 total / 8 convertidos = 80%
    vi.mocked(prisma.lead.count)
      .mockResolvedValueOnce(10).mockResolvedValueOnce(8)  // u1
      .mockResolvedValueOnce(10).mockResolvedValueOnce(2); // u2

    const result = await handleReAssignHot({ tenantId: TENANT, leadId: "lead-3" });

    expect(result.skipped).toBe(true);
    expect(prisma.lead.update).not.toHaveBeenCalled();
  });
});

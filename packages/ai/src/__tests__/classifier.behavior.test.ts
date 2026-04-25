import { vi, describe, it, expect, beforeEach } from "vitest";

// Mocks hoisted before imports by vitest
vi.mock("ai", () => ({
  generateObject: vi.fn(),
}));

const modelSpy = vi.fn((modelId: string) => ({ id: modelId }));
vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: vi.fn(() => modelSpy),
}));

import { classifyLead } from "../assistants/classifier";
import { generateObject } from "ai";
import { MODELS } from "../models";

const minimalInput = {
  tenantId: "tenant-A",
  leadId: "lead-1",
  messages: [{ role: "lead" as const, content: "quanto custa? tem parcelamento?", at: new Date() }],
};

const hotResult = {
  classification: "hot" as const,
  confidence: 0.92,
  rationale: "Perguntou preço e parcelamento diretamente",
  recommendedNextAction: "route_to_human" as const,
  signals: { intent: "high" as const, budget: "fit" as const, timeline: "short" as const },
};

const warmResult = {
  classification: "warm" as const,
  confidence: 0.65,
  rationale: "Engajado mas ainda explorando",
  recommendedNextAction: "send_education" as const,
};

describe("classifyLead (Fase 2 — comportamento)", () => {
  beforeEach(() => {
    vi.mocked(generateObject).mockReset();
    modelSpy.mockClear();
    process.env.OPENROUTER_API_KEY = "test-key";
  });

  it("retorna Classification válida quando AI responde com hot", async () => {
    vi.mocked(generateObject).mockResolvedValueOnce({ object: hotResult } as never);

    const result = await classifyLead(minimalInput);

    expect(result.classification).toBe("hot");
    expect(result.confidence).toBeGreaterThan(0.8);
    expect(result.recommendedNextAction).toBe("route_to_human");
  });

  it("retorna warm quando AI classifica como warm", async () => {
    vi.mocked(generateObject).mockResolvedValueOnce({ object: warmResult } as never);

    const result = await classifyLead({
      ...minimalInput,
      messages: [{ role: "lead", content: "interessante, me conta mais", at: new Date() }],
    });

    expect(result.classification).toBe("warm");
  });

  it("ctwaClid aparece no prompt quando fornecido", async () => {
    vi.mocked(generateObject).mockResolvedValueOnce({ object: hotResult } as never);

    await classifyLead({
      ...minimalInput,
      attribution: { ctwaClid: "ARB-TEST-123" },
    });

    const callArgs = vi.mocked(generateObject).mock.calls[0][0] as Record<string, unknown>;
    const prompt = String(callArgs.prompt ?? "");
    expect(prompt).toContain("ARB-TEST-123");
  });

  it("productContext (nome e preço) aparece no prompt", async () => {
    vi.mocked(generateObject).mockResolvedValueOnce({ object: hotResult } as never);

    await classifyLead({
      ...minimalInput,
      productContext: { name: "Pós Cardiologia", priceBrl: 14997 },
    });

    const callArgs = vi.mocked(generateObject).mock.calls[0][0] as Record<string, unknown>;
    const prompt = String(callArgs.prompt ?? "");
    expect(prompt).toContain("Pós Cardiologia");
    expect(prompt).toContain("14997");
  });

  it("histórico de mensagens está no prompt", async () => {
    vi.mocked(generateObject).mockResolvedValueOnce({ object: hotResult } as never);

    await classifyLead({
      ...minimalInput,
      messages: [{ role: "lead", content: "preciso de um certificado válido", at: new Date() }],
    });

    const callArgs = vi.mocked(generateObject).mock.calls[0][0] as Record<string, unknown>;
    const prompt = String(callArgs.prompt ?? "");
    expect(prompt).toContain("preciso de um certificado válido");
  });

  it("tenant isolation: tenantId de tenant-A não contamina chamada para tenant-B", async () => {
    vi.mocked(generateObject).mockResolvedValue({ object: warmResult } as never);

    await classifyLead({ ...minimalInput, tenantId: "tenant-A", leadId: "la1" });
    const promptA = String(
      (vi.mocked(generateObject).mock.calls[0][0] as Record<string, unknown>).prompt ?? "",
    );

    await classifyLead({ ...minimalInput, tenantId: "tenant-B", leadId: "lb1" });
    const promptB = String(
      (vi.mocked(generateObject).mock.calls[1][0] as Record<string, unknown>).prompt ?? "",
    );

    expect(promptA).not.toContain("tenant-B");
    expect(promptB).not.toContain("tenant-A");
  });

  it("usa MODELS.scoring (haiku) no generateObject call", async () => {
    vi.mocked(generateObject).mockResolvedValueOnce({ object: hotResult } as never);

    await classifyLead(minimalInput);

    expect(modelSpy).toHaveBeenCalledWith(MODELS.scoring);
    expect(MODELS.scoring).toContain("haiku");
  });

  it("propaga erro do AI SDK sem engolir", async () => {
    vi.mocked(generateObject).mockRejectedValueOnce(new Error("OpenRouter 429 rate limit"));

    await expect(classifyLead(minimalInput)).rejects.toThrow(/429 rate limit/);
  });
});

import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("ai", () => ({
  generateObject: vi.fn(),
}));

const modelSpy = vi.fn((modelId: string) => ({ id: modelId }));
vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: vi.fn(() => modelSpy),
}));

import { generateFirstContact, generateFollowUp } from "../assistants/sdr";
import { generateObject } from "ai";
import { MODELS } from "../models";

const baseFirstContactInput = {
  tenantId: "t1",
  leadId: "l1",
  leadName: "Ana",
  channel: "whatsapp" as const,
  productContext: {
    name: "Pós Cardiologia",
    priceBrl: 14997,
    highlights: ["EAD", "Certificado MEC", "Plantão ao vivo"],
  },
  tone: "consultivo" as const,
};

const validFirstContactOutput = {
  message: "Oi Ana! Vi que você tem interesse em cardiologia. Posso te ajudar?",
  suggestedFollowUpMinutes: 120,
  intent: "qualify" as const,
};

const baseFollowUpInput = {
  tenantId: "t1",
  leadId: "l1",
  leadName: "Ana",
  channel: "whatsapp" as const,
  previousMessages: [{ role: "sdr" as const, content: "Oi Ana!", at: new Date() }],
  attempt: 1,
  daysSinceLastReply: 1,
};

const validFollowUpOutput = {
  message: "Ana, tudo bem? Queria saber se teve chance de ver o material.",
  shouldEscalate: false,
  nextAttemptHours: 48,
};

describe("generateFirstContact (Fase 2 — comportamento)", () => {
  beforeEach(() => {
    vi.mocked(generateObject).mockReset();
    modelSpy.mockClear();
    process.env.OPENROUTER_API_KEY = "test-key";
  });

  it("retorna FirstContactOutput válido quando AI responde", async () => {
    vi.mocked(generateObject).mockResolvedValueOnce({ object: validFirstContactOutput } as never);

    const result = await generateFirstContact(baseFirstContactInput);

    expect(result.message).toBeTruthy();
    expect(result.suggestedFollowUpMinutes).toBeGreaterThan(0);
    expect(["qualify", "educate", "book_call"]).toContain(result.intent);
  });

  it("nome do lead está no prompt", async () => {
    vi.mocked(generateObject).mockResolvedValueOnce({ object: validFirstContactOutput } as never);

    await generateFirstContact(baseFirstContactInput);

    const callArgs = vi.mocked(generateObject).mock.calls[0][0] as Record<string, unknown>;
    const prompt = String(callArgs.prompt ?? "");
    expect(prompt).toContain("Ana");
  });

  it("highlights do produto estão no prompt", async () => {
    vi.mocked(generateObject).mockResolvedValueOnce({ object: validFirstContactOutput } as never);

    await generateFirstContact(baseFirstContactInput);

    const callArgs = vi.mocked(generateObject).mock.calls[0][0] as Record<string, unknown>;
    const prompt = String(callArgs.prompt ?? "");
    expect(prompt).toContain("EAD");
    expect(prompt).toContain("Certificado MEC");
  });

  it("tom está refletido no prompt", async () => {
    vi.mocked(generateObject).mockResolvedValueOnce({ object: validFirstContactOutput } as never);

    await generateFirstContact({ ...baseFirstContactInput, tone: "formal" });

    const callArgs = vi.mocked(generateObject).mock.calls[0][0] as Record<string, unknown>;
    const prompt = String(callArgs.prompt ?? "");
    expect(prompt).toContain("formal");
  });

  it("ctwaClid está no prompt quando fornecido", async () => {
    vi.mocked(generateObject).mockResolvedValueOnce({ object: validFirstContactOutput } as never);

    await generateFirstContact({
      ...baseFirstContactInput,
      attribution: { ctwaClid: "CTWA-ANUNCIO-123" },
    });

    const callArgs = vi.mocked(generateObject).mock.calls[0][0] as Record<string, unknown>;
    const prompt = String(callArgs.prompt ?? "");
    expect(prompt).toContain("CTWA-ANUNCIO-123");
  });

  it("usa MODELS.sdr (haiku) no generateObject call", async () => {
    vi.mocked(generateObject).mockResolvedValueOnce({ object: validFirstContactOutput } as never);

    await generateFirstContact(baseFirstContactInput);

    expect(modelSpy).toHaveBeenCalledWith(MODELS.sdr);
  });

  it("propaga erro do AI SDK", async () => {
    vi.mocked(generateObject).mockRejectedValueOnce(new Error("timeout after 30s"));

    await expect(generateFirstContact(baseFirstContactInput)).rejects.toThrow(/timeout/);
  });
});

describe("generateFollowUp (Fase 2 — comportamento)", () => {
  beforeEach(() => {
    vi.mocked(generateObject).mockReset();
    modelSpy.mockClear();
    process.env.OPENROUTER_API_KEY = "test-key";
  });

  it("retorna FollowUpOutput válido quando AI responde", async () => {
    vi.mocked(generateObject).mockResolvedValueOnce({ object: validFollowUpOutput } as never);

    const result = await generateFollowUp(baseFollowUpInput);

    expect(result.message).toBeTruthy();
    expect(typeof result.shouldEscalate).toBe("boolean");
  });

  it("attempt number está no prompt", async () => {
    vi.mocked(generateObject).mockResolvedValueOnce({ object: validFollowUpOutput } as never);

    await generateFollowUp({ ...baseFollowUpInput, attempt: 3 });

    const callArgs = vi.mocked(generateObject).mock.calls[0][0] as Record<string, unknown>;
    const prompt = String(callArgs.prompt ?? "");
    expect(prompt).toContain("3");
  });

  it("previousMessages estão no prompt", async () => {
    vi.mocked(generateObject).mockResolvedValueOnce({ object: validFollowUpOutput } as never);

    await generateFollowUp({
      ...baseFollowUpInput,
      previousMessages: [{ role: "sdr", content: "Oi Ana, tudo bem?", at: new Date() }],
    });

    const callArgs = vi.mocked(generateObject).mock.calls[0][0] as Record<string, unknown>;
    const prompt = String(callArgs.prompt ?? "");
    expect(prompt).toContain("Oi Ana, tudo bem?");
  });

  it("shouldEscalate=true é retornado quando AI decide escalar", async () => {
    vi.mocked(generateObject).mockResolvedValueOnce({
      object: { message: "Vou te colocar com um consultor.", shouldEscalate: true, nextAttemptHours: null },
    } as never);

    const result = await generateFollowUp({ ...baseFollowUpInput, attempt: 5 });

    expect(result.shouldEscalate).toBe(true);
    expect(result.nextAttemptHours).toBeNull();
  });

  it("propaga erro do AI SDK", async () => {
    vi.mocked(generateObject).mockRejectedValueOnce(new Error("model unavailable"));

    await expect(generateFollowUp(baseFollowUpInput)).rejects.toThrow(/model unavailable/);
  });
});

import { describe, it, expect } from "vitest";
import { createEvolutionAdapter } from "../adapters/evolution";

const adapter = createEvolutionAdapter({
  baseUrl: "https://evo.example.com",
  apiKey: "secret-key-123",
  instanceName: "test-instance",
  instancePhone: "+5511000000000",
});

describe("evolution — verifyWebhookSignature", () => {
  it("aceita quando header apikey bate com config", async () => {
    const result = await adapter.verifyWebhookSignature({
      rawBody: '{"event":"messages.upsert","instance":"test-instance","data":[]}',
      headers: { apikey: "secret-key-123" },
      secret: "secret-key-123",
    });
    expect(result.ok).toBe(true);
  });

  it("rejeita quando apikey ausente nos headers", async () => {
    const result = await adapter.verifyWebhookSignature({
      rawBody: "{}",
      headers: {},
      secret: "secret-key-123",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/apikey/i);
  });

  it("rejeita quando apikey errado", async () => {
    const result = await adapter.verifyWebhookSignature({
      rawBody: "{}",
      headers: { apikey: "wrong-key" },
      secret: "secret-key-123",
    });
    expect(result.ok).toBe(false);
  });

  it("aceita apikey em body quando ausente no header (Evolution v1 compat)", async () => {
    const body = JSON.stringify({
      event: "messages.upsert",
      instance: "test-instance",
      apikey: "secret-key-123",
      data: [],
    });
    const result = await adapter.verifyWebhookSignature({
      rawBody: body,
      headers: {},
      secret: "secret-key-123",
    });
    expect(result.ok).toBe(true);
  });

  it("header tem prioridade sobre body (header errado rejeita mesmo body certo)", async () => {
    const body = JSON.stringify({ apikey: "secret-key-123" });
    const result = await adapter.verifyWebhookSignature({
      rawBody: body,
      headers: { apikey: "wrong" },
      secret: "secret-key-123",
    });
    expect(result.ok).toBe(false);
  });

  it("rejeita body JSON inválido sem header", async () => {
    const result = await adapter.verifyWebhookSignature({
      rawBody: "not-json",
      headers: {},
      secret: "secret-key-123",
    });
    expect(result.ok).toBe(false);
  });
});

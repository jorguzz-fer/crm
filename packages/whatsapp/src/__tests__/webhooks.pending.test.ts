import { describe, it } from "vitest";

/**
 * Contratos pendentes (Fase 1) do handler compartilhado.
 */
describe("handleWebhook — especificações pendentes", () => {
  it.todo("retorna 401 quando verifyWebhookSignature falha");
  it.todo("retorna 200 com processed=0 quando payload vazio (health probe)");
  it.todo("aplica rate limit por providerInstanceId e retorna 429");
  it.todo("dedup por externalMessageId — mesma mensagem 2x é processada 1x");
  it.todo("emite inngest event 'message/received' com tenantId pra cada msg");
  it.todo("preserva ctwaClid no payload do evento pra tracking stitcher");
  it.todo("retorna 500 sem vazar stacktrace em body público");
  it.todo("audit log em toda mensagem processada");
});

import { describe, it } from "vitest";

/**
 * Especificações pendentes (RED) da Fase 4.
 *
 * Cada `.todo` é contrato vinculante. Implementar a função correspondente
 * exige transformar o `.todo` em teste real + passar.
 */

describe("packages/tracking (Fase 4) — especificações pendentes", () => {
  describe("sendMetaCapiEvent", () => {
    it.todo("envia payload no formato Graph API v21.0");
    it.todo("hasheia email/phone (SHA-256) antes do envio");
    it.todo("inclui event_id para dedup com pixel browser");
    it.todo("retry com backoff exponencial em 5xx (max 3 tentativas)");
    it.todo("não retry em 4xx (exceto 429 rate limit)");
    it.todo("registra ConversionEvent com status success/failed");
    it.todo("preserva ctwa_clid quando disponível na attribution");
  });

  describe("sendGoogleOfflineConversion", () => {
    it.todo("envia via Google Ads API conversion_adjustments");
    it.todo("inclui gclid quando presente");
    it.todo("fallback para Enhanced Conversions quando gclid ausente");
    it.todo("hasheia identificadores conforme spec Google");
  });

  describe("webhook Hotmart", () => {
    it.todo("valida header x-hotmart-hottok contra config do tenant");
    it.todo("rejeita 401 quando hottok ausente ou inválido");
    it.todo("parseia evento PURCHASE_APPROVED corretamente");
    it.todo("parseia evento PURCHASE_REFUNDED corretamente");
    it.todo("idempotência via transaction id");
  });

  describe("webhook Pagar.me", () => {
    it.todo("valida HMAC-SHA256 em x-hub-signature");
    it.todo("rejeita 401 sem assinatura");
    it.todo("parseia charge.paid");
    it.todo("parseia charge.refunded");
  });

  describe("webhook PayPal", () => {
    it.todo("valida IPN via POST de volta pra PayPal");
    it.todo("rejeita se IPN retorna INVALID");
  });

  describe("stitchPaymentToLead", () => {
    it.todo("casa payment.buyerEmail com Lead.email (case insensitive)");
    it.todo("casa payment.buyerPhone com Lead.phone (normalized E.164)");
    it.todo("quando múltiplos leads batem, usa o mais recente com status != DESQUALIFICADO");
    it.todo("quando nenhum lead bate, cria lead órfão com source=PAYMENT_RECONCILIATION");
    it.todo("herda attribution do lead casado");
    it.todo("tenant isolation: payment da org A nunca costura com lead da org B");
  });

  describe("dashboard queries — ROAS", () => {
    it.todo("calcula ROAS por campanha (sum(deal.value) / sum(campaign.spend))");
    it.todo("calcula CPL por campanha (campaign.spend / leads_generated)");
    it.todo("calcula tempo médio clique→venda");
    it.todo("filtra por período e respeita tenantId");
  });
});

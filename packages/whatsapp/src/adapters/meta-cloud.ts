/**
 * Meta WhatsApp Cloud API adapter (oficial).
 *
 * Vantagem: suporte oficial, Click-to-WhatsApp Ads entrega `ctwa_clid`,
 * menor risco de ban, Embedded Signup para onboarding de clientes SaaS.
 * Custo: tarifa por conversa conforme preços do WhatsApp Business.
 *
 * Fase 1: implementação RED/GREEN. Hoje apenas stub + shape.
 */

import type {
  InboundMessage,
  OutboundMessage,
  SendResult,
  WhatsAppAdapter,
} from "../types";

export interface MetaCloudAdapterConfig {
  appSecret: string;        // pra HMAC-SHA256 do x-hub-signature-256
  accessToken: string;
  phoneNumberId: string;
  wabaId: string;
  graphApiVersion?: string; // default v21.0
}

export function createMetaCloudAdapter(
  _config: MetaCloudAdapterConfig,
): WhatsAppAdapter {
  return {
    provider: "meta-cloud",

    async sendMessage(_msg: OutboundMessage): Promise<SendResult> {
      throw new Error("metaCloud.sendMessage: not implemented (Fase 1)");
    },

    async verifyWebhookSignature(_input) {
      throw new Error(
        "metaCloud.verifyWebhookSignature: not implemented (Fase 1)",
      );
    },

    async parseInbound(_rawBody: string): Promise<InboundMessage[]> {
      throw new Error("metaCloud.parseInbound: not implemented (Fase 1)");
    },
  };
}

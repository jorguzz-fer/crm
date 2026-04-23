/**
 * Evolution API adapter (self-hosted, não oficial do Meta).
 *
 * Vantagem: custo zero de conexão, multi-instância trivial.
 * Risco: ban de número pessoal, depende do cliente hospedar/gerenciar instância.
 *
 * Fase 1: implementação RED/GREEN. Hoje apenas stub + shape.
 */

import type {
  InboundMessage,
  OutboundMessage,
  SendResult,
  WhatsAppAdapter,
} from "../types";

export interface EvolutionAdapterConfig {
  baseUrl: string;           // ex: https://evo.mycrm.com
  apiKey: string;            // header "apikey"
  defaultInstanceName?: string;
}

export function createEvolutionAdapter(
  _config: EvolutionAdapterConfig,
): WhatsAppAdapter {
  return {
    provider: "evolution",

    async sendMessage(_msg: OutboundMessage): Promise<SendResult> {
      throw new Error("evolution.sendMessage: not implemented (Fase 1)");
    },

    async verifyWebhookSignature(_input) {
      throw new Error(
        "evolution.verifyWebhookSignature: not implemented (Fase 1)",
      );
    },

    async parseInbound(_rawBody: string): Promise<InboundMessage[]> {
      throw new Error("evolution.parseInbound: not implemented (Fase 1)");
    },
  };
}

export type {
  WhatsAppAdapter,
  InboundMessage,
  OutboundMessage,
  SendResult,
} from "./types";
export { inboundMessageSchema, outboundMessageSchema } from "./types";

export { createEvolutionAdapter } from "./adapters/evolution";
export type { EvolutionAdapterConfig } from "./adapters/evolution";

export { createMetaCloudAdapter } from "./adapters/meta-cloud";
export type { MetaCloudAdapterConfig } from "./adapters/meta-cloud";

export { handleWebhook } from "./webhooks";
export type { HandleWebhookInput, HandleWebhookResult } from "./webhooks";

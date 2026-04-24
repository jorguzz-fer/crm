/**
 * Disparadores server-side de eventos de conversão.
 *
 * Implementações virão na Fase 4. Este módulo define os contratos pra que
 * testes possam começar a ser escritos em RED.
 */

export { sendMetaCapiEvent } from "./meta-capi";
export type { MetaCapiPayload, MetaTenantConfig, MetaCapiResult } from "./meta-capi";
// TODO (Fase 4): export { sendGoogleOfflineConversion } from "./google-offline";
// TODO (Fase 4): export { sendGoogleEnhancedConversion } from "./google-enhanced";

export {}; // placeholder para o módulo ser válido

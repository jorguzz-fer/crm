/**
 * Utilitários de captura no cliente (browser).
 *
 * Usado na Landing Page: captura fbclid/gclid/utms da URL, lê cookies
 * definidos pelos pixels (Meta _fbp/_fbc, Google _ga), e prepara o payload
 * pra mandar ao backend antes de redirecionar pro WhatsApp.
 */

export { captureFromUrl } from "./capture-params";
export { readTrackingCookies } from "./cookies";
export type { ClientCapturedData } from "./capture-params";

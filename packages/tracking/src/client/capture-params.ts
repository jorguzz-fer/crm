import type { AttributionData } from "../types";

export interface ClientCapturedData extends AttributionData {
  landingPage: string | null;
  referrer: string | null;
  userAgent: string | null;
}

/**
 * Captura IDs de clique e UTMs de uma URL.
 *
 * Aceita tanto URL completa (browser: `window.location.href`) quanto
 * objeto URL pré-parseado (SSR: `new URL(request.url)`).
 *
 * Whitelist explícita — não vaza qualquer param pra attribution.
 */
export function captureFromUrl(
  input: string | URL,
  context: {
    referrer?: string | null;
    userAgent?: string | null;
  } = {},
): ClientCapturedData {
  const url = input instanceof URL ? input : new URL(input);
  const params = url.searchParams;

  return {
    fbclid: params.get("fbclid"),
    fbp: null, // cookies são lidos separado
    fbc: null,
    ctwaClid: null,
    gclid: params.get("gclid"),
    gbraid: params.get("gbraid"),
    wbraid: params.get("wbraid"),
    utmSource: params.get("utm_source"),
    utmMedium: params.get("utm_medium"),
    utmCampaign: params.get("utm_campaign"),
    utmContent: params.get("utm_content"),
    utmTerm: params.get("utm_term"),
    landingPage: url.pathname + url.search,
    referrer: context.referrer ?? null,
    userAgent: context.userAgent ?? null,
    ip: null,
  };
}

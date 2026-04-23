/**
 * Leitura de cookies relevantes pra tracking.
 *
 * Pixels Meta e Google setam cookies automaticamente. Lemos pra enriquecer
 * attribution — mas nunca dependemos só deles (ad blockers).
 */

export interface TrackingCookies {
  fbp: string | null; // _fbp — ID de browser Meta
  fbc: string | null; // _fbc — derivado do fbclid
  ga: string | null; // _ga — Google Analytics client ID
}

/**
 * Parse cookies de um header Cookie (string) ou document.cookie.
 *
 * Retorna só os cookies relevantes. Não loga valores (privacidade).
 */
export function readTrackingCookies(cookieHeader: string | null | undefined): TrackingCookies {
  if (!cookieHeader) {
    return { fbp: null, fbc: null, ga: null };
  }

  const cookies = parseCookieHeader(cookieHeader);

  return {
    fbp: cookies._fbp ?? null,
    fbc: cookies._fbc ?? null,
    ga: cookies._ga ?? null,
  };
}

function parseCookieHeader(header: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const part of header.split(";")) {
    const [rawKey, ...rest] = part.split("=");
    if (!rawKey) continue;
    const key = rawKey.trim();
    const value = rest.join("=").trim();
    if (key) result[key] = decodeURIComponent(value);
  }
  return result;
}

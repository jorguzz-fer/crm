/**
 * Token público por tenant para integrações server-to-server (n8n, Make, Zapier).
 *
 * Estratégia: HMAC-SHA256 determinístico do tenantId + AUTH_SECRET.
 * Vantagens:
 *   - Não precisa armazenar no DB (regenerável a qualquer momento)
 *   - Rotaciona junto com o AUTH_SECRET (rotina trimestral)
 *   - Único por tenant, impossível de gerar sem o secret
 */

import crypto from "crypto";

export function generatePublicApiToken(tenantId: string): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET não definido");

  // 32 chars hex = 16 bytes — suficiente contra brute-force
  return crypto
    .createHmac("sha256", secret)
    .update(`public-api:${tenantId}`)
    .digest("hex")
    .slice(0, 32);
}

export function verifyPublicApiToken(tenantId: string, token: string): boolean {
  if (!token || token.length !== 32) return false;
  try {
    const expected = generatePublicApiToken(tenantId);
    return crypto.timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(token,    "hex"),
    );
  } catch {
    return false;
  }
}

/**
 * POST /api/webhooks/pagarme
 *
 * Gateway de pagamento — recebe eventos do Pagar.me.
 *
 * Segurança obrigatória (Fase 4):
 *   1) Verificar HMAC-SHA256 em `x-hub-signature` com secret do tenant
 *   2) Rejeitar 401 sem assinatura ou assinatura inválida
 *   3) Rate limit por IP
 *   4) Idempotência via charge.id
 *   5) Audit log em toda conversão reportada
 *
 * Eventos relevantes:
 *   - charge.paid      → deal/won + payment/received
 *   - charge.refunded  → estorno
 *   - order.canceled   → cancelamento
 *
 * Rota pública — sem requireAuth (é o Pagar.me quem chama).
 */

import { NextResponse } from "next/server";

export async function POST(): Promise<NextResponse> {
  // TODO Fase 4: validar HMAC-SHA256 + stitcher
  return NextResponse.json(
    { error: "Not implemented (Fase 4)" },
    { status: 501 },
  );
}

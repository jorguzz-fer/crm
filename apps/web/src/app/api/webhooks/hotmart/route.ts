/**
 * POST /api/webhooks/hotmart
 *
 * Gateway de pagamento — recebe eventos da Hotmart.
 *
 * Segurança obrigatória (Fase 4):
 *   1) Verificar header `x-hotmart-hottok` contra config do tenant
 *   2) Rate limit por IP
 *   3) Idempotência via transaction id
 *   4) Audit log em toda conversão reportada
 *
 * Eventos relevantes:
 *   - PURCHASE_APPROVED  → deal/won + payment/received
 *   - PURCHASE_REFUNDED  → estorno
 *   - PURCHASE_CANCELED  → cancelamento
 *
 * Rota pública — sem requireAuth (é o Hotmart quem chama).
 */

import { NextResponse } from "next/server";

export async function POST(_req: Request): Promise<NextResponse> {
  // TODO Fase 4: implementar validação + stitcher
  return NextResponse.json(
    { error: "Not implemented (Fase 4)" },
    { status: 501 },
  );
}

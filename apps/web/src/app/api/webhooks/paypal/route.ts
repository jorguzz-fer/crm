/**
 * POST /api/webhooks/paypal
 *
 * Gateway de pagamento — recebe IPN (Instant Payment Notification) do PayPal.
 *
 * Segurança obrigatória (Fase 4):
 *   1) Verificar IPN: enviar de volta para o PayPal com cmd=_notify-validate
 *      e só processar se resposta for "VERIFIED"
 *   2) Rejeitar se PayPal retornar "INVALID"
 *   3) Idempotência via txn_id
 *   4) Audit log em toda conversão reportada
 *
 * Eventos relevantes:
 *   - payment_status=Completed → deal/won + payment/received
 *   - payment_status=Refunded  → estorno
 *
 * Rota pública — sem requireAuth.
 */

import { NextResponse } from "next/server";

export async function POST(): Promise<NextResponse> {
  // TODO Fase 4: validar IPN + stitcher
  return NextResponse.json(
    { error: "Not implemented (Fase 4)" },
    { status: 501 },
  );
}

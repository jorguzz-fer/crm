/**
 * POST /api/webhooks/meta-capi
 *
 * Intake interno para conversões server-side.
 *
 * Este endpoint NÃO é chamado pelo Meta — é chamado pela nossa própria app
 * (ou por webhooks de gateway) para disparar eventos ao Meta CAPI.
 *
 * Segurança obrigatória (Fase 4):
 *   1) requireAuth() — só código interno autenticado envia conversões
 *   2) Validar payload com conversionEventPayloadSchema (@crm/tracking)
 *   3) Hash SHA-256 em email/phone ANTES de enviar ao Meta
 *   4) Idempotência via externalEventId
 *   5) Rate limit para evitar disparos acidentais em massa
 *   6) Audit log de toda conversão reportada
 *
 * Também recebe callbacks de dedup do Meta CAPI (GET com challenge).
 */

import { NextResponse } from "next/server";

export async function POST(_req: Request): Promise<NextResponse> {
  // TODO Fase 4: validar + enviar via sendMetaCapiEvent
  return NextResponse.json(
    { error: "Not implemented (Fase 4)" },
    { status: 501 },
  );
}

// Verificação de webhook Meta (GET com challenge)
export async function GET(req: Request): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (
    mode === "subscribe" &&
    token === process.env.META_WEBHOOK_VERIFY_TOKEN &&
    challenge
  ) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

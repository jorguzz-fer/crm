/**
 * POST /api/webhooks/whatsapp-cloud
 *
 * Webhook da Meta WhatsApp Cloud API (WABA oficial).
 *
 * Distinto de /api/webhooks/whatsapp (Evolution API self-hosted).
 * Escolha de provedor configurável por tenant — ver OPEN_QUESTIONS.md.
 *
 * Segurança obrigatória (Fase 1):
 *   1) Verificar HMAC-SHA256 em `x-hub-signature-256` via createMetaCloudAdapter
 *   2) Rejeitar 401 sem assinatura válida
 *   3) Rate limit por phoneNumberId
 *   4) Idempotência via wamid (externalMessageId)
 *   5) Emitir inngest event `message/received` com tenantId + ctwaClid
 *   6) Audit log de toda mensagem processada
 *
 * GET: verificação de challenge (webhook registration no Meta).
 *
 * Rota pública — sem requireAuth (é o Meta quem chama).
 */

import { NextResponse } from "next/server";

export async function POST(_req: Request): Promise<NextResponse> {
  // TODO Fase 1: createMetaCloudAdapter + handleWebhook + inngest.send
  return NextResponse.json(
    { error: "Not implemented (Fase 1)" },
    { status: 501 },
  );
}

// Challenge do Meta para registrar o webhook
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

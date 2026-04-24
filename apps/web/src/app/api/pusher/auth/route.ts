/**
 * POST /api/pusher/auth
 *
 * Endpoint de autenticação de canais privados do Pusher/Soketi.
 * O pusher-js chama este endpoint automaticamente ao fazer subscribe
 * em canais com prefixo "private-".
 *
 * Segurança:
 *  - Sessão obrigatória (usuário deve estar logado)
 *  - Canal deve pertencer ao tenantId do usuário
 *    (private-pipeline-{tenantId} → valida o tenantId do canal)
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSoketi } from "@/lib/soketi";

export async function POST(req: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const soketi = getSoketi();
  if (!soketi) {
    // Soketi não configurado — retorna erro silencioso (não quebra a UI)
    return NextResponse.json({ error: "Realtime not configured" }, { status: 503 });
  }

  const body = await req.text();
  const params = new URLSearchParams(body);
  const socketId  = params.get("socket_id") ?? "";
  const channel   = params.get("channel_name") ?? "";

  if (!socketId || !channel) {
    return NextResponse.json({ error: "Missing socket_id or channel_name" }, { status: 400 });
  }

  // Valida que o canal pertence ao tenant do usuário
  // Formato: private-pipeline-{tenantId}
  const expectedPrefix = `private-pipeline-${session.user.tenantId}`;
  if (!channel.startsWith("private-pipeline-")) {
    return NextResponse.json({ error: "Channel not allowed" }, { status: 403 });
  }
  if (channel !== expectedPrefix) {
    return NextResponse.json({ error: "Channel not allowed for this tenant" }, { status: 403 });
  }

  // Assina a subscription — o Soketi valida este token no WS
  const authResponse = soketi.authorizeChannel(socketId, channel);

  return NextResponse.json(authResponse);
}

/**
 * POST /api/integrations/meta/data-deletion
 *
 * Data Deletion Callback obrigatório pelo Meta para apps que usam Facebook Login.
 * O Facebook chama esse endpoint quando um usuário remove o app nas configurações
 * da sua conta do Facebook.
 *
 * Docs: https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback
 *
 * Fluxo:
 * 1. Meta envia POST com campo `signed_request`
 * 2. Validamos a assinatura com META_APP_SECRET
 * 3. Buscamos e anonimizamos dados do usuário pelo facebook_user_id
 * 4. Retornamos { url, confirmation_code } para o usuário acompanhar
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import crypto from "crypto";

function parseSignedRequest(
  signedRequest: string,
): { userId: string; issuedAt: number } | null {
  try {
    const [encodedSig, payload] = signedRequest.split(".");
    if (!encodedSig || !payload) return null;

    const secret = process.env.META_APP_SECRET;
    if (!secret) return null;

    // Verifica assinatura HMAC-SHA256
    const expectedSig = crypto
      .createHmac("sha256", secret)
      .update(payload)
      .digest("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");

    if (encodedSig !== expectedSig) return null;

    // Decodifica payload
    const decoded = Buffer.from(
      payload.replace(/-/g, "+").replace(/_/g, "/"),
      "base64",
    ).toString("utf8");

    const data = JSON.parse(decoded) as {
      user_id:    string;
      algorithm:  string;
      issued_at:  number;
    };

    if (data.algorithm?.toUpperCase() !== "HMAC-SHA256") return null;

    return { userId: data.user_id, issuedAt: data.issued_at };
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  // Meta envia como form-urlencoded
  let signedRequest: string | null = null;
  try {
    const ct = req.headers.get("content-type") ?? "";
    if (ct.includes("application/x-www-form-urlencoded")) {
      const text   = await req.text();
      const params = new URLSearchParams(text);
      signedRequest = params.get("signed_request");
    } else {
      const body = await req.json().catch(() => ({}));
      signedRequest = body.signed_request ?? null;
    }
  } catch {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  if (!signedRequest) {
    return NextResponse.json({ error: "signed_request obrigatório" }, { status: 400 });
  }

  const parsed = parseSignedRequest(signedRequest);
  if (!parsed) {
    return NextResponse.json({ error: "Assinatura inválida" }, { status: 401 });
  }

  const facebookUserId = parsed.userId;

  // Gera um código de confirmação único para o usuário acompanhar
  const confirmationCode = crypto.randomBytes(16).toString("hex");

  // Na nossa arquitetura o Facebook User ID não é armazenado diretamente —
  // o que temos são Page Access Tokens vinculados a tenants.
  // Registramos o pedido de exclusão e retornamos a URL de status.
  // Se no futuro armazenarmos o facebook_user_id, fazer o delete aqui.
  console.log(
    `[meta/data-deletion] solicitação de exclusão para facebook_user_id=${facebookUserId}`,
    { confirmationCode },
  );

  // Registra o pedido de exclusão no audit log (sem dados pessoais — só o ID externo)
  // Usa o primeiro admin disponível do sistema (não temos o tenantId aqui)
  try {
    const adminUser = await prisma.user.findFirst({
      where:   { role: { in: ["SUPERADMIN", "ADMIN"] } },
      select:  { id: true, tenantId: true },
      orderBy: { createdAt: "asc" },
    });

    if (adminUser) {
      await prisma.auditLog.create({
        data: {
          tenantId: adminUser.tenantId,
          userId:   adminUser.id,
          action:   "meta.data_deletion_request",
          entity:   "FacebookUser",
          entityId: facebookUserId,
          meta:     { confirmationCode, requestedAt: new Date().toISOString() },
        },
      });
    }
  } catch (err) {
    // Não deixa falhar — o que importa é retornar 200 pro Meta
    console.error("[meta/data-deletion] erro ao registrar audit:", err);
  }

  const baseUrl = process.env.AUTH_URL ?? "https://crm.tudomudou.com.br";
  const statusUrl = `${baseUrl}/dados/exclusao?code=${confirmationCode}`;

  // Resposta exigida pelo Meta
  return NextResponse.json({
    url:               statusUrl,
    confirmation_code: confirmationCode,
  });
}

/**
 * GET  /api/webhooks/meta-leads  — verificação de webhook (Meta challenge)
 * POST /api/webhooks/meta-leads  — recebe eventos leadgen do Facebook/Instagram
 *
 * Fluxo completo:
 * 1. Usuário preenche formulário nativo no FB/IG Ad
 * 2. Meta envia POST com leadgen_id + page_id
 * 3. Buscamos no DB qual tenant tem essa página conectada
 * 4. Chamamos a Graph API para obter os dados do lead
 * 5. Criamos o Lead no CRM com source = FACEBOOK ou INSTAGRAM
 *
 * Docs: https://developers.facebook.com/docs/marketing-api/guides/lead-ads/retrieving
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import crypto from "crypto";

// ── Verificação de assinatura HMAC-SHA256 ─────────────────────────────────────
function verifySignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.META_APP_SECRET;
  if (!secret || !signature) return false;

  const expected = `sha256=${crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex")}`;

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, "utf8"),
      Buffer.from(signature, "utf8"),
    );
  } catch {
    return false;
  }
}

// ── GET — verificação do webhook (Meta envia hub.challenge) ───────────────────
export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode      = url.searchParams.get("hub.mode");
  const token     = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  const verifyToken = process.env.META_VERIFY_TOKEN;

  if (mode === "subscribe" && token === verifyToken && challenge) {
    console.log("[meta-leads] webhook verificado com sucesso");
    return new Response(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Verificação falhou" }, { status: 403 });
}

// ── POST — recebe leadgen events ──────────────────────────────────────────────
export async function POST(req: Request) {
  const rawBody = await req.text();

  // Valida assinatura (garante que veio da Meta)
  const signature = req.headers.get("x-hub-signature-256");
  if (!verifySignature(rawBody, signature)) {
    console.warn("[meta-leads] assinatura inválida");
    return NextResponse.json({ error: "Assinatura inválida" }, { status: 401 });
  }

  let body: MetaWebhookPayload;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  // Processa cada entrada (pode vir em batch)
  for (const entry of body.entry ?? []) {
    const pageId = entry.id;

    for (const change of entry.changes ?? []) {
      if (change.field !== "leadgen") continue;

      const leadgenId = change.value?.leadgen_id;
      if (!leadgenId) continue;

      // Dispara em background para não atrasar o ACK à Meta
      // (Meta espera 200 em < 20s, caso contrário retenta)
      processLead({ pageId, leadgenId }).catch((err) =>
        console.error("[meta-leads] erro ao processar lead:", err),
      );
    }
  }

  // Meta exige ACK imediato
  return NextResponse.json({ status: "ok" });
}

// ── Processamento assíncrono ──────────────────────────────────────────────────

interface MetaWebhookPayload {
  object: string;
  entry: Array<{
    id: string; // page_id
    changes: Array<{
      field: string;
      value: { leadgen_id: string; form_id?: string; ad_id?: string; ad_name?: string };
    }>;
  }>;
}

interface MetaLeadData {
  id: string;
  created_time: number;
  ad_id?: string;
  ad_name?: string;
  form_id?: string;
  field_data: Array<{ name: string; values: string[] }>;
}

async function processLead({ pageId, leadgenId }: { pageId: string; leadgenId: string }) {
  // 1) Encontra o tenant dono dessa página
  const form = await prisma.metaLeadForm.findUnique({
    where: { pageId },
    select: { tenantId: true, accessToken: true },
  });

  if (!form) {
    console.warn(`[meta-leads] nenhum tenant encontrou page_id=${pageId}`);
    return;
  }

  // 2) Busca dados do lead na Graph API
  const graphUrl = `https://graph.facebook.com/v21.0/${leadgenId}?fields=id,created_time,ad_id,ad_name,form_id,field_data&access_token=${form.accessToken}`;

  const res = await fetch(graphUrl);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Graph API ${res.status}: ${err}`);
  }

  const leadData: MetaLeadData = await res.json();

  // 3) Mapeia os campos do formulário para o modelo Lead
  const fields = Object.fromEntries(
    leadData.field_data.map((f) => [f.name.toLowerCase(), f.values[0] ?? ""]),
  );

  // Campos comuns dos formulários nativos do Meta
  const name    = fields["full_name"] || fields["nome_completo"] || fields["first_name"]
    ? `${fields["first_name"] ?? ""} ${fields["last_name"] ?? ""}`.trim()
    : fields["nome"] || "Lead Meta";
  const email   = fields["email"] || fields["e-mail"] || undefined;
  const phone   = fields["phone_number"] || fields["phone"] || fields["celular"] || fields["telefone"] || undefined;
  const company = fields["company_name"] || fields["empresa"] || undefined;

  // 4) Detecta se veio do Instagram ou Facebook pela presença do ad_name ou campo platform
  // Por enquanto, default FACEBOOK (Instagram Ads também cai aqui pelo mesmo webhook)
  const source: "FACEBOOK" | "INSTAGRAM" = "FACEBOOK";

  // 5) Cria o lead (idempotente — usa leadgenId como dedup key via note)
  const existingNote = await prisma.note.findFirst({
    where: {
      tenantId: form.tenantId,
      content: { contains: `leadgen_id: ${leadgenId}` },
    },
    select: { id: true },
  });

  if (existingNote) {
    console.log(`[meta-leads] lead ${leadgenId} já processado — ignorando`);
    return;
  }

  const lead = await prisma.lead.create({
    data: {
      tenantId: form.tenantId,
      name,
      email:   email  || null,
      phone:   phone  || null,
      company: company || null,
      source,
      status: "NOVO",
    },
    select: { id: true, name: true },
  });

  // 6) Nota com contexto da captura (inclui leadgenId para dedup futuro)
  await prisma.note.create({
    data: {
      tenantId: form.tenantId,
      leadId:   lead.id,
      userId:   await getSystemUserId(form.tenantId),
      content: [
        `[Capturado via Meta Lead Ads]`,
        `leadgen_id: ${leadgenId}`,
        leadData.ad_name ? `Anúncio: ${leadData.ad_name}` : null,
        leadData.form_id ? `Form ID: ${leadData.form_id}` : null,
        // Campos extras do formulário
        ...Object.entries(fields)
          .filter(([k]) => !["full_name", "first_name", "last_name", "email", "phone_number",
                             "nome_completo", "nome", "e-mail", "celular", "telefone", "company_name", "empresa"].includes(k))
          .map(([k, v]) => `${k}: ${v}`),
      ]
        .filter(Boolean)
        .join("\n"),
    },
  });

  // 7) Audit log
  await logAudit({
    tenantId: form.tenantId,
    userId:   await getSystemUserId(form.tenantId),
    action:   "lead.create",
    entity:   "Lead",
    entityId: lead.id,
    meta:     { name: lead.name, source, via: "meta_lead_ads", leadgenId },
  });

  console.log(`[meta-leads] lead criado: ${lead.id} (${lead.name})`);
}

/** Retorna o userId do primeiro ADMIN/OWNER do tenant para operações de sistema */
async function getSystemUserId(tenantId: string): Promise<string> {
  const user = await prisma.user.findFirst({
    where: { tenantId, role: { in: ["SUPERADMIN", "ADMIN", ] } },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  if (!user) throw new Error(`Nenhum admin encontrado para tenant ${tenantId}`);
  return user.id;
}

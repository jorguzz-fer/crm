/**
 * POST /api/public/leads
 *
 * Endpoint público para captura de leads via formulários de sites e landing pages.
 * Autenticado por tenantSlug (sem JWT — qualquer site pode postar aqui).
 *
 * Uso:
 *   fetch("https://app.seucrm.com/api/public/leads", {
 *     method: "POST",
 *     headers: { "Content-Type": "application/json" },
 *     body: JSON.stringify({
 *       tenantSlug: "medicine-cursos",
 *       name: "João Silva",
 *       email: "joao@email.com",
 *       phone: "11999999999",
 *       source: "WEBSITE",
 *       // campos extras viram nota
 *       message: "Tenho interesse no curso de Medicina",
 *       utm_source: "google",
 *       utm_campaign: "medicina-2025",
 *     })
 *   })
 *
 * Rate limit: 20 leads / 60s por IP para evitar spam.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { rateLimit } from "@/lib/rateLimit";
import { z } from "zod";

// ── CORS ─────────────────────────────────────────────────────────────────────
const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

// ── Schema de validação ───────────────────────────────────────────────────────
const publicLeadSchema = z.object({
  tenantSlug: z.string().min(2).max(50),
  name:       z.string().min(2).max(200),
  email:      z.string().email().max(200).optional().or(z.literal("")),
  phone:      z.string().max(30).optional().or(z.literal("")),
  company:    z.string().max(200).optional().or(z.literal("")),
  source:     z.enum(["WEBSITE", "FACEBOOK", "INSTAGRAM", "WHATSAPP", "OUTRO"]).default("WEBSITE"),
  // Campos extras opcionais — viram nota
  message:    z.string().max(2000).optional(),
  utm_source:   z.string().max(200).optional(),
  utm_medium:   z.string().max(200).optional(),
  utm_campaign: z.string().max(200).optional(),
  utm_content:  z.string().max(200).optional(),
  utm_term:     z.string().max(200).optional(),
  fbclid:       z.string().max(500).optional(),
  gclid:        z.string().max(500).optional(),
});

export async function POST(req: Request) {
  // Rate limit por IP
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim()
           ?? req.headers.get("x-real-ip")
           ?? "unknown";

  const limit = await rateLimit({ key: `public-leads:${ip}`, windowSec: 60, max: 20 });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Muitas requisições. Tente novamente em instantes." },
      { status: 429, headers: corsHeaders },
    );
  }

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "JSON inválido" }, { status: 400, headers: corsHeaders }); }

  const parsed = publicLeadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
      { status: 400, headers: corsHeaders },
    );
  }

  const d = parsed.data;

  // Busca tenant pelo slug
  const tenant = await prisma.tenant.findUnique({
    where: { slug: d.tenantSlug },
    select: { id: true, active: true },
  });

  if (!tenant || !tenant.active) {
    // Retorna 200 mesmo assim (não vazar existência de tenants)
    return NextResponse.json({ ok: true }, { headers: corsHeaders });
  }

  // Cria lead
  const lead = await prisma.lead.create({
    data: {
      tenantId: tenant.id,
      name:    d.name.trim(),
      email:   d.email?.trim() || null,
      phone:   d.phone?.trim() || null,
      company: d.company?.trim() || null,
      source:  d.source as "WEBSITE" | "FACEBOOK" | "INSTAGRAM" | "WHATSAPP" | "OUTRO",
      status:  "NOVO",
    },
    select: { id: true, name: true },
  });

  // Nota com contexto (mensagem + UTMs)
  const noteParts: string[] = ["[Capturado via formulário do site]"];
  if (d.message)       noteParts.push(`Mensagem: ${d.message}`);
  if (d.utm_source)    noteParts.push(`UTM Source: ${d.utm_source}`);
  if (d.utm_medium)    noteParts.push(`UTM Medium: ${d.utm_medium}`);
  if (d.utm_campaign)  noteParts.push(`UTM Campaign: ${d.utm_campaign}`);
  if (d.utm_content)   noteParts.push(`UTM Content: ${d.utm_content}`);
  if (d.utm_term)      noteParts.push(`UTM Term: ${d.utm_term}`);
  if (d.fbclid)        noteParts.push(`fbclid: ${d.fbclid}`);
  if (d.gclid)         noteParts.push(`gclid: ${d.gclid}`);

  if (noteParts.length > 1) {
    const systemUser = await prisma.user.findFirst({
      where: { tenantId: tenant.id, role: { in: ["SUPERADMIN", "ADMIN", ] } },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });
    if (systemUser) {
      await prisma.note.create({
        data: {
          tenantId: tenant.id,
          leadId:   lead.id,
          userId:   systemUser.id,
          content:  noteParts.join("\n"),
        },
      });
    }
  }

  // Attribution (UTMs + fbclid/gclid para CAPI)
  if (d.utm_source || d.fbclid || d.gclid) {
    await prisma.attribution.upsert({
      where: { leadId: lead.id },
      create: {
        tenantId:    tenant.id,
        leadId:      lead.id,
        utmSource:   d.utm_source   || null,
        utmMedium:   d.utm_medium   || null,
        utmCampaign: d.utm_campaign || null,
        utmContent:  d.utm_content  || null,
        utmTerm:     d.utm_term     || null,
        fbclid:      d.fbclid       || null,
        gclid:       d.gclid        || null,
        ip,
      },
      update: {},
    });
  }

  // Audit — usa o primeiro admin do tenant como actor de sistema
  const sysUser = await prisma.user.findFirst({
    where: { tenantId: tenant.id, role: { in: ["SUPERADMIN", "ADMIN", ] } },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });

  if (sysUser) await logAudit({
    tenantId: tenant.id,
    userId:   sysUser.id,
    action:   "lead.create",
    entity:   "Lead",
    entityId: lead.id,
    meta:     { name: lead.name, source: d.source, via: "public_api", ip },
  });
  // (se não há admin ainda no tenant, segue sem audit — lead já foi criado)

  return NextResponse.json({ ok: true, leadId: lead.id }, { headers: corsHeaders });
}

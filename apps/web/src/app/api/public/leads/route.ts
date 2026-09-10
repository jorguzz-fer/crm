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
 *
 * ── Deduplicação (opcional) ───────────────────────────────────────────────────
 *
 *   externalRef: "chatwoot:8:1042"   → o mesmo evento da origem reenviado não
 *                                      vira outro lead. Sempre ativa.
 *   dedupe:      "phone"             → a mesma pessoa em conversa nova
 *                                      reaproveita o lead. **Opt-in.**
 *
 * O opt-in é deliberado: formulário de site e Lead Ads mandam cada submissão
 * como um lead novo e devem continuar assim. Quem precisa de deduplicação é o
 * webhook de conversa de WhatsApp, onde a mesma pessoa reabre conversa toda
 * semana — e onde, sem isto, cada conversa virava um lead (era o problema
 * registrado como pendência no workflow da Alumine).
 *
 * Em ambos os casos o lead reaproveitado **ganha a nota do novo contato** e
 * **não abre outra oportunidade** no funil.
 *
 * Para ferramenta HTTP de agente de IA use `/api/public/agent/:slug/lead` —
 * lá o corpo não pode carregar constante, então nem `tenantSlug` entra nele.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { rateLimit } from "@/lib/rateLimit";
import { verifyPublicApiToken } from "@/lib/publicApiToken";
import { phoneVariants } from "@/lib/agentLead";
import { z } from "zod";

// ── CORS ─────────────────────────────────────────────────────────────────────
const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Token",
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
  source:     z.enum(["WEBSITE", "FACEBOOK", "INSTAGRAM", "WHATSAPP", "LINKEDIN", "OUTRO"]).default("WEBSITE"),
  // Token opcional — quando presente, autentica server-to-server (n8n/Make/Zapier)
  // e libera fontes não-WEBSITE
  token: z.string().length(32).optional(),
  // Campo livre para anúncio/origem específica
  ad_name:  z.string().max(300).optional(),
  form_id:  z.string().max(100).optional(),
  // Referência do registro na origem ("<sistema>:<id>", ex. "chatwoot:8:1042").
  // Torna o intake idempotente: o mesmo evento reenviado não vira outro lead.
  externalRef: z.string().max(120).optional(),
  // Deduplicação por telefone. **Opt-in**: os integradores que já existem
  // (Manychat, Lead Ads, formulário do site) mandam cada submissão como um
  // lead novo e continuam funcionando exatamente assim. Só quem pede
  // `dedupe: "phone"` — o webhook de conversa de WhatsApp, onde a mesma
  // pessoa reabre conversa toda semana — passa a reaproveitar o lead.
  dedupe: z.enum(["none", "phone"]).default("none"),
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

  // Token também pode vir no header (n8n geralmente usa header)
  const headerToken = req.headers.get("x-api-token") ?? req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const token       = d.token ?? headerToken ?? null;

  // Busca tenant pelo slug
  const tenant = await prisma.tenant.findUnique({
    where: { slug: d.tenantSlug },
    select: { id: true, active: true },
  });

  if (!tenant || !tenant.active) {
    // Retorna 200 mesmo assim (não vazar existência de tenants)
    return NextResponse.json({ ok: true }, { headers: corsHeaders });
  }

  // Fontes não-WEBSITE exigem token válido (integrações server-to-server)
  const isServerSource = d.source !== "WEBSITE";
  if (isServerSource) {
    if (!token || !verifyPublicApiToken(tenant.id, token)) {
      return NextResponse.json(
        { error: "Token inválido ou ausente para source diferente de WEBSITE" },
        { status: 401, headers: corsHeaders },
      );
    }
  }

  // ── Deduplicação ────────────────────────────────────────────────────────────
  //
  // Duas pistas, ambas exatas e ambas dentro do tenant:
  //
  //   1. `externalRef` — o mesmo evento da origem reenviado (retry do provider,
  //      reexecução do workflow). Sempre ativa quando o campo vem.
  //   2. telefone — a mesma pessoa numa conversa nova. Só com `dedupe: "phone"`.
  //
  // Não há casamento por nome: dois homônimos viram um lead só, com o histórico
  // de duas pessoas misturado. Duplicata se resolve; isso não.
  const phoneDigits = d.phone?.replace(/\D/g, "") ?? "";

  let existente = d.externalRef
    ? await prisma.lead.findFirst({
        where: { tenantId: tenant.id, externalRef: d.externalRef, anonymizedAt: null },
        select: { id: true, name: true },
      })
    : null;

  if (!existente && d.dedupe === "phone" && phoneDigits) {
    existente = await prisma.lead.findFirst({
      where: {
        tenantId: tenant.id,
        phone: { in: phoneVariants(phoneDigits) },
        anonymizedAt: null,
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true },
    });
  }

  // Lead existente ganha a nota de contexto do novo contato (mais abaixo), mas
  // não vira outro registro nem outra oportunidade no funil.
  const lead =
    existente ??
    (await prisma.lead.create({
      data: {
        tenantId: tenant.id,
        name:    d.name.trim(),
        email:   d.email?.trim() || null,
        phone:   d.phone?.trim() || null,
        company: d.company?.trim() || null,
        source:  d.source as "WEBSITE" | "FACEBOOK" | "INSTAGRAM" | "WHATSAPP" | "OUTRO",
        status:  "NOVO",
        externalRef: d.externalRef ?? null,
      },
      select: { id: true, name: true },
    }));

  const duplicado = Boolean(existente);

  // Auto-converter lead → oportunidade no pipeline padrão.
  // Lead reaproveitado não abre outra oportunidade: o funil ficaria com o mesmo
  // negócio em duplicidade a cada conversa nova da mesma pessoa.
  if (!duplicado) {
    try {
      const defaultPipeline = await prisma.pipeline.findFirst({
        where: { tenantId: tenant.id, isDefault: true },
        select: { id: true, stages: { orderBy: { order: "asc" }, take: 1, select: { id: true } } },
      });
      if (defaultPipeline && defaultPipeline.stages.length > 0) {
        const firstStage = defaultPipeline.stages[0];
        await prisma.opportunity.create({
          data: {
            tenantId: tenant.id,
            pipelineId: defaultPipeline.id,
            stageId: firstStage.id,
            leadId: lead.id,
            title: lead.name,
          },
        });
      }
    } catch {
      // Conversão é best-effort — o lead já foi criado
      console.error("Falha ao criar oportunidade automática para lead", lead.id);
    }
  }

  // Nota com contexto (mensagem + UTMs + dados de campanha)
  const sourceLabel = {
    WEBSITE:   "formulário do site",
    FACEBOOK:  "Facebook Lead Ads (via integração)",
    INSTAGRAM: "Instagram Lead Ads (via integração)",
    WHATSAPP:  "WhatsApp (via integração)",
    LINKEDIN:  "LinkedIn (via integração)",
    OUTRO:     "integração externa",
  }[d.source] ?? "integração externa";

  // Em lead reaproveitado o cabeçalho muda: não houve captura, houve um novo
  // contato de alguém que já estava na base. Quem lê a nota precisa ver isso.
  const noteParts: string[] = [
    duplicado
      ? `[Novo contato via ${sourceLabel}]`
      : `[Capturado via ${sourceLabel}]`,
  ];
  if (d.ad_name)       noteParts.push(`Anúncio: ${d.ad_name}`);
  if (d.form_id)       noteParts.push(`Form ID: ${d.form_id}`);
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
    action:   duplicado ? "lead.update" : "lead.create",
    entity:   "Lead",
    entityId: lead.id,
    meta:     { name: lead.name, source: d.source, via: "public_api", duplicado, ip },
  });
  // (se não há admin ainda no tenant, segue sem audit — lead já foi criado)

  // `duplicado` aparece na execução do n8n — é como se enxerga, em produção,
  // que a deduplicação está funcionando em vez de silenciosamente não fazer nada.
  return NextResponse.json({ ok: true, leadId: lead.id, duplicado }, { headers: corsHeaders });
}

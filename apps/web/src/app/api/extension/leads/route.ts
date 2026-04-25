/**
 * GET  /api/extension/leads?limit=5   — últimos leads do tenant
 * POST /api/extension/leads            — criar lead via extensão Chrome
 */

import { NextResponse } from "next/server";
import { requireExtensionAuth } from "@/lib/extensionAuth";
import { prisma } from "@crm/db";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

const createLeadSchema = z.object({
  name:        z.string().min(2).max(200),
  email:       z.string().email().max(200).optional().or(z.literal("")),
  phone:       z.string().max(30).optional(),
  company:     z.string().max(200).optional(),
  position:    z.string().max(200).optional(),
  source:      z.enum(["COLD_OUTREACH", "WEBSITE", "INDICACAO", "WHATSAPP", "OUTRO"]).default("OUTRO"),
  notes:       z.string().max(2000).optional(),
  linkedinUrl: z.string().url().optional().or(z.literal("")),
});

export async function GET(req: Request) {
  const { session, error } = await requireExtensionAuth(req);
  if (error) return error;

  const url   = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "5"), 20);

  const leads = await prisma.lead.findMany({
    where:   { tenantId: session.tenantId },
    select:  { id: true, name: true, email: true, phone: true, company: true, source: true, status: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take:    limit,
  });

  return NextResponse.json(leads);
}

export async function POST(req: Request) {
  const { session, error } = await requireExtensionAuth(req);
  if (error) return error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = createLeadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }

  const d = parsed.data;

  // Monta notes incluindo cargo e URL do LinkedIn, se fornecidos
  const noteParts: string[] = [];
  if (d.position) noteParts.push(`Cargo: ${d.position}`);
  if (d.linkedinUrl) noteParts.push(`LinkedIn: ${d.linkedinUrl}`);
  if (d.notes) noteParts.push(d.notes);

  const lead = await prisma.lead.create({
    data: {
      tenantId: session.tenantId,
      name:     d.name.trim(),
      email:    d.email?.trim() || null,
      phone:    d.phone?.trim() || null,
      company:  d.company?.trim() || null,
      source:   d.source as "COLD_OUTREACH" | "WEBSITE" | "INDICACAO" | "WHATSAPP" | "OUTRO",
      status:   "NOVO",
      assignedTo: session.userId,  // auto-assign para quem capturou
    },
    select: { id: true, name: true, email: true, phone: true, company: true, source: true, status: true, createdAt: true },
  });

  // Cria nota inicial com contexto da captura
  if (noteParts.length > 0) {
    await prisma.note.create({
      data: {
        tenantId: session.tenantId,
        leadId:   lead.id,
        userId:   session.userId,
        content:  `[Capturado via extensão Chrome]\n${noteParts.join("\n")}`,
      },
    });
  }

  await logAudit({
    tenantId: session.tenantId,
    userId:   session.userId,
    action:   "lead.create",
    entity:   "Lead",
    entityId: lead.id,
    meta:     { name: lead.name, source: lead.source, via: "chrome_extension" },
  });

  return NextResponse.json(lead, { status: 201 });
}

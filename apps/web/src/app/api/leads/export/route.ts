import { prisma } from "@crm/db";
import { NextResponse } from "next/server";
import { requireRole, ROLES_MANAGE } from "@/lib/authz";
import { logAudit } from "@/lib/audit";

function csvEsc(v: string | null | undefined): string {
  const s = String(v ?? "");
  return s.includes(",") || s.includes('"') || s.includes("\n")
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

function csvRow(cols: (string | null | undefined)[]): string {
  return cols.map(csvEsc).join(",");
}

const STATUS_LABEL: Record<string, string> = {
  NOVO: "Novo", EM_CONTATO: "Em contato", QUALIFICADO: "Qualificado",
  DESQUALIFICADO: "Desqualificado", CONVERTIDO: "Convertido",
};
const SOURCE_LABEL: Record<string, string> = {
  WEBSITE: "Website", WHATSAPP: "WhatsApp", INSTAGRAM: "Instagram",
  FACEBOOK: "Facebook", INDICACAO: "Indicação", EVENTO: "Evento",
  COLD_OUTREACH: "Prospecção", OUTRO: "Outro",
};

const VALID_LEAD_STATUSES = new Set(["NOVO", "EM_CONTATO", "QUALIFICADO", "DESQUALIFICADO", "CONVERTIDO"]);

export async function GET(req: Request) {
  const { session, error } = await requireRole(ROLES_MANAGE);
  if (error) return error;

  const tenantId = session.user.tenantId;
  const url = new URL(req.url);

  // Suporta os mesmos filtros da listagem
  const q      = url.searchParams.get("q")?.trim() || "";
  const status = url.searchParams.get("status") || "";

  const where = {
    tenantId,
    ...(status && VALID_LEAD_STATUSES.has(status) && { status: status as never }),
    ...(q && {
      OR: [
        { name:    { contains: q, mode: "insensitive" as const } },
        { email:   { contains: q, mode: "insensitive" as const } },
        { company: { contains: q, mode: "insensitive" as const } },
        { phone:   { contains: q, mode: "insensitive" as const } },
      ],
    }),
  };

  const leads = await prisma.lead.findMany({
    where,
    include: { assignee: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 10_000,   // limite de segurança
  });

  const header = csvRow([
    "id", "nome", "email", "telefone", "empresa",
    "origem", "status", "responsável", "criado_em", "atualizado_em",
  ]);

  const rows = leads.map((l) =>
    csvRow([
      l.id,
      l.name,
      l.email,
      l.phone,
      l.company,
      SOURCE_LABEL[l.source] ?? l.source,
      STATUS_LABEL[l.status]  ?? l.status,
      l.assignee?.name ?? "",
      l.createdAt.toLocaleDateString("pt-BR"),
      l.updatedAt.toLocaleDateString("pt-BR"),
    ])
  );

  const csv = [header, ...rows].join("\r\n");
  const date = new Date().toISOString().slice(0, 10);

  await logAudit({
    tenantId,
    userId: session.user.id,
    action: "lead.export",
    entity: "Lead",
    meta: { count: leads.length, filters: { q, status } },
  });

  return new Response("\uFEFF" + csv, {   // BOM para Excel reconhecer UTF-8
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="leads-${date}.csv"`,
    },
  });
}

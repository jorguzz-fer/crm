import { auth } from "@/lib/auth";
import { prisma } from "@crm/db";
import { NextResponse } from "next/server";
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

const fmtBRL = new Intl.NumberFormat("pt-BR", {
  style: "currency", currency: "BRL",
});

const STATUS_LABEL: Record<string, string> = {
  ABERTA: "Aberta", GANHA: "Ganha", PERDIDA: "Perdida",
};

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenantId = session.user.tenantId;
  const url = new URL(req.url);

  const status   = url.searchParams.get("status") || "";
  const stageId  = url.searchParams.get("stageId") || "";
  const from     = url.searchParams.get("from") || "";
  const to       = url.searchParams.get("to") || "";

  const where = {
    tenantId,
    ...(status  && { status:  status  as never }),
    ...(stageId && { stageId }),
    ...(from && to && {
      createdAt: {
        gte: new Date(from),
        lte: new Date(to + "T23:59:59.999Z"),
      },
    }),
  };

  const opps = await prisma.opportunity.findMany({
    where,
    include: {
      stage:    { select: { name: true, pipeline: { select: { name: true } } } },
      lead:     { select: { name: true } },
      assignee: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 10_000,
  });

  const header = csvRow([
    "id", "título", "pipeline", "estágio", "status", "valor",
    "probabilidade", "lead", "responsável",
    "previsão_fechamento", "fechado_em", "criado_em",
  ]);

  const rows = opps.map((o) =>
    csvRow([
      o.id,
      o.title,
      o.stage.pipeline.name,
      o.stage.name,
      STATUS_LABEL[o.status] ?? o.status,
      o.value != null ? fmtBRL.format(Number(o.value)) : "",
      o.probability != null ? String(o.probability) + "%" : "",
      o.lead?.name ?? "",
      o.assignee?.name ?? "",
      o.expectedCloseAt ? o.expectedCloseAt.toLocaleDateString("pt-BR") : "",
      o.closedAt        ? o.closedAt.toLocaleDateString("pt-BR")        : "",
      o.createdAt.toLocaleDateString("pt-BR"),
    ])
  );

  const csv  = [header, ...rows].join("\r\n");
  const date = new Date().toISOString().slice(0, 10);

  await logAudit({
    tenantId,
    userId: session.user.id,
    action: "opportunity.export",
    entity: "Opportunity",
    meta: { count: opps.length, filters: { status, stageId, from, to } },
  });

  return new Response("\uFEFF" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="oportunidades-${date}.csv"`,
    },
  });
}

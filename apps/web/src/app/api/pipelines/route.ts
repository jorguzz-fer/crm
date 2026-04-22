import { prisma } from "@crm/db";
import { NextResponse } from "next/server";
import { requireRole, ROLES_MANAGE } from "@/lib/authz";
import { logAudit, getClientIp } from "@/lib/audit";
import { z } from "zod";

const DEFAULT_STAGES = [
  { name: "Prospecção",   order: 0, color: "#8b5cf6" },
  { name: "Qualificação", order: 1, color: "#3b82f6" },
  { name: "Proposta",     order: 2, color: "#f59e0b" },
  { name: "Negociação",   order: 3, color: "#f97316" },
  { name: "Fechamento",   order: 4, color: "#10b981" },
];

const createPipelineSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  stages: z
    .array(
      z.object({
        name: z.string().min(1).max(80).trim(),
        color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#6366f1"),
      })
    )
    .min(1)
    .max(20)
    .optional(),
});

export async function GET(req: Request) {
  const { session, error } = await requireRole(["SUPERADMIN", "ADMIN", "SUPERVISOR", "ANALYST", "VIEWER"]);
  if (error) return error;

  const pipelines = await prisma.pipeline.findMany({
    where: { tenantId: session.user.tenantId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    include: { stages: { orderBy: { order: "asc" } } },
  });

  return NextResponse.json(pipelines);
}

export async function POST(req: Request) {
  const { session, error } = await requireRole(ROLES_MANAGE);
  if (error) return error;

  const body = await req.json();
  const parsed = createPipelineSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const tenantId = session.user.tenantId;
  const { name, stages } = parsed.data;

  // Checar se já existe pipeline padrão
  const existing = await prisma.pipeline.findFirst({
    where: { tenantId },
    select: { id: true },
  });
  const isDefault = !existing; // Primeiro pipeline é sempre o padrão

  const stageList = (stages ?? DEFAULT_STAGES).map((s, i) => ({
    name: s.name,
    order: i,
    color: (s as { name: string; color?: string }).color ?? "#6366f1",
    tenantId,
  }));

  const pipeline = await prisma.pipeline.create({
    data: {
      tenantId,
      name,
      isDefault,
      stages: { create: stageList },
    },
    include: { stages: { orderBy: { order: "asc" } } },
  });

  await logAudit({
    tenantId,
    userId: session.user.id,
    action: "pipeline.create",
    entity: "Pipeline",
    entityId: pipeline.id,
    meta: { name, stagesCount: stageList.length, isDefault },
    ip: getClientIp(req),
  });

  return NextResponse.json(pipeline, { status: 201 });
}

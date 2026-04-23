"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@crm/db";
import { requireRole, ROLES_WRITE, ROLES_MANAGE } from "@/lib/authz";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

export type ActionState = { error: string } | { success: true; id: string } | null;

const createVisitSchema = z.object({
  subject:       z.string().min(2).max(300),
  notes:         z.string().max(5000).optional().or(z.literal("")),
  outcome:       z.string().max(500).optional().or(z.literal("")),
  visitedAt:     z.string().datetime().optional().or(z.literal("")),
  lat:           z.coerce.number().min(-90).max(90).optional(),
  lng:           z.coerce.number().min(-180).max(180).optional(),
  address:       z.string().max(500).optional().or(z.literal("")),
  leadId:        z.string().cuid().optional().or(z.literal("")),
  companyId:     z.string().cuid().optional().or(z.literal("")),
  opportunityId: z.string().cuid().optional().or(z.literal("")),
});

export async function createVisitAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { session, error } = await requireRole(ROLES_WRITE);
  if (error) return { error: "Sem permissão" };

  const tenantId = session!.user.tenantId;
  const userId   = session!.user.id;

  // Converter datetime-local para ISO string
  const rawDate = (formData.get("visitedAt") as string) || "";
  const visitedAt = rawDate ? new Date(rawDate).toISOString() : "";

  const raw = {
    subject:       formData.get("subject"),
    notes:         formData.get("notes")         || undefined,
    outcome:       formData.get("outcome")        || undefined,
    visitedAt:     visitedAt                      || undefined,
    lat:           formData.get("lat")            || undefined,
    lng:           formData.get("lng")            || undefined,
    address:       formData.get("address")        || undefined,
    leadId:        formData.get("leadId")         || undefined,
    companyId:     formData.get("companyId")      || undefined,
    opportunityId: formData.get("opportunityId")  || undefined,
  };

  const parsed = createVisitSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const data = parsed.data;

  // Validações cross-tenant de FKs
  if (data.leadId) {
    const lead = await prisma.lead.findFirst({ where: { id: data.leadId, tenantId }, select: { id: true } });
    if (!lead) return { error: "Lead inválido" };
  }
  if (data.companyId) {
    const company = await prisma.company.findFirst({ where: { id: data.companyId, tenantId }, select: { id: true } });
    if (!company) return { error: "Empresa inválida" };
  }
  if (data.opportunityId) {
    const opp = await prisma.opportunity.findFirst({ where: { id: data.opportunityId, tenantId }, select: { id: true } });
    if (!opp) return { error: "Oportunidade inválida" };
  }

  const visit = await prisma.visit.create({
    data: {
      tenantId,
      userId,
      subject:       data.subject,
      notes:         data.notes         || null,
      outcome:       data.outcome       || null,
      visitedAt:     data.visitedAt ? new Date(data.visitedAt) : new Date(),
      lat:           data.lat           ?? null,
      lng:           data.lng           ?? null,
      address:       data.address       || null,
      leadId:        data.leadId        || null,
      companyId:     data.companyId     || null,
      opportunityId: data.opportunityId || null,
    },
  });

  await logAudit({
    tenantId,
    userId,
    action: "visit.create",
    entity: "Visit",
    entityId: visit.id,
    meta: { subject: visit.subject, leadId: visit.leadId, companyId: visit.companyId },
  });

  revalidatePath("/visitas");
  return { success: true, id: visit.id };
}

export async function deleteVisitAction(formData: FormData): Promise<void> {
  const { session, error } = await requireRole(ROLES_MANAGE);
  if (error) return;

  const id = formData.get("id") as string;
  const tenantId = session!.user.tenantId;

  const visit = await prisma.visit.findFirst({ where: { id, tenantId }, select: { id: true, subject: true } });
  if (!visit) return;

  await prisma.visit.delete({ where: { id } });

  await logAudit({
    tenantId,
    userId: session!.user.id,
    action: "visit.delete",
    entity: "Visit",
    entityId: id,
    meta: { subject: visit.subject },
  });

  revalidatePath("/visitas");
}

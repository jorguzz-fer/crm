import { prisma } from "@crm/db";
import { inngest } from "../client";

interface AssignInput {
  tenantId: string;
  leadId: string;
}

type AssignResult =
  | { skipped: true }
  | { skipped: false; assignedTo: string };

type ReAssignResult =
  | { skipped: true }
  | { skipped: false; reassigned: boolean; assignedTo: string };

const SELLER_ROLES = ["ANALYST", "SUPERVISOR"] as const;

export async function handleAutoAssign(data: AssignInput): Promise<AssignResult> {
  const { tenantId, leadId } = data;

  const members = await prisma.membership.findMany({
    where: { tenantId, acceptingLeads: true, role: { in: [...SELLER_ROLES] } },
    select: { userId: true, maxLeads: true, user: { select: { id: true, name: true, active: true } } },
  });

  const active = members.filter((m) => m.user.active);
  if (active.length === 0) return { skipped: true };

  // Count open leads per member
  const counts = await Promise.all(
    active.map((m) =>
      prisma.lead.count({
        where: { tenantId, assignedTo: m.userId, status: { notIn: ["CONVERTIDO", "DESQUALIFICADO"] } },
      }).then((count) => ({ userId: m.userId, count, maxLeads: m.maxLeads }))
    )
  );

  // Filter out those at capacity
  const available = counts.filter((c) => c.maxLeads == null || c.count < c.maxLeads);
  if (available.length === 0) return { skipped: true };

  // Pick least-loaded
  available.sort((a, b) => a.count - b.count);
  const winner = available[0].userId;

  await prisma.lead.update({
    where: { id: leadId },
    data: { assignedTo: winner },
  });

  await inngest.send({
    name: "lead/assigned",
    data: { tenantId, leadId, assignedTo: winner, strategy: "least-loaded" },
  });

  return { skipped: false, assignedTo: winner };
}

export async function handleReAssignHot(data: AssignInput): Promise<ReAssignResult> {
  const { tenantId, leadId } = data;

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { scoreLabel: true, assignedTo: true },
  });

  if (lead?.scoreLabel !== "hot") return { skipped: true };

  const members = await prisma.membership.findMany({
    where: { tenantId, acceptingLeads: true, role: { in: [...SELLER_ROLES] } },
    select: { userId: true, user: { select: { id: true, active: true } } },
  });

  const active = members.filter((m) => m.user.active);
  if (active.length === 0) return { skipped: true };

  // Score each seller by conversion rate
  const rates = await Promise.all(
    active.map(async (m) => {
      const [total, converted] = await Promise.all([
        prisma.lead.count({ where: { tenantId, assignedTo: m.userId } }),
        prisma.lead.count({ where: { tenantId, assignedTo: m.userId, status: "CONVERTIDO" } }),
      ]);
      const rate = total > 0 ? converted / total : 0;
      return { userId: m.userId, rate };
    })
  );

  rates.sort((a, b) => b.rate - a.rate);
  const best = rates[0].userId;

  if (best === lead.assignedTo) return { skipped: true };

  await prisma.lead.update({
    where: { id: leadId },
    data: { assignedTo: best },
  });

  await inngest.send({
    name: "lead/assigned",
    data: { tenantId, leadId, assignedTo: best, strategy: "hot-conversion-rate" },
  });

  return { skipped: false, reassigned: true, assignedTo: best };
}

export const autoAssignLeadFn = inngest.createFunction(
  { id: "auto-assign-lead", idempotency: "event.data.leadId" },
  { event: "lead/created" },
  async ({ event, step }) =>
    step.run("assign", () => handleAutoAssign(event.data as AssignInput)),
);

export const reAssignHotLeadFn = inngest.createFunction(
  { id: "reassign-hot-lead" },
  { event: "lead/classified" },
  async ({ event, step }) =>
    step.run("reassign-hot", () => handleReAssignHot(event.data as AssignInput)),
);

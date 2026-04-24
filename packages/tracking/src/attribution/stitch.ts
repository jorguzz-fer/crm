import { prisma } from "@crm/db";
import type { NormalizedPayment } from "../webhooks/index";

export interface StitchResult {
  matched: boolean;
  leadId?: string;
  skipped?: boolean;
  attribution?: {
    fbclid?: string | null;
    fbp?: string | null;
    fbc?: string | null;
    ctwaClid?: string | null;
  };
}

export async function stitchPaymentToLead(
  tenantId: string,
  payment: NormalizedPayment,
): Promise<StitchResult> {
  if (payment.status !== "approved") {
    return { matched: false, skipped: true };
  }

  const lead = await prisma.lead.findFirst({
    where: { tenantId, email: payment.buyerEmail },
    select: { id: true },
  });

  if (!lead) return { matched: false };

  const attribution = await prisma.attribution.findUnique({
    where: { leadId: lead.id },
    select: { fbclid: true, fbp: true, fbc: true, ctwaClid: true },
  });

  await prisma.conversionEvent.create({
    data: {
      tenantId,
      leadId: lead.id,
      platform: payment.gateway,
      eventType: "purchase",
      externalEventId: payment.externalId,
      status: "success",
      value: payment.amount,
      currency: payment.currency,
      sentAt: new Date(),
    },
  });

  return {
    matched: true,
    leadId: lead.id,
    attribution: attribution ?? undefined,
  };
}

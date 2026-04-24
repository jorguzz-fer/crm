import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseHotmart, verifyHotmartSignature } from "@crm/tracking/webhooks";
import { stitchPaymentToLead } from "@crm/tracking/attribution";
import { logAudit, getClientIp } from "@/lib/audit";

export async function POST(req: Request): Promise<NextResponse> {
  const rawBody = await req.text();
  const headers = req.headers;

  // Identify tenant via query param (each tenant registers their own webhook URL)
  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get("tenant");
  if (!tenantId) {
    return NextResponse.json({ error: "Missing tenant" }, { status: 400 });
  }

  const config = await prisma.tenantTrackingConfig.findUnique({
    where: { tenantId },
    select: { hotmartHottok: true, metaPixelId: true, metaAccessToken: true },
  });

  if (!config?.hotmartHottok) {
    return NextResponse.json({ error: "Tenant not configured" }, { status: 400 });
  }

  const verify = verifyHotmartSignature(headers, config.hotmartHottok);
  if (!verify.valid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Malformed JSON" }, { status: 400 });
  }

  const payment = parseHotmart(payload);
  if (!payment) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const result = await stitchPaymentToLead(tenantId, payment);

  if (result.matched && result.leadId) {
    await logAudit({
      tenantId,
      userId: "system",
      action: "payment.received",
      entity: "ConversionEvent",
      meta: {
        gateway: payment.gateway,
        externalId: payment.externalId,
        status: payment.status,
        amount: payment.amount,
        leadId: result.leadId,
      },
      ip: getClientIp(req),
    });
  }

  return NextResponse.json({ ok: true, matched: result.matched });
}

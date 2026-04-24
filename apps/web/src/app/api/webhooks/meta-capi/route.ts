import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendMetaCapiEvent } from "@crm/tracking/server";
import { requireAuth } from "@/lib/authz";
import { logAudit, getClientIp } from "@/lib/audit";
import { z } from "zod";

const payloadSchema = z.object({
  tenantId: z.string().min(1),
  leadId: z.string().min(1),
  eventType: z.enum(["lead", "purchase", "contact"]),
  externalEventId: z.string().min(1),
  userData: z.object({
    email: z.string().email(),
    phone: z.string().optional(),
    firstName: z.string().optional(),
  }),
  attribution: z.object({
    fbclid: z.string().nullable().optional(),
    fbp: z.string().nullable().optional(),
    fbc: z.string().nullable().optional(),
    ctwaClid: z.string().nullable().optional(),
  }),
  value: z.number().positive().optional(),
  currency: z.string().optional(),
});

export async function POST(req: Request): Promise<NextResponse> {
  const { session, error } = await requireAuth();
  if (error) return error;

  const body = await req.json();
  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
  }

  const { tenantId } = parsed.data;
  if (tenantId !== session.user.tenantId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const config = await prisma.tenantTrackingConfig.findUnique({
    where: { tenantId },
    select: { metaPixelId: true, metaAccessToken: true },
  });

  if (!config?.metaPixelId || !config?.metaAccessToken) {
    return NextResponse.json({ error: "Meta CAPI not configured for tenant" }, { status: 400 });
  }

  const result = await sendMetaCapiEvent(parsed.data, {
    pixelId: config.metaPixelId,
    accessToken: config.metaAccessToken,
  });

  await logAudit({
    tenantId,
    userId: session.user.id,
    action: "meta_capi.send",
    entity: "ConversionEvent",
    meta: { eventType: parsed.data.eventType, externalEventId: parsed.data.externalEventId, result },
    ip: getClientIp(req),
  });

  return NextResponse.json(result, { status: result.status === "success" ? 200 : 502 });
}

// Meta webhook verification (GET with hub.challenge)
export async function GET(req: Request): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (
    mode === "subscribe" &&
    token === process.env.META_WEBHOOK_VERIFY_TOKEN &&
    challenge
  ) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

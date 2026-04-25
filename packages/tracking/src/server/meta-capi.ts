import { createHash } from "crypto";
import { prisma } from "@crm/db";

export interface MetaCapiPayload {
  tenantId: string;
  leadId: string;
  eventType: "lead" | "purchase" | "contact";
  externalEventId: string;
  userData: {
    email: string;
    phone?: string;
    firstName?: string;
  };
  attribution: {
    fbclid?: string | null;
    fbp?: string | null;
    fbc?: string | null;
    ctwaClid?: string | null;
  };
  value?: number;
  currency?: string;
}

export interface MetaTenantConfig {
  pixelId: string;
  accessToken: string;
}

export interface MetaCapiResult {
  status: "success" | "failed";
  eventsReceived?: number;
  errorMessage?: string;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

const GRAPH_API_VERSION = "v21.0";
const MAX_RETRIES = 3;

export async function sendMetaCapiEvent(
  payload: MetaCapiPayload,
  config: MetaTenantConfig,
): Promise<MetaCapiResult> {
  const { tenantId, leadId, eventType, externalEventId, userData, attribution, value, currency } = payload;
  const { pixelId, accessToken } = config;

  const record = await prisma.conversionEvent.create({
    data: {
      tenantId,
      leadId,
      platform: "meta",
      eventType,
      externalEventId,
      status: "pending",
      value: value ?? null,
      currency: currency ?? "BRL",
    },
  });

  const userData_: Record<string, string> = {
    em: sha256(userData.email.toLowerCase().trim()),
  };
  if (userData.phone) {
    userData_.ph = sha256(normalizePhone(userData.phone));
  }
  if (userData.firstName) {
    userData_.fn = sha256(userData.firstName.toLowerCase().trim());
  }
  if (attribution.fbp) userData_.fbp = attribution.fbp;
  if (attribution.fbc) userData_.fbc = attribution.fbc;
  if (attribution.ctwaClid) userData_.ctwa_clid = attribution.ctwaClid;

  const eventData: Record<string, unknown> = {
    event_name: eventType === "lead" ? "Lead" : eventType === "purchase" ? "Purchase" : "Contact",
    event_time: Math.floor(Date.now() / 1000),
    event_id: externalEventId,
    user_data: userData_,
  };

  if (attribution.fbclid) {
    (eventData as Record<string, unknown>).action_source = "website";
  } else {
    eventData.action_source = "other";
  }

  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${pixelId}/events?access_token=${accessToken}`;
  const body = JSON.stringify({ data: [eventData] });

  let lastError: string | undefined;
  let attempt = 0;

  while (attempt < MAX_RETRIES) {
    attempt++;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });

    if (res.ok) {
      const json = (await res.json()) as { events_received?: number };
      await prisma.conversionEvent.update({
        where: { id: record.id },
        data: { status: "success", sentAt: new Date() },
      });
      return { status: "success", eventsReceived: json.events_received };
    }

    const isRetryable = res.status === 429 || res.status >= 500;
    const json = (await res.json()) as { error?: { message?: string } };
    lastError = json.error?.message ?? `HTTP ${res.status}`;

    if (!isRetryable) break;
  }

  await prisma.conversionEvent.update({
    where: { id: record.id },
    data: { status: "failed", errorMessage: lastError },
  });

  return { status: "failed", errorMessage: lastError };
}

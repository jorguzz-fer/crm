import { prisma } from "@crm/db";
import { generateFirstContact } from "@crm/ai";
import { createEvolutionAdapter } from "@crm/whatsapp";
import { inngest } from "../client";
import type { EventData } from "../events";

const DEFAULT_PRODUCT = {
  name: "Pós-graduação médica",
  priceBrl: 9997,
  highlights: [
    "100% EAD e flexível",
    "Certificado reconhecido pelo MEC",
    "Corpo docente especializado",
  ],
} as const;

export type FirstContactResult =
  | { skipped: true; reason: string }
  | { skipped: false; conversationId: string; messageSent: string };

export async function handleFirstContact(
  eventData: Partial<EventData<"lead/created">> & {
    tenantId: string;
    leadId: string;
    channel?: string | null;
    productContext?: { name: string; priceBrl: number; highlights: string[] } | null;
  },
): Promise<FirstContactResult> {
  const { tenantId, leadId, channel } = eventData;

  // Only process WhatsApp channel for now
  if (channel && channel !== "whatsapp") {
    return { skipped: true, reason: "channel_not_supported" };
  }

  // Load lead with tenant isolation
  const lead = await prisma.lead.findUnique({
    where: { id: leadId, tenantId },
    select: { id: true, name: true, phone: true, tenantId: true },
  });

  if (!lead) return { skipped: true, reason: "lead_not_found" };
  if (!lead.phone) return { skipped: true, reason: "no_phone" };

  // Load WhatsApp instance for tenant
  const instance = await prisma.whatsAppInstance.findUnique({
    where: { tenantId },
    select: { id: true, instanceName: true, phone: true, status: true },
  });

  if (!instance) return { skipped: true, reason: "no_wa_instance" };
  if (instance.status !== "CONNECTED") return { skipped: true, reason: "instance_not_connected" };

  // Generate first contact message via AI
  const productContext = eventData.productContext ?? DEFAULT_PRODUCT;

  const firstContact = await generateFirstContact({
    tenantId,
    leadId,
    leadName: lead.name,
    channel: "whatsapp",
    productContext: {
      name: productContext.name,
      priceBrl: productContext.priceBrl,
      highlights: [...productContext.highlights],
    },
    tone: "consultivo",
  });

  // Send via Evolution adapter
  const adapter = createEvolutionAdapter({
    baseUrl: process.env.EVOLUTION_API_URL ?? "",
    apiKey: process.env.EVOLUTION_WEBHOOK_SECRET ?? "",
    instanceName: instance.instanceName,
    instancePhone: instance.phone ?? "+5500000000000",
  });

  await adapter.sendMessage({
    tenantId,
    providerInstanceId: instance.instanceName,
    toPhoneE164: lead.phone,
    content: { type: "text", text: firstContact.message },
    externalEventId: `first-contact-${leadId}`,
  });

  // Find or create conversation
  const phone = lead.phone.replace("+", "");
  const remoteJid = `${phone}@s.whatsapp.net`;

  let conversationId: string;
  const existingConv = await prisma.whatsAppConversation.findFirst({
    where: { tenantId, leadId },
    select: { id: true },
  });

  if (existingConv) {
    conversationId = existingConv.id;
  } else {
    const conv = await prisma.whatsAppConversation.create({
      data: {
        tenantId,
        instanceId: instance.id,
        remoteJid,
        remotePhone: phone,
        remoteName: lead.name,
        leadId,
        lastMessageAt: new Date(),
      },
    });
    conversationId = conv.id;
  }

  // Save outbound message to DB
  await prisma.whatsAppMessage.create({
    data: {
      tenantId,
      conversationId,
      waMessageId: `fc-${leadId}-${Date.now()}`,
      fromMe: true,
      body: firstContact.message,
      mediaType: "TEXT",
      status: "SENT",
      timestamp: new Date(),
    },
  });

  // Schedule follow-up sequence
  await inngest.send({
    name: "followup/scheduled",
    data: {
      tenantId,
      leadId,
      sequenceId: `seq-${leadId}`,
      nextStepAt: new Date(
        Date.now() + firstContact.suggestedFollowUpMinutes * 60_000,
      ).toISOString(),
    },
  });

  return { skipped: false, conversationId, messageSent: firstContact.message };
}

export const firstContactFn = inngest.createFunction(
  {
    id: "first-contact",
    name: "SDR First Contact on Lead Created",
    // Idempotency: only fire once per lead
    idempotency: "event.data.leadId",
  },
  { event: "lead/created" },
  async ({ event, step }) => {
    return step.run("send-first-contact", () => handleFirstContact(event.data));
  },
);

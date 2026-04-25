import { prisma } from "@crm/db";
import { generateFollowUp } from "@crm/ai";
import { createEvolutionAdapter } from "@crm/whatsapp";
import { inngest } from "../client";
import type { EventData } from "../events";

// D+1, D+3, D+7 from first contact — 3 attempts max before escalation
const SEQUENCE_DAYS = [1, 3, 7] as const;

export type FollowupResult =
  | { skipped: true; reason: string }
  | { skipped: false; shouldEscalate: boolean; nextAttemptHours: number | null };

export async function handleFollowup(
  eventData: Partial<EventData<"followup/scheduled">> & {
    tenantId: string;
    leadId: string;
    sequenceId?: string;
  },
  attempt: number,
): Promise<FollowupResult> {
  const { tenantId, leadId } = eventData;

  // Load conversation with lead + instance info
  const conversation = await prisma.whatsAppConversation.findFirst({
    where: { tenantId, leadId },
    select: {
      id: true,
      instanceId: true,
      remotePhone: true,
      lead: { select: { id: true, name: true, phone: true } },
      instance: { select: { instanceName: true, phone: true, status: true } },
    },
  });

  if (!conversation) return { skipped: true, reason: "no_conversation" };
  if (conversation.instance.status !== "CONNECTED")
    return { skipped: true, reason: "instance_not_connected" };
  if (!conversation.lead?.phone) return { skipped: true, reason: "no_phone" };

  // Get message history for AI context
  const messages = await prisma.whatsAppMessage.findMany({
    where: { conversationId: conversation.id },
    orderBy: { timestamp: "asc" },
    take: 20,
    select: { fromMe: true, body: true, timestamp: true },
  });

  type MsgRow = { fromMe: boolean; body: string | null; timestamp: Date };
  const previousMessages = (messages as MsgRow[])
    .filter((m) => m.body && m.body.trim().length > 0)
    .map((m) => ({
      role: m.fromMe ? ("sdr" as const) : ("lead" as const),
      content: m.body!,
      at: m.timestamp,
    }));

  const lastLeadReply = (messages as MsgRow[]).filter((m) => !m.fromMe).at(-1);
  const daysSinceLastReply = lastLeadReply
    ? Math.floor((Date.now() - lastLeadReply.timestamp.getTime()) / 86400_000)
    : attempt;

  // Generate follow-up message via AI
  const result = await generateFollowUp({
    tenantId,
    leadId,
    leadName: conversation.lead.name ?? "amigo(a)",
    channel: "whatsapp",
    previousMessages:
      previousMessages.length > 0
        ? previousMessages
        : [{ role: "sdr", content: "Oi! Vi que você tem interesse em nossos cursos.", at: new Date() }],
    attempt: Math.min(attempt, 5) as 1 | 2 | 3 | 4 | 5,
    daysSinceLastReply,
  });

  // Send via Evolution adapter
  const adapter = createEvolutionAdapter({
    baseUrl: process.env.EVOLUTION_API_URL ?? "",
    apiKey: process.env.EVOLUTION_WEBHOOK_SECRET ?? "",
    instanceName: conversation.instance.instanceName,
    instancePhone: conversation.instance.phone ?? "+5500000000000",
  });

  await adapter.sendMessage({
    tenantId,
    providerInstanceId: conversation.instance.instanceName,
    toPhoneE164: conversation.lead.phone,
    content: { type: "text", text: result.message },
    externalEventId: `followup-${leadId}-attempt-${attempt}`,
  });

  // Save message to DB
  await prisma.whatsAppMessage.create({
    data: {
      tenantId,
      conversationId: conversation.id,
      waMessageId: `fu-${leadId}-${attempt}-${Date.now()}`,
      fromMe: true,
      body: result.message,
      mediaType: "TEXT",
      status: "SENT",
      timestamp: new Date(),
    },
  });

  return {
    skipped: false,
    shouldEscalate: result.shouldEscalate,
    nextAttemptHours: result.nextAttemptHours,
  };
}

export const followupSequenceFn = inngest.createFunction(
  {
    id: "followup-sequence",
    name: "Follow-up SDR Sequence D+1/D+3/D+7",
  },
  { event: "followup/scheduled" },
  async ({ event, step }) => {
    const { data } = event;

    for (let i = 0; i < SEQUENCE_DAYS.length; i++) {
      const attempt = i + 1;

      // Sleep until next follow-up day (relative to previous step)
      if (i === 0) {
        await step.sleep(`wait-d${SEQUENCE_DAYS[i]}`, `${SEQUENCE_DAYS[i] * 24}h`);
      } else {
        const waitDays = SEQUENCE_DAYS[i] - SEQUENCE_DAYS[i - 1];
        await step.sleep(`wait-d${SEQUENCE_DAYS[i]}`, `${waitDays * 24}h`);
      }

      const result = await step.run(`attempt-${attempt}`, () =>
        handleFollowup(data, attempt),
      );

      // Stop sequence on escalation or skip
      if (result.skipped || result.shouldEscalate) break;
    }
  },
);

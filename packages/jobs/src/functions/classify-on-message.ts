import { prisma } from "@crm/db";
import { classifyLead } from "@crm/ai";
import { inngest } from "../client";
import type { EventData } from "../events";

const SCORE_MAP = { hot: 85, warm: 60, cold: 30, unqualified: 0 } as const;
const LABEL_MAP = {
  hot: "HOT",
  warm: "WARM",
  cold: "COLD",
  unqualified: "DISQUALIFIED",
} as const;

export type ClassifyResult =
  | { skipped: true }
  | { skipped: false; leadId: string; classification: string };

export async function handleClassifyOnMessage(
  eventData: Partial<EventData<"message/received">> & {
    tenantId: string;
    conversationId: string;
    leadId?: string | null;
  },
): Promise<ClassifyResult> {
  const { tenantId, conversationId, leadId } = eventData;

  if (!leadId) return { skipped: true };

  const messages = await prisma.whatsAppMessage.findMany({
    where: { conversationId },
    orderBy: { timestamp: "asc" },
    take: 15,
    select: { fromMe: true, body: true, timestamp: true },
  });

  type MsgRow = { fromMe: boolean; body: string | null; timestamp: Date };
  const classifierMessages = (messages as MsgRow[])
    .filter((m) => m.body && m.body.trim().length > 0)
    .map((m) => ({
      role: m.fromMe ? ("sdr" as const) : ("lead" as const),
      content: m.body!,
      at: m.timestamp,
    }));

  if (classifierMessages.length === 0) return { skipped: true };

  const result = await classifyLead({
    tenantId,
    leadId,
    messages: classifierMessages,
  });

  const score = SCORE_MAP[result.classification];

  await prisma.lead.update({
    where: { id: leadId, tenantId },
    data: {
      score,
      scoreLabel: result.classification,
      scoreUpdatedAt: new Date(),
    },
  });

  await inngest.send({
    name: "lead/classified",
    data: {
      tenantId,
      leadId,
      score: LABEL_MAP[result.classification],
      confidence: result.confidence,
      reasons: [result.rationale],
      modelUsed: "anthropic/claude-haiku-4-5",
    },
  });

  return { skipped: false, leadId, classification: result.classification };
}

export const classifyOnMessageFn = inngest.createFunction(
  {
    id: "classify-on-message",
    name: "Re-classify lead on new message",
    rateLimit: { key: "event.data.leadId", limit: 1, period: "30s" },
  },
  { event: "message/received" },
  async ({ event, step }) => {
    return step.run("classify-lead", () => handleClassifyOnMessage(event.data));
  },
);

import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { WaInbox } from "@/components/whatsapp/WaInbox";
import Link from "next/link";
import { Settings } from "lucide-react";

export const metadata: Metadata = { title: "WhatsApp" };

interface Props {
  searchParams: Promise<{ conv?: string }>;
}

export default async function WhatsAppPage({ searchParams }: Props) {
  const session = await auth();
  if (!session) redirect("/login");

  const { conv: selectedId } = await searchParams;
  const tenantId = session.user.tenantId;

  const instance = await prisma.whatsAppInstance.findUnique({
    where: { tenantId },
    select: { id: true, status: true },
  });

  // Carrega lista de conversas com última mensagem (preview)
  const conversationsList = await prisma.whatsAppConversation.findMany({
    where: { tenantId },
    orderBy: { lastMessageAt: "desc" },
    take: 50,
    select: {
      id: true,
      remotePhone: true,
      remoteName: true,
      unreadCount: true,
      lastMessageAt: true,
      lead: { select: { id: true, name: true } },
      contact: { select: { id: true, name: true } },
      messages: {
        orderBy: { timestamp: "desc" },
        take: 1,
        select: {
          id: true,
          fromMe: true,
          body: true,
          mediaType: true,
          timestamp: true,
          status: true,
        },
      },
    },
  });

  // Carrega mensagens completas da conversa selecionada
  const selectedMessages = selectedId
    ? await prisma.whatsAppMessage.findMany({
        where: { conversationId: selectedId, tenantId },
        orderBy: { timestamp: "asc" },
        take: 200,
        select: {
          id: true,
          fromMe: true,
          body: true,
          mediaType: true,
          timestamp: true,
          status: true,
        },
      })
    : [];

  // Monta conversas serializadas
  const convsSerialized = conversationsList.map((c) => ({
    ...c,
    lastMessageAt: c.lastMessageAt?.toISOString() ?? null,
    messages:
      c.id === selectedId
        ? selectedMessages.map((m) => ({ ...m, timestamp: m.timestamp.toISOString() }))
        : c.messages.map((m) => ({ ...m, timestamp: m.timestamp.toISOString() })),
  }));

  return (
    // Contrapõe o p-6 do layout pai para preencher a altura toda
    <div className="-m-6 flex flex-col" style={{ height: "calc(100vh - 3.5rem)" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-card shrink-0">
        <div>
          <h1 className="font-semibold text-sm">WhatsApp</h1>
          <p className="text-xs text-muted-foreground">
            {instance?.status === "CONNECTED" ? "Conectado" : "Desconectado"} ·{" "}
            {conversationsList.length} conversa{conversationsList.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Link
          href="/configuracoes/whatsapp"
          className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent transition-colors"
        >
          <Settings size={13} />
          Configurar
        </Link>
      </div>

      {/* Inbox */}
      <div className="flex-1 overflow-hidden">
        <WaInbox
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          conversations={convsSerialized as any}
          selectedId={selectedId ?? null}
          instanceStatus={instance?.status ?? "DISCONNECTED"}
        />
      </div>
    </div>
  );
}

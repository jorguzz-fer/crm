"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { sendWhatsAppMessageAction, markConversationReadAction } from "@/app/actions/whatsapp";
import { Send, MessageCircle, Search, CheckCheck, Check, Clock, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  fromMe: boolean;
  body: string | null;
  mediaType: string;
  timestamp: string; // ISO string from server
  status: string;
}

interface Conversation {
  id: string;
  remotePhone: string;
  remoteName: string | null;
  unreadCount: number;
  lastMessageAt: string | null; // ISO string from server
  lead: { id: string; name: string } | null;
  contact: { id: string; name: string } | null;
  messages: Message[];
}

interface Props {
  conversations: Conversation[];
  selectedId: string | null;
  instanceStatus: string;
}

function formatTime(date: string | null) {
  if (!date) return "";
  const d = new Date(date);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return "Ontem";
  if (diffDays < 7) return d.toLocaleDateString("pt-BR", { weekday: "short" });
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function StatusIcon({ status, fromMe }: { status: string; fromMe: boolean }) {
  if (!fromMe) return null;
  if (status === "READ") return <CheckCheck size={12} className="text-blue-400" />;
  if (status === "DELIVERED") return <CheckCheck size={12} className="text-muted-foreground" />;
  if (status === "SENT") return <Check size={12} className="text-muted-foreground" />;
  return <Clock size={12} className="text-muted-foreground" />;
}

function getDisplayName(conv: Conversation): string {
  return conv.lead?.name ?? conv.contact?.name ?? conv.remoteName ?? `+${conv.remotePhone}`;
}

export function WaInbox({ conversations, selectedId, instanceStatus }: Props) {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const [text, setText] = useState("");
  const [sending, startSend] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const bottomRef  = useRef<HTMLDivElement>(null);
  const inputRef   = useRef<HTMLTextAreaElement>(null);

  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selected?.messages.length]);

  // Mark as read when opening
  useEffect(() => {
    if (selectedId && selected && selected.unreadCount > 0) {
      markConversationReadAction(selectedId);
    }
  }, [selectedId, selected]);

  // Polling: refresh every 5 seconds
  useEffect(() => {
    const id = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(id);
  }, [router]);

  const filteredConversations = conversations.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      getDisplayName(c).toLowerCase().includes(q) ||
      c.remotePhone.includes(q)
    );
  });

  function selectConversation(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("conv", id);
    router.push(`/whatsapp?${params.toString()}`);
    setText("");
    setError(null);
  }

  function handleSend() {
    if (!selectedId || !text.trim()) return;
    setError(null);
    startSend(async () => {
      const result = await sendWhatsAppMessageAction(selectedId, text);
      if ("error" in result) {
        setError(result.error);
      } else {
        setText("");
        router.refresh();
      }
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex h-full">
      {/* ── Conversation list ───────────────────────────────────── */}
      <div className="w-72 flex-none flex flex-col border-r border-border">
        {/* Search */}
        <div className="p-3 border-b border-border">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar conversa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md border border-input bg-background pl-8 pr-3 py-1.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {filteredConversations.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              {conversations.length === 0 ? (
                <>
                  <MessageCircle size={24} className="mx-auto mb-2 opacity-40" />
                  Nenhuma conversa ainda
                </>
              ) : "Nenhum resultado"}
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const name = getDisplayName(conv);
              const lastMsg = conv.messages[conv.messages.length - 1];
              const active  = conv.id === selectedId;
              return (
                <button
                  key={conv.id}
                  onClick={() => selectConversation(conv.id)}
                  className={cn(
                    "w-full flex items-start gap-3 p-3 text-left hover:bg-accent transition-colors",
                    active && "bg-primary/5 border-r-2 border-primary"
                  )}
                >
                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-primary text-sm font-medium">
                      {name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline gap-1">
                      <span className="text-sm font-medium truncate">{name}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {formatTime(conv.lastMessageAt)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center mt-0.5">
                      <p className="text-xs text-muted-foreground truncate">
                        {lastMsg?.fromMe && "→ "}
                        {lastMsg?.body ?? "—"}
                      </p>
                      {conv.unreadCount > 0 && (
                        <span className="ml-1 shrink-0 rounded-full bg-primary text-primary-foreground text-[10px] font-medium px-1.5 py-0.5 min-w-[18px] text-center">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                    {(conv.lead || conv.contact) && (
                      <p className="text-[10px] text-primary mt-0.5 flex items-center gap-1">
                        <User size={9} />
                        {conv.lead?.name ?? conv.contact?.name}
                      </p>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ── Chat view ───────────────────────────────────────────── */}
      {selected ? (
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card shrink-0">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <span className="text-primary text-sm font-medium">
                {getDisplayName(selected).charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{getDisplayName(selected)}</p>
              <p className="text-xs text-muted-foreground">+{selected.remotePhone}</p>
            </div>
            {selected.lead && (
              <a
                href={`/leads/${selected.lead.id}`}
                className="text-xs text-primary hover:underline shrink-0"
              >
                Ver lead →
              </a>
            )}
            {selected.contact && (
              <a
                href={`/contatos/${selected.contact.id}`}
                className="text-xs text-primary hover:underline shrink-0"
              >
                Ver contato →
              </a>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {selected.messages.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-8">
                Nenhuma mensagem ainda
              </p>
            )}
            {selected.messages.map((msg) => (
              <div
                key={msg.id}
                className={cn("flex", msg.fromMe ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[72%] rounded-2xl px-3 py-2 text-sm",
                    msg.fromMe
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-muted text-foreground rounded-bl-sm"
                  )}
                >
                  {msg.body && <p className="whitespace-pre-wrap break-words">{msg.body}</p>}
                  {!msg.body && (
                    <p className="text-xs opacity-60 italic">
                      {msg.mediaType === "IMAGE" ? "📷 Imagem" :
                       msg.mediaType === "AUDIO" ? "🎤 Áudio" :
                       msg.mediaType === "VIDEO" ? "🎥 Vídeo" :
                       msg.mediaType === "DOCUMENT" ? "📄 Documento" :
                       msg.mediaType === "STICKER" ? "😀 Figurinha" :
                       "Mensagem"}
                    </p>
                  )}
                  <div className={cn(
                    "flex items-center gap-1 mt-1",
                    msg.fromMe ? "justify-end" : "justify-start"
                  )}>
                    <span className="text-[10px] opacity-60">
                      {new Date(msg.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <StatusIcon status={msg.status} fromMe={msg.fromMe} />
                  </div>
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-border bg-card shrink-0">
            {instanceStatus !== "CONNECTED" && (
              <p className="text-xs text-amber-600 text-center mb-2">
                WhatsApp desconectado — configure em Configurações → WhatsApp
              </p>
            )}
            {error && <p className="text-xs text-destructive mb-2">{error}</p>}
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={sending || instanceStatus !== "CONNECTED"}
                placeholder={instanceStatus === "CONNECTED" ? "Digite uma mensagem... (Enter para enviar)" : "WhatsApp não conectado"}
                rows={1}
                className="flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50 max-h-28 overflow-y-auto"
                style={{ minHeight: "38px" }}
              />
              <button
                onClick={handleSend}
                disabled={sending || !text.trim() || instanceStatus !== "CONNECTED"}
                className="flex-none w-9 h-9 rounded-full bg-primary flex items-center justify-center hover:bg-primary/90 disabled:opacity-40 transition-colors"
              >
                <Send size={15} className="text-primary-foreground translate-x-[1px]" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <div className="text-center space-y-2">
            <MessageCircle size={40} className="mx-auto opacity-20" />
            <p className="text-sm">Selecione uma conversa</p>
          </div>
        </div>
      )}
    </div>
  );
}

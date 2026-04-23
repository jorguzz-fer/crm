"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { Send, MessageCircle, Loader2, Phone } from "lucide-react";
import { sendWhatsAppMessageAction } from "@/app/actions/whatsapp";

export interface WaMessage {
  id: string;
  fromMe: boolean;
  body: string | null;
  mediaType: string;
  timestamp: Date;
  status: string;
}

export interface WaConversation {
  id: string;
  remotePhone: string;
  remoteName: string | null;
  messages: WaMessage[];
}

interface Props {
  conversations: WaConversation[];
  waConnected: boolean;
}

function formatTime(d: Date) {
  return new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatDay(d: Date) {
  const now = new Date();
  const date = new Date(d);
  const diff = now.setHours(0,0,0,0) - date.setHours(0,0,0,0);
  if (diff === 0) return "Hoje";
  if (diff === 86400000) return "Ontem";
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export function WhatsAppThread({ conversations, waConnected }: Props) {
  const [activeId, setActiveId] = useState(conversations[0]?.id ?? "");
  const [text, setText] = useState("");
  const [isPending, startTransition] = useTransition();
  const [localMsgs, setLocalMsgs] = useState<Record<string, WaMessage[]>>({});
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const active = conversations.find((c) => c.id === activeId);
  const allMsgs = [...(active?.messages ?? []), ...(localMsgs[activeId] ?? [])].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [allMsgs.length, activeId]);

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || !activeId) return;
    const msg = text.trim();
    setText("");
    setError("");

    // Mensagem otimista
    const optimistic: WaMessage = {
      id: `opt-${Date.now()}`,
      fromMe: true,
      body: msg,
      mediaType: "TEXT",
      timestamp: new Date(),
      status: "PENDING",
    };
    setLocalMsgs((prev) => ({
      ...prev,
      [activeId]: [...(prev[activeId] ?? []), optimistic],
    }));

    startTransition(async () => {
      const result = await sendWhatsAppMessageAction(activeId, msg);
      if ("error" in result) {
        setError(result.error);
        // Remove a mensagem otimista em caso de erro
        setLocalMsgs((prev) => ({
          ...prev,
          [activeId]: (prev[activeId] ?? []).filter((m) => m.id !== optimistic.id),
        }));
      }
    });
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <MessageCircle size={28} className="text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">Nenhuma conversa WhatsApp vinculada a este lead.</p>
        {!waConnected && (
          <p className="text-xs text-muted-foreground">
            Configure o WhatsApp em{" "}
            <a href="/configuracoes/whatsapp" className="text-primary hover:underline">
              Configurações → WhatsApp
            </a>
            .
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Seletor de conversa (se houver mais de uma) */}
      {conversations.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {conversations.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveId(c.id)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                c.id === activeId
                  ? "bg-primary/10 text-primary border-primary/20"
                  : "border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              <Phone size={11} />
              {c.remoteName ?? c.remotePhone}
            </button>
          ))}
        </div>
      )}

      {/* Thread de mensagens */}
      <div className="rounded-xl border border-border bg-muted/20 flex flex-col overflow-hidden" style={{ minHeight: 320, maxHeight: 460 }}>
        <div className="flex items-center gap-2 border-b border-border px-4 py-2.5 bg-card">
          <div className="h-7 w-7 rounded-full bg-green-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
            {(active?.remoteName ?? active?.remotePhone ?? "?")[0].toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{active?.remoteName ?? active?.remotePhone}</p>
            <p className="text-xs text-muted-foreground">{active?.remotePhone}</p>
          </div>
        </div>

        {/* Mensagens */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {allMsgs.length === 0 && (
            <p className="text-center text-xs text-muted-foreground py-8">Nenhuma mensagem ainda.</p>
          )}
          {allMsgs.map((msg, i) => {
            const prevMsg = allMsgs[i - 1];
            const showDay =
              i === 0 ||
              formatDay(new Date(msg.timestamp)) !== formatDay(new Date(prevMsg.timestamp));

            return (
              <div key={msg.id}>
                {showDay && (
                  <div className="flex items-center gap-2 my-3">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-[10px] text-muted-foreground px-2">
                      {formatDay(new Date(msg.timestamp))}
                    </span>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                )}
                <div className={`flex ${msg.fromMe ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                      msg.fromMe
                        ? "bg-green-500 text-white rounded-br-sm"
                        : "bg-card border border-border rounded-bl-sm"
                    }`}
                  >
                    {msg.mediaType !== "TEXT" && (
                      <p className="text-[11px] opacity-70 mb-0.5 italic">
                        [{msg.mediaType.toLowerCase()}]
                      </p>
                    )}
                    <p className="whitespace-pre-wrap break-words leading-snug">
                      {msg.body ?? "(sem conteúdo)"}
                    </p>
                    <p className={`text-[10px] mt-0.5 text-right ${msg.fromMe ? "text-white/70" : "text-muted-foreground"}`}>
                      {formatTime(new Date(msg.timestamp))}
                      {msg.fromMe && msg.status === "PENDING" && " ·"}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Input de resposta */}
        <div className="border-t border-border p-3 bg-card">
          {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
          {!waConnected ? (
            <p className="text-xs text-muted-foreground text-center py-1">
              WhatsApp desconectado —{" "}
              <a href="/configuracoes/whatsapp" className="text-primary hover:underline">
                reconectar
              </a>
            </p>
          ) : (
            <form onSubmit={handleSend} className="flex gap-2">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Digite uma mensagem..."
                className="flex-1 rounded-full border border-input bg-background px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                disabled={isPending}
              />
              <button
                type="submit"
                disabled={isPending || !text.trim()}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-500 text-white hover:bg-green-600 disabled:opacity-50 transition-colors"
              >
                {isPending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

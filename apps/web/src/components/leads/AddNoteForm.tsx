"use client";

import { useActionState, useRef, useEffect, useState } from "react";
import { createNoteAction } from "@/app/actions/leads";
import { AudioTranscriber } from "@/components/ai/AudioTranscriber";
import { Mic } from "lucide-react";

export function AddNoteForm({ leadId }: { leadId: string }) {
  const [state, action, pending] = useActionState(createNoteAction, null);
  const ref = useRef<HTMLFormElement>(null);
  const [content, setContent]           = useState("");
  const [showTranscriber, setShowTranscriber] = useState(false);

  useEffect(() => {
    if (state && "success" in state) {
      ref.current?.reset();
      setContent("");
      setShowTranscriber(false);
    }
  }, [state]);

  function handleTranscribed(text: string) {
    setContent((prev) => (prev ? `${prev}\n\n${text}` : text));
    setShowTranscriber(false);
  }

  return (
    <form ref={ref} action={action} className="rounded-lg border border-border bg-card p-4 space-y-3">
      <input type="hidden" name="leadId" value={leadId} />

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Adicionar nota</h2>
        <button
          type="button"
          onClick={() => setShowTranscriber((v) => !v)}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          title="Transcrever áudio"
        >
          <Mic size={12} />
          {showTranscriber ? "Fechar áudio" : "Transcrever áudio"}
        </button>
      </div>

      {state && "error" in state && (
        <p className="text-xs text-destructive">{state.error}</p>
      )}

      {showTranscriber && (
        <AudioTranscriber
          onTranscribed={handleTranscribed}
          entityType="note"
          entityId={leadId}
        />
      )}

      <textarea
        name="content"
        rows={3}
        required
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Escreva uma nota sobre este lead..."
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
      />
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {pending ? "Salvando..." : "Salvar nota"}
        </button>
      </div>
    </form>
  );
}

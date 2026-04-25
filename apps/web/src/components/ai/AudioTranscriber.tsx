"use client";

/**
 * AudioTranscriber
 *
 * Componente que:
 *  1. Deixa o usuário gravar áudio (MediaRecorder) OU fazer upload de arquivo
 *  2. Exibe aviso de consentimento LGPD (obrigatório)
 *  3. Envia para POST /api/transcription e retorna o texto
 *  4. Chama onTranscribed(text) para o componente pai inserir a transcrição
 */

import { useState, useRef, useCallback } from "react";
import {
  Mic, MicOff, Upload, Loader2, AlertTriangle, CheckCircle, X,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  /** Chamado com o texto transcrito quando pronto */
  onTranscribed: (text: string) => void;
  /** Contexto da entidade para o audit trail (opcional) */
  entityType?: "note" | "activity" | "visit";
  entityId?: string;
  className?: string;
}

type RecordState = "idle" | "recording" | "recorded" | "uploading" | "done" | "error";

const MAX_BYTES = 25 * 1024 * 1024;

export function AudioTranscriber({ onTranscribed, entityType, entityId, className }: Props) {
  const [state, setState]               = useState<RecordState>("idle");
  const [blob, setBlob]                 = useState<Blob | null>(null);
  const [filename, setFilename]         = useState<string>("gravacao.webm");
  const [consentGiven, setConsentGiven] = useState(false);
  const [errorMsg, setErrorMsg]         = useState<string | null>(null);
  const [recSeconds, setRecSeconds]     = useState(0);
  const [transcribedText, setTranscribedText] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef        = useRef<BlobPart[]>([]);
  const timerRef         = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef     = useRef<HTMLInputElement>(null);

  // ── Gravação ──────────────────────────────────────────────────────────────
  async function startRecording() {
    if (!consentGiven) {
      setErrorMsg("Confirme o consentimento antes de gravar.");
      return;
    }
    setErrorMsg(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const mr = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mr;
      chunksRef.current = [];

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const recorded = new Blob(chunksRef.current, { type: mimeType });
        setBlob(recorded);
        setFilename(`gravacao-${Date.now()}.webm`);
        stream.getTracks().forEach((t) => t.stop());
        setState("recorded");
        if (timerRef.current) clearInterval(timerRef.current);
      };

      mr.start(200);
      setState("recording");
      setRecSeconds(0);
      timerRef.current = setInterval(() => setRecSeconds((s) => s + 1), 1000);
    } catch {
      setErrorMsg("Não foi possível acessar o microfone.");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    if (timerRef.current) clearInterval(timerRef.current);
  }

  // ── Upload de arquivo ─────────────────────────────────────────────────────
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setErrorMsg("Arquivo muito grande (máx 25 MB).");
      return;
    }
    setBlob(file);
    setFilename(file.name);
    setState("recorded");
    setErrorMsg(null);
  }

  // ── Transcrição ───────────────────────────────────────────────────────────
  const transcribe = useCallback(async () => {
    if (!blob || !consentGiven) return;
    setState("uploading");
    setErrorMsg(null);

    const fd = new FormData();
    fd.append("audio", blob, filename);
    fd.append("consentGiven", "true");
    fd.append("language", "pt");
    if (entityType) fd.append("entityType", entityType);
    if (entityId)   fd.append("entityId", entityId);

    try {
      const res  = await fetch("/api/transcription", { method: "POST", body: fd });
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error ?? "Erro na transcrição.");
        setState("error");
        return;
      }

      setTranscribedText(data.text);
      onTranscribed(data.text);
      setState("done");
    } catch {
      setErrorMsg("Erro de rede. Tente novamente.");
      setState("error");
    }
  }, [blob, consentGiven, filename, entityType, entityId, onTranscribed]);

  function reset() {
    setBlob(null);
    setFilename("gravacao.webm");
    setState("idle");
    setErrorMsg(null);
    setTranscribedText(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // ── UI ────────────────────────────────────────────────────────────────────
  return (
    <div className={cn("rounded-lg border border-border bg-card p-4 space-y-3", className)}>
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        Transcrição de áudio (Whisper)
      </p>

      {/* Consentimento LGPD */}
      <label className="flex items-start gap-2 cursor-pointer group">
        <input
          type="checkbox"
          checked={consentGiven}
          onChange={(e) => setConsentGiven(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
        />
        <span className="text-xs text-muted-foreground leading-relaxed">
          <span className="font-medium text-foreground">Consentimento obrigatório (LGPD art. 9º):</span>{" "}
          Confirmo que obtive o consentimento de todas as partes gravadas para transcrição e
          armazenamento do áudio.
        </span>
      </label>

      {/* Controles */}
      {state === "idle" || state === "error" ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={startRecording}
            disabled={!consentGiven}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Mic size={13} />
            Gravar
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={!consentGiven}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
          >
            <Upload size={13} />
            Enviar arquivo
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*,video/mp4,video/webm"
            className="sr-only"
            onChange={handleFileChange}
          />
        </div>
      ) : state === "recording" ? (
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-sm text-destructive font-medium animate-pulse">
            <span className="h-2 w-2 rounded-full bg-destructive" />
            Gravando {recSeconds}s
          </span>
          <button
            type="button"
            onClick={stopRecording}
            className="inline-flex items-center gap-1.5 rounded-md border border-destructive/50 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10"
          >
            <MicOff size={13} />
            Parar
          </button>
        </div>
      ) : state === "recorded" ? (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">{filename}</span>
          <button
            type="button"
            onClick={transcribe}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            Transcrever
          </button>
          <button type="button" onClick={reset} className="text-muted-foreground/50 hover:text-muted-foreground">
            <X size={14} />
          </button>
        </div>
      ) : state === "uploading" ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={14} className="animate-spin" />
          Transcrevendo com Whisper…
        </div>
      ) : state === "done" ? (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs text-green-700 font-medium">
            <CheckCircle size={13} />
            Transcrição concluída
          </div>
          {transcribedText && (
            <p className="text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2 max-h-28 overflow-y-auto whitespace-pre-wrap">
              {transcribedText}
            </p>
          )}
          <button
            type="button"
            onClick={reset}
            className="text-xs text-muted-foreground underline-offset-4 hover:underline"
          >
            Nova transcrição
          </button>
        </div>
      ) : null}

      {errorMsg && (
        <div className="flex items-center gap-2 text-xs text-destructive">
          <AlertTriangle size={13} />
          {errorMsg}
        </div>
      )}
    </div>
  );
}

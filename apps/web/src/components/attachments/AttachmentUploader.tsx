"use client";

/**
 * AttachmentUploader
 *
 * Drag-and-drop + click-to-browse para anexar arquivos a uma entidade.
 * Fluxo:
 *   1. Usuário seleciona arquivo
 *   2. POST /api/upload → recebe { attachmentId, uploadUrl }
 *   3. PUT direto no R2 com o signed URL
 *   4. onUploaded(attachmentId) é chamado — o pai recarrega a lista
 */

import { useRef, useState } from "react";
import { Upload, X, File, ImageIcon, FileAudio, FileVideo, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

const MAX_SIZE_MB = 25;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

const ALLOWED_EXTENSIONS =
  ".jpg,.jpeg,.png,.gif,.webp,.heic,.svg," +
  ".mp3,.m4a,.wav,.ogg,.aac,.flac," +
  ".mp4,.mov,.webm," +
  ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv";

interface Props {
  entityType: "note" | "visit" | "lead" | "opportunity";
  entityId:   string;
  onUploaded: (attachmentId: string) => void;
  disabled?:  boolean;
  className?: string;
}

function getMimeIcon(mimeType: string) {
  if (mimeType.startsWith("image/"))  return ImageIcon;
  if (mimeType.startsWith("audio/"))  return FileAudio;
  if (mimeType.startsWith("video/"))  return FileVideo;
  return FileText;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type FileState = {
  file:     File;
  progress: number; // 0-100
  error?:   string;
  done:     boolean;
};

export function AttachmentUploader({ entityType, entityId, onUploaded, disabled, className }: Props) {
  const inputRef  = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<FileState[]>([]);
  const [dragging, setDragging] = useState(false);

  function updateFile(index: number, patch: Partial<FileState>) {
    setFiles((prev) => prev.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  }

  async function processFile(file: File, index: number) {
    if (file.size > MAX_SIZE_BYTES) {
      updateFile(index, { error: `Arquivo muito grande (máx ${MAX_SIZE_MB} MB)` });
      return;
    }

    try {
      // 1. Pede a signed URL ao servidor
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename:   file.name,
          mimeType:   file.type || "application/octet-stream",
          size:       file.size,
          entityType,
          entityId,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Erro ${res.status}`);
      }

      const { attachmentId, uploadUrl } = await res.json();

      updateFile(index, { progress: 20 });

      // 2. PUT direto no R2 (XHR para ter progresso real)
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            const pct = 20 + Math.round((e.loaded / e.total) * 75);
            updateFile(index, { progress: pct });
          }
        });
        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`Upload falhou: ${xhr.status}`));
        });
        xhr.addEventListener("error", () => reject(new Error("Erro de rede")));
        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
        xhr.send(file);
      });

      updateFile(index, { progress: 100, done: true });
      onUploaded(attachmentId);
    } catch (err) {
      updateFile(index, { error: err instanceof Error ? err.message : "Erro desconhecido" });
    }
  }

  function addFiles(newFiles: FileList | null) {
    if (!newFiles) return;
    const arr = Array.from(newFiles);
    const startIndex = files.length;
    const states: FileState[] = arr.map((f) => ({ file: f, progress: 0, done: false }));
    setFiles((prev) => [...prev, ...states]);
    states.forEach((_, i) => processFile(arr[i], startIndex + i));
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <div className={cn("space-y-2", className)}>
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!disabled) addFiles(e.dataTransfer.files);
        }}
        onClick={() => !disabled && inputRef.current?.click()}
        className={cn(
          "relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition-colors cursor-pointer",
          dragging
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50 hover:bg-accent/40",
          disabled && "opacity-50 cursor-not-allowed",
        )}
      >
        <Upload size={20} className="text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">Arraste arquivos ou clique para selecionar</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Imagens, PDFs, áudios, vídeos, documentos Office — máx {MAX_SIZE_MB} MB por arquivo
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ALLOWED_EXTENSIONS}
          disabled={disabled}
          onChange={(e) => addFiles(e.target.files)}
          className="sr-only"
        />
      </div>

      {/* Lista de arquivos em progresso */}
      {files.length > 0 && (
        <ul className="space-y-1.5">
          {files.map((fs, i) => {
            const Icon = getMimeIcon(fs.file.type);
            return (
              <li
                key={i}
                className={cn(
                  "flex items-center gap-2 rounded-md border px-3 py-2 text-sm",
                  fs.error   ? "border-destructive/50 bg-destructive/5" :
                  fs.done    ? "border-green-200 bg-green-50/50" :
                               "border-border",
                )}
              >
                <Icon size={14} className={fs.error ? "text-destructive" : "text-muted-foreground"} />
                <span className="flex-1 min-w-0 truncate">{fs.file.name}</span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {formatBytes(fs.file.size)}
                </span>

                {/* Progresso / erro / concluído */}
                {!fs.done && !fs.error && (
                  <span className="text-xs text-muted-foreground shrink-0 w-8 text-right">
                    {fs.progress}%
                  </span>
                )}
                {fs.done && (
                  <span className="text-xs text-green-600 shrink-0">✓</span>
                )}
                {fs.error && (
                  <span className="text-xs text-destructive shrink-0 max-w-[140px] truncate" title={fs.error}>
                    {fs.error}
                  </span>
                )}

                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                  className="shrink-0 text-muted-foreground/50 hover:text-muted-foreground"
                >
                  <X size={13} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

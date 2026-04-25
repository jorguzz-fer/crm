"use client";

/**
 * AttachmentList
 *
 * Exibe e gerencia a lista de anexos de uma entidade.
 * Download: GET /api/upload/[id] → signed URL → abre em nova aba.
 * Delete: DELETE /api/upload/[id] → remove do R2 + banco.
 */

import { useState, useTransition } from "react";
import {
  File,
  ImageIcon,
  FileAudio,
  FileVideo,
  FileText,
  Download,
  Trash2,
  Paperclip,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface AttachmentItem {
  id:        string;
  filename:  string;
  mimeType:  string;
  size:      number;
  createdAt: string; // ISO string
  user?:     { name: string };
}

interface Props {
  attachments: AttachmentItem[];
  canDelete?:  boolean;
  onDeleted?:  (id: string) => void;
  className?:  string;
}

function getMimeIcon(mimeType: string) {
  if (mimeType.startsWith("image/"))  return ImageIcon;
  if (mimeType.startsWith("audio/"))  return FileAudio;
  if (mimeType.startsWith("video/"))  return FileVideo;
  if (mimeType === "application/pdf") return File;
  return FileText;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function AttachmentList({ attachments, canDelete = false, onDeleted, className }: Props) {
  const [downloading, setDownloading] = useState<string | null>(null);
  const [deleting, startDelete] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (attachments.length === 0) return null;

  async function handleDownload(id: string, filename: string) {
    setDownloading(id);
    setError(null);
    try {
      const res = await fetch(`/api/upload/${id}`);
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      const { url } = await res.json();
      // Abre em nova aba — o browser usa o Content-Disposition do R2
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      setError("Erro ao baixar arquivo. Tente novamente.");
    } finally {
      setDownloading(null);
    }
  }

  function handleDelete(id: string) {
    setDeletingId(id);
    setError(null);
    startDelete(async () => {
      try {
        const res = await fetch(`/api/upload/${id}`, { method: "DELETE" });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `Erro ${res.status}`);
        }
        onDeleted?.(id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao excluir anexo");
      } finally {
        setDeletingId(null);
      }
    });
  }

  return (
    <div className={cn("space-y-1", className)}>
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-2">
        <Paperclip size={12} />
        {attachments.length} anexo{attachments.length !== 1 ? "s" : ""}
      </p>

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}

      <ul className="space-y-1">
        {attachments.map((att) => {
          const Icon       = getMimeIcon(att.mimeType);
          const isDownloading = downloading === att.id;
          const isDeleting    = deleting && deletingId === att.id;

          return (
            <li
              key={att.id}
              className="group flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm hover:border-primary/30 transition-colors"
            >
              <Icon size={14} className="shrink-0 text-muted-foreground" />

              <div className="flex-1 min-w-0">
                <p className="truncate font-medium text-xs">{att.filename}</p>
                <p className="text-[10px] text-muted-foreground">
                  {formatBytes(att.size)} · {formatDate(att.createdAt)}
                  {att.user && ` · ${att.user.name}`}
                </p>
              </div>

              {/* Download */}
              <button
                type="button"
                onClick={() => handleDownload(att.id, att.filename)}
                disabled={isDownloading || isDeleting}
                title="Baixar"
                className={cn(
                  "shrink-0 text-muted-foreground/60 hover:text-primary transition-colors",
                  "opacity-0 group-hover:opacity-100",
                  (isDownloading || isDeleting) && "opacity-50",
                )}
              >
                <Download size={13} className={isDownloading ? "animate-pulse" : ""} />
              </button>

              {/* Delete */}
              {canDelete && (
                <button
                  type="button"
                  onClick={() => handleDelete(att.id)}
                  disabled={isDownloading || isDeleting}
                  title="Excluir anexo"
                  className={cn(
                    "shrink-0 text-muted-foreground/60 hover:text-destructive transition-colors",
                    "opacity-0 group-hover:opacity-100",
                    (isDownloading || isDeleting) && "opacity-50",
                  )}
                >
                  <Trash2 size={13} className={isDeleting ? "animate-pulse" : ""} />
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

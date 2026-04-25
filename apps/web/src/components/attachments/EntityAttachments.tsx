"use client";

/**
 * EntityAttachments
 * Wrapper reutilizável que combina AttachmentList + AttachmentUploader.
 *
 * - Estado local inicializado pelo Server Component (SSR).
 * - router.refresh() após upload → Next.js re-renderiza o RSC com dados frescos.
 * - Deleção otimista (remove do estado local imediatamente).
 * - useEffect sincroniza o estado quando o Server Component re-envia novas props.
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Paperclip, ChevronDown, ChevronUp } from "lucide-react";
import { AttachmentList, type AttachmentItem } from "./AttachmentList";
import { AttachmentUploader } from "./AttachmentUploader";
import { cn } from "@/lib/utils";

interface Props {
  entityType:          "note" | "visit" | "lead" | "opportunity";
  entityId:            string;
  initialAttachments:  AttachmentItem[];
  canDelete?:          boolean;
  /** Mostra como seção colapsável (padrão em lista de visitas) */
  collapsible?:        boolean;
  className?:          string;
}

export function EntityAttachments({
  entityType,
  entityId,
  initialAttachments,
  canDelete = false,
  collapsible = false,
  className,
}: Props) {
  const router = useRouter();
  const [attachments, setAttachments] = useState<AttachmentItem[]>(initialAttachments);
  const [open, setOpen] = useState(!collapsible);

  // Sincroniza quando o RSC re-renderiza com dados novos (após router.refresh())
  useEffect(() => {
    setAttachments(initialAttachments);
  }, [initialAttachments]);

  function handleDeleted(id: string) {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }

  function handleUploaded() {
    // router.refresh() faz o RSC recarregar do DB, trazendo o novo anexo
    router.refresh();
  }

  if (collapsible) {
    return (
      <div className={cn("border-t border-border", className)}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-2.5 text-xs text-muted-foreground hover:bg-accent/40 transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <Paperclip size={12} />
            Anexos
            {attachments.length > 0 && (
              <span className="ml-1 rounded-full bg-primary/10 text-primary px-1.5 py-0.5 font-medium">
                {attachments.length}
              </span>
            )}
          </span>
          {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>

        {open && (
          <div className="px-4 pb-4 space-y-3">
            <AttachmentList
              attachments={attachments}
              canDelete={canDelete}
              onDeleted={handleDeleted}
            />
            <AttachmentUploader
              entityType={entityType}
              entityId={entityId}
              onUploaded={handleUploaded}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <AttachmentList
        attachments={attachments}
        canDelete={canDelete}
        onDeleted={handleDeleted}
      />
      <AttachmentUploader
        entityType={entityType}
        entityId={entityId}
        onUploaded={handleUploaded}
      />
    </div>
  );
}

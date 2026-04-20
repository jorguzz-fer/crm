"use client";

import { useActionState } from "react";
import { approveDataRequestAction, rejectDataRequestAction } from "@/app/actions/lgpd";
import { Download, CheckCircle, XCircle, Clock } from "lucide-react";

const TYPE_LABELS: Record<string, string> = {
  EXPORT: "Portabilidade",
  DELETE: "Exclusão",
};

const TYPE_STYLE: Record<string, string> = {
  EXPORT: "bg-blue-100 text-blue-700",
  DELETE: "bg-red-100 text-red-700",
};

const STATUS_LABELS: Record<string, string> = {
  PENDENTE: "Pendente",
  APROVADO: "Aprovado",
  REJEITADO: "Rejeitado",
  CONCLUIDO: "Concluído",
};

const STATUS_STYLE: Record<string, string> = {
  PENDENTE: "bg-amber-100 text-amber-700",
  APROVADO: "bg-blue-100 text-blue-700",
  REJEITADO: "bg-red-100 text-red-700",
  CONCLUIDO: "bg-green-100 text-green-700",
};

interface DataRequest {
  id: string;
  type: string;
  entityType: string;
  entityName: string;
  status: string;
  createdAt: Date;
  processedAt: Date | null;
  requester: { name: string };
  processor: { name: string } | null;
}

function ApproveRejectButtons({ requestId }: { requestId: string }) {
  const [approveState, approveAction, approvePending] = useActionState(approveDataRequestAction, null);
  const [rejectState, rejectAction, rejectPending] = useActionState(rejectDataRequestAction, null);

  return (
    <div className="flex items-center gap-2">
      {(approveState as any)?.error && (
        <span className="text-xs text-destructive">{(approveState as any).error}</span>
      )}
      {(rejectState as any)?.error && (
        <span className="text-xs text-destructive">{(rejectState as any).error}</span>
      )}
      <form action={approveAction}>
        <input type="hidden" name="requestId" value={requestId} />
        <button
          type="submit"
          disabled={approvePending || rejectPending}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-50 transition-colors disabled:opacity-50"
        >
          <CheckCircle size={13} />
          {approvePending ? "..." : "Aprovar"}
        </button>
      </form>
      <form action={rejectAction}>
        <input type="hidden" name="requestId" value={requestId} />
        <button
          type="submit"
          disabled={approvePending || rejectPending}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
        >
          <XCircle size={13} />
          {rejectPending ? "..." : "Rejeitar"}
        </button>
      </form>
    </div>
  );
}

export function DataRequestsSection({ requests }: { requests: DataRequest[] }) {
  if (requests.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <Clock size={24} className="mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Nenhuma solicitação de titular registrada ainda.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-muted/40">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Titular</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Tipo</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">Solicitado por</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden sm:table-cell">Data</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {requests.map((req) => (
            <tr key={req.id} className="hover:bg-muted/20 transition-colors">
              <td className="px-4 py-3">
                <p className="font-medium">{req.entityName}</p>
                <p className="text-xs text-muted-foreground">{req.entityType}</p>
              </td>
              <td className="px-4 py-3">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_STYLE[req.type] ?? ""}`}>
                  {TYPE_LABELS[req.type] ?? req.type}
                </span>
              </td>
              <td className="px-4 py-3">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[req.status] ?? ""}`}>
                  {STATUS_LABELS[req.status] ?? req.status}
                </span>
              </td>
              <td className="px-4 py-3 hidden md:table-cell text-muted-foreground text-xs">
                {req.requester.name}
              </td>
              <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground text-xs whitespace-nowrap">
                {new Date(req.createdAt).toLocaleDateString("pt-BR")}
              </td>
              <td className="px-4 py-3 text-right">
                {req.status === "PENDENTE" && <ApproveRejectButtons requestId={req.id} />}
                {req.status === "CONCLUIDO" && req.type === "EXPORT" && (
                  <a
                    href={`/api/lgpd/export/${req.id}`}
                    download
                    className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors ml-auto w-fit"
                  >
                    <Download size={13} />
                    Baixar JSON
                  </a>
                )}
                {req.status === "CONCLUIDO" && req.type === "DELETE" && (
                  <span className="text-xs text-muted-foreground">
                    Anonimizado em {req.processedAt ? new Date(req.processedAt).toLocaleDateString("pt-BR") : "—"}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

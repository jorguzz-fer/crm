"use client";

import { useRef, useState, useEffect, useTransition } from "react";
import { Bell, AlertCircle, CheckSquare, MapPin, X } from "lucide-react";
import Link from "next/link";
import { dismissFollowUpAlertAction } from "@/app/actions/ai";

export interface AlertNotif {
  id: string;
  type: "follow_up";
  leadId: string;
  leadName: string | null;
  message: string;
  daysStale: number;
}

export interface TaskNotif {
  id: string;
  type: "overdue_task";
  title: string;
  dueAt: string;            // ISO string (serialized from Date)
  leadId: string | null;
  opportunityId: string | null;
}

interface Props {
  alerts: AlertNotif[];
  overdueTasks: TaskNotif[];
}

export function NotificationDropdown({ alerts, overdueTasks }: Props) {
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();
  const panelRef = useRef<HTMLDivElement>(null);

  const visibleAlerts   = alerts.filter((a) => !dismissed.has(a.id));
  const totalCount      = visibleAlerts.length + overdueTasks.length;
  const allItems        = [
    ...visibleAlerts.map((a) => ({ ...a, _type: "alert" as const })),
    ...overdueTasks.map((t) => ({ ...t, _type: "task"  as const })),
  ];

  // Fecha ao clicar fora
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  function handleDismiss(alertId: string) {
    setDismissed((prev) => new Set([...prev, alertId]));
    startTransition(() => {
      dismissFollowUpAlertAction(alertId);
    });
  }

  return (
    <div className="relative" ref={panelRef}>
      {/* Botão sino */}
      <button
        onClick={() => setOpen((p) => !p)}
        aria-label="Notificações"
        className="relative rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
      >
        <Bell size={18} />
        {totalCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {totalCount > 9 ? "9+" : totalCount}
          </span>
        )}
      </button>

      {/* Painel */}
      {open && (
        <div className="absolute right-0 top-10 z-50 w-80 rounded-xl border border-border bg-card shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold">Notificações</h3>
            {totalCount > 0 && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                {totalCount}
              </span>
            )}
          </div>

          {/* Lista */}
          <div className="max-h-96 overflow-y-auto divide-y divide-border">
            {allItems.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                <Bell size={28} className="text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">Tudo em dia!</p>
              </div>
            ) : (
              allItems.map((item) => (
                <div key={`${item._type}-${item.id}`} className="flex items-start gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                  {/* Ícone */}
                  <div className={`mt-0.5 shrink-0 rounded-lg p-1.5 ${
                    item._type === "alert"
                      ? "bg-amber-100 text-amber-600"
                      : "bg-red-100 text-red-600"
                  }`}>
                    {item._type === "alert"
                      ? <AlertCircle size={13} />
                      : <CheckSquare size={13} />
                    }
                  </div>

                  <div className="flex-1 min-w-0">
                    {item._type === "alert" ? (
                      <>
                        <p className="text-xs font-medium leading-snug">
                          Lead sem contato há <strong>{item.daysStale} dias</strong>
                        </p>
                        {item.leadName && (
                          <Link
                            href={`/leads/${item.leadId}`}
                            onClick={() => setOpen(false)}
                            className="text-xs text-primary hover:underline"
                          >
                            {item.leadName}
                          </Link>
                        )}
                        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{item.message}</p>
                      </>
                    ) : (
                      <>
                        <p className="text-xs font-medium leading-snug line-clamp-1">
                          Tarefa vencida: <strong>{item.title}</strong>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Venceu em{" "}
                          {new Date(item.dueAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                        </p>
                        {(item.leadId || item.opportunityId) && (
                          <Link
                            href={item.leadId ? `/leads/${item.leadId}` : `/pipeline/${item.opportunityId}`}
                            onClick={() => setOpen(false)}
                            className="text-xs text-primary hover:underline"
                          >
                            Ver detalhe →
                          </Link>
                        )}
                      </>
                    )}
                  </div>

                  {/* Dismiss (apenas follow-up alerts) */}
                  {item._type === "alert" && (
                    <button
                      onClick={() => handleDismiss(item.id)}
                      title="Dispensar"
                      className="shrink-0 rounded p-1 text-muted-foreground/50 hover:bg-muted hover:text-muted-foreground transition-colors"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {allItems.length > 0 && (
            <div className="flex justify-between border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
              <Link
                href="/tarefas?status=atrasadas"
                onClick={() => setOpen(false)}
                className="hover:text-foreground"
              >
                Ver tarefas atrasadas →
              </Link>
              <Link
                href="/dashboard"
                onClick={() => setOpen(false)}
                className="hover:text-foreground"
              >
                Dashboard →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import { useTransition } from "react";
import Link from "next/link";
import { AlertCircle, X, Clock } from "lucide-react";
import { dismissFollowUpAlertAction } from "@/app/actions/ai";
import { useRouter } from "next/navigation";

interface Alert {
  id: string;
  leadId: string | null;
  leadName: string | null;
  message: string;
  daysStale: number | null;
}

interface Props {
  alerts: Alert[];
}

export function FollowUpAlerts({ alerts }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (alerts.length === 0) return null;

  function dismiss(alertId: string) {
    startTransition(async () => {
      await dismissFollowUpAlertAction(alertId);
      router.refresh();
    });
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-amber-200 px-4 py-3">
        <AlertCircle size={16} className="text-amber-600 shrink-0" />
        <span className="text-sm font-semibold text-amber-800">
          Acompanhamento necessário
        </span>
        <span className="ml-auto rounded-full bg-amber-200 px-2 py-0.5 text-xs font-medium text-amber-700">
          {alerts.length}
        </span>
      </div>

      {/* Alerts list */}
      <div className="divide-y divide-amber-100">
        {alerts.map((alert) => (
          <div key={alert.id} className="flex items-start gap-3 px-4 py-3">
            <Clock size={14} className="mt-0.5 shrink-0 text-amber-500" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-amber-900">{alert.message}</p>
              {alert.leadId && (
                <Link
                  href={`/leads/${alert.leadId}`}
                  className="text-xs text-amber-600 hover:underline"
                >
                  Ver lead →
                </Link>
              )}
            </div>
            <button
              onClick={() => dismiss(alert.id)}
              disabled={isPending}
              title="Dispensar"
              className="shrink-0 rounded p-0.5 text-amber-400 hover:bg-amber-200 hover:text-amber-700 disabled:opacity-40 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

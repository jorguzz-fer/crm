"use client";

import { useActionState } from "react";
import { Sparkles, Loader2, ChevronRight } from "lucide-react";
import type { AISummaryState } from "@/app/actions/ai";

const SENTIMENT_STYLE = {
  positivo: "text-green-600 bg-green-50",
  neutro:   "text-amber-600 bg-amber-50",
  negativo: "text-red-600 bg-red-50",
} as const;

interface Props {
  action: (prev: AISummaryState, formData: FormData) => Promise<AISummaryState>;
  fieldName: "leadId" | "opportunityId";
  entityId: string;
}

export function SummarizeButton({ action, fieldName, entityId }: Props) {
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <div className="space-y-3">
      <form action={formAction}>
        <input type="hidden" name={fieldName} value={entityId} />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-60 transition-colors"
        >
          {pending
            ? <Loader2 size={14} className="animate-spin" />
            : <Sparkles size={14} />
          }
          {pending ? "Gerando resumo..." : "Resumir com IA"}
        </button>
      </form>

      {state && "error" in state && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
          {state.error}
        </div>
      )}

      {state && "result" in state && (
        <div className="rounded-lg border border-violet-200 bg-violet-50 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-violet-600" />
              <span className="text-sm font-semibold text-violet-800">Resumo IA</span>
            </div>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${SENTIMENT_STYLE[state.result.sentiment]}`}>
              {state.result.sentiment}
            </span>
          </div>

          <p className="text-sm text-violet-900 leading-relaxed whitespace-pre-wrap">
            {state.result.summary}
          </p>

          {state.result.nextSteps.length > 0 && (
            <div className="space-y-1.5 pt-1 border-t border-violet-200">
              <p className="text-xs font-semibold text-violet-700 uppercase tracking-wide">Próximos passos</p>
              {state.result.nextSteps.map((step, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-violet-800">
                  <ChevronRight size={14} className="mt-0.5 shrink-0 text-violet-500" />
                  <span>{step}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

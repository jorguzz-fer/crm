"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, User, Calendar } from "lucide-react";
import Link from "next/link";

type Opportunity = {
  id: string;
  title: string;
  value: unknown;
  probability: number;
  expectedCloseAt: Date | null;
  assignee: { name: string } | null;
  lead: { name: string } | null;
};

export function OpportunityCard({
  opportunity,
  isDragging = false,
}: {
  opportunity: Opportunity;
  isDragging?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging: isSorting } =
    useSortable({ id: opportunity.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSorting ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group rounded-lg border border-border bg-card p-3 shadow-sm select-none cursor-default ${
        isDragging ? "shadow-lg rotate-1 ring-2 ring-primary/30" : ""
      }`}
    >
      <div className="flex items-start gap-2">
        <button
          {...attributes}
          {...listeners}
          className="mt-0.5 cursor-grab text-muted-foreground/40 hover:text-muted-foreground shrink-0 active:cursor-grabbing"
          tabIndex={-1}
        >
          <GripVertical size={14} />
        </button>

        <div className="flex-1 min-w-0 space-y-1.5">
          <Link
            href={`/pipeline/${opportunity.id}`}
            className="block text-sm font-medium truncate hover:text-primary"
          >
            {opportunity.title}
          </Link>

          {opportunity.lead && (
            <p className="text-xs text-muted-foreground truncate">{opportunity.lead.name}</p>
          )}

          <div className="flex items-center justify-between gap-2">
            {opportunity.value ? (
              <span className="text-xs font-semibold text-green-600">
                {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(opportunity.value))}
              </span>
            ) : (
              <span />
            )}

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {opportunity.expectedCloseAt && (
                <span className="flex items-center gap-1">
                  <Calendar size={11} />
                  {new Date(opportunity.expectedCloseAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                </span>
              )}
              {opportunity.assignee && (
                <span className="flex items-center gap-1">
                  <User size={11} />
                  {opportunity.assignee.name.split(" ")[0]}
                </span>
              )}
            </div>
          </div>

          {opportunity.probability > 0 && (
            <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary/60"
                style={{ width: `${opportunity.probability}%` }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

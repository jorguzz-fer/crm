"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { OpportunityCard } from "./OpportunityCard";

type Opportunity = {
  id: string;
  title: string;
  value: unknown;
  probability: number;
  expectedCloseAt: Date | null;
  assignee: { name: string } | null;
  lead: { name: string } | null;
};

type Stage = {
  id: string;
  name: string;
  color: string;
  opportunities: Opportunity[];
};

export function KanbanColumn({
  stage,
  opportunities,
}: {
  stage: Stage;
  opportunities: Opportunity[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });

  const totalValue = opportunities.reduce(
    (sum, o) => sum + (o.value ? Number(o.value) : 0),
    0
  );

  return (
    <div className="flex flex-col w-72 shrink-0" data-testid="stage-column">
      {/* Header da coluna */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: stage.color }} />
          <span className="text-sm font-semibold">{stage.name}</span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {opportunities.length}
          </span>
        </div>
        {totalValue > 0 && (
          <span className="text-xs text-muted-foreground">
            {new Intl.NumberFormat("pt-BR", { notation: "compact", currency: "BRL", style: "currency" }).format(totalValue)}
          </span>
        )}
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={`flex-1 min-h-24 rounded-lg border-2 border-dashed transition-colors space-y-2 p-2 ${
          isOver ? "border-primary/50 bg-primary/5" : "border-transparent bg-muted/30"
        }`}
      >
        <SortableContext
          items={opportunities.map((o) => o.id)}
          strategy={verticalListSortingStrategy}
        >
          {opportunities.map((opp) => (
            <OpportunityCard key={opp.id} opportunity={opp} />
          ))}
        </SortableContext>

        {opportunities.length === 0 && (
          <div className="h-16 flex items-center justify-center text-xs text-muted-foreground">
            Arraste aqui
          </div>
        )}
      </div>
    </div>
  );
}

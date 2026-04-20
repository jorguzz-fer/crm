"use client";

import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy } from "@dnd-kit/sortable";
import { useState, useOptimistic, useTransition } from "react";
import { moveOpportunityAction } from "@/app/actions/opportunities";
import { KanbanColumn } from "./KanbanColumn";
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
  order: number;
  opportunities: Opportunity[];
};

type Pipeline = {
  id: string;
  name: string;
  stages: Stage[];
};

export function KanbanBoard({ pipeline }: { pipeline: Pipeline }) {
  const [activeOpp, setActiveOpp] = useState<Opportunity | null>(null);
  const [, startTransition] = useTransition();

  // Optimistic state: mapa stageId → opportunities[]
  const [stageMap, setStageMap] = useOptimistic(
    Object.fromEntries(pipeline.stages.map((s) => [s.id, s.opportunities])) as Record<string, Opportunity[]>
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  function findStageOfOpp(oppId: string): string | undefined {
    return Object.entries(stageMap).find(([, opps]) =>
      opps.some((o) => o.id === oppId)
    )?.[0];
  }

  function onDragStart({ active }: DragStartEvent) {
    const stageId = findStageOfOpp(active.id as string);
    if (!stageId) return;
    const opp = stageMap[stageId]?.find((o) => o.id === active.id);
    setActiveOpp(opp ?? null);
  }

  function onDragOver({ active, over }: DragOverEvent) {
    if (!over) return;
    const fromStage = findStageOfOpp(active.id as string);
    // over pode ser um stageId ou um oppId
    const toStage = stageMap[over.id as string]
      ? (over.id as string)
      : findStageOfOpp(over.id as string);

    if (!fromStage || !toStage || fromStage === toStage) return;

    setStageMap((prev) => {
      const opp = prev[fromStage]?.find((o) => o.id === active.id);
      if (!opp) return prev;
      return {
        ...prev,
        [fromStage]: prev[fromStage].filter((o) => o.id !== active.id),
        [toStage]: [opp, ...prev[toStage]],
      };
    });
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    setActiveOpp(null);
    if (!over) return;

    const toStage = stageMap[over.id as string]
      ? (over.id as string)
      : findStageOfOpp(over.id as string);

    if (!toStage) return;

    startTransition(async () => {
      await moveOpportunityAction(active.id as string, toStage);
    });
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4 flex-1 min-h-0">
        <SortableContext
          items={pipeline.stages.map((s) => s.id)}
          strategy={horizontalListSortingStrategy}
        >
          {pipeline.stages.map((stage) => (
            <KanbanColumn
              key={stage.id}
              stage={stage}
              opportunities={stageMap[stage.id] ?? []}
            />
          ))}
        </SortableContext>
      </div>

      <DragOverlay>
        {activeOpp && <OpportunityCard opportunity={activeOpp} isDragging />}
      </DragOverlay>
    </DndContext>
  );
}

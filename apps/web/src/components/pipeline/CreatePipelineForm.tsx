"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@crm/ui/button";
import { Input } from "@crm/ui/input";
import { Label } from "@crm/ui/label";
import { Badge } from "@crm/ui/badge";
import { Plus, Trash2, Loader2, GripVertical } from "lucide-react";

interface Stage {
  name: string;
  color: string;
}

const PRESET_COLORS = [
  "#8b5cf6", // purple
  "#3b82f6", // blue
  "#06b6d4", // cyan
  "#10b981", // green
  "#f59e0b", // amber
  "#f97316", // orange
  "#ef4444", // red
  "#ec4899", // pink
];

const DEFAULT_STAGES: Stage[] = [
  { name: "Prospecção",   color: "#8b5cf6" },
  { name: "Qualificação", color: "#3b82f6" },
  { name: "Proposta",     color: "#f59e0b" },
  { name: "Negociação",   color: "#f97316" },
  { name: "Fechamento",   color: "#10b981" },
];

export function CreatePipelineForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("Pipeline Principal");
  const [stages, setStages] = useState<Stage[]>(DEFAULT_STAGES);
  const [error, setError] = useState<string | null>(null);

  function addStage() {
    const color = PRESET_COLORS[stages.length % PRESET_COLORS.length];
    setStages((prev) => [...prev, { name: `Etapa ${prev.length + 1}`, color }]);
  }

  function removeStage(idx: number) {
    if (stages.length <= 1) return;
    setStages((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateStage(idx: number, field: keyof Stage, value: string) {
    setStages((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s))
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Informe o nome do pipeline.");
      return;
    }
    if (stages.some((s) => !s.name.trim())) {
      setError("Todas as etapas precisam ter um nome.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/pipelines", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), stages }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data?.error?.message ?? "Erro ao criar pipeline.");
          return;
        }
        router.refresh();
      } catch {
        setError("Erro de conexão. Tente novamente.");
      }
    });
  }

  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
            <svg
              className="w-8 h-8 text-primary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0H3"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold">Criar seu primeiro pipeline</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Configure as etapas do seu funil de vendas
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Nome do pipeline */}
          <div className="space-y-1.5">
            <Label htmlFor="pipeline-name">Nome do pipeline</Label>
            <Input
              id="pipeline-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex.: Pipeline Principal"
              maxLength={100}
              disabled={isPending}
            />
          </div>

          {/* Etapas */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Etapas</Label>
              <span className="text-xs text-muted-foreground">{stages.length}/20</span>
            </div>

            <div className="space-y-2">
              {stages.map((stage, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 rounded-lg border bg-card p-2"
                >
                  <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />

                  {/* Color picker */}
                  <div className="relative shrink-0">
                    <input
                      type="color"
                      value={stage.color}
                      onChange={(e) => updateStage(idx, "color", e.target.value)}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      disabled={isPending}
                      title="Escolher cor"
                    />
                    <div
                      className="w-6 h-6 rounded-full border-2 border-white shadow"
                      style={{ backgroundColor: stage.color }}
                    />
                  </div>

                  <Input
                    value={stage.name}
                    onChange={(e) => updateStage(idx, "name", e.target.value)}
                    placeholder={`Etapa ${idx + 1}`}
                    maxLength={80}
                    className="flex-1 h-8 text-sm"
                    disabled={isPending}
                  />

                  <Badge variant="outline" className="text-xs shrink-0 tabular-nums">
                    {idx + 1}
                  </Badge>

                  <button
                    type="button"
                    onClick={() => removeStage(idx)}
                    disabled={stages.length <= 1 || isPending}
                    className="shrink-0 text-muted-foreground hover:text-destructive disabled:opacity-30 transition-colors"
                    title="Remover etapa"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            {stages.length < 20 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addStage}
                disabled={isPending}
                className="w-full"
              >
                <Plus className="w-4 h-4 mr-1" />
                Adicionar etapa
              </Button>
            )}
          </div>

          {/* Erro */}
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          {/* Submit */}
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Criando pipeline…
              </>
            ) : (
              "Criar pipeline"
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}

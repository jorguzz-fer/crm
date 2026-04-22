"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Loader2, GripVertical } from "lucide-react";

interface Stage {
  name: string;
  color: string;
}

const PRESET_COLORS = [
  "#8b5cf6",
  "#3b82f6",
  "#06b6d4",
  "#10b981",
  "#f59e0b",
  "#f97316",
  "#ef4444",
  "#ec4899",
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
          setError(
            typeof data?.error === "string"
              ? data.error
              : "Erro ao criar pipeline."
          );
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
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-100 dark:bg-indigo-900/30 mb-4">
            <svg
              className="w-8 h-8 text-indigo-600 dark:text-indigo-400"
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
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Criar seu primeiro pipeline
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
            Configure as etapas do seu funil de vendas
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Nome do pipeline */}
          <div className="space-y-1.5">
            <label
              htmlFor="pipeline-name"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Nome do pipeline
            </label>
            <input
              id="pipeline-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex.: Pipeline Principal"
              maxLength={100}
              disabled={isPending}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
            />
          </div>

          {/* Etapas */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Etapas
              </span>
              <span className="text-xs text-gray-400">{stages.length}/20</span>
            </div>

            <div className="space-y-2">
              {stages.map((stage, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-2"
                >
                  <GripVertical className="w-4 h-4 text-gray-400 shrink-0" />

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
                      className="w-6 h-6 rounded-full border-2 border-white shadow-sm"
                      style={{ backgroundColor: stage.color }}
                    />
                  </div>

                  <input
                    type="text"
                    value={stage.name}
                    onChange={(e) => updateStage(idx, "name", e.target.value)}
                    placeholder={`Etapa ${idx + 1}`}
                    maxLength={80}
                    disabled={isPending}
                    className="flex-1 rounded border border-gray-200 dark:border-gray-600 bg-transparent px-2 py-1 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
                  />

                  <span className="shrink-0 text-xs text-gray-400 tabular-nums w-5 text-center">
                    {idx + 1}
                  </span>

                  <button
                    type="button"
                    onClick={() => removeStage(idx)}
                    disabled={stages.length <= 1 || isPending}
                    className="shrink-0 text-gray-400 hover:text-red-500 disabled:opacity-30 transition-colors"
                    title="Remover etapa"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            {stages.length < 20 && (
              <button
                type="button"
                onClick={addStage}
                disabled={isPending}
                className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 py-2 text-sm text-gray-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors disabled:opacity-60"
              >
                <Plus className="w-4 h-4" />
                Adicionar etapa
              </button>
            )}
          </div>

          {/* Erro */}
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isPending}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white px-4 py-2.5 text-sm font-medium transition-colors"
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Criando pipeline…
              </>
            ) : (
              "Criar pipeline"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

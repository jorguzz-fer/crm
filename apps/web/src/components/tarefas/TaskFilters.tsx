"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Filter } from "lucide-react";

interface Props {
  users: { id: string; name: string }[];
  filterPriority: string;
  filterAssignedTo: string;
}

/**
 * Client Component responsável pelos selects de filtro de tarefas.
 * Separado do Server Component (page.tsx) porque event handlers (onChange)
 * não podem ser serializados em RSC — causam erro de renderização.
 */
export function TaskFilters({ users, filterPriority, filterAssignedTo }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function buildUrl(overrides: Record<string, string>) {
    const p = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(overrides)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    return `/tarefas?${p.toString()}`;
  }

  return (
    <>
      <Filter size={14} className="text-muted-foreground" />
      <select
        onChange={(e) => router.push(buildUrl({ priority: e.target.value }))}
        defaultValue={filterPriority}
        className="rounded-md border border-input bg-background px-2 py-1 text-xs focus-visible:outline-none"
      >
        <option value="">Todas prioridades</option>
        <option value="URGENTE">Urgente</option>
        <option value="ALTA">Alta</option>
        <option value="MEDIA">Média</option>
        <option value="BAIXA">Baixa</option>
      </select>
      <select
        onChange={(e) => router.push(buildUrl({ assignedTo: e.target.value }))}
        defaultValue={filterAssignedTo}
        className="rounded-md border border-input bg-background px-2 py-1 text-xs focus-visible:outline-none"
      >
        <option value="">Todos responsáveis</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
          </option>
        ))}
      </select>
    </>
  );
}

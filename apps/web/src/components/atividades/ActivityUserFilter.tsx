"use client";

import { useRouter, useSearchParams } from "next/navigation";

interface Props {
  users: { id: string; name: string }[];
  filterUserId: string;
}

/**
 * Client Component para o filtro de usuário na página de Atividades.
 * Separado do Server Component porque event handlers não podem ser
 * serializados em RSC.
 */
export function ActivityUserFilter({ users, filterUserId }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function buildUrl(overrides: Record<string, string>) {
    const p = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(overrides)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    return `/atividades?${p.toString()}`;
  }

  return (
    <select
      onChange={(e) => router.push(buildUrl({ userId: e.target.value, page: "1" }))}
      defaultValue={filterUserId}
      className="ml-auto rounded-md border border-input bg-background px-2 py-1 text-xs focus-visible:outline-none"
    >
      <option value="">Todos usuários</option>
      {users.map((u) => (
        <option key={u.id} value={u.id}>
          {u.name}
        </option>
      ))}
    </select>
  );
}

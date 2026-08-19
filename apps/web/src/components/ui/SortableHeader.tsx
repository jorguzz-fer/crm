import Link from "next/link";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  buildListHref,
  nextSort,
  type QueryValue,
  type SortDir,
  type SortState,
} from "@/lib/listParams";

interface SortableHeaderProps<F extends string> {
  label: string;
  field: F;
  /** Ordenação atual da listagem. */
  sort: SortState<F>;
  basePath: string;
  /** Filtros ativos preservados no link (q, status...). `page` é descartado. */
  params?: Record<string, QueryValue>;
  /** Direção inicial ao clicar neste campo pela primeira vez. */
  defaultDir?: SortDir;
  className?: string;
}

export function SortableHeader<F extends string>({
  label,
  field,
  sort,
  basePath,
  params = {},
  defaultDir = "asc",
  className,
}: SortableHeaderProps<F>) {
  const active = sort.field === field;
  const target = nextSort(sort, field, { [field]: defaultDir } as Partial<
    Record<F, SortDir>
  >);

  // Ordenar sempre volta para a primeira página
  const href = buildListHref(basePath, {
    ...params,
    page: undefined,
    sort: target.field,
    dir: target.dir,
  });

  const Icon = !active ? ChevronsUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;

  return (
    <th
      scope="col"
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
      className={cn("px-4 py-3 text-left font-medium text-muted-foreground", className)}
    >
      <Link
        href={href}
        className={cn(
          "inline-flex items-center gap-1 rounded-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          active && "text-foreground"
        )}
      >
        {label}
        <Icon size={13} className={cn(!active && "opacity-40")} aria-hidden />
      </Link>
    </th>
  );
}

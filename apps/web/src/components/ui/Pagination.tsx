import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buildListHref, pageRange, type QueryValue } from "@/lib/listParams";

interface PaginationProps {
  basePath: string;
  page: number;
  totalPages: number;
  total: number;
  perPage: number;
  /** Filtros ativos preservados nos links (q, status, sort...). */
  params?: Record<string, QueryValue>;
  /** Nome dos registros no resumo — ex.: "lead" → "de 137 leads". */
  itemLabel?: string;
}

export function Pagination({
  basePath,
  page,
  totalPages,
  total,
  perPage,
  params = {},
  itemLabel,
}: PaginationProps) {
  if (total === 0) return null;

  const { from, to } = pageRange(page, perPage, total);
  const suffix = itemLabel ? ` ${itemLabel}${total !== 1 ? "s" : ""}` : "";

  return (
    <nav
      aria-label="Paginação"
      className="flex flex-wrap items-center justify-between gap-3 text-sm"
    >
      <p className="text-muted-foreground">
        Mostrando {from}–{to} de {total}
        {suffix}
      </p>

      {totalPages > 1 && (
        <div className="flex items-center gap-2">
          {page > 1 ? (
            <Link
              href={buildListHref(basePath, { ...params, page: page - 1 })}
              rel="prev"
              className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1 hover:bg-accent"
            >
              <ChevronLeft size={14} />
              Anterior
            </Link>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1 text-muted-foreground/50">
              <ChevronLeft size={14} />
              Anterior
            </span>
          )}

          <span className="text-muted-foreground">
            Página {page} de {totalPages}
          </span>

          {page < totalPages ? (
            <Link
              href={buildListHref(basePath, { ...params, page: page + 1 })}
              rel="next"
              className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1 hover:bg-accent"
            >
              Próxima
              <ChevronRight size={14} />
            </Link>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1 text-muted-foreground/50">
              Próxima
              <ChevronRight size={14} />
            </span>
          )}
        </div>
      )}
    </nav>
  );
}

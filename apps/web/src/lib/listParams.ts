/**
 * Helpers puros para listagens paginadas/filtráveis (leads, contatos, empresas...).
 *
 * Centraliza a montagem de URLs e o parse de `searchParams` para que as páginas
 * não repitem a lógica — e para que ela seja testável sem Next.js/Prisma.
 */

export type SortDir = "asc" | "desc";

export interface SortState<F extends string = string> {
  field: F;
  dir: SortDir;
}

export type QueryValue = string | number | null | undefined;

/**
 * Monta a URL de uma listagem preservando os filtros ativos.
 *
 * Valores vazios (`""`, `null`, `undefined`) são omitidos, e todos os valores
 * são codificados — busca com `&`, `#` ou espaço não quebra mais o link.
 */
export function buildListHref(
  basePath: string,
  params: Record<string, QueryValue> = {}
): string {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined) continue;
    const str = String(value).trim();
    if (str === "") continue;
    search.set(key, str);
  }

  const qs = search.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

/** Lê `?page=` garantindo um inteiro >= 1 (valores inválidos viram 1). */
export function parsePage(raw: string | undefined): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.floor(n));
}

/** Total de páginas para `total` registros (mínimo 1, mesmo com lista vazia). */
export function totalPages(total: number, perPage: number): number {
  if (perPage <= 0) return 1;
  return Math.max(1, Math.ceil(Math.max(0, total) / perPage));
}

/**
 * Lê `?sort=`/`?dir=` aceitando apenas campos da whitelist — evita que um
 * parâmetro arbitrário da URL vire `orderBy` no Prisma.
 *
 * Campo inválido cai no `fallback` inteiro. Campo válido sem direção usa a
 * direção padrão daquele campo (`defaultDirs`), ou `asc`.
 */
export function parseSort<F extends string>(
  rawField: string | undefined,
  rawDir: string | undefined,
  allowed: readonly F[],
  fallback: SortState<F>,
  defaultDirs: Partial<Record<F, SortDir>> = {}
): SortState<F> {
  const field = allowed.includes(rawField as F) ? (rawField as F) : null;
  if (!field) return fallback;

  const dir: SortDir =
    rawDir === "asc" || rawDir === "desc" ? rawDir : defaultDirs[field] ?? "asc";

  return { field, dir };
}

/**
 * Estado de ordenação ao clicar num cabeçalho: mesmo campo inverte a direção,
 * campo novo começa pela direção padrão dele.
 */
export function nextSort<F extends string>(
  current: SortState<F>,
  field: F,
  defaultDirs: Partial<Record<F, SortDir>> = {}
): SortState<F> {
  if (current.field === field) {
    return { field, dir: current.dir === "asc" ? "desc" : "asc" };
  }
  return { field, dir: defaultDirs[field] ?? "asc" };
}

/** Intervalo exibido na página atual — "Mostrando 21–40 de 137". */
export function pageRange(
  page: number,
  perPage: number,
  total: number
): { from: number; to: number } {
  if (total <= 0 || perPage <= 0) return { from: 0, to: 0 };
  const from = Math.min((Math.max(1, page) - 1) * perPage + 1, total);
  const to = Math.min(Math.max(1, page) * perPage, total);
  return { from, to };
}

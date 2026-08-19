import { auth } from "@/lib/auth";
import { prisma } from "@crm/db";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Plus, Search, Building2, Users } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { SortableHeader } from "@/components/ui/SortableHeader";
import {
  buildListHref,
  parsePage,
  parseSort,
  totalPages as calcTotalPages,
  type SortDir,
} from "@/lib/listParams";

export const metadata: Metadata = { title: "Empresas" };

const SORT_FIELDS = ["name", "industry", "contacts", "opportunities", "createdAt"] as const;
type SortField = (typeof SORT_FIELDS)[number];

const SORT_DEFAULT_DIR: Partial<Record<SortField, SortDir>> = {
  contacts: "desc",
  opportunities: "desc",
  createdAt: "desc",
};

interface Props {
  searchParams: Promise<{ q?: string; sort?: string; dir?: string; page?: string }>;
}

export default async function EmpresasPage({ searchParams }: Props) {
  const session = await auth();
  const params = await searchParams;

  const q = params.q?.trim() || "";
  const sort = parseSort<SortField>(
    params.sort,
    params.dir,
    SORT_FIELDS,
    { field: "name", dir: "asc" },
    SORT_DEFAULT_DIR
  );
  const page = parsePage(params.page);
  const perPage = 20;

  const where = {
    tenantId: session!.user.tenantId,
    ...(q && {
      OR: [
        { name: { contains: q, mode: "insensitive" as const } },
        { cnpj: { contains: q, mode: "insensitive" as const } },
        { email: { contains: q, mode: "insensitive" as const } },
        { industry: { contains: q, mode: "insensitive" as const } },
      ],
    }),
  };

  const orderBy =
    sort.field === "contacts"
      ? { contacts: { _count: sort.dir } }
      : sort.field === "opportunities"
        ? { opportunities: { _count: sort.dir } }
        : sort.field === "industry"
          ? // Empresas sem segmento ficam no fim
            { industry: { sort: sort.dir, nulls: "last" as const } }
          : sort.field === "createdAt"
            ? { createdAt: sort.dir }
            : { name: sort.dir };

  const [companies, total] = await Promise.all([
    prisma.company.findMany({
      where,
      include: {
        _count: { select: { contacts: true, opportunities: true } },
      },
      orderBy,
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.company.count({ where }),
  ]);

  const filterParams = { q };
  const listParams = { q, sort: sort.field, dir: sort.dir };
  const totalPages = calcTotalPages(total, perPage);

  // Filtro que reduz o total não pode deixar o usuário numa página vazia
  if (page > totalPages) {
    redirect(
      buildListHref("/empresas", {
        ...listParams,
        page: totalPages > 1 ? totalPages : undefined,
      })
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Empresas</h1>
          <p className="text-sm text-muted-foreground">{total} empresa{total !== 1 ? "s" : ""}</p>
        </div>
        <Link
          href="/empresas/new"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus size={16} />
          Nova empresa
        </Link>
      </div>

      {/* Filtros — a ordenação atual é preservada; a página volta para a 1ª */}
      <form method="GET" className="flex flex-wrap gap-3">
        <input type="hidden" name="sort" value={sort.field} />
        <input type="hidden" name="dir" value={sort.dir} />
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar por nome, CNPJ, segmento..."
            className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <button type="submit" className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent">
          Filtrar
        </button>
        {q && (
          <Link
            href={buildListHref("/empresas", { sort: sort.field, dir: sort.dir })}
            className="rounded-md px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
          >
            Limpar
          </Link>
        )}
      </form>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {companies.length === 0 ? (
          q ? (
            <EmptyState
              icon={Building2}
              title="Nenhuma empresa encontrada com esses filtros."
              description="Ajuste a busca ou limpe os filtros para ver todas as empresas."
              action={{ href: "/empresas", label: "Limpar filtros" }}
            />
          ) : (
            <EmptyState
              icon={Building2}
              title="Nenhuma empresa ainda."
              description="Cadastre a primeira empresa para organizar seus contatos."
              action={{ href: "/empresas/new", label: "Criar primeira empresa" }}
            />
          )
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40">
                <tr>
                  <SortableHeader label="Nome" field="name" sort={sort} basePath="/empresas" params={filterParams} />
                  <th scope="col" className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">Contato</th>
                  <SortableHeader
                    label="Segmento"
                    field="industry"
                    sort={sort}
                    basePath="/empresas"
                    params={filterParams}
                    className="hidden lg:table-cell"
                  />
                  <SortableHeader
                    label="Contatos"
                    field="contacts"
                    sort={sort}
                    basePath="/empresas"
                    params={filterParams}
                    defaultDir="desc"
                    className="hidden sm:table-cell"
                  />
                  <SortableHeader
                    label="Oportunidades"
                    field="opportunities"
                    sort={sort}
                    basePath="/empresas"
                    params={filterParams}
                    defaultDir="desc"
                    className="hidden lg:table-cell"
                  />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {companies.map((company) => (
                  <tr key={company.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/empresas/${company.id}`} className="font-medium hover:text-primary flex items-center gap-2">
                        <Building2 size={14} className="text-muted-foreground shrink-0" />
                        {company.name}
                      </Link>
                      {company.cnpj && <p className="text-xs text-muted-foreground mt-0.5">{company.cnpj}</p>}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">
                      {company.email && <p>{company.email}</p>}
                      {company.phone && <p>{company.phone}</p>}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">
                      {company.industry ?? "—"}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Users size={13} />
                        {company._count.contacts}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">
                      {company._count.opportunities}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Pagination
        basePath="/empresas"
        page={page}
        totalPages={totalPages}
        total={total}
        perPage={perPage}
        params={listParams}
        itemLabel="empresa"
      />
    </div>
  );
}

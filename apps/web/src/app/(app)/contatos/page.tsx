import { auth } from "@/lib/auth";
import { prisma } from "@crm/db";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Plus, Search, Contact as ContactIcon } from "lucide-react";
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

export const metadata: Metadata = { title: "Contatos" };

const SORT_FIELDS = ["name", "role", "createdAt"] as const;
type SortField = (typeof SORT_FIELDS)[number];

const SORT_DEFAULT_DIR: Partial<Record<SortField, SortDir>> = { createdAt: "desc" };

interface Props {
  searchParams: Promise<{
    q?: string;
    companyId?: string;
    sort?: string;
    dir?: string;
    page?: string;
  }>;
}

export default async function ContatosPage({ searchParams }: Props) {
  const session = await auth();
  const params = await searchParams;

  const q = params.q?.trim() || "";
  const companyId = params.companyId || "";
  const sort = parseSort<SortField>(
    params.sort,
    params.dir,
    SORT_FIELDS,
    { field: "name", dir: "asc" },
    SORT_DEFAULT_DIR
  );
  const page = parsePage(params.page);
  const perPage = 20;
  const tenantId = session!.user.tenantId;

  const where = {
    tenantId,
    ...(companyId && { companyId }),
    ...(q && {
      OR: [
        { name: { contains: q, mode: "insensitive" as const } },
        { email: { contains: q, mode: "insensitive" as const } },
        { role: { contains: q, mode: "insensitive" as const } },
      ],
    }),
  };

  const orderBy =
    sort.field === "role"
      ? // Contatos sem cargo ficam no fim
        { role: { sort: sort.dir, nulls: "last" as const } }
      : sort.field === "createdAt"
        ? { createdAt: sort.dir }
        : { name: sort.dir };

  const [contacts, total, companies] = await Promise.all([
    prisma.contact.findMany({
      where,
      include: { company: { select: { id: true, name: true } } },
      orderBy,
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.contact.count({ where }),
    prisma.company.findMany({
      where: { tenantId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 100,
    }),
  ]);

  const hasFilters = Boolean(q || companyId);
  const filterParams = { q, companyId };
  const listParams = { ...filterParams, sort: sort.field, dir: sort.dir };
  const totalPages = calcTotalPages(total, perPage);

  // Filtro que reduz o total não pode deixar o usuário numa página vazia
  if (page > totalPages) {
    redirect(
      buildListHref("/contatos", {
        ...listParams,
        page: totalPages > 1 ? totalPages : undefined,
      })
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Contatos</h1>
          <p className="text-sm text-muted-foreground">{total} contato{total !== 1 ? "s" : ""}</p>
        </div>
        <Link
          href="/contatos/new"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus size={16} />
          Novo contato
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
            placeholder="Buscar por nome, e-mail, cargo..."
            className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        {companies.length > 0 && (
          <select
            name="companyId"
            defaultValue={companyId}
            aria-label="Filtrar por empresa"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Todas as empresas</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
        <button type="submit" className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent">
          Filtrar
        </button>
        {hasFilters && (
          <Link
            href={buildListHref("/contatos", { sort: sort.field, dir: sort.dir })}
            className="rounded-md px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
          >
            Limpar
          </Link>
        )}
      </form>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {contacts.length === 0 ? (
          hasFilters ? (
            <EmptyState
              icon={ContactIcon}
              title="Nenhum contato encontrado com esses filtros."
              description="Ajuste a busca ou limpe os filtros para ver todos os contatos."
              action={{ href: "/contatos", label: "Limpar filtros" }}
            />
          ) : (
            <EmptyState
              icon={ContactIcon}
              title="Nenhum contato ainda."
              description="Cadastre o primeiro contato para começar."
              action={{ href: "/contatos/new", label: "Criar primeiro contato" }}
            />
          )
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40">
                <tr>
                  <SortableHeader label="Nome" field="name" sort={sort} basePath="/contatos" params={filterParams} />
                  <th scope="col" className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">Contato</th>
                  <SortableHeader
                    label="Cargo"
                    field="role"
                    sort={sort}
                    basePath="/contatos"
                    params={filterParams}
                    className="hidden lg:table-cell"
                  />
                  <th scope="col" className="px-4 py-3 text-left font-medium text-muted-foreground hidden sm:table-cell">Empresa</th>
                  <SortableHeader
                    label="Criado em"
                    field="createdAt"
                    sort={sort}
                    basePath="/contatos"
                    params={filterParams}
                    defaultDir="desc"
                    className="hidden xl:table-cell"
                  />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {contacts.map((contact) => (
                  <tr key={contact.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/contatos/${contact.id}`} className="font-medium hover:text-primary">
                        {contact.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">
                      {contact.email && <p>{contact.email}</p>}
                      {contact.phone && <p>{contact.phone}</p>}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">
                      {contact.role ?? "—"}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      {contact.company ? (
                        <Link href={`/empresas/${contact.company.id}`} className="text-muted-foreground hover:text-primary">
                          {contact.company.name}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden xl:table-cell text-muted-foreground">
                      {contact.createdAt.toLocaleDateString("pt-BR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Pagination
        basePath="/contatos"
        page={page}
        totalPages={totalPages}
        total={total}
        perPage={perPage}
        params={listParams}
        itemLabel="contato"
      />
    </div>
  );
}

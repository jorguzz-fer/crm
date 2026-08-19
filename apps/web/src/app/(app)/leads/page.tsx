import { auth } from "@/lib/auth";
import { prisma } from "@crm/db";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Plus, Search, Download, Users } from "lucide-react";
import { LeadStatusBadge } from "@/components/leads/LeadStatusBadge";
import { ScoreBadge } from "@/components/leads/ScoreBadge";
import { ImportLeadsModal } from "@/components/leads/ImportLeadsModal";
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

export const metadata: Metadata = { title: "Leads" };

const STATUS_LABELS: Record<string, string> = {
  NOVO: "Novo",
  EM_CONTATO: "Em contato",
  QUALIFICADO: "Qualificado",
  DESQUALIFICADO: "Desqualificado",
  CONVERTIDO: "Convertido",
};

const SOURCE_LABELS: Record<string, string> = {
  WEBSITE: "Website",
  WHATSAPP: "WhatsApp",
  INSTAGRAM: "Instagram",
  FACEBOOK: "Facebook",
  INDICACAO: "Indicação",
  EVENTO: "Evento",
  COLD_OUTREACH: "Prospecção",
  OUTRO: "Outro",
};

const SORT_FIELDS = ["name", "status", "score", "createdAt"] as const;
type SortField = (typeof SORT_FIELDS)[number];

const SORT_DEFAULT_DIR: Partial<Record<SortField, SortDir>> = {
  score: "desc",
  createdAt: "desc",
};

/** Sem responsável — filtro `assignedTo=none`. */
const UNASSIGNED = "none";

interface Props {
  searchParams: Promise<{
    q?: string;
    status?: string;
    source?: string;
    assignedTo?: string;
    sort?: string;
    dir?: string;
    page?: string;
  }>;
}

export default async function LeadsPage({ searchParams }: Props) {
  const session = await auth();
  const params = await searchParams;
  const tenantId = session!.user.tenantId;

  const q = params.q?.trim() || "";
  const status = params.status && STATUS_LABELS[params.status] ? params.status : "";
  const source = params.source && SOURCE_LABELS[params.source] ? params.source : "";
  const assignedTo = params.assignedTo || "";
  const sort = parseSort<SortField>(
    params.sort,
    params.dir,
    SORT_FIELDS,
    { field: "createdAt", dir: "desc" },
    SORT_DEFAULT_DIR
  );
  const perPage = 20;

  const where = {
    tenantId,
    ...(status && { status: status as never }),
    ...(source && { source: source as never }),
    ...(assignedTo && {
      assignedTo: assignedTo === UNASSIGNED ? null : assignedTo,
    }),
    ...(q && {
      OR: [
        { name: { contains: q, mode: "insensitive" as const } },
        { email: { contains: q, mode: "insensitive" as const } },
        { company: { contains: q, mode: "insensitive" as const } },
        { phone: { contains: q, mode: "insensitive" as const } },
      ],
    }),
  };

  const orderBy =
    sort.field === "name"
      ? { name: sort.dir }
      : sort.field === "status"
        ? { status: sort.dir }
        : sort.field === "score"
          ? // Leads sem score ficam sempre no fim, independente da direção
            { score: { sort: sort.dir, nulls: "last" as const } }
          : { createdAt: sort.dir };

  const page = parsePage(params.page);

  const [leads, total, users] = await Promise.all([
    prisma.lead.findMany({
      where,
      include: { assignee: { select: { name: true } } },
      orderBy,
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.lead.count({ where }),
    prisma.user.findMany({
      where: { tenantId, active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const hasFilters = Boolean(q || status || source || assignedTo);
  const filterParams = { q, status, source, assignedTo };
  const listParams = { ...filterParams, sort: sort.field, dir: sort.dir };
  const totalPages = calcTotalPages(total, perPage);

  // Filtro que reduz o total não pode deixar o usuário numa página vazia
  if (page > totalPages) {
    redirect(
      buildListHref("/leads", {
        ...listParams,
        page: totalPages > 1 ? totalPages : undefined,
      })
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Leads</h1>
          <p className="text-sm text-muted-foreground">{total} lead{total !== 1 ? "s" : ""} encontrado{total !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Exportar CSV (passa filtros ativos) */}
          <a
            href={buildListHref("/api/leads/export", filterParams)}
            download
            className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            <Download size={15} />
            Exportar CSV
          </a>
          {/* Importar em lote */}
          <ImportLeadsModal />
          {/* Novo lead */}
          <Link
            href="/leads/new"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus size={16} />
            Novo lead
          </Link>
        </div>
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
            placeholder="Buscar por nome, email, empresa..."
            className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <select
          name="status"
          defaultValue={status}
          aria-label="Filtrar por status"
          className="rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">Todos os status</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <select
          name="source"
          defaultValue={source}
          aria-label="Filtrar por origem"
          className="rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">Todas as origens</option>
          {Object.entries(SOURCE_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <select
          name="assignedTo"
          defaultValue={assignedTo}
          aria-label="Filtrar por responsável"
          className="rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">Todos os responsáveis</option>
          <option value={UNASSIGNED}>Sem responsável</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
        >
          Filtrar
        </button>
        {hasFilters && (
          <Link
            href={buildListHref("/leads", { sort: sort.field, dir: sort.dir })}
            className="rounded-md px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
          >
            Limpar
          </Link>
        )}
      </form>

      {/* Tabela */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {leads.length === 0 ? (
          hasFilters ? (
            <EmptyState
              icon={Users}
              title="Nenhum lead encontrado com esses filtros."
              description="Ajuste a busca ou limpe os filtros para ver todos os leads."
              action={{ href: "/leads", label: "Limpar filtros" }}
            />
          ) : (
            <EmptyState
              icon={Users}
              title="Nenhum lead ainda."
              description="Cadastre o primeiro lead ou importe uma lista em CSV."
              action={{ href: "/leads/new", label: "Criar primeiro lead" }}
            />
          )
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40">
                <tr>
                  <SortableHeader label="Nome" field="name" sort={sort} basePath="/leads" params={filterParams} />
                  <th scope="col" className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">Contato</th>
                  <th scope="col" className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">Origem</th>
                  <SortableHeader label="Status" field="status" sort={sort} basePath="/leads" params={filterParams} />
                  <SortableHeader
                    label="Temp."
                    field="score"
                    sort={sort}
                    basePath="/leads"
                    params={filterParams}
                    defaultDir="desc"
                    className="hidden sm:table-cell"
                  />
                  <th scope="col" className="px-4 py-3 text-left font-medium text-muted-foreground hidden xl:table-cell">Responsável</th>
                  <SortableHeader
                    label="Criado em"
                    field="createdAt"
                    sort={sort}
                    basePath="/leads"
                    params={filterParams}
                    defaultDir="desc"
                    className="hidden lg:table-cell"
                  />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/leads/${lead.id}`} className="font-medium hover:text-primary">
                        {lead.name}
                      </Link>
                      {lead.company && (
                        <p className="text-xs text-muted-foreground">{lead.company}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">
                      {lead.email && <p>{lead.email}</p>}
                      {lead.phone && <p>{lead.phone}</p>}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">
                      {SOURCE_LABELS[lead.source] ?? lead.source}
                    </td>
                    <td className="px-4 py-3">
                      <LeadStatusBadge status={lead.status} />
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <ScoreBadge score={lead.score} label={lead.scoreLabel} />
                    </td>
                    <td className="px-4 py-3 hidden xl:table-cell text-muted-foreground">
                      {lead.assignee?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">
                      {lead.createdAt.toLocaleDateString("pt-BR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Pagination
        basePath="/leads"
        page={page}
        totalPages={totalPages}
        total={total}
        perPage={perPage}
        params={listParams}
        itemLabel="lead"
      />
    </div>
  );
}

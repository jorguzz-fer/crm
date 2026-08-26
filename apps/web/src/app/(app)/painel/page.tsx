import { prisma } from "@crm/db";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { Building2, Search, Users, UserCircle2 } from "lucide-react";
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
import { getPlatformAdmin } from "@/lib/platformAuth";
import { isPlan, PLAN_LABELS, PLANS } from "@/lib/platform";
import { NewTenantForm } from "./NewTenantForm";
import { TenantRowActions } from "./TenantRowActions";

export const metadata: Metadata = { title: "Painel da plataforma" };

const SORT_FIELDS = ["name", "slug", "plan", "users", "leads", "createdAt"] as const;
type SortField = (typeof SORT_FIELDS)[number];

const SORT_DEFAULT_DIR: Partial<Record<SortField, SortDir>> = {
  users: "desc",
  leads: "desc",
  createdAt: "desc",
};

interface Props {
  searchParams: Promise<{
    q?: string;
    plan?: string;
    status?: string;
    sort?: string;
    dir?: string;
    page?: string;
  }>;
}

export default async function PainelPage({ searchParams }: Props) {
  // 404 em vez de 403: quem não é admin da plataforma não descobre que a tela existe
  const admin = await getPlatformAdmin();
  if (!admin) notFound();

  const params = await searchParams;

  const q = params.q?.trim() || "";
  const plan = params.plan && isPlan(params.plan) ? params.plan : "";
  const status = params.status === "ativos" || params.status === "suspensos" ? params.status : "";
  const sort = parseSort<SortField>(
    params.sort,
    params.dir,
    SORT_FIELDS,
    { field: "createdAt", dir: "desc" },
    SORT_DEFAULT_DIR
  );
  const page = parsePage(params.page);
  const perPage = 20;

  const where = {
    ...(plan && { plan }),
    ...(status && { active: status === "ativos" }),
    ...(q && {
      OR: [
        { name: { contains: q, mode: "insensitive" as const } },
        { slug: { contains: q, mode: "insensitive" as const } },
      ],
    }),
  };

  const orderBy =
    sort.field === "users"
      ? { users: { _count: sort.dir } }
      : sort.field === "leads"
        ? { leads: { _count: sort.dir } }
        : sort.field === "name"
          ? { name: sort.dir }
          : sort.field === "slug"
            ? { slug: sort.dir }
            : sort.field === "plan"
              ? { plan: sort.dir }
              : { createdAt: sort.dir };

  const [tenants, total, stats] = await Promise.all([
    prisma.tenant.findMany({
      where,
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        active: true,
        createdAt: true,
        _count: { select: { users: true, leads: true } },
      },
      orderBy,
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.tenant.count({ where }),
    prisma.tenant.groupBy({ by: ["active"], _count: { _all: true } }),
  ]);

  const hasFilters = Boolean(q || plan || status);
  const filterParams = { q, plan, status };
  const listParams = { ...filterParams, sort: sort.field, dir: sort.dir };
  const totalPages = calcTotalPages(total, perPage);

  if (page > totalPages) {
    redirect(
      buildListHref("/painel", {
        ...listParams,
        page: totalPages > 1 ? totalPages : undefined,
      })
    );
  }

  const activeCount = stats.find((s) => s.active)?._count._all ?? 0;
  const suspendedCount = stats.find((s) => !s.active)?._count._all ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Painel da plataforma</h1>
        <p className="text-sm text-muted-foreground">
          {activeCount} cliente{activeCount !== 1 ? "s" : ""} ativo{activeCount !== 1 ? "s" : ""}
          {suspendedCount > 0 && ` · ${suspendedCount} suspenso${suspendedCount !== 1 ? "s" : ""}`}
        </p>
      </div>

      <NewTenantForm />

      <form method="GET" className="flex flex-wrap gap-3">
        <input type="hidden" name="sort" value={sort.field} />
        <input type="hidden" name="dir" value={sort.dir} />
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar por nome ou slug..."
            className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <select
          name="plan"
          defaultValue={plan}
          aria-label="Filtrar por plano"
          className="rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">Todos os planos</option>
          {PLANS.map((p) => (
            <option key={p} value={p}>{PLAN_LABELS[p]}</option>
          ))}
        </select>
        <select
          name="status"
          defaultValue={status}
          aria-label="Filtrar por status"
          className="rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">Ativos e suspensos</option>
          <option value="ativos">Só ativos</option>
          <option value="suspensos">Só suspensos</option>
        </select>
        <button type="submit" className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent">
          Filtrar
        </button>
        {hasFilters && (
          <a
            href={buildListHref("/painel", { sort: sort.field, dir: sort.dir })}
            className="rounded-md px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
          >
            Limpar
          </a>
        )}
      </form>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {tenants.length === 0 ? (
          hasFilters ? (
            <EmptyState
              icon={Building2}
              title="Nenhum cliente encontrado com esses filtros."
              action={{ href: "/painel", label: "Limpar filtros" }}
            />
          ) : (
            <EmptyState
              icon={Building2}
              title="Nenhum cliente ainda."
              description="Use o formulário acima para cadastrar o primeiro tenant."
            />
          )
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40">
                <tr>
                  <SortableHeader label="Cliente" field="name" sort={sort} basePath="/painel" params={filterParams} />
                  <SortableHeader label="Slug" field="slug" sort={sort} basePath="/painel" params={filterParams} className="hidden md:table-cell" />
                  <SortableHeader label="Plano" field="plan" sort={sort} basePath="/painel" params={filterParams} />
                  <SortableHeader label="Usuários" field="users" sort={sort} basePath="/painel" params={filterParams} defaultDir="desc" className="hidden sm:table-cell" />
                  <SortableHeader label="Leads" field="leads" sort={sort} basePath="/painel" params={filterParams} defaultDir="desc" className="hidden sm:table-cell" />
                  <SortableHeader label="Criado em" field="createdAt" sort={sort} basePath="/painel" params={filterParams} defaultDir="desc" className="hidden lg:table-cell" />
                  <th scope="col" className="px-4 py-3 text-right font-medium text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {tenants.map((tenant) => (
                  <tr key={tenant.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{tenant.name}</span>
                        {!tenant.active && (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700">
                            Suspenso
                          </span>
                        )}
                        {tenant.id === admin.tenantId && (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                            Seu tenant
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground md:hidden">{tenant.slug}</p>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {/* Porta do cliente — link para entregar/bookmarkar */}
                      <Link
                        href={`/${tenant.slug}`}
                        title={`Abrir a porta de entrada de ${tenant.name}`}
                        className="font-mono text-xs text-muted-foreground hover:text-primary"
                      >
                        /{tenant.slug}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      {isPlan(tenant.plan) ? PLAN_LABELS[tenant.plan] : tenant.plan}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <UserCircle2 size={13} />
                        {tenant._count.users}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users size={13} />
                        {tenant._count.leads}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">
                      {tenant.createdAt.toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-4 py-3">
                      <TenantRowActions
                        tenantId={tenant.id}
                        tenantName={tenant.name}
                        plan={tenant.plan}
                        active={tenant.active}
                        isOwnTenant={tenant.id === admin.tenantId}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Pagination
        basePath="/painel"
        page={page}
        totalPages={totalPages}
        total={total}
        perPage={perPage}
        params={listParams}
        itemLabel="cliente"
      />
    </div>
  );
}

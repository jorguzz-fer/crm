import { auth } from "@/lib/auth";
import { prisma } from "@crm/db";
import Link from "next/link";
import type { Metadata } from "next";
import { Plus, Search, Download } from "lucide-react";
import { LeadStatusBadge } from "@/components/leads/LeadStatusBadge";
import { ScoreBadge } from "@/components/leads/ScoreBadge";
import { ImportLeadsModal } from "@/components/leads/ImportLeadsModal";

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

interface Props {
  searchParams: Promise<{ q?: string; status?: string; page?: string; exportar?: string }>;
}

export default async function LeadsPage({ searchParams }: Props) {
  const session = await auth();
  const params = await searchParams;

  const q = params.q?.trim() || "";
  const status = params.status || "";
  const page = Math.max(1, Number(params.page) || 1);
  const perPage = 20;

  const VALID_STATUSES = new Set(["NOVO", "EM_CONTATO", "QUALIFICADO", "DESQUALIFICADO", "CONVERTIDO"]);

  const where = {
    tenantId: session!.user.tenantId,
    ...(status && VALID_STATUSES.has(status) && { status: status as never }),
    ...(q && {
      OR: [
        { name: { contains: q, mode: "insensitive" as const } },
        { email: { contains: q, mode: "insensitive" as const } },
        { company: { contains: q, mode: "insensitive" as const } },
        { phone: { contains: q, mode: "insensitive" as const } },
      ],
    }),
  };

  const [leads, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      include: { assignee: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.lead.count({ where }),
  ]);

  const totalPages = Math.ceil(total / perPage);

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
            href={`/api/leads/export${q || status ? `?q=${encodeURIComponent(q)}&status=${encodeURIComponent(status)}` : ""}`}
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

      {/* Filtros */}
      <form method="GET" className="flex flex-wrap gap-3">
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
          className="rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">Todos os status</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
        >
          Filtrar
        </button>
        {(q || status) && (
          <Link
            href="/leads"
            className="rounded-md px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
          >
            Limpar
          </Link>
        )}
      </form>

      {/* Tabela */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {leads.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            {q || status ? "Nenhum lead encontrado com esses filtros." : "Nenhum lead ainda. Crie o primeiro!"}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Nome</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">Contato</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">Origem</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden sm:table-cell">Temp.</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden xl:table-cell">Responsável</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">Criado em</th>
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
        )}
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 text-sm">
          {page > 1 && (
            <Link
              href={`/leads?page=${page - 1}&q=${q}&status=${status}`}
              className="rounded-md border border-border px-3 py-1 hover:bg-accent"
            >
              ← Anterior
            </Link>
          )}
          <span className="text-muted-foreground">
            Página {page} de {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={`/leads?page=${page + 1}&q=${q}&status=${status}`}
              className="rounded-md border border-border px-3 py-1 hover:bg-accent"
            >
              Próxima →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

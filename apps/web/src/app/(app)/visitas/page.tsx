import { auth } from "@/lib/auth";
import { prisma } from "@crm/db";
import type { Metadata } from "next";
import Link from "next/link";
import { MapPin, Calendar, User, Trash2 } from "lucide-react";
import { NovaVisitaForm } from "@/components/visitas/NovaVisitaForm";
import { deleteVisitAction } from "@/app/actions/visits";
import { EntityAttachments } from "@/components/attachments/EntityAttachments";
import type { AttachmentItem } from "@/components/attachments/AttachmentList";

export const metadata: Metadata = { title: "Visitas de campo" };

interface Props {
  searchParams: Promise<{ page?: string; userId?: string }>;
}

export default async function VisitasPage({ searchParams }: Props) {
  const session = await auth();
  const params  = await searchParams;
  const tenantId = session!.user.tenantId;
  const isManager = ["SUPERADMIN", "ADMIN", "SUPERVISOR"].includes(session!.user.role);

  const page    = Math.max(1, Number(params.page) || 1);
  const perPage = 20;
  const userFilter = params.userId || "";

  const where = {
    tenantId,
    ...(userFilter && { userId: userFilter }),
    // vendedores só veem as próprias visitas
    ...(!isManager && { userId: session!.user.id }),
  };

  const [visits, total, users, leads, companies, opportunities] = await Promise.all([
    prisma.visit.findMany({
      where,
      include: {
        user:        { select: { name: true } },
        lead:        { select: { id: true, name: true } },
        company:     { select: { id: true, name: true } },
        opportunity: { select: { id: true, title: true } },
        attachments: {
          include: { user: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { visitedAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.visit.count({ where }),
    // Para o filtro de responsável (apenas managers)
    isManager
      ? prisma.user.findMany({ where: { tenantId, active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } })
      : Promise.resolve([]),
    // Para o formulário
    prisma.lead.findMany({
      where: { tenantId, status: { not: "CONVERTIDO" } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 200,
    }),
    prisma.company.findMany({
      where: { tenantId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 200,
    }),
    prisma.opportunity.findMany({
      where: { tenantId, status: "ABERTA" },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
      take: 200,
    }),
  ]);

  const totalPages = Math.ceil(total / perPage);

  // Estatísticas rápidas (últimos 30 dias)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
  const [visitsMonth, withGeo] = await Promise.all([
    prisma.visit.count({ where: { ...where, visitedAt: { gte: thirtyDaysAgo } } }),
    prisma.visit.count({ where: { ...where, lat: { not: null } } }),
  ]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Visitas de campo</h1>
        <p className="text-sm text-muted-foreground">
          {total} visita{total !== 1 ? "s" : ""} registrada{total !== 1 ? "s" : ""} ·{" "}
          {visitsMonth} nos últimos 30 dias ·{" "}
          {withGeo} com geolocalização
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Formulário de nova visita */}
        <div className="lg:col-span-1">
          <NovaVisitaForm
            leads={leads}
            companies={companies}
            opportunities={opportunities}
          />
        </div>

        {/* Listagem */}
        <div className="lg:col-span-2 space-y-4">
          {/* Filtros (apenas managers) */}
          {isManager && users.length > 0 && (
            <form method="GET" className="flex items-center gap-3">
              <label className="text-sm font-medium">Vendedor:</label>
              <select
                name="userId"
                defaultValue={userFilter}
                className="rounded-md border border-input bg-background px-3 py-1.5 text-sm focus-visible:outline-none"
              >
                <option value="">Todos</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
              <button type="submit" className="rounded-md border border-input bg-background px-3 py-1.5 text-sm hover:bg-accent">
                Filtrar
              </button>
              {userFilter && <Link href="/visitas" className="text-sm text-muted-foreground hover:text-foreground">Limpar</Link>}
            </form>
          )}

          {/* Lista */}
          {visits.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border p-12 text-center">
              <MapPin size={32} className="mb-3 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                {total === 0 ? "Nenhuma visita registrada ainda." : "Nenhuma visita nesta página."}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {visits.map((v) => (
                <div key={v.id} className="group rounded-lg border border-border bg-card hover:border-primary/30 transition-colors overflow-hidden">
                  <div className="flex items-start gap-3 p-4">
                    {/* Ícone — verde se tem geo, cinza se não tem */}
                    <div className={`mt-0.5 shrink-0 rounded-lg p-1.5 ${v.lat ? "bg-green-100 text-green-600" : "bg-muted text-muted-foreground"}`}>
                      <MapPin size={14} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{v.subject}</p>

                      {/* Meta */}
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar size={11} />
                          {v.visitedAt.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                          {" · "}
                          {v.visitedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <span className="flex items-center gap-1">
                          <User size={11} />
                          {v.user.name.split(" ")[0]}
                        </span>
                        {v.lead && (
                          <Link href={`/leads/${v.lead.id}`} className="hover:text-primary">
                            Lead: {v.lead.name}
                          </Link>
                        )}
                        {v.company && (
                          <Link href={`/empresas/${v.company.id}`} className="hover:text-primary">
                            Empresa: {v.company.name}
                          </Link>
                        )}
                        {v.opportunity && (
                          <Link href={`/pipeline/${v.opportunity.id}`} className="hover:text-primary">
                            Opp: {v.opportunity.title}
                          </Link>
                        )}
                      </div>

                      {v.address && (
                        <p className="mt-1 text-xs text-muted-foreground truncate">
                          📍 {v.address}
                        </p>
                      )}
                      {v.notes && (
                        <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{v.notes}</p>
                      )}
                      {v.outcome && (
                        <div className="mt-2 rounded-md bg-muted/50 px-3 py-1.5 text-xs">
                          <span className="font-medium text-muted-foreground">Resultado:</span> {v.outcome}
                        </div>
                      )}
                      {v.lat && v.lng && (
                        <a
                          href={`https://www.google.com/maps?q=${v.lat},${v.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <MapPin size={11} />
                          Ver no mapa
                        </a>
                      )}
                    </div>

                    {/* Delete (apenas manager) */}
                    {isManager && (
                      <form action={deleteVisitAction} className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <input type="hidden" name="id" value={v.id} />
                        <button
                          type="submit"
                          title="Excluir visita"
                          className="rounded-md p-1.5 text-muted-foreground/50 hover:bg-destructive/10 hover:text-destructive transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </form>
                    )}
                  </div>

                  {/* Anexos colapsável */}
                  <EntityAttachments
                    entityType="visit"
                    entityId={v.id}
                    initialAttachments={v.attachments.map((a): AttachmentItem => ({
                      id:        a.id,
                      filename:  a.filename,
                      mimeType:  a.mimeType,
                      size:      a.size,
                      createdAt: a.createdAt.toISOString(),
                      user:      a.user ? { name: a.user.name } : undefined,
                    }))}
                    canDelete={isManager || v.userId === session!.user.id}
                    collapsible
                  />
                </div>
              ))}
            </div>
          )}

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 text-sm">
              {page > 1 && (
                <Link
                  href={`/visitas?page=${page - 1}${userFilter ? `&userId=${userFilter}` : ""}`}
                  className="rounded-md border border-border px-3 py-1 hover:bg-accent"
                >
                  ← Anterior
                </Link>
              )}
              <span className="text-muted-foreground">Página {page} de {totalPages}</span>
              {page < totalPages && (
                <Link
                  href={`/visitas?page=${page + 1}${userFilter ? `&userId=${userFilter}` : ""}`}
                  className="rounded-md border border-border px-3 py-1 hover:bg-accent"
                >
                  Próxima →
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

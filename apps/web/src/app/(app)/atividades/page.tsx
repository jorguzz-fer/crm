import { auth } from "@/lib/auth";
import { prisma } from "@crm/db";
import Link from "next/link";
import type { Metadata } from "next";
import { Phone, Mail, Users, MessageSquare, MapPin, Activity, Trash2 } from "lucide-react";
import { deleteActivityAction } from "@/app/actions/activities";
import { CreateActivityForm } from "@/components/atividades/CreateActivityForm";

export const metadata: Metadata = { title: "Atividades" };

const TYPE_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  LIGACAO:  { label: "Ligação",   icon: Phone,         color: "bg-purple-100 text-purple-700" },
  EMAIL:    { label: "E-mail",    icon: Mail,          color: "bg-indigo-100 text-indigo-700" },
  REUNIAO:  { label: "Reunião",   icon: Users,         color: "bg-sky-100 text-sky-700" },
  WHATSAPP: { label: "WhatsApp",  icon: MessageSquare, color: "bg-green-100 text-green-700" },
  VISITA:   { label: "Visita",    icon: MapPin,        color: "bg-amber-100 text-amber-700" },
  OUTRO:    { label: "Outro",     icon: Activity,      color: "bg-zinc-100 text-zinc-600" },
};

interface Props {
  searchParams: Promise<{ type?: string; userId?: string; page?: string }>;
}

export default async function AtividadesPage({ searchParams }: Props) {
  const session = await auth();
  const params = await searchParams;
  const tenantId = session!.user.tenantId;

  const filterType = params.type ?? "";
  const filterUserId = params.userId ?? "";
  const page = Math.max(1, Number(params.page) || 1);
  const perPage = 30;

  const where = {
    tenantId,
    ...(filterType && { type: filterType as never }),
    ...(filterUserId && { userId: filterUserId }),
  };

  const [activities, total, users, leads, opportunities] = await Promise.all([
    prisma.activity.findMany({
      where,
      include: {
        user: { select: { name: true } },
        lead: { select: { id: true, name: true } },
        opportunity: { select: { id: true, title: true } },
        company: { select: { id: true, name: true } },
      },
      orderBy: { occurredAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.activity.count({ where }),
    prisma.user.findMany({
      where: { tenantId, active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.lead.findMany({
      where: { tenantId, status: { not: "CONVERTIDO" } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 100,
    }),
    prisma.opportunity.findMany({
      where: { tenantId, status: "ABERTA" },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
      take: 100,
    }),
  ]);

  const totalPages = Math.ceil(total / perPage);

  function buildUrl(overrides: Record<string, string>) {
    const p = new URLSearchParams({
      ...(filterType && { type: filterType }),
      ...(filterUserId && { userId: filterUserId }),
      ...overrides,
    });
    const s = p.toString();
    return `/atividades${s ? `?${s}` : ""}`;
  }

  const TYPES = ["LIGACAO", "EMAIL", "REUNIAO", "WHATSAPP", "VISITA", "OUTRO"];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Atividades</h1>
        <p className="text-sm text-muted-foreground">{total} atividade{total !== 1 ? "s" : ""} registrada{total !== 1 ? "s" : ""}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Lista */}
        <div className="lg:col-span-2 space-y-4">
          {/* Filtros */}
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={buildUrl({ type: "", page: "1" })}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                !filterType ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"
              }`}
            >
              Todos
            </Link>
            {TYPES.map((t) => {
              const meta = TYPE_META[t]!;
              return (
                <Link
                  key={t}
                  href={buildUrl({ type: t, page: "1" })}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    filterType === t ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {meta.label}
                </Link>
              );
            })}
            {users.length > 1 && (
              <select
                onChange={(e) => { window.location.href = buildUrl({ userId: e.target.value, page: "1" }); }}
                defaultValue={filterUserId}
                className="ml-auto rounded-md border border-input bg-background px-2 py-1 text-xs focus-visible:outline-none"
              >
                <option value="">Todos usuários</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            )}
          </div>

          {/* Timeline */}
          {activities.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-12 text-center">
              <Activity size={32} className="mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">Nenhuma atividade encontrada. Registre a primeira ao lado!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activities.map((act) => {
                const meta = TYPE_META[act.type] ?? TYPE_META.OUTRO!;
                const Icon = meta.icon;
                return (
                  <div key={act.id} className="group flex gap-3 rounded-lg border border-border bg-card p-4 hover:border-primary/30 transition-colors">
                    <div className={`shrink-0 rounded-lg p-2 h-fit ${meta.color}`}>
                      <Icon size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{act.subject}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap text-xs text-muted-foreground">
                            <span className={`rounded-full px-2 py-0.5 font-medium ${meta.color}`}>{meta.label}</span>
                            <span>{act.user.name}</span>
                            {act.duration && <span>{act.duration} min</span>}
                            {act.lead && (
                              <Link href={`/leads/${act.lead.id}`} className="hover:text-primary">
                                {act.lead.name}
                              </Link>
                            )}
                            {act.opportunity && (
                              <Link href={`/pipeline/${act.opportunity.id}`} className="hover:text-primary">
                                {act.opportunity.title}
                              </Link>
                            )}
                            {act.company && (
                              <Link href={`/empresas/${act.company.id}`} className="hover:text-primary">
                                {act.company.name}
                              </Link>
                            )}
                          </div>
                          {act.description && (
                            <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">{act.description}</p>
                          )}
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-xs text-muted-foreground whitespace-nowrap">
                            {act.occurredAt.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {act.occurredAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                          </p>
                          <form action={deleteActivityAction} className="mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <input type="hidden" name="id" value={act.id} />
                            <button type="submit" title="Excluir" className="text-muted-foreground/50 hover:text-destructive">
                              <Trash2 size={12} />
                            </button>
                          </form>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 text-sm">
              {page > 1 && (
                <Link href={buildUrl({ page: String(page - 1) })} className="rounded-md border border-border px-3 py-1 hover:bg-accent">
                  ← Anterior
                </Link>
              )}
              <span className="text-muted-foreground">Página {page} de {totalPages}</span>
              {page < totalPages && (
                <Link href={buildUrl({ page: String(page + 1) })} className="rounded-md border border-border px-3 py-1 hover:bg-accent">
                  Próxima →
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Form */}
        <div>
          <CreateActivityForm leads={leads} opportunities={opportunities} />
        </div>
      </div>
    </div>
  );
}

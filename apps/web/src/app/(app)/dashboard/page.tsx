import { auth } from "@/lib/auth";
import { prisma } from "@crm/db";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  Users, Kanban, CheckSquare, TrendingUp,
  ArrowRight, Clock, AlertCircle,
} from "lucide-react";
import { FollowUpAlerts } from "@/components/ai/FollowUpAlerts";
import { LeadsChart }   from "@/components/dashboard/LeadsChart";
import { PipelineChart } from "@/components/dashboard/PipelineChart";
import { SourceDonut }  from "@/components/dashboard/SourceDonut";
import { PeriodFilter } from "@/components/dashboard/PeriodFilter";

export const metadata: Metadata = { title: "Dashboard" };

const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact" });

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

// Gera array de datas dos últimos N dias
function lastNDays(n: number): Date[] {
  const days: Date[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    days.push(startOfDay(d));
  }
  return days;
}

interface Props {
  searchParams: Promise<{ days?: string }>;
}

export default async function DashboardPage({ searchParams }: Props) {
  const session = await auth();
  const tenantId = session!.user.tenantId;
  const now = new Date();
  const todayStart = startOfDay(now);
  const monthStart = startOfMonth(now);
  const monthEnd   = endOfMonth(now);

  // Período selecionado (7 | 30 | 90 dias)
  const params = await searchParams;
  const periodDays = Number(params.days ?? "30");
  const validDays  = [7, 30, 90].includes(periodDays) ? periodDays : 30;
  const periodStart = new Date(now);
  periodStart.setDate(periodStart.getDate() - validDays);

  const [
    leadsHoje,
    leadsTotal,
    leadsConvertidos,
    oppsAbertas,
    oppsPipelineValue,
    oppsMetaMes,
    tarefasAtrasadas,
    tarefasHoje,
    ultimosLeads,
    ultimasAtividades,
    followUpAlerts,
    // Dados para gráficos
    leadsPorDia,
    leadsPorSource,
    oppsByStage,
  ] = await Promise.all([
    prisma.lead.count({ where: { tenantId, createdAt: { gte: todayStart } } }),
    prisma.lead.count({ where: { tenantId } }),
    prisma.lead.count({ where: { tenantId, status: "CONVERTIDO" } }),
    prisma.opportunity.count({ where: { tenantId, status: "ABERTA" } }),
    prisma.opportunity.aggregate({
      where: { tenantId, status: "ABERTA" },
      _sum: { value: true },
    }),
    prisma.opportunity.aggregate({
      where: {
        tenantId,
        status: "ABERTA",
        expectedCloseAt: { gte: monthStart, lte: monthEnd },
      },
      _sum: { value: true },
    }),
    prisma.task.count({
      where: { tenantId, completedAt: null, dueAt: { lt: todayStart } },
    }),
    prisma.task.count({
      where: {
        tenantId,
        completedAt: null,
        dueAt: { gte: todayStart, lt: new Date(todayStart.getTime() + 86400000) },
      },
    }),
    prisma.lead.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, name: true, company: true, status: true, source: true, createdAt: true },
    }),
    prisma.activity.findMany({
      where: { tenantId },
      orderBy: { occurredAt: "desc" },
      take: 5,
      include: {
        user: { select: { name: true } },
        lead: { select: { id: true, name: true } },
        opportunity: { select: { id: true, title: true } },
      },
    }),
    prisma.aiFollowUpAlert.findMany({
      where: {
        tenantId,
        dismissed: false,
        createdAt: { gte: new Date(Date.now() - 7 * 86400000) },
      },
      orderBy: [{ daysStale: "desc" }, { createdAt: "desc" }],
      take: 10,
      select: {
        id: true, leadId: true, message: true, daysStale: true,
        lead: { select: { name: true } },
      },
    }),

    // Leads criados por dia no período selecionado
    prisma.lead.findMany({
      where: { tenantId, createdAt: { gte: periodStart } },
      select: { createdAt: true },
      orderBy: { createdAt: "asc" },
    }),

    // Leads por origem no período selecionado
    prisma.lead.groupBy({
      by: ["source"],
      where: { tenantId, createdAt: { gte: periodStart } },
      _count: true,
    }),

    // Oportunidades abertas por estágio
    prisma.opportunity.findMany({
      where: { tenantId, status: "ABERTA" },
      select: {
        stageId: true,
        value:   true,
        stage:   { select: { name: true, color: true, order: true } },
      },
    }),
  ]);

  // ── Processar dados dos gráficos ──────────────────────────────────────────

  const taxaConversao = leadsTotal > 0 ? Math.round((leadsConvertidos / leadsTotal) * 100) : 0;
  const pipelineValue = Number(oppsPipelineValue._sum.value ?? 0);
  const metaMesValue  = Number(oppsMetaMes._sum.value ?? 0);

  // Leads por dia — preenche zeros nos dias sem lead
  const days = lastNDays(validDays);
  const leadCountByDay = new Map<string, number>();
  for (const lead of leadsPorDia) {
    const key = startOfDay(lead.createdAt).toISOString();
    leadCountByDay.set(key, (leadCountByDay.get(key) ?? 0) + 1);
  }
  const leadsChartData = days.map((d) => ({
    date: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
    leads: leadCountByDay.get(d.toISOString()) ?? 0,
  }));

  // Leads por source
  const sourceChartData = leadsPorSource
    .sort((a, b) => b._count - a._count)
    .map((g) => ({ name: g.source, value: g._count }));

  // Oportunidades por estágio (valor + quantidade)
  const stageMap = new Map<string, { name: string; color: string; order: number; count: number; value: number }>();
  for (const opp of oppsByStage) {
    const s = opp.stage;
    if (!stageMap.has(opp.stageId)) {
      stageMap.set(opp.stageId, { name: s.name, color: s.color ?? "#6366f1", order: s.order, count: 0, value: 0 });
    }
    const entry = stageMap.get(opp.stageId)!;
    entry.count++;
    entry.value += Number(opp.value ?? 0);
  }
  const pipelineChartData = [...stageMap.values()]
    .sort((a, b) => a.order - b.order)
    .map((s) => ({ name: s.name, count: s.count, value: s.value, color: s.color }));

  // ── Labels ───────────────────────────────────────────────────────────────

  const STATUS_LABEL: Record<string, string> = {
    NOVO: "Novo", EM_CONTATO: "Em contato", QUALIFICADO: "Qualificado",
    DESQUALIFICADO: "Desqualif.", CONVERTIDO: "Convertido",
  };
  const STATUS_COLOR: Record<string, string> = {
    NOVO: "bg-blue-100 text-blue-700", EM_CONTATO: "bg-yellow-100 text-yellow-700",
    QUALIFICADO: "bg-green-100 text-green-700", DESQUALIFICADO: "bg-zinc-100 text-zinc-500",
    CONVERTIDO: "bg-purple-100 text-purple-700",
  };
  const ACTIVITY_LABEL: Record<string, string> = {
    LIGACAO: "Ligação", EMAIL: "E-mail", REUNIAO: "Reunião",
    WHATSAPP: "WhatsApp", VISITA: "Visita", OUTRO: "Outro",
  };

  return (
    <div className="space-y-6">
      {/* Header com filtro de período */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Bom dia, {session?.user.name?.split(" ")[0]} —{" "}
            {now.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        <Suspense>
          <PeriodFilter current={String(validDays)} />
        </Suspense>
      </div>

      {/* Alertas de tarefas */}
      {tarefasAtrasadas > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertCircle size={16} className="shrink-0" />
          <span>
            Você tem <strong>{tarefasAtrasadas}</strong> tarefa{tarefasAtrasadas > 1 ? "s" : ""} em atraso.
          </span>
          <Link href="/tarefas" className="ml-auto font-medium underline underline-offset-2 hover:no-underline">
            Ver tarefas
          </Link>
        </div>
      )}

      {/* Alertas de acompanhamento (IA) */}
      <FollowUpAlerts
        alerts={followUpAlerts.map((a) => ({
          id: a.id, leadId: a.leadId, leadName: a.lead?.name ?? null,
          message: a.message, daysStale: a.daysStale,
        }))}
      />

      {/* KPIs principais */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon={<Users size={18} />}
          label="Leads hoje"
          value={leadsHoje}
          sub={`${leadsTotal} total`}
          href="/leads"
          color="blue"
        />
        <KpiCard
          icon={<Kanban size={18} />}
          label="Pipeline aberto"
          value={pipelineValue > 0 ? fmt.format(pipelineValue) : oppsAbertas}
          sub={`${oppsAbertas} oportunidade${oppsAbertas !== 1 ? "s" : ""}`}
          href="/pipeline"
          color="violet"
        />
        <KpiCard
          icon={<CheckSquare size={18} />}
          label="Tarefas para hoje"
          value={tarefasHoje}
          sub={tarefasAtrasadas > 0 ? `${tarefasAtrasadas} em atraso` : "Em dia"}
          href="/tarefas"
          color={tarefasAtrasadas > 0 ? "amber" : "green"}
        />
        <KpiCard
          icon={<TrendingUp size={18} />}
          label="Meta do mês"
          value={metaMesValue > 0 ? fmt.format(metaMesValue) : "—"}
          sub={`${taxaConversao}% taxa de conversão`}
          href="/pipeline"
          color="green"
        />
      </div>

      {/* ── Gráficos ── */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Leads por dia */}
        <div className="lg:col-span-2 rounded-lg border border-border bg-card p-5">
          <h2 className="mb-1 text-sm font-semibold">Leads recebidos</h2>
          <p className="mb-4 text-xs text-muted-foreground">Últimos {validDays} dias</p>
          <LeadsChart data={leadsChartData} />
        </div>

        {/* Origens */}
        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="mb-1 text-sm font-semibold">Origens dos leads</h2>
          <p className="mb-4 text-xs text-muted-foreground">Últimos {validDays} dias</p>
          <SourceDonut data={sourceChartData} />
        </div>
      </div>

      {/* Pipeline por estágio */}
      <div className="rounded-lg border border-border bg-card p-5">
        <h2 className="mb-1 text-sm font-semibold">Oportunidades por estágio</h2>
        <p className="mb-4 text-xs text-muted-foreground">Oportunidades abertas agora</p>
        <PipelineChart data={pipelineChartData} />
      </div>

      {/* Tabelas */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Últimos leads */}
        <div className="rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold">Últimos leads</h2>
            <Link href="/leads" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              Ver todos <ArrowRight size={12} />
            </Link>
          </div>
          {ultimosLeads.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Nenhum lead ainda.{" "}
              <Link href="/leads/new" className="text-primary underline-offset-2 hover:underline">Criar primeiro</Link>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {ultimosLeads.map((lead) => (
                <div key={lead.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="flex-1 min-w-0">
                    <Link href={`/leads/${lead.id}`} className="text-sm font-medium hover:text-primary truncate block">
                      {lead.name}
                    </Link>
                    {lead.company && (
                      <p className="text-xs text-muted-foreground truncate">{lead.company}</p>
                    )}
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[lead.status]}`}>
                    {STATUS_LABEL[lead.status]}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground hidden sm:block">
                    {lead.createdAt.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Últimas atividades */}
        <div className="rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold">Atividades recentes</h2>
            <Clock size={14} className="text-muted-foreground" />
          </div>
          {ultimasAtividades.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Nenhuma atividade registrada.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {ultimasAtividades.map((act) => (
                <div key={act.id} className="px-4 py-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{act.subject}</p>
                      <p className="text-xs text-muted-foreground">
                        {ACTIVITY_LABEL[act.type]} · {act.user.name.split(" ")[0]}
                        {act.lead && (
                          <> · <Link href={`/leads/${act.lead.id}`} className="hover:text-primary">{act.lead.name}</Link></>
                        )}
                        {act.opportunity && (
                          <> · <Link href={`/pipeline/${act.opportunity.id}`} className="hover:text-primary">{act.opportunity.title}</Link></>
                        )}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {act.occurredAt.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  icon, label, value, sub, href, color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub: string;
  href: string;
  color: "blue" | "violet" | "green" | "amber";
}) {
  const colors = {
    blue:   "bg-blue-50 text-blue-600",
    violet: "bg-violet-50 text-violet-600",
    green:  "bg-green-50 text-green-600",
    amber:  "bg-amber-50 text-amber-600",
  };
  return (
    <Link href={href} className="group rounded-lg border border-border bg-card p-5 shadow-sm hover:border-primary/40 transition-colors block">
      <div className="flex items-start justify-between">
        <div className={`rounded-lg p-2 ${colors[color]}`}>{icon}</div>
        <ArrowRight size={14} className="text-muted-foreground/0 group-hover:text-muted-foreground transition-colors" />
      </div>
      <p className="mt-3 text-2xl font-bold">{value}</p>
      <p className="text-sm font-medium text-muted-foreground mt-0.5">{label}</p>
      <p className="text-xs text-muted-foreground mt-1">{sub}</p>
    </Link>
  );
}

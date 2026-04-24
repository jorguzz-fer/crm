import { auth } from "@/lib/auth";
import { prisma } from "@crm/db";
import type { Metadata } from "next";
import { Download, TrendingUp, Users, Kanban, BarChart2, Target } from "lucide-react";
import { getCplByCampaign, getRoasByCampaign, getConversionFunnel } from "@crm/tracking/analytics";

export const metadata: Metadata = { title: "Relatórios" };

const fmtBRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const STATUS_LABEL_LEAD: Record<string, string> = {
  NOVO: "Novo", EM_CONTATO: "Em contato", QUALIFICADO: "Qualificado",
  DESQUALIFICADO: "Desqualificado", CONVERTIDO: "Convertido",
};
const SOURCE_LABEL: Record<string, string> = {
  WEBSITE: "Website", WHATSAPP: "WhatsApp", INSTAGRAM: "Instagram",
  FACEBOOK: "Facebook", INDICACAO: "Indicação", EVENTO: "Evento",
  COLD_OUTREACH: "Prospecção", OUTRO: "Outro",
};
const STATUS_LABEL_OPP: Record<string, string> = {
  ABERTA: "Aberta", GANHA: "Ganha", PERDIDA: "Perdida",
};

// Períodos predefinidos
const PERIODS = [
  { value: "7",  label: "7 dias" },
  { value: "30", label: "30 dias" },
  { value: "90", label: "90 dias" },
  { value: "365",label: "12 meses" },
] as const;

interface Props {
  searchParams: Promise<{
    days?: string;
    from?: string;
    to?: string;
  }>;
}

export default async function RelatoriosPage({ searchParams }: Props) {
  const session = await auth();
  const tenantId = session!.user.tenantId;
  const params   = await searchParams;

  // Período: dias predefinido OU from/to personalizado
  const days     = Number(params.days ?? "30");
  const validDays = [7, 30, 90, 365].includes(days) ? days : 30;
  const fromDate  = params.from ? new Date(params.from) : (() => {
    const d = new Date(); d.setDate(d.getDate() - validDays); return d;
  })();
  const toDate = params.to
    ? new Date(params.to + "T23:59:59.999Z")
    : new Date();

  const activePeriod = params.days ?? "30";

  function buildExportUrl(base: string, extra: Record<string, string> = {}) {
    const p = new URLSearchParams({
      from: fromDate.toISOString().slice(0, 10),
      to:   toDate.toISOString().slice(0, 10),
      ...extra,
    });
    return `${base}?${p.toString()}`;
  }

  const [
    // Leads
    leadsByStatus,
    leadsBySource,
    leadsTotal,
    leadsConvertidos,
    // Oportunidades
    oppsByStatus,
    oppsValorGanho,
    oppsValorAberto,
    oppsValorPerdido,
    // Atividades
    activitiesByType,
    activitiesTotal,
    funnel,
    cplRows,
    roasRows,
  ] = await Promise.all([
    prisma.lead.groupBy({
      by: ["status"],
      where: { tenantId, createdAt: { gte: fromDate, lte: toDate } },
      _count: true,
    }),
    prisma.lead.groupBy({
      by: ["source"],
      where: { tenantId, createdAt: { gte: fromDate, lte: toDate } },
      _count: true,
      orderBy: { _count: { source: "desc" } },
    }),
    prisma.lead.count({ where: { tenantId, createdAt: { gte: fromDate, lte: toDate } } }),
    prisma.lead.count({ where: { tenantId, createdAt: { gte: fromDate, lte: toDate }, status: "CONVERTIDO" } }),
    prisma.opportunity.groupBy({
      by: ["status"],
      where: { tenantId, createdAt: { gte: fromDate, lte: toDate } },
      _count: true,
      _sum:   { value: true },
    }),
    prisma.opportunity.aggregate({
      where: { tenantId, status: "GANHA",   closedAt: { gte: fromDate, lte: toDate } },
      _sum:  { value: true },
      _count: true,
    }),
    prisma.opportunity.aggregate({
      where: { tenantId, status: "ABERTA" },
      _sum:  { value: true },
      _count: true,
    }),
    prisma.opportunity.aggregate({
      where: { tenantId, status: "PERDIDA", closedAt: { gte: fromDate, lte: toDate } },
      _sum:  { value: true },
      _count: true,
    }),
    prisma.activity.groupBy({
      by: ["type"],
      where: { tenantId, occurredAt: { gte: fromDate, lte: toDate } },
      _count: true,
      orderBy: { _count: { type: "desc" } },
    }),
    prisma.activity.count({ where: { tenantId, occurredAt: { gte: fromDate, lte: toDate } } }),
    getConversionFunnel(tenantId, fromDate, toDate),
    getCplByCampaign(tenantId, fromDate, toDate),
    getRoasByCampaign(tenantId, fromDate, toDate),
  ]);

  const taxaConversao = leadsTotal > 0 ? ((leadsConvertidos / leadsTotal) * 100).toFixed(1) : "0";
  const valorGanho    = Number(oppsValorGanho._sum.value  ?? 0);
  const valorAberto   = Number(oppsValorAberto._sum.value ?? 0);
  const valorPerdido  = Number(oppsValorPerdido._sum.value ?? 0);

  const ACTIVITY_LABEL: Record<string, string> = {
    LIGACAO: "Ligações", EMAIL: "E-mails", REUNIAO: "Reuniões",
    WHATSAPP: "WhatsApp", VISITA: "Visitas", OUTRO: "Outros",
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Relatórios</h1>
          <p className="text-sm text-muted-foreground">
            {fromDate.toLocaleDateString("pt-BR")} — {toDate.toLocaleDateString("pt-BR")}
          </p>
        </div>

        {/* Filtro de período */}
        <form method="GET" className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-0.5">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                type="submit"
                name="days"
                value={p.value}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  activePeriod === p.value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {/* Período personalizado */}
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <input
              type="date"
              name="from"
              defaultValue={fromDate.toISOString().slice(0, 10)}
              className="rounded-md border border-input bg-background px-2 py-1 text-xs focus-visible:outline-none"
            />
            <span>—</span>
            <input
              type="date"
              name="to"
              defaultValue={toDate.toISOString().slice(0, 10)}
              className="rounded-md border border-input bg-background px-2 py-1 text-xs focus-visible:outline-none"
            />
            <button
              type="submit"
              className="rounded-md border border-input bg-background px-3 py-1 text-xs font-medium hover:bg-accent"
            >
              Aplicar
            </button>
          </div>
        </form>
      </div>

      {/* ── KPIs resumo ── */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          icon={<Users size={18} />}
          label="Leads no período"
          value={leadsTotal}
          sub={`${taxaConversao}% convertidos`}
          color="blue"
        />
        <SummaryCard
          icon={<TrendingUp size={18} />}
          label="Receita fechada"
          value={fmtBRL.format(valorGanho)}
          sub={`${oppsValorGanho._count} negócios ganhos`}
          color="green"
        />
        <SummaryCard
          icon={<Kanban size={18} />}
          label="Pipeline aberto"
          value={fmtBRL.format(valorAberto)}
          sub={`${oppsValorAberto._count} oportunidades`}
          color="violet"
        />
        <SummaryCard
          icon={<BarChart2 size={18} />}
          label="Atividades"
          value={activitiesTotal}
          sub="registradas no período"
          color="amber"
        />
      </div>

      {/* ── Seção Leads ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Leads</h2>
          <a
            href={buildExportUrl("/api/leads/export")}
            download
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent"
          >
            <Download size={13} />
            Exportar CSV
          </a>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {/* Por status */}
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="border-b border-border bg-muted/30 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Por status
            </div>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-border">
                {leadsByStatus.length === 0 ? (
                  <tr><td className="px-4 py-6 text-center text-muted-foreground text-xs">Nenhum lead</td></tr>
                ) : (
                  leadsByStatus
                    .sort((a, b) => b._count - a._count)
                    .map((r) => (
                      <tr key={r.status} className="hover:bg-muted/20">
                        <td className="px-4 py-2.5 font-medium">{STATUS_LABEL_LEAD[r.status] ?? r.status}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-semibold">{r._count}</td>
                        <td className="px-4 py-2.5 text-right text-xs text-muted-foreground">
                          {leadsTotal > 0 ? ((r._count / leadsTotal) * 100).toFixed(0) + "%" : "—"}
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>

          {/* Por origem */}
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="border-b border-border bg-muted/30 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Por origem
            </div>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-border">
                {leadsBySource.length === 0 ? (
                  <tr><td className="px-4 py-6 text-center text-muted-foreground text-xs">Nenhum lead</td></tr>
                ) : (
                  leadsBySource.map((r) => (
                    <tr key={r.source} className="hover:bg-muted/20">
                      <td className="px-4 py-2.5 font-medium">{SOURCE_LABEL[r.source] ?? r.source}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-semibold">{r._count}</td>
                      <td className="px-4 py-2.5 text-right text-xs text-muted-foreground">
                        {leadsTotal > 0 ? ((r._count / leadsTotal) * 100).toFixed(0) + "%" : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── Seção Oportunidades ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Oportunidades</h2>
          <a
            href={buildExportUrl("/api/opportunities/export")}
            download
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent"
          >
            <Download size={13} />
            Exportar CSV
          </a>
        </div>

        {/* Resumo de valores */}
        <div className="grid gap-4 sm:grid-cols-3">
          <ValueCard label="Ganhas" value={valorGanho} count={oppsValorGanho._count}  color="green" />
          <ValueCard label="Abertas" value={valorAberto} count={oppsValorAberto._count} color="blue" />
          <ValueCard label="Perdidas" value={valorPerdido} count={oppsValorPerdido._count} color="red" />
        </div>

        {/* Por status (do período) */}
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="border-b border-border bg-muted/30 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Por status — criadas no período
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">Qtd.</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">Valor total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {oppsByStatus.length === 0 ? (
                <tr><td colSpan={3} className="px-4 py-6 text-center text-muted-foreground text-xs">Nenhuma oportunidade</td></tr>
              ) : (
                oppsByStatus.map((r) => (
                  <tr key={r.status} className="hover:bg-muted/20">
                    <td className="px-4 py-2.5 font-medium">{STATUS_LABEL_OPP[r.status] ?? r.status}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{r._count}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                      {r._sum.value != null ? fmtBRL.format(Number(r._sum.value)) : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Seção Tracking & Conversões ── */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <Target size={16} className="text-primary" />
          Tracking & Conversões
        </h2>

        {/* Funil */}
        <div className="grid gap-4 sm:grid-cols-4">
          {[
            { label: "Leads",        value: funnel.totalLeads,     sub: "no período" },
            { label: "Qualificados", value: funnel.qualifiedLeads, sub: "score ≥ 60" },
            { label: "Conversões",   value: funnel.conversions,    sub: `${funnel.conversionRate.toFixed(1)}% dos leads` },
            { label: "Receita CAPI", value: fmtBRL.format(funnel.totalRevenue), sub: "confirmada" },
          ].map((c) => (
            <div key={c.label} className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">{c.label}</p>
              <p className="mt-1 text-2xl font-bold">{c.value}</p>
              <p className="text-xs text-muted-foreground">{c.sub}</p>
            </div>
          ))}
        </div>

        {/* CPL por campanha */}
        {cplRows.length > 0 && (
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="border-b border-border bg-muted/30 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              CPL por campanha
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Campanha</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">Plataforma</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">Gasto</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">Leads</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">CPL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {cplRows.map((r) => (
                  <tr key={r.campaignId} className="hover:bg-muted/20">
                    <td className="px-4 py-2.5 font-medium">{r.campaignName ?? r.campaignId}</td>
                    <td className="px-4 py-2.5 text-right">
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{r.platform}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{fmtBRL.format(r.totalSpend)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{r.leads}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-semibold">
                      {r.cpl != null ? fmtBRL.format(r.cpl) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ROAS por campanha */}
        {roasRows.length > 0 && (
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="border-b border-border bg-muted/30 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              ROAS por campanha
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Campanha</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">Gasto</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">Receita</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">ROAS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {roasRows.map((r) => (
                  <tr key={r.campaignId} className="hover:bg-muted/20">
                    <td className="px-4 py-2.5 font-medium">{r.campaignName ?? r.campaignId}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{fmtBRL.format(r.totalSpend)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{fmtBRL.format(r.totalRevenue)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-semibold">
                      {r.roas != null ? `${r.roas.toFixed(2)}x` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {cplRows.length === 0 && roasRows.length === 0 && (
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Nenhum gasto de campanha registrado no período.
            Configure os gastos via <strong>CampaignSpend</strong> para ver CPL e ROAS aqui.
          </div>
        )}
      </section>

      {/* ── Seção Atividades ── */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold">Atividades</h2>
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="border-b border-border bg-muted/30 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Por tipo
          </div>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-border">
              {activitiesByType.length === 0 ? (
                <tr><td className="px-4 py-6 text-center text-muted-foreground text-xs">Nenhuma atividade</td></tr>
              ) : (
                activitiesByType.map((r) => (
                  <tr key={r.type} className="hover:bg-muted/20">
                    <td className="px-4 py-2.5 font-medium">{ACTIVITY_LABEL[r.type] ?? r.type}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-semibold">{r._count}</td>
                    <td className="px-4 py-2.5 pr-4">
                      <div className="ml-auto h-1.5 w-full max-w-32 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{
                            width: activitiesTotal > 0
                              ? `${(r._count / activitiesTotal) * 100}%`
                              : "0%",
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

// ── Sub-componentes ────────────────────────────────────────────────────────────

function SummaryCard({
  icon, label, value, sub, color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub: string;
  color: "blue" | "green" | "violet" | "amber";
}) {
  const colors = {
    blue:   "bg-blue-50 text-blue-600",
    green:  "bg-green-50 text-green-600",
    violet: "bg-violet-50 text-violet-600",
    amber:  "bg-amber-50 text-amber-600",
  };
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className={`inline-flex rounded-lg p-2 ${colors[color]}`}>{icon}</div>
      <p className="mt-3 text-2xl font-bold">{value}</p>
      <p className="text-sm font-medium text-muted-foreground mt-0.5">{label}</p>
      <p className="text-xs text-muted-foreground mt-1">{sub}</p>
    </div>
  );
}

function ValueCard({
  label, value, count, color,
}: {
  label: string;
  value: number;
  count: number;
  color: "green" | "blue" | "red";
}) {
  const colors = {
    green: "border-l-green-400 bg-green-50/50",
    blue:  "border-l-blue-400 bg-blue-50/50",
    red:   "border-l-red-400 bg-red-50/50",
  };
  const fmtBRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  return (
    <div className={`rounded-lg border border-border border-l-4 bg-card p-4 ${colors[color]}`}>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-xl font-bold">{fmtBRL.format(value)}</p>
      <p className="text-xs text-muted-foreground">{count} negócio{count !== 1 ? "s" : ""}</p>
    </div>
  );
}

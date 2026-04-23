import { auth } from "@/lib/auth";
import { prisma } from "@crm/db";
import { redirect } from "next/navigation";
import { Brain, Zap, Bell, Clock, Hash, Cpu } from "lucide-react";
import Link from "next/link";

const ASSISTANT_LABEL: Record<string, string> = {
  summarize: "Resumo",
  "follow-up": "Acompanhamento",
};

const ENTITY_LABEL: Record<string, string> = {
  Lead: "Lead",
  Opportunity: "Oportunidade",
};

function fmt(n: number | null | undefined, decimals = 0) {
  if (n == null) return "—";
  return n.toLocaleString("pt-BR", { maximumFractionDigits: decimals });
}

export default async function IAPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const tenantId = session.user.tenantId;

  // Últimas 50 invocações
  const [logs, totals] = await Promise.all([
    prisma.aiInvocationLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        assistant: true,
        entityType: true,
        entityId: true,
        tokens: true,
        latencyMs: true,
        model: true,
        createdAt: true,
      },
    }),
    prisma.aiInvocationLog.aggregate({
      where: { tenantId },
      _count: { id: true },
      _sum: { tokens: true },
      _avg: { latencyMs: true },
    }),
  ]);

  // Buscar nomes das entidades referenciadas
  const leadIds = logs.filter((l) => l.entityType === "Lead" && l.entityId).map((l) => l.entityId!);
  const oppIds  = logs.filter((l) => l.entityType === "Opportunity" && l.entityId).map((l) => l.entityId!);

  const [leads, opps] = await Promise.all([
    leadIds.length > 0
      ? prisma.lead.findMany({ where: { id: { in: leadIds }, tenantId }, select: { id: true, name: true } })
      : Promise.resolve([]),
    oppIds.length > 0
      ? prisma.opportunity.findMany({ where: { id: { in: oppIds }, tenantId }, select: { id: true, title: true } })
      : Promise.resolve([]),
  ]);

  const leadMap = new Map(leads.map((l) => [l.id, l.name]));
  const oppMap  = new Map(opps.map((o) => [o.id, o.title]));

  function entityName(log: typeof logs[number]) {
    if (!log.entityId) return null;
    if (log.entityType === "Lead") return leadMap.get(log.entityId) ?? log.entityId;
    if (log.entityType === "Opportunity") return oppMap.get(log.entityId) ?? log.entityId;
    return null;
  }

  function entityHref(log: typeof logs[number]) {
    if (!log.entityId) return null;
    if (log.entityType === "Lead") return `/leads/${log.entityId}`;
    if (log.entityType === "Opportunity") return `/pipeline/${log.entityId}`;
    return null;
  }

  const totalInvocations = totals._count.id;
  const totalTokens      = totals._sum.tokens ?? 0;
  const avgLatencyMs     = Math.round(totals._avg.latencyMs ?? 0);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Brain size={24} className="text-primary" />
          Assistentes de IA
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Ferramentas de inteligência artificial integradas ao CRM
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card p-5 flex items-center gap-4">
          <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
            <Zap size={20} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Invocações</p>
            <p className="text-2xl font-bold">{fmt(totalInvocations)}</p>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 flex items-center gap-4">
          <div className="rounded-lg bg-violet-100 p-2.5 text-violet-600">
            <Hash size={20} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Tokens usados</p>
            <p className="text-2xl font-bold">{fmt(totalTokens)}</p>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 flex items-center gap-4">
          <div className="rounded-lg bg-blue-100 p-2.5 text-blue-600">
            <Clock size={20} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Latência média</p>
            <p className="text-2xl font-bold">
              {avgLatencyMs > 0 ? `${(avgLatencyMs / 1000).toFixed(1)}s` : "—"}
            </p>
          </div>
        </div>
      </div>

      {/* Assistentes disponíveis */}
      <div>
        <h2 className="text-base font-semibold mb-4">Assistentes disponíveis</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Resumo */}
          <div className="rounded-xl border border-border bg-card p-6 space-y-3">
            <div className="flex items-start justify-between">
              <div className="rounded-lg bg-amber-100 p-2.5 text-amber-600">
                <Brain size={20} />
              </div>
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                Disponível
              </span>
            </div>
            <div>
              <h3 className="font-semibold">Resumo Executivo</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Analisa notas e atividades de leads e oportunidades para gerar um resumo em 3–5 linhas
                com próximos passos concretos e sentimento da negociação.
              </p>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p><span className="font-medium">Modelo:</span> Claude Sonnet 4.6 (via OpenRouter)</p>
              <p><span className="font-medium">Como usar:</span> Abra um lead ou oportunidade → clique em &quot;Resumir com IA&quot;</p>
            </div>
          </div>

          {/* Acompanhamento */}
          <div className="rounded-xl border border-border bg-card p-6 space-y-3">
            <div className="flex items-start justify-between">
              <div className="rounded-lg bg-blue-100 p-2.5 text-blue-600">
                <Bell size={20} />
              </div>
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                Disponível
              </span>
            </div>
            <div>
              <h3 className="font-semibold">Acompanhamento Automático</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Job agendado que detecta leads sem interação, tarefas vencidas e oportunidades paradas.
                Gera alertas no sino de notificações com mensagens acionáveis.
              </p>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p><span className="font-medium">Modelo:</span> Claude Sonnet 4.6 (via OpenRouter)</p>
              <p><span className="font-medium">Frequência:</span> Automático — roda a cada hora via cron</p>
            </div>
          </div>

          {/* Em breve: Pesquisa */}
          <div className="rounded-xl border border-border bg-card/50 p-6 space-y-3 opacity-60">
            <div className="flex items-start justify-between">
              <div className="rounded-lg bg-muted p-2.5 text-muted-foreground">
                <Cpu size={20} />
              </div>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                Em breve
              </span>
            </div>
            <div>
              <h3 className="font-semibold">Pesquisa e Enriquecimento</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Enriquece automaticamente o perfil de leads com dados públicos do site da empresa,
                LinkedIn e outras fontes abertas.
              </p>
            </div>
          </div>

          {/* Em breve: Scoring */}
          <div className="rounded-xl border border-border bg-card/50 p-6 space-y-3 opacity-60">
            <div className="flex items-start justify-between">
              <div className="rounded-lg bg-muted p-2.5 text-muted-foreground">
                <Zap size={20} />
              </div>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                Em breve
              </span>
            </div>
            <div>
              <h3 className="font-semibold">Scoring de Leads</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Pontua a temperatura de cada lead com base em comportamento, fit de perfil e histórico
                de conversão do tenant.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Histórico de invocações */}
      <div>
        <h2 className="text-base font-semibold mb-4">Histórico de invocações</h2>
        {logs.length === 0 ? (
          <div className="rounded-xl border border-border bg-card flex flex-col items-center gap-3 py-16 text-center">
            <Brain size={32} className="text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">Nenhuma invocação registrada ainda.</p>
            <p className="text-xs text-muted-foreground">
              Abra um lead ou oportunidade e clique em &quot;Resumir com IA&quot; para começar.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Assistente</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Entidade</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Modelo</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Tokens</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Latência</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {logs.map((log) => {
                    const name = entityName(log);
                    const href = entityHref(log);
                    return (
                      <tr key={log.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                            <Brain size={11} />
                            {ASSISTANT_LABEL[log.assistant] ?? log.assistant}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            {log.entityType && (
                              <span className="text-xs text-muted-foreground">
                                {ENTITY_LABEL[log.entityType] ?? log.entityType}
                              </span>
                            )}
                            {name && href ? (
                              <Link
                                href={href}
                                className="text-primary hover:underline text-xs font-medium line-clamp-1"
                              >
                                {name}
                              </Link>
                            ) : name ? (
                              <span className="text-xs font-medium line-clamp-1">{name}</span>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-muted-foreground font-mono truncate max-w-[160px] block">
                            {log.model
                              ? log.model.replace("anthropic/", "").replace("openai/", "")
                              : "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {log.tokens != null ? fmt(log.tokens) : "—"}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                          {log.latencyMs != null
                            ? `${(log.latencyMs / 1000).toFixed(1)}s`
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-muted-foreground whitespace-nowrap">
                          {log.createdAt.toLocaleDateString("pt-BR", {
                            day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                          })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {totalInvocations > 50 && (
              <div className="border-t border-border px-4 py-3 text-xs text-muted-foreground text-center">
                Exibindo as últimas 50 de {fmt(totalInvocations)} invocações
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

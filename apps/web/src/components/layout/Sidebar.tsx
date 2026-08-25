"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, Kanban, Building2, Contact, Calendar, CheckSquare, Activity, Settings, ChevronRight, MessageCircle, BarChart2, MapPin, Brain, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/dashboard",     label: "Dashboard",     icon: LayoutDashboard },
  { href: "/leads",         label: "Leads",         icon: Users },
  { href: "/pipeline",      label: "Pipeline",      icon: Kanban },
  { href: "/whatsapp",      label: "WhatsApp",      icon: MessageCircle },
  { href: "/agenda",        label: "Agenda",        icon: Calendar },
  { href: "/tarefas",       label: "Tarefas",       icon: CheckSquare },
  { href: "/atividades",    label: "Atividades",    icon: Activity },
  { href: "/visitas",       label: "Visitas",       icon: MapPin },
  { href: "/relatorios",    label: "Relatórios",    icon: BarChart2 },
  { href: "/ia",            label: "Inteligência IA", icon: Brain },
  { href: "/empresas",      label: "Empresas",      icon: Building2 },
  { href: "/contatos",      label: "Contatos",      icon: Contact },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];

interface SidebarProps {
  /** Slug do tenant logado — exibido ao lado do logo para identificar a conta. */
  tenantSlug?: string | null;
  /** Nome do tenant, usado como tooltip do slug. */
  tenantName?: string | null;
  /** Exibe o link do painel da plataforma (cross-tenant). */
  showPlatformPanel?: boolean;
}

export function Sidebar({ tenantSlug, tenantName, showPlatformPanel }: SidebarProps = {}) {
  const pathname = usePathname();

  const items = showPlatformPanel
    ? [...nav, { href: "/painel", label: "Painel da plataforma", icon: ShieldCheck }]
    : nav;

  return (
    <aside className="flex w-56 flex-col border-r border-border bg-card">
      <div className="flex h-14 items-center gap-2 border-b border-border px-4">
        <span className="text-base font-bold tracking-tight">CRM</span>
        {tenantSlug && (
          <span
            title={tenantName ? `${tenantName} (${tenantSlug})` : tenantSlug}
            className="min-w-0 truncate rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
          >
            {tenantSlug}
          </span>
        )}
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon size={16} />
              {label}
              {active && <ChevronRight size={14} className="ml-auto opacity-60" />}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

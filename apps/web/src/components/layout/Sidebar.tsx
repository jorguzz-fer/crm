"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, Kanban, Building2, Contact, Calendar, CheckSquare, Activity, Settings, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/dashboard",     label: "Dashboard",     icon: LayoutDashboard },
  { href: "/leads",         label: "Leads",         icon: Users },
  { href: "/pipeline",      label: "Pipeline",      icon: Kanban },
  { href: "/agenda",        label: "Agenda",        icon: Calendar },
  { href: "/tarefas",       label: "Tarefas",       icon: CheckSquare },
  { href: "/atividades",    label: "Atividades",    icon: Activity },
  { href: "/empresas",      label: "Empresas",      icon: Building2 },
  { href: "/contatos",      label: "Contatos",      icon: Contact },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-56 flex-col border-r border-border bg-card">
      <div className="flex h-14 items-center border-b border-border px-4">
        <span className="text-base font-bold tracking-tight">CRM</span>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {nav.map(({ href, label, icon: Icon }) => {
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

import { auth } from "@/lib/auth";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const session = await auth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm">
          Bem-vindo, {session?.user.name}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Leads hoje", value: "—" },
          { label: "Follow-ups pendentes", value: "—" },
          { label: "Oportunidades abertas", value: "—" },
          { label: "Meta do mês", value: "—" },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="rounded-lg border border-border bg-card p-4 shadow-sm"
          >
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
        CRM core chega na Fase 2 — leads, funil e atividades.
      </div>
    </div>
  );
}

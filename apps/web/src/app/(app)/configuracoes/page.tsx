import { auth } from "@/lib/auth";
import { prisma } from "@crm/db";
import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { TenantForm } from "./TenantForm";
import { InviteUserForm } from "./InviteUserForm";
import { UserTable } from "./UserTable";

export const metadata: Metadata = { title: "Configurações" };

export default async function ConfiguracoesPage() {
  const session = await auth();
  const tenantId = session!.user.tenantId;
  const currentRole = session!.user.role;
  const isAdmin = ["SUPERADMIN", "ADMIN"].includes(currentRole);

  const [tenant, users] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId } }),
    prisma.user.findMany({
      where: { tenantId },
      orderBy: [{ active: "desc" }, { name: "asc" }],
      select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
    }),
  ]);

  if (!tenant) return null;

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Configurações</h1>
        <p className="text-sm text-muted-foreground">Gerencie seu tenant e usuários</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href="/configuracoes/seguranca"
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent"
          >
            <ShieldCheck size={14} />
            Segurança &amp; 2FA
          </Link>
        </div>
      </div>

      {/* Tenant */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold border-b border-border pb-2">Informações do tenant</h2>
        <div className="grid gap-4 sm:grid-cols-2 rounded-lg border border-border bg-card p-4 text-sm">
          <div>
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide mb-1">Plano</p>
            <p className="font-medium">{tenant.plan}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide mb-1">Criado em</p>
            <p className="font-medium">{tenant.createdAt.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide mb-1">Status</p>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tenant.active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
              {tenant.active ? "Ativo" : "Inativo"}
            </span>
          </div>
          <div>
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide mb-1">Usuários</p>
            <p className="font-medium">{users.filter((u) => u.active).length} ativos</p>
          </div>
        </div>

        {isAdmin && <TenantForm name={tenant.name} />}
        {!isAdmin && (
          <p className="text-sm text-muted-foreground">Nome: <strong>{tenant.name}</strong></p>
        )}
      </section>

      {/* Usuários */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold border-b border-border pb-2">Usuários</h2>
        <UserTable
          users={users}
          currentUserId={session!.user.id}
          isAdmin={isAdmin}
        />
      </section>

      {/* Convidar */}
      {isAdmin && (
        <section className="space-y-4">
          <h2 className="text-base font-semibold border-b border-border pb-2">Adicionar usuário</h2>
          <InviteUserForm />
        </section>
      )}

      {/* WhatsApp */}
      {isAdmin && (
        <section className="space-y-4">
          <h2 className="text-base font-semibold border-b border-border pb-2">Integrações</h2>
          <a
            href="/configuracoes/whatsapp"
            className="flex items-center justify-between rounded-lg border border-border bg-card p-4 hover:bg-muted/30 transition-colors group"
          >
            <div>
              <p className="font-medium text-sm">WhatsApp (Evolution API)</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Conecte um número para receber e responder mensagens diretamente no CRM
              </p>
            </div>
            <span className="text-muted-foreground group-hover:text-foreground transition-colors text-lg">→</span>
          </a>
          <a
            href="/configuracoes/tracking"
            className="flex items-center justify-between rounded-lg border border-border bg-card p-4 hover:bg-muted/30 transition-colors group"
          >
            <div>
              <p className="font-medium text-sm">Tracking & Conversões</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Meta CAPI, Hotmart e Pagar.me — rastreie conversões server-side
              </p>
            </div>
            <span className="text-muted-foreground group-hover:text-foreground transition-colors text-lg">→</span>
          </a>
        </section>
      )}

      {/* LGPD */}
      {isAdmin && (
        <section className="space-y-4">
          <h2 className="text-base font-semibold border-b border-border pb-2">Privacidade e LGPD</h2>
          <a
            href="/configuracoes/lgpd"
            className="flex items-center justify-between rounded-lg border border-border bg-card p-4 hover:bg-muted/30 transition-colors group"
          >
            <div>
              <p className="font-medium text-sm">Painel de conformidade LGPD</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Solicitações de titulares, registros de consentimento e trilha de auditoria
              </p>
            </div>
            <span className="text-muted-foreground group-hover:text-foreground transition-colors text-lg">→</span>
          </a>
        </section>
      )}
    </div>
  );
}

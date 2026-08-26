import { auth } from "@/lib/auth";
import { prisma } from "@crm/db";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/LoginForm";
import { signOutAction } from "@/app/actions/auth";
import { isTenantDoorPath } from "@/lib/routes";

interface Props {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ error?: string }>;
}

const AUTH_ERRORS: Record<string, string> = {
  CredentialsSignin: "E-mail ou senha incorretos",
  Default: "Erro ao fazer login. Tente novamente.",
};

/** Só busca o tenant quando o caminho é mesmo uma porta de cliente. */
async function findTenant(slug: string) {
  if (!isTenantDoorPath(`/${slug}`)) return null;
  return prisma.tenant.findUnique({
    where: { slug },
    select: { name: true, slug: true, active: true },
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tenant: slug } = await params;
  const tenant = await findTenant(slug);
  return { title: tenant ? `Entrar — ${tenant.name}` : "Entrar" };
}

/**
 * Porta de entrada por cliente: crm.exemplo.com.br/alumine
 *
 * Mostra o login já identificado com o nome do cliente. O tenant continua vindo
 * da sessão depois do login — o slug aqui serve para o cliente ter um endereço
 * próprio e para barrar login de e-mail de outro ambiente.
 */
export default async function TenantDoorPage({ params, searchParams }: Props) {
  const { tenant: slug } = await params;
  const tenant = await findTenant(slug);

  // Tenant inexistente ou suspenso responde igual — a URL não confirma clientes
  if (!tenant || !tenant.active) notFound();

  const [session, query] = await Promise.all([auth(), searchParams]);

  if (session?.user?.tenantId) {
    const current = await prisma.tenant.findUnique({
      where: { id: session.user.tenantId },
      select: { name: true, slug: true },
    });

    // Já logado neste ambiente: segue direto para o app
    if (current?.slug === tenant.slug) redirect("/dashboard");

    // Logado em outro ambiente: não dá para atender os dois na mesma sessão
    return (
      <main className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-6 text-center">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">{tenant.name}</h1>
            <p className="text-sm text-muted-foreground">
              Você está conectado como <strong>{session.user.name}</strong>
              {current && <> no ambiente <strong>{current.name}</strong></>}.
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            Para entrar em {tenant.name}, saia da conta atual.
          </p>
          <div className="space-y-2">
            <form action={signOutAction}>
              <button
                type="submit"
                className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Sair e entrar em {tenant.name}
              </button>
            </form>
            <Link
              href="/dashboard"
              className="block w-full rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              Continuar em {current?.name ?? "meu ambiente"}
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const urlError = query.error ? (AUTH_ERRORS[query.error] ?? AUTH_ERRORS.Default) : undefined;

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">CRM</p>
          <h1 className="text-2xl font-bold">{tenant.name}</h1>
          <p className="text-sm text-muted-foreground">Entre com sua conta deste ambiente</p>
        </div>

        <LoginForm urlError={urlError} tenantSlug={tenant.slug} />
      </div>
    </main>
  );
}

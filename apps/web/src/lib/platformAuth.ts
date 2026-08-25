import { auth } from "@/lib/auth";
import { prisma } from "@crm/db";

export interface PlatformAdmin {
  id: string;
  name: string;
  email: string;
  tenantId: string;
}

/**
 * Retorna o usuário logado se ele for admin da plataforma, senão null.
 *
 * A checagem vai ao banco a cada request de propósito: o JWT tem validade de
 * 8h, então confiar numa claim significaria que revogar o acesso só faria
 * efeito no próximo login. Sendo uma tela de poucos acessos, o custo de uma
 * query por PK é irrelevante perto da garantia.
 */
export async function getPlatformAdmin(): Promise<PlatformAdmin | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      tenantId: true,
      active: true,
      isPlatformAdmin: true,
    },
  });

  if (!user || !user.active || !user.isPlatformAdmin) return null;

  return { id: user.id, name: user.name, email: user.email, tenantId: user.tenantId };
}

/** `true` se o usuário logado enxerga o painel — usado para exibir o link na sidebar. */
export async function isPlatformAdmin(): Promise<boolean> {
  return (await getPlatformAdmin()) !== null;
}

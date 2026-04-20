// TODO Fase 1: implementar com Auth.js v5 + Prisma adapter + RBAC + rate limit
// Referência: skill nextjs-prisma-multitenant-security (seção 7)

export interface AppSession {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    tenantId: string;
    unitId?: string;
  };
}

// Stub para Fase 0 — não quebra imports
export async function auth(): Promise<AppSession | null> {
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function signIn(..._args: unknown[]) {
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function signOut(..._args: unknown[]) {
  return null;
}

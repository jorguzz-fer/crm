import { auth } from "@/lib/auth";
import { prisma } from "@crm/db";
import type { Metadata } from "next";
import { ShieldCheck, Key } from "lucide-react";
import { TwoFactorSetup } from "@/components/security/TwoFactorSetup";
import { PersonalTokens } from "@/components/security/PersonalTokens";

export const metadata: Metadata = { title: "Segurança" };

export default async function SegurancaPage() {
  const session = await auth();

  const user = await prisma.user.findUnique({
    where: { id: session!.user.id },
    select: { twoFactorEnabled: true },
  });

  const tokens = await prisma.personalAccessToken.findMany({
    where: { userId: session!.user.id },
    select: { id: true, name: true, lastUsedAt: true, expiresAt: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Segurança da conta</h1>
        <p className="text-sm text-muted-foreground">
          Gerencie autenticação em dois fatores e tokens de acesso pessoal.
        </p>
      </div>

      {/* 2FA */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 border-b border-border pb-2">
          <ShieldCheck size={16} className="text-muted-foreground" />
          <h2 className="text-base font-semibold">Autenticação em dois fatores (2FA)</h2>
        </div>
        <TwoFactorSetup enabled={user?.twoFactorEnabled ?? false} />
      </section>

      {/* Personal Access Tokens */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 border-b border-border pb-2">
          <Key size={16} className="text-muted-foreground" />
          <h2 className="text-base font-semibold">Tokens de acesso pessoal</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Tokens para integrar com a extensão Chrome ou acessar a API programaticamente.
          Cada token tem acesso total à sua conta — trate como uma senha.
        </p>
        <PersonalTokens
          initialTokens={tokens.map((t) => ({
            id:         t.id,
            name:       t.name,
            lastUsedAt: t.lastUsedAt?.toISOString() ?? null,
            expiresAt:  t.expiresAt?.toISOString() ?? null,
            createdAt:  t.createdAt.toISOString(),
          }))}
        />
      </section>
    </div>
  );
}

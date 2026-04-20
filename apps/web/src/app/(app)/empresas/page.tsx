import { auth } from "@/lib/auth";
import { prisma } from "@crm/db";
import Link from "next/link";
import type { Metadata } from "next";
import { Plus, Search, Building2, Users } from "lucide-react";

export const metadata: Metadata = { title: "Empresas" };

interface Props {
  searchParams: Promise<{ q?: string; page?: string }>;
}

export default async function EmpresasPage({ searchParams }: Props) {
  const session = await auth();
  const params = await searchParams;

  const q = params.q?.trim() || "";
  const page = Math.max(1, Number(params.page) || 1);
  const perPage = 20;

  const where = {
    tenantId: session!.user.tenantId,
    ...(q && {
      OR: [
        { name: { contains: q, mode: "insensitive" as const } },
        { cnpj: { contains: q, mode: "insensitive" as const } },
        { email: { contains: q, mode: "insensitive" as const } },
        { industry: { contains: q, mode: "insensitive" as const } },
      ],
    }),
  };

  const [companies, total] = await Promise.all([
    prisma.company.findMany({
      where,
      include: {
        _count: { select: { contacts: true, opportunities: true } },
      },
      orderBy: { name: "asc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.company.count({ where }),
  ]);

  const totalPages = Math.ceil(total / perPage);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Empresas</h1>
          <p className="text-sm text-muted-foreground">{total} empresa{total !== 1 ? "s" : ""}</p>
        </div>
        <Link
          href="/empresas/new"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus size={16} />
          Nova empresa
        </Link>
      </div>

      <form method="GET" className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar por nome, CNPJ, segmento..."
            className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <button type="submit" className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent">
          Filtrar
        </button>
        {q && (
          <Link href="/empresas" className="rounded-md px-4 py-2 text-sm text-muted-foreground hover:text-foreground">
            Limpar
          </Link>
        )}
      </form>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {companies.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            {q ? "Nenhuma empresa encontrada com esses filtros." : "Nenhuma empresa ainda. Crie a primeira!"}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Nome</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">Contato</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">Segmento</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden sm:table-cell">Contatos</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">Oportunidades</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {companies.map((company) => (
                <tr key={company.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/empresas/${company.id}`} className="font-medium hover:text-primary flex items-center gap-2">
                      <Building2 size={14} className="text-muted-foreground shrink-0" />
                      {company.name}
                    </Link>
                    {company.cnpj && <p className="text-xs text-muted-foreground mt-0.5">{company.cnpj}</p>}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">
                    {company.email && <p>{company.email}</p>}
                    {company.phone && <p>{company.phone}</p>}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">
                    {company.industry ?? "—"}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Users size={13} />
                      {company._count.contacts}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">
                    {company._count.opportunities}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 text-sm">
          {page > 1 && (
            <Link href={`/empresas?page=${page - 1}&q=${q}`} className="rounded-md border border-border px-3 py-1 hover:bg-accent">
              ← Anterior
            </Link>
          )}
          <span className="text-muted-foreground">Página {page} de {totalPages}</span>
          {page < totalPages && (
            <Link href={`/empresas?page=${page + 1}&q=${q}`} className="rounded-md border border-border px-3 py-1 hover:bg-accent">
              Próxima →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

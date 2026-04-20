import { auth } from "@/lib/auth";
import { prisma } from "@crm/db";
import Link from "next/link";
import type { Metadata } from "next";
import { Plus, Search } from "lucide-react";

export const metadata: Metadata = { title: "Contatos" };

interface Props {
  searchParams: Promise<{ q?: string; companyId?: string; page?: string }>;
}

export default async function ContatosPage({ searchParams }: Props) {
  const session = await auth();
  const params = await searchParams;

  const q = params.q?.trim() || "";
  const companyId = params.companyId || "";
  const page = Math.max(1, Number(params.page) || 1);
  const perPage = 20;
  const tenantId = session!.user.tenantId;

  const where = {
    tenantId,
    ...(companyId && { companyId }),
    ...(q && {
      OR: [
        { name: { contains: q, mode: "insensitive" as const } },
        { email: { contains: q, mode: "insensitive" as const } },
        { role: { contains: q, mode: "insensitive" as const } },
      ],
    }),
  };

  const [contacts, total, companies] = await Promise.all([
    prisma.contact.findMany({
      where,
      include: { company: { select: { id: true, name: true } } },
      orderBy: { name: "asc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.contact.count({ where }),
    prisma.company.findMany({
      where: { tenantId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 100,
    }),
  ]);

  const totalPages = Math.ceil(total / perPage);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Contatos</h1>
          <p className="text-sm text-muted-foreground">{total} contato{total !== 1 ? "s" : ""}</p>
        </div>
        <Link
          href="/contatos/new"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus size={16} />
          Novo contato
        </Link>
      </div>

      <form method="GET" className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar por nome, e-mail, cargo..."
            className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        {companies.length > 0 && (
          <select
            name="companyId"
            defaultValue={companyId}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Todas as empresas</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
        <button type="submit" className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent">
          Filtrar
        </button>
        {(q || companyId) && (
          <Link href="/contatos" className="rounded-md px-4 py-2 text-sm text-muted-foreground hover:text-foreground">
            Limpar
          </Link>
        )}
      </form>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {contacts.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            {q || companyId ? "Nenhum contato encontrado com esses filtros." : "Nenhum contato ainda. Crie o primeiro!"}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Nome</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">Contato</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">Cargo</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden sm:table-cell">Empresa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {contacts.map((contact) => (
                <tr key={contact.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/contatos/${contact.id}`} className="font-medium hover:text-primary">
                      {contact.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">
                    {contact.email && <p>{contact.email}</p>}
                    {contact.phone && <p>{contact.phone}</p>}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">
                    {contact.role ?? "—"}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    {contact.company ? (
                      <Link href={`/empresas/${contact.company.id}`} className="text-muted-foreground hover:text-primary">
                        {contact.company.name}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
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
            <Link href={`/contatos?page=${page - 1}&q=${q}&companyId=${companyId}`} className="rounded-md border border-border px-3 py-1 hover:bg-accent">
              ← Anterior
            </Link>
          )}
          <span className="text-muted-foreground">Página {page} de {totalPages}</span>
          {page < totalPages && (
            <Link href={`/contatos?page=${page + 1}&q=${q}&companyId=${companyId}`} className="rounded-md border border-border px-3 py-1 hover:bg-accent">
              Próxima →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

import { auth } from "@/lib/auth";
import { prisma } from "@crm/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, Globe, Mail, Phone, Hash, Briefcase, User, Pencil } from "lucide-react";
import { deleteCompanyAction } from "@/app/actions/companies";
import { AddCompanyNoteForm } from "@/components/companies/AddCompanyNoteForm";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const company = await prisma.company.findUnique({ where: { id }, select: { name: true } });
  return { title: company?.name ?? "Empresa" };
}

export default async function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const { id } = await params;

  const company = await prisma.company.findFirst({
    where: { id, tenantId: session!.user.tenantId },
    include: {
      contacts: {
        select: { id: true, name: true, email: true, phone: true, role: true },
        orderBy: { name: "asc" },
      },
      notes: {
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      },
      _count: { select: { opportunities: true, leads: true } },
    },
  });

  if (!company) notFound();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Link href="/empresas" className="mt-1 text-muted-foreground hover:text-foreground">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{company.name}</h1>
            {company.industry && (
              <p className="text-sm text-muted-foreground">{company.industry}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href={`/empresas/${company.id}/edit`}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-accent"
          >
            <Pencil size={14} />
            Editar
          </Link>
          <form action={deleteCompanyAction}>
            <input type="hidden" name="id" value={company.id} />
            <button
              type="submit"
              className="rounded-md border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              Excluir
            </button>
          </form>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Info */}
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Informações</h2>

            {company.cnpj && (
              <div className="flex items-center gap-2 text-sm">
                <Hash size={14} className="text-muted-foreground shrink-0" />
                <span>{company.cnpj}</span>
              </div>
            )}
            {company.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail size={14} className="text-muted-foreground shrink-0" />
                <a href={`mailto:${company.email}`} className="hover:text-primary truncate">{company.email}</a>
              </div>
            )}
            {company.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone size={14} className="text-muted-foreground shrink-0" />
                <a href={`tel:${company.phone}`} className="hover:text-primary">{company.phone}</a>
              </div>
            )}
            {company.website && (
              <div className="flex items-center gap-2 text-sm">
                <Globe size={14} className="text-muted-foreground shrink-0" />
                <a href={company.website} target="_blank" rel="noopener noreferrer" className="hover:text-primary truncate">
                  {company.website.replace(/^https?:\/\//, "")}
                </a>
              </div>
            )}
            {company.industry && (
              <div className="flex items-center gap-2 text-sm">
                <Briefcase size={14} className="text-muted-foreground shrink-0" />
                <span>{company.industry}</span>
              </div>
            )}

            <div className="pt-2 border-t border-border grid grid-cols-2 gap-3 text-center">
              <div>
                <p className="text-lg font-bold">{company._count.opportunities}</p>
                <p className="text-xs text-muted-foreground">Oportunidades</p>
              </div>
              <div>
                <p className="text-lg font-bold">{company._count.leads}</p>
                <p className="text-xs text-muted-foreground">Leads</p>
              </div>
            </div>

            <div className="border-t border-border pt-2 text-xs text-muted-foreground">
              Criada em {company.createdAt.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
            </div>
          </div>

          {/* Contatos */}
          {company.contacts.length > 0 && (
            <div className="rounded-lg border border-border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Contatos ({company.contacts.length})
                </h2>
                <Link
                  href={`/contatos/new?companyId=${company.id}`}
                  className="text-xs text-primary hover:underline"
                >
                  + Novo
                </Link>
              </div>
              <div className="space-y-2">
                {company.contacts.map((c) => (
                  <Link
                    key={c.id}
                    href={`/contatos/${c.id}`}
                    className="flex items-start gap-2 text-sm hover:text-primary group"
                  >
                    <User size={14} className="mt-0.5 text-muted-foreground shrink-0" />
                    <div>
                      <p className="font-medium group-hover:text-primary">{c.name}</p>
                      {c.role && <p className="text-xs text-muted-foreground">{c.role}</p>}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {company.contacts.length === 0 && (
            <div className="rounded-lg border border-dashed border-border p-4 text-center">
              <p className="text-xs text-muted-foreground mb-2">Nenhum contato vinculado</p>
              <Link
                href={`/contatos/new?companyId=${company.id}`}
                className="text-xs text-primary hover:underline"
              >
                + Adicionar contato
              </Link>
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="lg:col-span-2 space-y-4">
          <AddCompanyNoteForm companyId={company.id} />

          <div className="rounded-lg border border-border bg-card">
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold">Notas</h2>
            </div>
            {company.notes.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Nenhuma nota ainda. Adicione uma acima.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {company.notes.map((note) => (
                  <div key={note.id} className="px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium">{note.user.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {note.createdAt.toLocaleDateString("pt-BR", {
                          day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

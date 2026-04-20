import { auth } from "@/lib/auth";
import { prisma } from "@crm/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, Mail, Phone, Briefcase, Building2 } from "lucide-react";
import { deleteContactAction } from "@/app/actions/contacts";
import { AddContactNoteForm } from "@/components/contacts/AddContactNoteForm";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const contact = await prisma.contact.findUnique({ where: { id }, select: { name: true } });
  return { title: contact?.name ?? "Contato" };
}

export default async function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const { id } = await params;

  const contact = await prisma.contact.findFirst({
    where: { id, tenantId: session!.user.tenantId },
    include: {
      company: { select: { id: true, name: true } },
      notes: {
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!contact) notFound();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Link href="/contatos" className="mt-1 text-muted-foreground hover:text-foreground">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{contact.name}</h1>
            {contact.role && <p className="text-sm text-muted-foreground">{contact.role}</p>}
          </div>
        </div>
        <form action={deleteContactAction} className="shrink-0">
          <input type="hidden" name="id" value={contact.id} />
          <button
            type="submit"
            className="rounded-md border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            Excluir
          </button>
        </form>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Info */}
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Informações</h2>

            {contact.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail size={14} className="text-muted-foreground shrink-0" />
                <a href={`mailto:${contact.email}`} className="hover:text-primary truncate">{contact.email}</a>
              </div>
            )}
            {contact.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone size={14} className="text-muted-foreground shrink-0" />
                <a href={`tel:${contact.phone}`} className="hover:text-primary">{contact.phone}</a>
              </div>
            )}
            {contact.role && (
              <div className="flex items-center gap-2 text-sm">
                <Briefcase size={14} className="text-muted-foreground shrink-0" />
                <span>{contact.role}</span>
              </div>
            )}
            {contact.company && (
              <div className="flex items-center gap-2 text-sm">
                <Building2 size={14} className="text-muted-foreground shrink-0" />
                <Link href={`/empresas/${contact.company.id}`} className="hover:text-primary">
                  {contact.company.name}
                </Link>
              </div>
            )}

            <div className="pt-1 border-t border-border text-xs text-muted-foreground">
              Criado em {contact.createdAt.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="lg:col-span-2 space-y-4">
          <AddContactNoteForm contactId={contact.id} />

          <div className="rounded-lg border border-border bg-card">
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold">Notas</h2>
            </div>
            {contact.notes.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Nenhuma nota ainda. Adicione uma acima.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {contact.notes.map((note) => (
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

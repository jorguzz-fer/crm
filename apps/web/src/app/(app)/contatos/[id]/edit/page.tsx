import { auth } from "@/lib/auth";
import { prisma } from "@crm/db";
import { notFound } from "next/navigation";
import { EditContactForm } from "@/components/contacts/EditContactForm";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = { title: "Editar Contato" };

export default async function EditContactPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const { id } = await params;

  const [contact, companies] = await Promise.all([
    prisma.contact.findFirst({ where: { id, tenantId: session!.user.tenantId } }),
    prisma.company.findMany({
      where: { tenantId: session!.user.tenantId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 200,
    }),
  ]);

  if (!contact) notFound();

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/contatos/${contact.id}`} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Editar contato</h1>
          <p className="text-sm text-muted-foreground">{contact.name}</p>
        </div>
      </div>
      <EditContactForm contact={contact} companies={companies} />
    </div>
  );
}

import { auth } from "@/lib/auth";
import { prisma } from "@crm/db";
import { CreateContactForm } from "@/components/contacts/CreateContactForm";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = { title: "Novo Contato" };

interface Props {
  searchParams: Promise<{ companyId?: string }>;
}

export default async function NewContactPage({ searchParams }: Props) {
  const session = await auth();
  const params = await searchParams;

  const companies = await prisma.company.findMany({
    where: { tenantId: session!.user.tenantId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
    take: 200,
  });

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/contatos" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Novo contato</h1>
          <p className="text-sm text-muted-foreground">Preencha os dados do contato</p>
        </div>
      </div>
      <CreateContactForm companies={companies} defaultCompanyId={params.companyId} />
    </div>
  );
}

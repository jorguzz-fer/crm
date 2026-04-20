import { auth } from "@/lib/auth";
import { prisma } from "@crm/db";
import { notFound } from "next/navigation";
import { EditCompanyForm } from "@/components/companies/EditCompanyForm";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = { title: "Editar Empresa" };

export default async function EditCompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const { id } = await params;

  const company = await prisma.company.findFirst({
    where: { id, tenantId: session!.user.tenantId },
  });

  if (!company) notFound();

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/empresas/${company.id}`} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Editar empresa</h1>
          <p className="text-sm text-muted-foreground">{company.name}</p>
        </div>
      </div>
      <EditCompanyForm company={company} />
    </div>
  );
}

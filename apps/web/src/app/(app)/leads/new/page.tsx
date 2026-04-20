import { auth } from "@/lib/auth";
import { prisma } from "@crm/db";
import { CreateLeadForm } from "@/components/leads/CreateLeadForm";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = { title: "Novo Lead" };

export default async function NewLeadPage() {
  const session = await auth();

  const users = await prisma.user.findMany({
    where: { tenantId: session!.user.tenantId, active: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/leads" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Novo lead</h1>
          <p className="text-sm text-muted-foreground">Preencha os dados do lead</p>
        </div>
      </div>
      <CreateLeadForm users={users} />
    </div>
  );
}

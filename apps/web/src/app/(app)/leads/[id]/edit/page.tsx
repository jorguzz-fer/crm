import { auth } from "@/lib/auth";
import { prisma } from "@crm/db";
import { notFound } from "next/navigation";
import { EditLeadForm } from "@/components/leads/EditLeadForm";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = { title: "Editar Lead" };

export default async function EditLeadPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const { id } = await params;

  const [lead, users] = await Promise.all([
    prisma.lead.findFirst({
      where: { id, tenantId: session!.user.tenantId },
    }),
    prisma.user.findMany({
      where: { tenantId: session!.user.tenantId, active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!lead) notFound();

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/leads/${lead.id}`} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Editar lead</h1>
          <p className="text-sm text-muted-foreground">{lead.name}</p>
        </div>
      </div>
      <EditLeadForm lead={lead} users={users} />
    </div>
  );
}

import { CreateCompanyForm } from "@/components/companies/CreateCompanyForm";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = { title: "Nova Empresa" };

export default function NewCompanyPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/empresas" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Nova empresa</h1>
          <p className="text-sm text-muted-foreground">Preencha os dados da empresa</p>
        </div>
      </div>
      <CreateCompanyForm />
    </div>
  );
}

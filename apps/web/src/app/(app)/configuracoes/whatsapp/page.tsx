import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { WaSetupCard } from "@/components/whatsapp/WaSetupCard";
import { isConfigured } from "@/lib/evolution";
import { AlertTriangle, MessageCircle } from "lucide-react";

export const metadata: Metadata = { title: "WhatsApp" };

export default async function WhatsAppSettingsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const instance = await prisma.whatsAppInstance.findUnique({
    where: { tenantId: session.user.tenantId },
  });

  const configured = isConfigured();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">WhatsApp</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Conecte um número de WhatsApp para receber e responder mensagens diretamente no CRM.
        </p>
      </div>

      {!configured && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-amber-800">Evolution API não configurada</p>
            <p className="text-amber-700 mt-1">
              Adicione as variáveis de ambiente{" "}
              <code className="bg-amber-100 px-1 rounded font-mono text-xs">EVOLUTION_API_URL</code> e{" "}
              <code className="bg-amber-100 px-1 rounded font-mono text-xs">EVOLUTION_API_KEY</code>{" "}
              no Coolify para ativar a integração com WhatsApp.
            </p>
          </div>
        </div>
      )}

      <div className="flex gap-8 flex-wrap">
        <WaSetupCard
          status={instance?.status ?? "DISCONNECTED"}
          phone={instance?.phone ?? null}
          qrCode={instance?.qrCode ?? null}
        />

        <div className="space-y-4 max-w-sm">
          <div className="flex items-center gap-2 text-sm font-medium">
            <MessageCircle size={16} className="text-primary" />
            Como funciona
          </div>
          <ol className="space-y-3 text-sm text-muted-foreground list-none">
            {[
              'Clique em "Conectar WhatsApp" e escaneie o QR Code com seu celular.',
              "O número vinculado passa a receber mensagens no CRM.",
              "Mensagens chegam automaticamente na caixa de entrada.",
              "Leads são detectados automaticamente pelo número de telefone.",
              "Responda diretamente do CRM sem sair da plataforma.",
            ].map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex-none w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-medium flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>

          <div className="rounded-md border border-border p-3 text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">Aviso de uso</p>
            <p>
              Esta integração usa a Evolution API (biblioteca não oficial). O uso de APIs não
              oficiais pode violar os Termos de Serviço do WhatsApp. Recomendamos usar um número
              dedicado ao CRM e não o número pessoal.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

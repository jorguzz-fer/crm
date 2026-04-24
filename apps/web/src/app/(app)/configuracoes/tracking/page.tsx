import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { TrackingConfigForm } from "./TrackingConfigForm";
import { BarChart2 } from "lucide-react";

export const metadata: Metadata = { title: "Tracking & Conversões" };

export default async function TrackingSettingsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const tenantId = session.user.tenantId;
  const isAdmin = ["SUPERADMIN", "ADMIN"].includes(session.user.role);

  const config = await prisma.tenantTrackingConfig.findUnique({
    where: { tenantId },
    select: {
      metaPixelId: true,
      metaAccessToken: true,
      hotmartHottok: true,
      pagarmeWebhookSecret: true,
    },
  });

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Tracking & Conversões</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure as integrações de rastreamento de conversões e gateways de pagamento.
        </p>
      </div>

      {!isAdmin ? (
        <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
          <BarChart2 size={16} className="shrink-0 mt-0.5" />
          <p>Apenas administradores podem editar as configurações de tracking.</p>
        </div>
      ) : (
        <TrackingConfigForm
          metaPixelId={config?.metaPixelId ?? null}
          metaAccessToken={config?.metaAccessToken ?? null}
          hotmartHottok={config?.hotmartHottok ?? null}
          pagarmeWebhookSecret={config?.pagarmeWebhookSecret ?? null}
          tenantId={tenantId}
        />
      )}
    </div>
  );
}

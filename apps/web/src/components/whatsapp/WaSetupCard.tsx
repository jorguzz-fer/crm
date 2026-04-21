"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import {
  connectWhatsAppAction,
  disconnectWhatsAppAction,
  refreshQrAction,
} from "@/app/actions/whatsapp";
import { CheckCircle, Loader2, MessageCircle, RefreshCw, Wifi, WifiOff } from "lucide-react";

type ActionResult = { error: string } | { success: string; qrCode?: string } | null;

interface Props {
  status: "DISCONNECTED" | "CONNECTING" | "CONNECTED";
  phone: string | null;
  qrCode: string | null;
}

export function WaSetupCard({ status: initialStatus, phone: initialPhone, qrCode: initialQr }: Props) {
  const [connectState, connectAction, connectPending] = useActionState<ActionResult, FormData>(
    connectWhatsAppAction,
    null
  );
  const [disconnectState, disconnectAction, disconnectPending] = useActionState<ActionResult, FormData>(
    disconnectWhatsAppAction,
    null
  );

  const [qrCode, setQrCode] = useState(initialQr);
  const [status, setStatus] = useState(initialStatus);
  const phone = initialPhone; // atualiza via webhook → page refresh
  const [refreshing, startRefresh] = useTransition();

  // Polling enquanto estiver conectando: atualiza QR e status a cada 10s
  useEffect(() => {
    if (status === "CONNECTED" || status === "DISCONNECTED") return;

    const interval = setInterval(() => {
      startRefresh(async () => {
        const result = await refreshQrAction();
        if (result.qrCode) setQrCode(result.qrCode);
        if (result.status === "CONNECTED") {
          setStatus("CONNECTED");
          clearInterval(interval);
        }
      });
    }, 10_000);

    return () => clearInterval(interval);
  }, [status]);

  // Pega QR do resultado da connectAction
  useEffect(() => {
    if (connectState && "success" in connectState && connectState.qrCode) {
      setQrCode(connectState.qrCode);
      setStatus("CONNECTING");
    }
  }, [connectState]);

  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-6 max-w-md">
      {/* Status badge */}
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-full ${status === "CONNECTED" ? "bg-green-100" : status === "CONNECTING" ? "bg-amber-100" : "bg-muted"}`}>
          {status === "CONNECTED" ? (
            <Wifi size={20} className="text-green-600" />
          ) : status === "CONNECTING" ? (
            <Loader2 size={20} className="text-amber-600 animate-spin" />
          ) : (
            <WifiOff size={20} className="text-muted-foreground" />
          )}
        </div>
        <div>
          <p className="font-medium text-sm">
            {status === "CONNECTED" ? "WhatsApp conectado" :
             status === "CONNECTING" ? "Aguardando leitura do QR Code..." :
             "WhatsApp desconectado"}
          </p>
          {phone && <p className="text-xs text-muted-foreground">{phone}</p>}
        </div>
      </div>

      {/* Feedback */}
      {connectState && "error" in connectState && (
        <p className="text-sm text-destructive">{connectState.error}</p>
      )}
      {disconnectState && "error" in disconnectState && (
        <p className="text-sm text-destructive">{disconnectState.error}</p>
      )}
      {disconnectState && "success" in disconnectState && (
        <p className="text-sm text-green-600">{disconnectState.success}</p>
      )}

      {/* QR Code */}
      {status === "CONNECTING" && qrCode && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground text-center">
            Abra o WhatsApp no celular → Dispositivos conectados → Conectar um dispositivo
          </p>
          <div className="flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrCode}
              alt="QR Code WhatsApp"
              className="w-52 h-52 rounded-lg border border-border"
            />
          </div>
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
            QR atualiza automaticamente a cada 10s
          </div>
        </div>
      )}

      {/* Connected info */}
      {status === "CONNECTED" && (
        <div className="flex items-center gap-2 rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-800">
          <CheckCircle size={16} />
          Pronto para enviar e receber mensagens
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {status !== "CONNECTED" && (
          <form action={connectAction} className="flex-1">
            <button
              type="submit"
              disabled={connectPending}
              className="w-full flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {connectPending ? <Loader2 size={14} className="animate-spin" /> : <MessageCircle size={14} />}
              {status === "CONNECTING" ? "Novo QR Code" : "Conectar WhatsApp"}
            </button>
          </form>
        )}

        {status !== "DISCONNECTED" && (
          <form action={disconnectAction}>
            <button
              type="submit"
              disabled={disconnectPending}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent disabled:opacity-50"
            >
              Desconectar
            </button>
          </form>
        )}
      </div>
    </div>
  );
}


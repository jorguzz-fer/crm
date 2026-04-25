"use client";

import { useState, useTransition, useActionState } from "react";
import { ShieldCheck, ShieldOff, Loader2, CheckCircle } from "lucide-react";
import { setup2FAAction, enable2FAAction, disable2FAAction } from "@/app/actions/twoFactor";

interface Props { enabled: boolean }

export function TwoFactorSetup({ enabled }: Props) {
  const [step, setStep]     = useState<"idle" | "setup" | "disable">("idle");
  const [qrData, setQrData] = useState<{ qrDataUrl: string; secret: string } | null>(null);
  const [setupError, setSetupError]     = useState<string | null>(null);
  const [setupLoading, startSetup]      = useTransition();

  const [enableState, enableAction, enablePending]   = useActionState(enable2FAAction, null);
  const [disableState, disableAction, disablePending] = useActionState(disable2FAAction, null);

  const isEnabled = enabled ||
    (enableState != null && "success" in enableState && enableState.success === true);
  const isDisabled = !enabled ||
    (disableState != null && "success" in disableState && disableState.success === true);

  function startSetupFlow() {
    setSetupError(null);
    startSetup(async () => {
      const result = await setup2FAAction();
      if ("error" in result) {
        setSetupError(result.error);
      } else {
        setQrData({ qrDataUrl: result.qrDataUrl, secret: result.secret });
        setStep("setup");
      }
    });
  }

  // ── Estado: 2FA desativado ────────────────────────────────────────────────
  if ((!isEnabled || isDisabled) && step === "idle") {
    return (
      <div className="rounded-lg border border-border bg-card p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-muted p-2 shrink-0">
            <ShieldOff size={18} className="text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium">2FA desativado</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Adicione uma camada extra de segurança usando um aplicativo autenticador
              (Google Authenticator, Authy, etc.).
            </p>
          </div>
        </div>
        {setupError && (
          <p className="text-sm text-destructive">{setupError}</p>
        )}
        <button
          onClick={startSetupFlow}
          disabled={setupLoading}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {setupLoading && <Loader2 size={14} className="animate-spin" />}
          Ativar 2FA
        </button>
      </div>
    );
  }

  // ── Estado: configurando (mostra QR code) ─────────────────────────────────
  if (step === "setup" && qrData) {
    const verifySuccess = enableState != null && "success" in enableState && enableState.success;
    if (verifySuccess) {
      return (
        <div className="rounded-lg border border-green-200 bg-green-50 p-5 flex items-center gap-3">
          <CheckCircle size={20} className="text-green-600 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-green-800">2FA ativado com sucesso!</p>
            <p className="text-xs text-green-700 mt-0.5">
              Sua conta agora requer o código do autenticador a cada login.
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="rounded-lg border border-border bg-card p-5 space-y-5">
        <p className="text-sm font-medium">Passo 1 — Escaneie o QR code</p>
        <div className="flex flex-col sm:flex-row items-center gap-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrData.qrDataUrl}
            alt="QR Code 2FA"
            className="rounded-lg border border-border"
            width={200}
            height={200}
          />
          <div className="space-y-2 min-w-0">
            <p className="text-xs text-muted-foreground">
              Abra Google Authenticator, Authy ou outro app compatível com TOTP e
              escaneie o QR code. Se preferir, use o código manual abaixo:
            </p>
            <div className="rounded-md bg-muted px-3 py-2 font-mono text-xs tracking-widest break-all select-all">
              {qrData.secret}
            </div>
          </div>
        </div>

        <div className="border-t border-border pt-4 space-y-3">
          <p className="text-sm font-medium">Passo 2 — Confirme com o primeiro código</p>
          <form action={enableAction} className="flex items-center gap-3">
            <input
              name="code"
              type="text"
              inputMode="numeric"
              maxLength={6}
              pattern="\d{6}"
              required
              autoFocus
              placeholder="000000"
              className="w-32 rounded-md border border-input bg-background px-3 py-2 text-sm text-center tracking-[0.3em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <button
              type="submit"
              disabled={enablePending}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {enablePending && <Loader2 size={14} className="animate-spin" />}
              Verificar e ativar
            </button>
          </form>
          {enableState && "error" in enableState && (
            <p className="text-sm text-destructive">{enableState.error}</p>
          )}
        </div>

        <button
          type="button"
          onClick={() => { setStep("idle"); setQrData(null); }}
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          Cancelar
        </button>
      </div>
    );
  }

  // ── Estado: 2FA ativado ───────────────────────────────────────────────────
  if (step === "disable") {
    const disableSuccess = disableState != null && "success" in disableState && disableState.success;
    if (disableSuccess) {
      return (
        <div className="rounded-lg border border-border bg-card p-5 flex items-center gap-3">
          <ShieldOff size={18} className="text-muted-foreground" />
          <p className="text-sm">2FA desativado com sucesso.</p>
        </div>
      );
    }

    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-5 space-y-3">
        <p className="text-sm font-medium text-destructive">Desativar autenticação em dois fatores</p>
        <p className="text-xs text-muted-foreground">
          Digite o código atual do seu autenticador para confirmar a desativação.
        </p>
        <form action={disableAction} className="flex items-center gap-3">
          <input
            name="code"
            type="text"
            inputMode="numeric"
            maxLength={6}
            pattern="\d{6}"
            required
            autoFocus
            placeholder="000000"
            className="w-32 rounded-md border border-input bg-background px-3 py-2 text-sm text-center tracking-[0.3em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <button
            type="submit"
            disabled={disablePending}
            className="inline-flex items-center gap-2 rounded-md border border-destructive px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
          >
            {disablePending && <Loader2 size={14} className="animate-spin" />}
            Confirmar desativação
          </button>
        </form>
        {disableState && "error" in disableState && (
          <p className="text-sm text-destructive">{disableState.error}</p>
        )}
        <button
          type="button"
          onClick={() => setStep("idle")}
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          Cancelar
        </button>
      </div>
    );
  }

  // ── Estado: 2FA ativo ─────────────────────────────────────────────────────
  return (
    <div className="rounded-lg border border-green-200 bg-green-50/50 p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-green-100 p-2 shrink-0">
          <ShieldCheck size={18} className="text-green-600" />
        </div>
        <div>
          <p className="text-sm font-medium text-green-800">2FA está ativo</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Sua conta está protegida. O código do autenticador é solicitado a cada login.
          </p>
        </div>
      </div>
      <button
        onClick={() => setStep("disable")}
        className="inline-flex items-center gap-2 rounded-md border border-destructive/50 px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10"
      >
        <ShieldOff size={14} />
        Desativar 2FA
      </button>
    </div>
  );
}

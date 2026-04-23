"use client";

import { useActionState, useState, useEffect } from "react";
import { MapPin, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { createVisitAction, type ActionState } from "@/app/actions/visits";

interface Lead        { id: string; name: string }
interface Company     { id: string; name: string }
interface Opportunity { id: string; title: string }

interface Props {
  leads:         Lead[];
  companies:     Company[];
  opportunities: Opportunity[];
  // pré-seleção via URL param (ex: vindo de /leads/[id])
  defaultLeadId?:        string;
  defaultCompanyId?:     string;
  defaultOpportunityId?: string;
}

function nowLocalISO() {
  const now = new Date();
  // formato esperado por datetime-local: "YYYY-MM-DDTHH:mm"
  return now.toISOString().slice(0, 16);
}

export function NovaVisitaForm({
  leads, companies, opportunities,
  defaultLeadId, defaultCompanyId, defaultOpportunityId,
}: Props) {
  const [state, action, pending] = useActionState<ActionState, FormData>(createVisitAction, null);

  // Geolocalização
  const [geoStatus, setGeoStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [lat, setLat]         = useState("");
  const [lng, setLng]         = useState("");
  const [address, setAddress] = useState("");

  const success = state && "success" in state;

  // Limpa form após sucesso
  useEffect(() => {
    if (success) {
      setLat(""); setLng(""); setAddress(""); setGeoStatus("idle");
    }
  }, [success]);

  function captureGeo() {
    if (!navigator.geolocation) {
      setGeoStatus("error");
      return;
    }
    setGeoStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const la = pos.coords.latitude.toFixed(6);
        const lo = pos.coords.longitude.toFixed(6);
        setLat(la); setLng(lo);
        setGeoStatus("ok");
        // Reverse geocode via nominatim (OpenStreetMap — gratuito, sem API key)
        fetch(`https://nominatim.openstreetmap.org/reverse?lat=${la}&lon=${lo}&format=json`)
          .then((r) => r.json())
          .then((data) => { if (data.display_name) setAddress(data.display_name); })
          .catch(() => {}); // não critico: endereço é opcional
      },
      () => setGeoStatus("error"),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  return (
    <form action={action} className="space-y-5 rounded-lg border border-border bg-card p-5">
      <h2 className="text-sm font-semibold">Registrar visita</h2>

      {/* Feedback */}
      {success && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          <CheckCircle size={15} className="shrink-0" />
          Visita registrada com sucesso!
        </div>
      )}
      {state && "error" in state && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle size={15} className="shrink-0" />
          {state.error}
        </div>
      )}

      {/* Assunto */}
      <div>
        <label className="mb-1 block text-xs font-medium">Assunto / Motivo *</label>
        <input
          name="subject"
          required
          placeholder="Ex: Apresentação de proposta"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {/* Data e hora */}
      <div>
        <label className="mb-1 block text-xs font-medium">Data e hora da visita</label>
        <input
          type="datetime-local"
          name="visitedAt"
          defaultValue={nowLocalISO()}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {/* Localização */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="text-xs font-medium">Localização</label>
          <button
            type="button"
            onClick={captureGeo}
            disabled={geoStatus === "loading"}
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-50"
          >
            {geoStatus === "loading"
              ? <><Loader2 size={12} className="animate-spin" />Capturando…</>
              : geoStatus === "ok"
                ? <><CheckCircle size={12} className="text-green-600" />Localização capturada</>
                : geoStatus === "error"
                  ? <><AlertCircle size={12} className="text-amber-600" />Tentar novamente</>
                  : <><MapPin size={12} />Usar minha localização</>
            }
          </button>
        </div>
        <input type="hidden" name="lat" value={lat} />
        <input type="hidden" name="lng" value={lng} />
        <input
          name="address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Endereço (preenchido automaticamente ou manual)"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        {lat && lng && (
          <p className="mt-1 text-xs text-muted-foreground">
            Coordenadas: {lat}, {lng}
          </p>
        )}
      </div>

      {/* Vincular a */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium">Lead</label>
          <select
            name="leadId"
            defaultValue={defaultLeadId ?? ""}
            className="w-full rounded-md border border-input bg-background px-2 py-2 text-sm focus-visible:outline-none"
          >
            <option value="">Nenhum</option>
            {leads.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">Empresa</label>
          <select
            name="companyId"
            defaultValue={defaultCompanyId ?? ""}
            className="w-full rounded-md border border-input bg-background px-2 py-2 text-sm focus-visible:outline-none"
          >
            <option value="">Nenhuma</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">Oportunidade</label>
          <select
            name="opportunityId"
            defaultValue={defaultOpportunityId ?? ""}
            className="w-full rounded-md border border-input bg-background px-2 py-2 text-sm focus-visible:outline-none"
          >
            <option value="">Nenhuma</option>
            {opportunities.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
          </select>
        </div>
      </div>

      {/* Observações */}
      <div>
        <label className="mb-1 block text-xs font-medium">Observações</label>
        <textarea
          name="notes"
          rows={3}
          placeholder="Detalhes da visita, pontos discutidos…"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
        />
      </div>

      {/* Resultado */}
      <div>
        <label className="mb-1 block text-xs font-medium">Resultado / próximos passos</label>
        <input
          name="outcome"
          placeholder="Ex: Proposta aceita, retorno em 3 dias"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {pending && <Loader2 size={14} className="animate-spin" />}
        {pending ? "Salvando…" : "Registrar visita"}
      </button>
    </form>
  );
}

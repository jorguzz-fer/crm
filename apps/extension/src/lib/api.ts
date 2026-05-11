/**
 * Cliente da API do CRM para a extensão Chrome.
 * Usa Personal Access Token (Bearer) ao invés de cookie de sessão.
 */

import { getConfig } from "./storage";

export interface LeadData {
  name:      string;
  email?:    string;
  phone?:    string;
  company?:  string;
  position?: string;   // cargo — mapeado para o campo `company` com nota
  source:    "COLD_OUTREACH" | "WEBSITE" | "INDICACAO" | "WHATSAPP" | "OUTRO";
  notes?:    string;
  linkedinUrl?: string;
}

export interface ApiError {
  error: string;
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const config = await getConfig();
  if (!config?.apiUrl || !config?.apiToken) {
    throw new Error("Extensão não configurada. Acesse as configurações.");
  }

  const url     = `${config.apiUrl.replace(/\/$/, "")}${path}`;
  const headers = {
    "Content-Type":  "application/json",
    "Authorization": `Bearer ${config.apiToken}`,
    ...(options.headers ?? {}),
  };

  const res = await fetch(url, { ...options, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error((body as ApiError).error ?? `Erro ${res.status}`);
  }

  return res.json() as Promise<T>;
}

// ── Leads ─────────────────────────────────────────────────────────────────────

export interface Lead {
  id:        string;
  name:      string;
  email:     string | null;
  phone:     string | null;
  company:   string | null;
  source:    string;
  status:    string;
  createdAt: string;
}

export async function createLead(data: LeadData): Promise<Lead> {
  return apiFetch<Lead>("/api/extension/leads", {
    method: "POST",
    body:   JSON.stringify(data),
  });
}

export async function getRecentLeads(): Promise<Lead[]> {
  return apiFetch<Lead[]>("/api/extension/leads?limit=5");
}

// ── Auth validation ───────────────────────────────────────────────────────────

export interface ExtensionMe {
  id:       string;
  name:     string;
  email:    string;
  tenantId: string;
}

export async function validateToken(): Promise<ExtensionMe> {
  return apiFetch<ExtensionMe>("/api/extension/me");
}

/**
 * Cliente tipado para a Evolution API v2.
 * Compatível também com Evolution Go (mesma API REST).
 *
 * Docs: https://doc.evolution-api.com/v2
 */

const BASE_URL = (process.env.EVOLUTION_API_URL ?? "").replace(/\/$/, "");
const API_KEY  = process.env.EVOLUTION_API_KEY ?? "";

function headers() {
  return {
    "Content-Type": "application/json",
    apikey: API_KEY,
  };
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  if (!BASE_URL) throw new Error("EVOLUTION_API_URL não configurado");
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { ...headers(), ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Evolution API ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

export function isConfigured() {
  return Boolean(BASE_URL && API_KEY);
}

// ─── Instance management ──────────────────────────────────────────────────────

export interface CreateInstanceResult {
  instance: { instanceName: string; status: string };
  hash: { apikey: string };
  settings: Record<string, unknown>;
}

export async function createInstance(
  instanceName: string,
  webhookUrl: string
): Promise<CreateInstanceResult> {
  return req("/instance/create", {
    method: "POST",
    body: JSON.stringify({
      instanceName,
      qrcode: true,
      integration: "WHATSAPP-BAILEYS",
      webhook: {
        enabled: true,
        url: webhookUrl,
        webhookByEvents: false,
        webhookBase64: false,
        events: [
          "MESSAGES_UPSERT",
          "CONNECTION_UPDATE",
          "QRCODE_UPDATED",
          "MESSAGES_UPDATE",
        ],
      },
    }),
  });
}

export interface QRCodeResult {
  pairingCode: string | null;
  code: string;
  base64: string; // data:image/png;base64,...
  count?: number;
}

/** Conecta/reconecta a instância e retorna o QR code atual */
export async function connectInstance(instanceName: string): Promise<{ base64?: string; code?: string }> {
  const data = await req<{ base64?: string; code?: string; pairingCode?: string }>(
    `/instance/connect/${instanceName}`
  );
  return data;
}

export interface InstanceState {
  instance: { instanceName: string; state: "open" | "close" | "connecting" | string };
}

export async function getInstanceState(instanceName: string): Promise<InstanceState> {
  return req(`/instance/connectionState/${instanceName}`);
}

export async function deleteInstance(instanceName: string): Promise<unknown> {
  return req(`/instance/delete/${instanceName}`, { method: "DELETE" });
}

export async function logoutInstance(instanceName: string): Promise<unknown> {
  return req(`/instance/logout/${instanceName}`, { method: "DELETE" });
}

// ─── Messaging ────────────────────────────────────────────────────────────────

export interface SendTextResult {
  key: { remoteJid: string; fromMe: boolean; id: string };
  message: { conversation: string };
  messageTimestamp: number;
  status: string;
}

/** Envia mensagem de texto. `to` deve ser "55119..." (sem @s.whatsapp.net) */
export async function sendText(
  instanceName: string,
  to: string,
  text: string
): Promise<SendTextResult> {
  // Normaliza: adiciona @s.whatsapp.net se não tiver
  const number = to.includes("@") ? to : `${to}@s.whatsapp.net`;
  return req(`/message/sendText/${instanceName}`, {
    method: "POST",
    body: JSON.stringify({ number, text }),
  });
}

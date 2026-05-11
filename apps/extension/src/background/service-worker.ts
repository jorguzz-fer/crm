/**
 * Background Service Worker
 *
 * Centraliza chamadas à API do CRM — service workers não têm restrição
 * de CORS e não são afetados pela CSP da página LinkedIn.
 *
 * Mensagens aceitas (content script e popup):
 *   CREATE_LEAD   { data }        → { ok, data } | { ok: false, error }
 *   GET_LEADS     { limit? }      → { ok, data }
 *   VALIDATE_ME   {}              → { ok, data }
 */

async function getConfig(): Promise<{ apiUrl: string; apiToken: string } | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get(["apiUrl", "apiToken"], (r) =>
      resolve(r.apiUrl && r.apiToken ? { apiUrl: r.apiUrl, apiToken: r.apiToken } : null)
    );
  });
}

async function apiFetch(path: string, options: RequestInit = {}) {
  const cfg = await getConfig();
  if (!cfg) throw new Error("Extensão não configurada");
  const res = await fetch(`${cfg.apiUrl.replace(/\/$/, "")}${path}`, {
    ...options,
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${cfg.apiToken}`,
      ...(options.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
  if (!res.ok) throw new Error(body.error ?? `Erro ${res.status}`);
  return body;
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      switch (msg.type) {
        case "CREATE_LEAD":
          sendResponse({ ok: true, data: await apiFetch("/api/extension/leads", { method: "POST", body: JSON.stringify(msg.data) }) });
          break;
        case "GET_LEADS":
          sendResponse({ ok: true, data: await apiFetch(`/api/extension/leads?limit=${msg.limit ?? 5}`) });
          break;
        case "VALIDATE_ME":
          sendResponse({ ok: true, data: await apiFetch("/api/extension/me") });
          break;
        default:
          sendResponse({ ok: false, error: "Mensagem desconhecida" });
      }
    } catch (e) {
      sendResponse({ ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  })();
  return true; // keep channel open for async
});

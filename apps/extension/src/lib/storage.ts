/**
 * Abstração sobre chrome.storage.local para auth e config da extensão.
 */

export interface ExtensionConfig {
  apiUrl:   string;  // ex: https://crm.minhaempresa.com
  apiToken: string;  // Personal Access Token gerado em Configurações > Segurança
}

const STORAGE_KEY = "crm_config";

export async function getConfig(): Promise<ExtensionConfig | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY], (result) => {
      resolve(result[STORAGE_KEY] ?? null);
    });
  });
}

export async function saveConfig(config: ExtensionConfig): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEY]: config }, resolve);
  });
}

export async function clearConfig(): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.remove([STORAGE_KEY], resolve);
  });
}

export async function isConfigured(): Promise<boolean> {
  const config = await getConfig();
  return !!(config?.apiUrl && config?.apiToken);
}

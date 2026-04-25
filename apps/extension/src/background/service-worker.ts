/**
 * Background Service Worker — Manifest V3
 *
 * Responsabilidades:
 *  - Criar item no menu de contexto "Capturar como Lead"
 *  - Receber mensagens do content script (dados extraídos do LinkedIn)
 *  - Receber mensagens do popup (criar lead, validar token)
 *  - Abrir o popup programaticamente quando necessário
 */

import { getConfig } from "../lib/storage";

// ── Menu de contexto ──────────────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id:       "capture-lead",
    title:    "Capturar como Lead no CRM",
    contexts: ["page", "selection"],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "capture-lead" || !tab?.id) return;

  // Abre o popup programaticamente (fallback: envia mensagem ao content script)
  // Na prática, o usuário clica no ícone da extensão após selecionar texto
  const config = await getConfig();
  if (!config?.apiToken) {
    // Abre a tela de configuração
    chrome.action.openPopup?.();
    return;
  }

  // Passa o texto selecionado como hint para o popup
  if (info.selectionText) {
    await chrome.storage.session.set({ captureHint: info.selectionText });
  }

  chrome.action.openPopup?.();
});

// ── Mensagens do popup / content scripts ─────────────────────────────────────
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "PING") {
    sendResponse({ type: "PONG" });
    return true;
  }

  // Injeta o content script na aba ativa para extrair dados
  if (message.type === "EXTRACT_PAGE_DATA") {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const tab = tabs[0];
      if (!tab?.id) return sendResponse({ error: "Sem aba ativa" });

      try {
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func:   extractPageDataInPage,
        });
        sendResponse({ data: results[0]?.result ?? null });
      } catch (e) {
        sendResponse({ error: String(e) });
      }
    });
    return true; // async
  }
});

// ── Função injetada na página para extrair dados ──────────────────────────────
function extractPageDataInPage() {
  const url = window.location.href;

  // LinkedIn profile page
  if (url.includes("linkedin.com/in/")) {
    const name    = document.querySelector("h1")?.textContent?.trim() ?? "";
    const title   = document.querySelector(".text-body-medium.break-words")?.textContent?.trim() ?? "";
    const company = document.querySelector(".inline-show-more-text--is-collapsed:first-of-type")?.textContent?.trim() ?? "";
    const email   = document.querySelector("a[href^='mailto:']")?.getAttribute("href")?.replace("mailto:", "") ?? "";

    return { name, title, company, email, source: "COLD_OUTREACH", linkedinUrl: url };
  }

  // Página genérica — usa título e URL como hint
  return {
    name:    document.title ?? "",
    company: new URL(url).hostname.replace("www.", ""),
    source:  "WEBSITE",
    pageUrl: url,
  };
}

/**
 * Content Script — LinkedIn Profile Pages
 *
 * Injeta um botão "Salvar no CRM" abaixo do nome do perfil LinkedIn.
 * Ao clicar, abre o popup da extensão com os dados pré-preenchidos.
 */

function getLinkedInProfileData() {
  const name    = document.querySelector("h1")?.textContent?.trim() ?? "";
  const title   = (document.querySelector(".text-body-medium.break-words") as HTMLElement)
                    ?.innerText?.trim() ?? "";
  const company = (document.querySelectorAll(".pv-text-details__right-panel-item-text")[0] as HTMLElement)
                    ?.innerText?.trim() ?? "";
  const email   = document.querySelector("a[href^='mailto:']")
                    ?.getAttribute("href")?.replace("mailto:", "") ?? "";

  return { name, title, company, email, source: "COLD_OUTREACH", linkedinUrl: window.location.href };
}

function injectSaveButton() {
  // Evita duplicatas
  if (document.getElementById("crm-save-btn")) return;

  const targetEl = document.querySelector("h1")?.parentElement;
  if (!targetEl) return;

  const btn = document.createElement("button");
  btn.id = "crm-save-btn";
  btn.textContent = "💾 Salvar no CRM";
  btn.style.cssText = `
    margin-top: 8px;
    padding: 6px 14px;
    font-size: 13px;
    font-weight: 600;
    background: #2563eb;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  `;

  btn.addEventListener("click", () => {
    const data = getLinkedInProfileData();
    // Salva na storage de sessão para o popup pegar
    chrome.storage.session.set({ linkedinCapture: data });
    // Sinaliza o background para abrir o popup
    chrome.runtime.sendMessage({ type: "OPEN_POPUP", data });
  });

  targetEl.insertAdjacentElement("afterend", btn);
}

// Aguarda carregamento da SPA do LinkedIn
const observer = new MutationObserver(() => {
  if (window.location.pathname.startsWith("/in/")) {
    injectSaveButton();
  }
});

observer.observe(document.body, { childList: true, subtree: true });

// Tenta imediatamente também
if (window.location.pathname.startsWith("/in/")) {
  injectSaveButton();
}

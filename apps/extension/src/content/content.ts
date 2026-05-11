/**
 * Content Script — LinkedIn
 *
 * Injeta um botão flutuante "Adicionar ao CRM" e um sidebar
 * deslizante pela direita com o formulário de captura de lead.
 *
 * Todo o CSS fica dentro de um Shadow DOM — completamente isolado
 * dos estilos do LinkedIn.
 *
 * Chamadas de API são feitas via chrome.runtime.sendMessage →
 * background service worker (sem restrição de CSP / CORS).
 */

// ── Extração de dados do perfil ───────────────────────────────────────────────

interface ProfileData {
  name:        string;
  title:       string;
  company:     string;
  email:       string;
  phone:       string;
  linkedinUrl: string;
}

function getProfileData(): ProfileData {
  // ── 1) NOME ──────────────────────────────────────────────────────────────
  // document.title é o mais confiável em SPA — LinkedIn sempre o atualiza.
  // Formato: "Alexandre Messina | LinkedIn"
  let name = "";
  if (document.title?.includes("LinkedIn")) {
    const beforePipe = document.title.split("|")[0].trim();
    name = beforePipe.split(/\s+[–—-]\s+/)[0].trim();
  }
  if (!name) {
    const h1 =
      document.querySelector<HTMLElement>("main h1") ||
      document.querySelector<HTMLElement>("h1.text-heading-xlarge") ||
      document.querySelector<HTMLElement>("h1");
    name = h1?.innerText?.trim() || "";
  }
  const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute("content") || "";
  if (!name && ogTitle) name = ogTitle.split(/[|–—]/)[0].trim();

  // ── 2) HEADLINE / CARGO ──────────────────────────────────────────────────
  let title = "";

  // Helper: pega só a primeira linha não-vazia (evita pegar localização/seguidores juntos)
  const firstLine = (s: string) =>
    s.split(/\n/).map(l => l.trim()).find(l => l.length > 0) ?? "";

  // A) Seletores CSS do LinkedIn — pega só a 1ª linha do elemento
  const headlineSelectors = [
    ".text-body-medium.break-words",
    ".pv-text-details__left-panel .text-body-medium",
    "[data-generated-suggestion-target]",
    ".ph5 .text-body-medium",
    "main .text-body-medium",
  ];
  for (const sel of headlineSelectors) {
    const el = document.querySelector<HTMLElement>(sel);
    const raw = (el?.innerText || el?.textContent || "").trim();
    const t   = firstLine(raw);
    if (t && t.length >= 3 && t.length < 300 && !/conexões|connections|\d+\+/i.test(t)) {
      title = t; break;
    }
  }

  // B) Estrutural: percorre ancestrais do h1 procurando o próximo irmão com texto de headline
  // O LinkedIn envolve o h1 em até 3 níveis de div — precisamos subir na árvore.
  if (!title) {
    const h1 = document.querySelector<HTMLElement>("main h1") || document.querySelector<HTMLElement>("h1");
    if (h1) {
      let ancestor: HTMLElement | null = h1;
      outer: for (let depth = 0; depth < 4 && ancestor; depth++, ancestor = ancestor.parentElement) {
        const parent = ancestor.parentElement;
        if (!parent) continue;
        const children = Array.from(parent.children) as HTMLElement[];
        const idx = children.indexOf(ancestor);
        for (let j = idx + 1; j < Math.min(idx + 4, children.length); j++) {
          const raw = (children[j]?.innerText || children[j]?.textContent || "").trim();
          const t   = firstLine(raw);
          // Não começa com dígito (location/stats) e não contém conexões/seguidores
          if (
            t && t.length >= 3 && t.length < 250 &&
            !/conexões|connections|\d+\s*(conexões|followers|seguidores)|seguem/i.test(t) &&
            !/^\d/.test(t)
          ) { title = t; break outer; }
        }
      }
    }
  }

  // C) Varredura de todos .text-body-medium (min reduzido para 3 chars — ex: CEO)
  if (!title) {
    for (const el of Array.from(document.querySelectorAll<HTMLElement>(".text-body-medium"))) {
      const t = el.innerText?.trim();
      if (t && t.length >= 3 && t.length < 300 && !/conexões|connections|\d+\+|\bseguidor/i.test(t)) {
        title = t; break;
      }
    }
  }

  // D) document.title — "Nome - Headline | LinkedIn" (algumas versões do LinkedIn)
  if (!title) {
    const m = document.title.match(/^[^|–—-]+\s*[-–—]\s*(.+?)\s*\|\s*LinkedIn/i);
    if (m?.[1] && m[1].length >= 3 && m[1].length < 200) title = m[1].trim();
  }

  // E) og:title — "Nome – Cargo | LinkedIn" (válido em hard-nav; ogTitle já declarado acima)
  if (!title && ogTitle) {
    const m = ogTitle.match(/[–—]\s*(.+?)\s*\|/);
    if (m?.[1]) title = m[1].trim();
  }

  // ── 3) EMPRESA ───────────────────────────────────────────────────────────
  // Links /company/ no href são muito mais estáveis que classes CSS ou aria-labels.
  // O primeiro link de empresa no perfil é quase sempre o empregador atual.
  let company = "";

  for (const a of Array.from(document.querySelectorAll<HTMLElement>('a[href*="/company/"]'))) {
    const t = a.innerText?.trim();
    // Exclui textos que são "X e mais N conexões seguem esta página" ou contam seguidores
    if (
      t && t.length > 1 && t.length < 80 &&
      !/conexões|connections|seguem|follow|seguidores|followers|\de mais\b/i.test(t)
    ) { company = t; break; }
  }

  // Fallback CSS
  if (!company) {
    for (const sel of [".pv-text-details__right-panel-item-text", ".pv-top-card--experience-list .t-14.t-normal"]) {
      const t = document.querySelector<HTMLElement>(sel)?.innerText?.trim();
      if (t && t.length > 1) { company = t; break; }
    }
  }

  // ── 4) og:description — apenas para título/empresa ainda vazios ──────────
  // Nota: em SPA pode não estar atualizado, mas vale como última tentativa
  const ogDesc =
    document.querySelector('meta[property="og:description"]')?.getAttribute("content") ||
    document.querySelector('meta[name="description"]')?.getAttribute("content") || "";

  if (ogDesc) {
    const parts = ogDesc.split(/\s*·\s*/);
    if (!title && parts[0] && parts[0].length > 5) title = parts[0].trim();
    if (!company) {
      for (const p of parts) {
        const m = p.match(/^(?:Experi[êe]ncia|Experience|Cargo\s+atual|Empresa\s+atual|Atual)\s*:\s*(.+)$/i);
        if (m) { company = m[1].trim(); break; }
      }
    }
  }

  // E-mail e telefone vêm do modal "Dados de contato" (extractContactModal).
  // Não usamos a[href^="mailto:"] na página — pode pegar e-mails de outras pessoas.

  return { name, title, company, email: "", phone: "", linkedinUrl: cleanLinkedInUrl(window.location.href) };
}

function cleanLinkedInUrl(url: string): string {
  const m = url.match(/(https?:\/\/[^/]+\/in\/[^/?#]+)/);
  return m ? `${m[1]}/` : url;
}

/**
 * Clica no link "Dados de contato" do LinkedIn, aguarda o modal abrir,
 * extrai e-mail e telefone, depois fecha o modal (se fomos nós que abrimos).
 * Resolve com strings vazias caso o link não exista ou o perfil não exponha os dados.
 */
async function extractContactModal(): Promise<{ email: string; phone: string }> {
  const isModalOpen = () =>
    !!document.querySelector(".artdeco-modal__content, .pv-contact-info__contact-item");

  const alreadyOpen = isModalOpen();

  if (!alreadyOpen) {
    const link = document.querySelector<HTMLAnchorElement>('a[href*="overlay/contact-info"]');
    if (!link) return { email: "", phone: "" };
    link.click();

    // Aguarda o modal aparecer (máx ~2 s)
    await new Promise<void>((resolve) => {
      let tries = 0;
      const t = setInterval(() => {
        if (isModalOpen() || tries++ >= 25) { clearInterval(t); resolve(); }
      }, 80);
    });
  }

  const content = document.querySelector<HTMLElement>(".artdeco-modal__content");
  if (!content) return { email: "", phone: "" };

  // E-mail
  const emailEl = content.querySelector<HTMLAnchorElement>("a[href^='mailto:']");
  const email    = emailEl?.getAttribute("href")?.replace("mailto:", "").trim() ?? "";

  // Telefone — procura seção cujo cabeçalho menciona "Telefone"/"Phone"
  let phone = "";
  for (const section of Array.from(content.querySelectorAll<HTMLElement>("section"))) {
    if (/telefone|phone/i.test(section.textContent ?? "")) {
      for (const span of Array.from(section.querySelectorAll<HTMLElement>("span"))) {
        const raw = span.textContent?.trim() ?? "";
        // Remove sufixo de tipo "(Celular)" e valida que é um número
        const num = raw.replace(/\s*\([^)]+\)\s*$/, "").trim();
        if (/^[\d\s\-\(\)\+]{7,}$/.test(num)) { phone = num; break; }
      }
      break;
    }
  }

  // Fecha o modal somente se fomos nós que abrimos
  if (!alreadyOpen) {
    setTimeout(() => {
      const close = document.querySelector<HTMLElement>(
        'button[aria-label*="Fechar"], button[aria-label*="Close"], button[aria-label*="Dismiss"], .artdeco-modal__dismiss, [data-test-modal-close-btn]'
      );
      close?.click();
    }, 300);
  }

  return { email, phone };
}

/** Atualiza os campos do sidebar quando o perfil carregou após a abertura */
function refreshSidebarFields(shadow: ShadowRoot) {
  const fresh = getProfileData();
  if (!fresh.name) return; // ainda sem dados — desiste

  const setIfEmpty = (id: string, val: string) => {
    const el = shadow.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null;
    if (el && !el.value.trim() && val) el.value = val;
  };

  setIfEmpty("crm-name",     fresh.name);
  setIfEmpty("crm-company",  fresh.company);
  setIfEmpty("crm-position", fresh.title);

  // Atualiza também o banner de perfil
  const pName = shadow.querySelector<HTMLElement>(".p-name");
  if (pName && (!pName.textContent || pName.textContent === "Perfil LinkedIn")) {
    pName.textContent = fresh.name;
  }
  const pTitle = shadow.querySelector<HTMLElement>(".p-title");
  if (pTitle && !pTitle.textContent) pTitle.textContent = fresh.title;
  const avatar = shadow.querySelector<HTMLElement>(".avatar");
  if (avatar && avatar.textContent === "?") avatar.textContent = fresh.name[0].toUpperCase();
}

// ── Botão flutuante ───────────────────────────────────────────────────────────

function injectFloatingButton() {
  if (document.getElementById("crm-float-btn")) return;

  const btn = document.createElement("button");
  btn.id = "crm-float-btn";
  Object.assign(btn.style, {
    position:   "fixed",
    top:        "80px",
    right:      "0",
    zIndex:     "2147483646",
    background: "#2563eb",
    color:      "#fff",
    border:     "none",
    borderRadius: "8px 0 0 8px",
    padding:    "10px 12px 10px 14px",
    fontSize:   "13px",
    fontWeight: "700",
    fontFamily: "system-ui, sans-serif",
    cursor:     "pointer",
    boxShadow:  "-2px 2px 12px rgba(0,0,0,0.2)",
    display:    "flex",
    alignItems: "center",
    gap:        "6px",
    transition: "background 0.15s, right 0.2s",
    writingMode: "horizontal-tb",
  } as CSSStyleDeclaration);

  btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>Adicionar ao CRM`;

  btn.addEventListener("mouseover", () => { btn.style.background = "#1d4ed8"; });
  btn.addEventListener("mouseout",  () => { btn.style.background = "#2563eb"; });
  btn.addEventListener("click",     () => toggleSidebar());

  document.body.appendChild(btn);
}

// ── Sidebar com Shadow DOM ────────────────────────────────────────────────────

let sidebarOpen = false;

function toggleSidebar() {
  const existing = document.getElementById("crm-sidebar-host");
  if (existing) {
    closeSidebar(existing);
    return;
  }
  openSidebar();
}

function closeSidebar(host: HTMLElement) {
  const panel = host.shadowRoot?.querySelector<HTMLElement>(".panel");
  if (panel) {
    panel.style.transform = "translateX(100%)";
    setTimeout(() => host.remove(), 300);
  } else {
    host.remove();
  }
  sidebarOpen = false;
}

function openSidebar() {
  sidebarOpen = true;
  const data = getProfileData();

  const host = document.createElement("div");
  host.id = "crm-sidebar-host";
  Object.assign(host.style, {
    position: "fixed",
    top:      "0",
    right:    "0",
    width:    "380px",
    height:   "100vh",
    zIndex:   "2147483647",
  });

  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = buildSidebarHTML(data);
  document.body.appendChild(host);

  // Slide-in animation
  const panel = shadow.querySelector<HTMLElement>(".panel")!;
  panel.style.transform = "translateX(100%)";
  requestAnimationFrame(() => {
    panel.style.transition = "transform 0.28s cubic-bezier(.4,0,.2,1)";
    panel.style.transform  = "translateX(0)";
  });

  // Retry para nome/cargo/empresa (LinkedIn SPA pode não ter carregado ainda)
  if (!data.name || !data.title || !data.company) {
    setTimeout(() => refreshSidebarFields(shadow), 800);
    setTimeout(() => refreshSidebarFields(shadow), 2000);
    setTimeout(() => refreshSidebarFields(shadow), 4000);
  }

  // Extrai e-mail e telefone do modal "Dados de contato" de forma assíncrona.
  // O sidebar já está visível — os campos preenchem quando o modal resolver.
  extractContactModal().then(({ email, phone }) => {
    const setIfEmpty = (id: string, val: string) => {
      const el = shadow.getElementById(id) as HTMLInputElement | null;
      if (el && !el.value.trim() && val) el.value = val;
    };
    setIfEmpty("crm-email", email);
    setIfEmpty("crm-phone", phone);
  }).catch(() => { /* silencioso */ });

  wireSidebarEvents(shadow, data);
}

// ── HTML + CSS do sidebar (Shadow DOM) ────────────────────────────────────────

function buildSidebarHTML(data: ProfileData): string {
  const initial = data.name ? data.name[0].toUpperCase() : "?";
  const esc = (s: string) => s.replace(/"/g, "&quot;").replace(/</g, "&lt;");

  return `
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :host { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; }

  .panel {
    width: 380px; height: 100vh;
    background: #fff;
    box-shadow: -6px 0 32px rgba(0,0,0,.18);
    display: flex; flex-direction: column; overflow: hidden;
  }

  /* ── Header ── */
  .header {
    padding: 14px 16px;
    border-bottom: 1px solid #e2e8f0;
    display: flex; align-items: center; justify-content: space-between;
    flex-shrink: 0;
  }
  .brand { display: flex; align-items: center; gap: 8px; }
  .logo {
    width: 30px; height: 30px; background: #2563eb; border-radius: 7px;
    display: flex; align-items: center; justify-content: center;
    color: #fff; font-weight: 800; font-size: 15px; letter-spacing: -1px;
  }
  .brand-name { font-weight: 700; font-size: 15px; color: #0f172a; }
  .brand-sub  { font-size: 11px; color: #64748b; margin-top: 1px; }
  .close-btn {
    width: 30px; height: 30px; border: none; background: transparent;
    cursor: pointer; color: #94a3b8; font-size: 20px; border-radius: 6px;
    display: flex; align-items: center; justify-content: center;
    transition: background .15s, color .15s;
  }
  .close-btn:hover { background: #f1f5f9; color: #334155; }

  /* ── Profile banner ── */
  .profile-banner {
    padding: 14px 16px;
    background: linear-gradient(135deg, #eff6ff 0%, #f8fafc 100%);
    border-bottom: 1px solid #e2e8f0;
    display: flex; align-items: center; gap: 12px;
    flex-shrink: 0;
  }
  .avatar {
    width: 44px; height: 44px; border-radius: 50%;
    background: #2563eb; color: #fff;
    display: flex; align-items: center; justify-content: center;
    font-size: 18px; font-weight: 700; flex-shrink: 0;
    box-shadow: 0 0 0 3px #bfdbfe;
  }
  .profile-info { flex: 1; min-width: 0; }
  .p-name { font-size: 14px; font-weight: 700; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .p-title { font-size: 12px; color: #475569; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
  .li-badge {
    margin-top: 5px; display: inline-flex; align-items: center; gap: 4px;
    font-size: 11px; font-weight: 600; color: #0077b5;
    background: #e0f0ff; padding: 2px 8px; border-radius: 999px;
  }

  /* ── Form body ── */
  .form-body {
    flex: 1; overflow-y: auto; padding: 16px;
    display: flex; flex-direction: column; gap: 11px;
  }
  .field { display: flex; flex-direction: column; gap: 4px; }
  label { font-size: 12px; font-weight: 600; color: #334155; }
  input, select, textarea {
    padding: 8px 10px; border: 1px solid #e2e8f0; border-radius: 7px;
    font-size: 13px; color: #0f172a; background: #fff; width: 100%;
    outline: none; font-family: inherit; transition: border-color .15s, box-shadow .15s;
  }
  input:focus, select:focus, textarea:focus {
    border-color: #2563eb;
    box-shadow: 0 0 0 3px rgba(37,99,235,.12);
  }
  textarea { resize: vertical; }

  /* ── Footer ── */
  .footer {
    padding: 14px 16px; border-top: 1px solid #e2e8f0; flex-shrink: 0;
    display: flex; flex-direction: column; gap: 8px;
  }
  .btn-primary {
    padding: 10px; width: 100%; border: none; border-radius: 8px;
    background: #2563eb; color: #fff; font-size: 14px; font-weight: 600;
    cursor: pointer; font-family: inherit; transition: background .15s;
  }
  .btn-primary:hover    { background: #1d4ed8; }
  .btn-primary:disabled { opacity: .6; cursor: not-allowed; }

  /* ── States ── */
  .error {
    font-size: 12px; color: #dc2626;
    background: #fef2f2; border: 1px solid #fecaca;
    border-radius: 6px; padding: 8px 10px; display: none;
  }
  .success-screen {
    flex: 1; display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    gap: 14px; padding: 32px 24px; text-align: center; display: none;
  }
  .success-icon  { font-size: 52px; }
  .success-title { font-size: 17px; font-weight: 700; color: #0f172a; }
  .success-sub   { font-size: 13px; color: #64748b; }
  .btn-secondary {
    padding: 9px; width: 100%; border: 1px solid #e2e8f0;
    border-radius: 8px; background: #f8fafc; color: #334155;
    font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit;
  }
  .btn-secondary:hover { background: #f1f5f9; }
</style>

<div class="panel">
  <!-- Header -->
  <div class="header">
    <div class="brand">
      <div class="logo">C</div>
      <div>
        <div class="brand-name">CRM</div>
        <div class="brand-sub">Novo lead</div>
      </div>
    </div>
    <button class="close-btn" id="crm-close" title="Fechar">✕</button>
  </div>

  <!-- Profile banner -->
  <div class="profile-banner">
    <div class="avatar">${initial}</div>
    <div class="profile-info">
      <div class="p-name">${esc(data.name) || "Perfil LinkedIn"}</div>
      <div class="p-title">${esc(data.title)}</div>
      <span class="li-badge">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="#0077b5"><path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>
        LinkedIn
      </span>
    </div>
  </div>

  <!-- Form -->
  <div class="form-body" id="crm-form-body">
    <div class="field">
      <label>Nome *</label>
      <input id="crm-name" type="text" value="${esc(data.name)}" placeholder="Nome completo" />
    </div>
    <div class="field">
      <label>E-mail</label>
      <input id="crm-email" type="email" value="${esc(data.email)}" placeholder="email@empresa.com" />
    </div>
    <div class="field">
      <label>Telefone</label>
      <input id="crm-phone" type="tel" value="${esc(data.phone)}" placeholder="+55 11 99999-9999" />
    </div>
    <div class="field">
      <label>Empresa</label>
      <input id="crm-company" type="text" value="${esc(data.company)}" placeholder="Nome da empresa" />
    </div>
    <div class="field">
      <label>Cargo</label>
      <input id="crm-position" type="text" value="${esc(data.title)}" placeholder="Cargo / função" />
    </div>
    <div class="field">
      <label>Origem</label>
      <select id="crm-source">
        <option value="LINKEDIN" selected>LinkedIn</option>
        <option value="COLD_OUTREACH">Prospecção</option>
        <option value="INDICACAO">Indicação</option>
        <option value="WEBSITE">Website</option>
        <option value="WHATSAPP">WhatsApp</option>
        <option value="OUTRO">Outro</option>
      </select>
    </div>
    <div class="field">
      <label>Observação</label>
      <textarea id="crm-notes" rows="3" placeholder="Contexto, competências, LinkedIn…">${data.linkedinUrl ? `LinkedIn: ${data.linkedinUrl}` : ""}</textarea>
    </div>
    <div id="crm-error" class="error"></div>
  </div>

  <!-- Footer -->
  <div class="footer">
    <button class="btn-primary" id="crm-save">Salvar lead</button>
  </div>

  <!-- Success (hidden initially) -->
  <div class="success-screen" id="crm-success">
    <div class="success-icon">✅</div>
    <div class="success-title">Lead salvo!</div>
    <div class="success-sub" id="crm-success-name"></div>
    <a id="crm-view-link" href="#" target="_blank" class="btn-primary" style="text-decoration:none;text-align:center;display:block;">
      Ver no CRM ↗
    </a>
    <button class="btn-secondary" id="crm-another">Capturar outro</button>
  </div>
</div>`;
}

// ── Eventos do sidebar ────────────────────────────────────────────────────────

function wireSidebarEvents(shadow: ShadowRoot, data: ProfileData) {
  // Fechar
  shadow.getElementById("crm-close")!.addEventListener("click", () => {
    closeSidebar(document.getElementById("crm-sidebar-host")!);
  });

  // Salvar
  const saveBtn = shadow.getElementById("crm-save") as HTMLButtonElement;
  const errDiv  = shadow.getElementById("crm-error") as HTMLElement;

  saveBtn.addEventListener("click", async () => {
    errDiv.style.display = "none";
    const name = (shadow.getElementById("crm-name") as HTMLInputElement).value.trim();
    if (!name) { showError(errDiv, "Nome é obrigatório"); return; }

    saveBtn.disabled    = true;
    saveBtn.textContent = "Salvando…";

    const payload = {
      name,
      email:    (shadow.getElementById("crm-email")    as HTMLInputElement).value.trim() || undefined,
      phone:    (shadow.getElementById("crm-phone")    as HTMLInputElement).value.trim() || undefined,
      company:  (shadow.getElementById("crm-company")  as HTMLInputElement).value.trim() || undefined,
      position: (shadow.getElementById("crm-position") as HTMLInputElement).value.trim() || undefined,
      source:   (shadow.getElementById("crm-source")   as HTMLSelectElement).value,
      notes:    (shadow.getElementById("crm-notes")    as HTMLTextAreaElement).value.trim() || undefined,
      linkedinUrl: data.linkedinUrl || undefined,
    };

    chrome.runtime.sendMessage({ type: "CREATE_LEAD", data: payload }, (res) => {
      if (chrome.runtime.lastError || !res?.ok) {
        saveBtn.disabled    = false;
        saveBtn.textContent = "Salvar lead";
        showError(errDiv, res?.error ?? chrome.runtime.lastError?.message ?? "Erro desconhecido");
        return;
      }

      // Sucesso
      const lead = res.data;
      chrome.storage.local.get(["apiUrl"], (cfg) => {
        const link = shadow.getElementById("crm-view-link") as HTMLAnchorElement;
        if (cfg.apiUrl) link.href = `${cfg.apiUrl.replace(/\/$/, "")}/leads/${lead.id}`;
      });
      (shadow.getElementById("crm-success-name") as HTMLElement).textContent = lead.name;
      shadow.getElementById("crm-form-body")!.style.display = "none";
      shadow.querySelector<HTMLElement>(".footer")!.style.display = "none";
      shadow.getElementById("crm-success")!.style.display = "flex";
    });
  });

  // Capturar outro
  shadow.getElementById("crm-another")?.addEventListener("click", () => {
    closeSidebar(document.getElementById("crm-sidebar-host")!);
    setTimeout(openSidebar, 350);
  });
}

function showError(el: HTMLElement, msg: string) {
  el.textContent    = msg;
  el.style.display  = "block";
}

// ── Observer de navegação SPA ─────────────────────────────────────────────────

let lastPath = "";

function checkAndInject() {
  if (!window.location.pathname.startsWith("/in/")) {
    document.getElementById("crm-float-btn")?.remove();
    return;
  }
  if (window.location.pathname !== lastPath) {
    lastPath = window.location.pathname;
    document.getElementById("crm-sidebar-host")?.remove();
    sidebarOpen = false;
  }
  injectFloatingButton();
}

new MutationObserver(() => {
  if (window.location.pathname !== lastPath) checkAndInject();
}).observe(document.body, { childList: true, subtree: true });

// Inicial
setTimeout(checkAndInject, 1200);

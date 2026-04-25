import { useState, useEffect, useCallback } from "react";
import { getConfig, saveConfig, clearConfig, type ExtensionConfig } from "../lib/storage";
import { validateToken, createLead, getRecentLeads, type Lead, type LeadData } from "../lib/api";

type Screen = "loading" | "setup" | "main" | "capture" | "success";

interface LinkedInCapture {
  name: string;
  title?: string;
  company?: string;
  email?: string;
  linkedinUrl?: string;
  source?: string;
}

const SOURCES = [
  { value: "COLD_OUTREACH", label: "Prospecção" },
  { value: "LINKEDIN",      label: "LinkedIn" },
  { value: "WEBSITE",       label: "Website" },
  { value: "INDICACAO",     label: "Indicação" },
  { value: "OUTRO",         label: "Outro" },
] as const;

// ─── Tela de configuração ─────────────────────────────────────────────────────
function SetupScreen({ onSaved }: { onSaved: () => void }) {
  const [apiUrl,   setApiUrl]   = useState("https://");
  const [apiToken, setApiToken] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  async function handleSave() {
    if (!apiUrl.startsWith("https://") || !apiToken.startsWith("crm_")) {
      setError("URL deve começar com https:// e token com crm_");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await saveConfig({ apiUrl: apiUrl.trim(), apiToken: apiToken.trim() });
      await validateToken(); // valida antes de salvar
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro na validação");
      await clearConfig();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span style={{ fontSize: "22px" }}>🔗</span>
        <div>
          <h1 style={{ fontSize: "16px", fontWeight: "700" }}>Conectar ao CRM</h1>
          <p style={{ fontSize: "12px", color: "#64748b" }}>Configure uma vez para começar</p>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <label style={{ fontSize: "12px", fontWeight: "600" }}>URL do CRM</label>
        <input
          type="url"
          value={apiUrl}
          onChange={(e) => setApiUrl(e.target.value)}
          placeholder="https://crm.minhaempresa.com"
          style={inputStyle}
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <label style={{ fontSize: "12px", fontWeight: "600" }}>Token de acesso</label>
        <input
          type="password"
          value={apiToken}
          onChange={(e) => setApiToken(e.target.value)}
          placeholder="crm_..."
          style={inputStyle}
        />
        <p style={{ fontSize: "11px", color: "#64748b" }}>
          Gere em: Configurações → Segurança &amp; 2FA → Tokens de acesso pessoal
        </p>
      </div>

      {error && <p style={{ fontSize: "12px", color: "#dc2626" }}>{error}</p>}

      <button
        onClick={handleSave}
        disabled={loading}
        style={primaryBtnStyle}
      >
        {loading ? "Validando…" : "Salvar e conectar"}
      </button>
    </div>
  );
}

// ─── Tela principal ───────────────────────────────────────────────────────────
function MainScreen({
  config,
  onCapture,
  onLogout,
  recentLeads,
}: {
  config: ExtensionConfig;
  onCapture: () => void;
  onLogout: () => void;
  recentLeads: Lead[];
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <div style={{ padding: "12px 16px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "18px" }}>📊</span>
          <span style={{ fontWeight: "700", fontSize: "14px" }}>CRM</span>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <a
            href={`${config.apiUrl}/leads/new`}
            target="_blank"
            rel="noreferrer"
            style={{ fontSize: "12px", color: "#2563eb", textDecoration: "none" }}
          >
            Abrir CRM ↗
          </a>
          <button onClick={onLogout} style={{ fontSize: "11px", color: "#94a3b8", background: "none", border: "none", cursor: "pointer" }}>
            Desconectar
          </button>
        </div>
      </div>

      {/* Capture button */}
      <div style={{ padding: "16px" }}>
        <button onClick={onCapture} style={{ ...primaryBtnStyle, width: "100%" }}>
          + Capturar lead desta página
        </button>
      </div>

      {/* Recent leads */}
      {recentLeads.length > 0 && (
        <div style={{ padding: "0 16px 16px", flex: 1 }}>
          <p style={{ fontSize: "11px", fontWeight: "600", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>
            Últimos leads
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {recentLeads.map((lead) => (
              <a
                key={lead.id}
                href={`${config.apiUrl}/leads/${lead.id}`}
                target="_blank"
                rel="noreferrer"
                style={{ display: "block", padding: "8px 10px", borderRadius: "6px", background: "#f8fafc", border: "1px solid #e2e8f0", textDecoration: "none", color: "inherit" }}
              >
                <p style={{ fontSize: "13px", fontWeight: "600" }}>{lead.name}</p>
                {lead.company && <p style={{ fontSize: "11px", color: "#64748b" }}>{lead.company}</p>}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tela de captura ──────────────────────────────────────────────────────────
function CaptureScreen({
  prefill,
  onSaved,
  onBack,
}: {
  prefill: Partial<LeadData>;
  onSaved: (lead: Lead) => void;
  onBack: () => void;
}) {
  const [form, setForm] = useState<LeadData>({
    name:      prefill.name ?? "",
    email:     prefill.email ?? "",
    phone:     "",
    company:   prefill.company ?? "",
    position:  prefill.position ?? prefill.notes ?? "",
    source:    (prefill.source as LeadData["source"]) ?? "OUTRO",
    notes:     prefill.linkedinUrl ? `LinkedIn: ${prefill.linkedinUrl}` : "",
  });
  const [loading, setLoading]   = useState(false);
  const [error,   setError]     = useState<string | null>(null);

  function set(field: keyof LeadData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    if (!form.name.trim()) { setError("Nome é obrigatório"); return; }
    setLoading(true);
    setError(null);
    try {
      const lead = await createLead(form);
      onSaved(lead);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: "8px" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", fontSize: "18px", lineHeight: 1 }}>←</button>
        <h2 style={{ fontSize: "14px", fontWeight: "700" }}>Novo lead</h2>
      </div>

      <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: "10px" }}>
        <Field label="Nome *" value={form.name} onChange={(v) => set("name", v)} placeholder="João Silva" />
        <Field label="E-mail" value={form.email ?? ""} onChange={(v) => set("email", v)} type="email" placeholder="joao@empresa.com" />
        <Field label="Telefone" value={form.phone ?? ""} onChange={(v) => set("phone", v)} type="tel" placeholder="+55 11 99999-9999" />
        <Field label="Empresa" value={form.company ?? ""} onChange={(v) => set("company", v)} placeholder="Acme Corp" />

        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <label style={{ fontSize: "12px", fontWeight: "600" }}>Origem</label>
          <select value={form.source} onChange={(e) => set("source", e.target.value as LeadData["source"])} style={inputStyle}>
            {SOURCES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <label style={{ fontSize: "12px", fontWeight: "600" }}>Observação</label>
          <textarea
            value={form.notes ?? ""}
            onChange={(e) => set("notes", e.target.value)}
            rows={3}
            style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
            placeholder="Contexto, cargo, LinkedIn…"
          />
        </div>

        {error && <p style={{ fontSize: "12px", color: "#dc2626" }}>{error}</p>}

        <button onClick={handleSave} disabled={loading} style={primaryBtnStyle}>
          {loading ? "Salvando…" : "Salvar lead"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      <label style={{ fontSize: "12px", fontWeight: "600" }}>{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={inputStyle} />
    </div>
  );
}

// ─── Tela de sucesso ──────────────────────────────────────────────────────────
function SuccessScreen({ lead, config, onBack }: { lead: Lead; config: ExtensionConfig; onBack: () => void }) {
  return (
    <div style={{ padding: "24px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: "16px", textAlign: "center" }}>
      <span style={{ fontSize: "40px" }}>✅</span>
      <div>
        <p style={{ fontWeight: "700", fontSize: "15px" }}>Lead salvo!</p>
        <p style={{ color: "#64748b", fontSize: "13px", marginTop: "4px" }}>{lead.name}</p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px", width: "100%" }}>
        <a
          href={`${config.apiUrl}/leads/${lead.id}`}
          target="_blank"
          rel="noreferrer"
          style={{ ...primaryBtnStyle, textAlign: "center", textDecoration: "none", display: "block" }}
        >
          Ver no CRM ↗
        </a>
        <button onClick={onBack} style={{ ...secondaryBtnStyle }}>
          Capturar outro
        </button>
      </div>
    </div>
  );
}

// ─── App principal ────────────────────────────────────────────────────────────
export function App() {
  const [screen, setScreen]           = useState<Screen>("loading");
  const [config, setConfig]           = useState<ExtensionConfig | null>(null);
  const [recentLeads, setRecentLeads] = useState<Lead[]>([]);
  const [capturedLead, setCapturedLead] = useState<Lead | null>(null);
  const [linkedinPrefill, setLinkedinPrefill] = useState<Partial<LeadData>>({});

  const loadApp = useCallback(async () => {
    const cfg = await getConfig();
    if (!cfg?.apiToken) {
      setScreen("setup");
      return;
    }
    try {
      await validateToken();
      setConfig(cfg);
      const leads = await getRecentLeads().catch(() => []);
      setRecentLeads(leads);

      // Verifica se veio captura do LinkedIn via content script
      const session = await chrome.storage.session.get(["linkedinCapture"]);
      if (session.linkedinCapture) {
        setLinkedinPrefill(session.linkedinCapture as LinkedInCapture);
        chrome.storage.session.remove("linkedinCapture");
        setScreen("capture");
      } else {
        setScreen("main");
      }
    } catch {
      setScreen("setup");
    }
  }, []);

  useEffect(() => { loadApp(); }, [loadApp]);

  if (screen === "loading") {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "200px", color: "#94a3b8" }}>
        Carregando…
      </div>
    );
  }

  if (screen === "setup") {
    return <SetupScreen onSaved={loadApp} />;
  }

  if (screen === "capture") {
    return (
      <CaptureScreen
        prefill={linkedinPrefill}
        onSaved={(lead) => { setCapturedLead(lead); setScreen("success"); }}
        onBack={() => setScreen("main")}
      />
    );
  }

  if (screen === "success" && capturedLead && config) {
    return <SuccessScreen lead={capturedLead} config={config} onBack={() => { setCapturedLead(null); setScreen("main"); }} />;
  }

  return (
    <MainScreen
      config={config!}
      onCapture={async () => {
        // Extrai dados da página atual
        const session = await chrome.storage.session.get(["linkedinCapture"]);
        if (session.linkedinCapture) {
          setLinkedinPrefill(session.linkedinCapture as LinkedInCapture);
          chrome.storage.session.remove("linkedinCapture");
        } else {
          setLinkedinPrefill({});
        }
        setScreen("capture");
      }}
      onLogout={async () => { await clearConfig(); setScreen("setup"); }}
      recentLeads={recentLeads}
    />
  );
}

// ─── Estilos inline compartilhados ───────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  padding:      "7px 10px",
  borderRadius: "6px",
  border:       "1px solid #e2e8f0",
  fontSize:     "13px",
  outline:      "none",
  width:        "100%",
  background:   "#ffffff",
  color:        "#0f172a",
};

const primaryBtnStyle: React.CSSProperties = {
  padding:       "9px 16px",
  borderRadius:  "6px",
  border:        "none",
  background:    "#2563eb",
  color:         "#ffffff",
  fontSize:      "13px",
  fontWeight:    "600",
  cursor:        "pointer",
  width:         "100%",
};

const secondaryBtnStyle: React.CSSProperties = {
  ...primaryBtnStyle,
  background: "#f1f5f9",
  color:      "#334155",
  border:     "1px solid #e2e8f0",
};

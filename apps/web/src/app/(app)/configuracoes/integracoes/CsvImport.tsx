"use client";

import { useRef, useState } from "react";
import { Upload, FileText, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

type Status = "idle" | "loading" | "success" | "error";

interface ImportResult {
  total:   number;
  created: number;
  skipped: number;
}

export function CsvImport() {
  const inputRef                    = useRef<HTMLInputElement>(null);
  const [status, setStatus]         = useState<Status>("idle");
  const [result, setResult]         = useState<ImportResult | null>(null);
  const [error, setError]           = useState<string>("");
  const [fileName, setFileName]     = useState<string>("");
  const [dragging, setDragging]     = useState(false);

  async function upload(file: File) {
    setFileName(file.name);
    setStatus("loading");
    setResult(null);
    setError("");

    const form = new FormData();
    form.append("file", file);

    try {
      const res  = await fetch("/api/leads/import", { method: "POST", body: form });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? `Erro ${res.status}`);
        setStatus("error");
        return;
      }
      setResult(data.summary);
      setStatus("success");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro de rede");
      setStatus("error");
    }
  }

  function handleFile(f: File | null | undefined) {
    if (!f) return;
    if (!f.name.endsWith(".csv")) {
      setError("Apenas arquivos .csv são aceitos");
      setStatus("error");
      return;
    }
    upload(f);
  }

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => {
          e.preventDefault();
          setDragging(false);
          handleFile(e.dataTransfer.files[0]);
        }}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
          dragging
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50 hover:bg-muted/30"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={e => handleFile(e.target.files?.[0])}
        />

        {status === "loading" ? (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Loader2 size={32} className="animate-spin text-primary" />
            <p className="text-sm font-medium">Importando {fileName}…</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Upload size={28} className={dragging ? "text-primary" : ""} />
            <p className="text-sm font-medium text-foreground">
              Arraste um CSV aqui ou clique para selecionar
            </p>
            <p className="text-xs">Máximo 5.000 linhas · 10 MB</p>
          </div>
        )}
      </div>

      {/* Sucesso */}
      {status === "success" && result && (
        <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950">
          <CheckCircle size={18} className="shrink-0 text-green-600 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-green-800 dark:text-green-300">
              Importação concluída!
            </p>
            <p className="text-green-700 dark:text-green-400 mt-0.5">
              {result.created} leads criados · {result.skipped} ignorados
              (total: {result.total} linhas)
            </p>
            <button
              className="mt-2 text-xs underline text-green-700 dark:text-green-400"
              onClick={() => { setStatus("idle"); setResult(null); }}
            >
              Importar outro arquivo
            </button>
          </div>
        </div>
      )}

      {/* Erro */}
      {status === "error" && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950">
          <AlertCircle size={18} className="shrink-0 text-red-600 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-red-800 dark:text-red-300">Erro na importação</p>
            <p className="text-red-700 dark:text-red-400 mt-0.5">{error}</p>
            <button
              className="mt-2 text-xs underline text-red-700 dark:text-red-400"
              onClick={() => setStatus("idle")}
            >
              Tentar novamente
            </button>
          </div>
        </div>
      )}

      {/* Modelo de CSV */}
      <div className="rounded-md bg-muted/50 border border-border p-4 text-xs space-y-2">
        <div className="flex items-center gap-2 font-medium text-foreground text-sm">
          <FileText size={14} />
          Formato do CSV
        </div>
        <div className="font-mono bg-muted rounded p-2 text-[11px] overflow-x-auto">
          nome,email,telefone,empresa,origem,status,observacao
          <br />
          "João Silva","joao@email.com","11999999999","Empresa X","WEBSITE","NOVO","Interesse no curso"
          <br />
          "Maria Souza","maria@email.com","","","INDICACAO","QUALIFICADO",""
        </div>
        <p className="text-muted-foreground">
          Origens aceitas: WEBSITE, FACEBOOK, INSTAGRAM, WHATSAPP, LINKEDIN, INDICACAO, EVENTO, COLD_OUTREACH, OUTRO
        </p>
      </div>
    </div>
  );
}

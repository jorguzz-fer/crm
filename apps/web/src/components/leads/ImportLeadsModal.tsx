"use client";

import { useActionState, useRef, useState } from "react";
import { Upload, Download, X, CheckCircle, AlertCircle, FileText } from "lucide-react";
import { importLeadsAction, type ImportLeadsState } from "@/app/actions/import";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function ImportLeadsModal() {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const [state, action, pending] = useActionState<ImportLeadsState, FormData>(
    importLeadsAction,
    null
  );

  // Após importação com sucesso, atualiza a lista
  useEffect(() => {
    if (state && "imported" in state && state.imported > 0) {
      router.refresh();
    }
  }, [state, router]);

  function handleFile(f: File) {
    if (!f.name.endsWith(".csv")) {
      alert("Apenas arquivos .csv são aceitos");
      return;
    }
    setFile(f);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }

  function reset() {
    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  const hasResult = state && "imported" in state;
  const hasError  = state && "error" in state;

  return (
    <>
      {/* Botão de abertura */}
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
      >
        <Upload size={15} />
        Importar CSV
      </button>

      {/* Overlay */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="text-base font-semibold">Importar leads via CSV</h2>
              <button
                onClick={() => { setOpen(false); reset(); }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 p-5">
              {/* Download do modelo */}
              <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
                <div className="text-sm">
                  <p className="font-medium">Precisa do modelo?</p>
                  <p className="text-xs text-muted-foreground">Baixe a planilha de exemplo com os campos corretos</p>
                </div>
                <a
                  href="/api/leads/template"
                  download
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent"
                >
                  <Download size={13} />
                  Baixar modelo
                </a>
              </div>

              {/* Resultado anterior */}
              {hasResult && (
                <div className={`rounded-lg border px-4 py-3 text-sm ${
                  state.errors.length === 0
                    ? "border-green-200 bg-green-50"
                    : "border-amber-200 bg-amber-50"
                }`}>
                  <div className="flex items-center gap-2 font-medium">
                    <CheckCircle size={15} className="text-green-600 shrink-0" />
                    <span>{state.imported} lead{state.imported !== 1 ? "s" : ""} importado{state.imported !== 1 ? "s" : ""} com sucesso</span>
                  </div>
                  {state.errors.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-medium text-amber-700 flex items-center gap-1">
                        <AlertCircle size={12} />
                        {state.errors.length} linha{state.errors.length > 1 ? "s" : ""} com erro:
                      </p>
                      <ul className="mt-1 max-h-32 overflow-y-auto space-y-1">
                        {state.errors.map((e) => (
                          <li key={e.row} className="text-xs text-amber-800">
                            <span className="font-mono font-medium">Linha {e.row}</span>
                            {e.name !== "(sem nome)" && ` · ${e.name}`}
                            {" — "}{e.error}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {hasError && (
                <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  <AlertCircle size={15} className="shrink-0" />
                  {state.error}
                </div>
              )}

              {/* Área de drop */}
              <form action={action}>
                <input
                  ref={inputRef}
                  type="file"
                  name="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                  }}
                />

                {/* Drop zone */}
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => !file && inputRef.current?.click()}
                  className={`relative cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
                    dragging
                      ? "border-primary bg-primary/5"
                      : file
                        ? "border-green-400 bg-green-50"
                        : "border-border hover:border-primary/50 hover:bg-muted/30"
                  }`}
                >
                  {file ? (
                    <div className="flex flex-col items-center gap-2">
                      <FileText size={28} className="text-green-600" />
                      <p className="text-sm font-medium text-green-700">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(file.size / 1024).toFixed(1)} KB
                      </p>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); reset(); }}
                        className="text-xs text-muted-foreground underline hover:text-foreground"
                      >
                        Trocar arquivo
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Upload size={28} className="text-muted-foreground/50" />
                      <div>
                        <p className="text-sm font-medium">Arraste o CSV aqui</p>
                        <p className="text-xs text-muted-foreground">ou clique para selecionar</p>
                      </div>
                      <p className="text-xs text-muted-foreground">Máx. 500 linhas · 5 MB</p>
                    </div>
                  )}
                </div>

                {/* Instruções rápidas */}
                <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                  <li>• Colunas: <code className="font-mono">nome</code> (obrigatório), <code className="font-mono">email</code>, <code className="font-mono">telefone</code>, <code className="font-mono">empresa</code>, <code className="font-mono">origem</code>, <code className="font-mono">status</code></li>
                  <li>• Linhas de comentário (começando com <code className="font-mono">#</code>) são ignoradas</li>
                  <li>• Linhas com erro são puladas; as demais são importadas normalmente</li>
                </ul>

                {/* Botões */}
                <div className="mt-4 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => { setOpen(false); reset(); }}
                    className="rounded-md px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={!file || pending}
                    className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {pending ? (
                      <>
                        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Importando…
                      </>
                    ) : (
                      <>
                        <Upload size={15} />
                        Importar
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

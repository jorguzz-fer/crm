"use client";

import { useState, useTransition } from "react";
import { Facebook, Trash2, RefreshCw, CheckCircle, Circle } from "lucide-react";

interface MetaPage {
  id:        string;
  pageId:    string;
  pageName:  string | null;
  active:    boolean;
  createdAt: Date | string;
}

interface Props {
  pages:   MetaPage[];
  isAdmin: boolean;
}

export function MetaIntegration({ pages: initialPages, isAdmin }: Props) {
  const [pages, setPages]       = useState<MetaPage[]>(initialPages);
  const [isPending, startTrans] = useTransition();
  const [disconnecting, setDc]  = useState<string | null>(null);

  async function disconnect(pageId: string) {
    setDc(pageId);
    startTrans(async () => {
      const res = await fetch(`/api/integrations/meta/pages?pageId=${pageId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setPages(prev => prev.filter(p => p.pageId !== pageId));
      }
      setDc(null);
    });
  }

  const metaAppConfigured = true; // no lado client não temos as env vars; sempre mostramos o botão

  return (
    <div className="space-y-4">
      {/* Botão de conectar */}
      {isAdmin && (
        <div className="flex items-start gap-4 rounded-lg border border-border bg-card p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#1877F2] text-white">
            <Facebook size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Facebook / Instagram</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Conecte sua conta do Facebook para receber leads dos anúncios automaticamente.
              Serão conectadas todas as páginas que você administra.
            </p>
          </div>
          <a
            href="/api/integrations/meta/connect"
            className="inline-flex shrink-0 items-center gap-2 rounded-md bg-[#1877F2] px-4 py-2 text-sm font-medium text-white hover:bg-[#1565C0] transition-colors"
          >
            <Facebook size={14} />
            Conectar
          </a>
        </div>
      )}

      {/* Lista de páginas conectadas */}
      {pages.length > 0 ? (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="bg-muted/40 px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Páginas conectadas ({pages.length})
          </div>
          <ul className="divide-y divide-border">
            {pages.map(page => (
              <li key={page.pageId} className="flex items-center gap-3 px-4 py-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1877F2]/10 text-[#1877F2]">
                  <Facebook size={15} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {page.pageName ?? page.pageId}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    ID: {page.pageId} · Conectada em{" "}
                    {new Date(page.createdAt as string).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                      page.active
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {page.active ? <CheckCircle size={11} /> : <Circle size={11} />}
                    {page.active ? "Ativa" : "Inativa"}
                  </span>
                  {isAdmin && (
                    <button
                      onClick={() => disconnect(page.pageId)}
                      disabled={disconnecting === page.pageId || isPending}
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs text-destructive hover:bg-destructive/10 disabled:opacity-50 transition-colors"
                      title="Desconectar página"
                    >
                      {disconnecting === page.pageId ? (
                        <RefreshCw size={11} className="animate-spin" />
                      ) : (
                        <Trash2 size={11} />
                      )}
                      Desconectar
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          <Facebook size={24} className="mx-auto mb-2 opacity-30" />
          <p>Nenhuma página conectada.</p>
          {isAdmin && (
            <p className="mt-1 text-xs">
              Clique em "Conectar" para vincular sua conta do Facebook.
            </p>
          )}
        </div>
      )}

      {/* Info sobre o webhook */}
      {pages.length > 0 && (
        <div className="rounded-md bg-muted/50 border border-border p-3 text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">🔧 Configure o webhook no Meta for Developers</p>
          <p>
            URL do webhook:{" "}
            <code className="bg-muted rounded px-1 py-0.5 font-mono text-[11px]">
              {typeof window !== "undefined" ? window.location.origin : ""}/api/webhooks/meta-leads
            </code>
          </p>
          <p>
            Evento a subscrever: <code className="bg-muted rounded px-1 py-0.5 font-mono text-[11px]">leadgen</code>
          </p>
        </div>
      )}
    </div>
  );
}

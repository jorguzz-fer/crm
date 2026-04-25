"use client";

import { useState, useActionState } from "react";
import { Key, Trash2, Copy, CheckCircle, AlertTriangle } from "lucide-react";
import { createPersonalTokenAction, revokePersonalTokenAction } from "@/app/actions/twoFactor";
import { cn } from "@/lib/utils";

interface TokenInfo {
  id:         string;
  name:       string;
  lastUsedAt: string | null;
  expiresAt:  string | null;
  createdAt:  string;
}

interface Props { initialTokens: TokenInfo[] }

export function PersonalTokens({ initialTokens }: Props) {
  const [tokens, setTokens]         = useState<TokenInfo[]>(initialTokens);
  const [newToken, setNewToken]      = useState<string | null>(null);
  const [copied, setCopied]          = useState(false);

  const [createState, createAction, createPending] = useActionState(createPersonalTokenAction, null);
  const [revokeState, revokeAction, revokePending] = useActionState(revokePersonalTokenAction, null);

  // Detecta token recém-criado e exibe
  if (createState && "token" in createState && createState.token !== newToken) {
    setNewToken(createState.token);
  }

  function copyToken() {
    if (!newToken) return;
    navigator.clipboard.writeText(newToken).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleRevoke(id: string) {
    setTokens((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <div className="space-y-4">
      {/* Token recém-gerado */}
      {newToken && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-amber-800">
            <AlertTriangle size={15} />
            Copie o token agora — ele não será exibido novamente
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-md bg-white border border-amber-200 px-3 py-1.5 text-xs font-mono break-all">
              {newToken}
            </code>
            <button
              type="button"
              onClick={copyToken}
              className={cn(
                "shrink-0 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                copied
                  ? "border-green-300 bg-green-50 text-green-700"
                  : "border-border bg-background hover:bg-accent",
              )}
            >
              {copied ? <CheckCircle size={13} /> : <Copy size={13} />}
            </button>
          </div>
        </div>
      )}

      {/* Lista de tokens */}
      {tokens.length > 0 && (
        <div className="rounded-lg border border-border divide-y divide-border">
          {tokens.map((t) => (
            <div key={t.id} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <Key size={14} className="text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{t.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Criado em{" "}
                    {new Date(t.createdAt).toLocaleDateString("pt-BR", {
                      day: "2-digit", month: "short", year: "numeric",
                    })}
                    {t.lastUsedAt && (
                      <> · Último uso{" "}
                        {new Date(t.lastUsedAt).toLocaleDateString("pt-BR", {
                          day: "2-digit", month: "short",
                        })}
                      </>
                    )}
                  </p>
                </div>
              </div>
              <form
                action={async (fd) => {
                  handleRevoke(t.id);
                  await revokeAction(fd);
                }}
              >
                <input type="hidden" name="id" value={t.id} />
                <button
                  type="submit"
                  disabled={revokePending}
                  className="rounded-md p-1.5 text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-colors"
                  title="Revogar token"
                >
                  <Trash2 size={14} />
                </button>
              </form>
            </div>
          ))}
        </div>
      )}

      {tokens.length === 0 && !newToken && (
        <p className="text-sm text-muted-foreground">Nenhum token criado ainda.</p>
      )}

      {/* Criar novo token */}
      <form action={createAction} className="flex items-center gap-3">
        <input
          name="name"
          type="text"
          placeholder="Nome (ex: Chrome Extension)"
          required
          minLength={2}
          maxLength={50}
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <button
          type="submit"
          disabled={createPending}
          className="shrink-0 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          Gerar token
        </button>
      </form>
      {createState && "error" in createState && (
        <p className="text-sm text-destructive">{createState.error}</p>
      )}
    </div>
  );
}

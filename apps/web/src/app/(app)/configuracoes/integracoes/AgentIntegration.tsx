"use client";

import { useState } from "react";
import { Copy, Check, Eye, EyeOff, Bot, TriangleAlert } from "lucide-react";

interface Props {
  agentUrl: string;
  apiToken: string;
}

/**
 * Integração com agente de atendimento por IA (fazer.ai agents e equivalentes).
 *
 * A tela existe para deixar copiável a única configuração que funciona: URL com
 * o tenant embutido e token no header. O motivo está no aviso do rodapé e vale
 * repetir — corpo de ferramenta HTTP não carrega constante.
 */
export function AgentIntegration({ agentUrl, apiToken }: Props) {
  const [revealToken, setRevealToken] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  const toolBody = JSON.stringify(
    {
      nome: "nome da pessoa, como ela se apresentou",
      persona: "pf | b2b | licenciado",
      interesse: "o produto ou plano que ela quer",
      vidas: "número de vidas, só quando for empresa",
      resumo: "o que o vendedor precisa saber antes de ligar",
      proximo_passo: "o que ficou combinado",
      situacao: "qualificado | em_contato | desqualificado",
      telefone: "o telefone desta conversa, copiado das informações do sistema",
    },
    null,
    2,
  );

  const tokenDisplay = revealToken ? apiToken : "•".repeat(apiToken.length);

  const CAMPOS: [string, string][] = [
    ["nome", "nome da pessoa"],
    ["persona", "pf · b2b · licenciado"],
    ["interesse", "produto ou plano (vira nota e título da oportunidade)"],
    ["vidas", "nº de vidas no contrato B2B — aceita texto (\"cerca de 40\")"],
    ["resumo", "contexto da conversa (vira nota)"],
    ["proximo_passo", "o que ficou combinado (vira nota)"],
    ["situacao", "qualificado · em_contato · desqualificado"],
    ["telefone", "a chave — reencontra o lead que o webhook já criou; o agente copia do telefone da conversa que o prompt expõe"],
    ["email", "só entra se tiver cara de e-mail"],
    ["empresa", "razão social / nome da empresa"],
    ["conversa_id", "reserva — só se a plataforma expuser o id da conversa"],
    ["agente", "nome do agente, aparece no cabeçalho da nota"],
  ];

  return (
    <div className="space-y-4">
      {/* Credenciais */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="bg-muted/40 px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
          <Bot size={13} />
          Ferramenta HTTP do agente
        </div>
        <div className="divide-y divide-border">
          {/* URL */}
          <div className="p-4 space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <label className="text-xs font-medium text-foreground">
                URL da ferramenta
              </label>
              <button
                onClick={() => copy(agentUrl, "url")}
                className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded border border-border hover:bg-muted transition-colors shrink-0"
              >
                {copied === "url" ? <Check size={11} className="text-green-600" /> : <Copy size={11} />}
                {copied === "url" ? "Copiado" : "Copiar"}
              </button>
            </div>
            <code className="block break-all rounded bg-muted px-2.5 py-1.5 font-mono text-[11px] text-foreground">
              {agentUrl}
            </code>
            <p className="text-[11px] text-muted-foreground">
              Método: <code className="font-mono">POST</code> · o identificador do seu CRM
              já está na URL — <strong>não</strong> coloque nada disso no corpo.
            </p>
          </div>

          {/* Token */}
          <div className="p-4 space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <label className="text-xs font-medium text-foreground">
                Token (header <code className="font-mono text-[11px]">X-API-Token</code>)
              </label>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => setRevealToken((v) => !v)}
                  className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border border-border hover:bg-muted transition-colors"
                >
                  {revealToken ? <EyeOff size={11} /> : <Eye size={11} />}
                  {revealToken ? "Ocultar" : "Mostrar"}
                </button>
                <button
                  onClick={() => copy(apiToken, "token")}
                  className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded border border-border hover:bg-muted transition-colors"
                >
                  {copied === "token" ? <Check size={11} className="text-green-600" /> : <Copy size={11} />}
                  {copied === "token" ? "Copiado" : "Copiar"}
                </button>
              </div>
            </div>
            <code className="block break-all rounded bg-muted px-2.5 py-1.5 font-mono text-[11px] text-foreground select-all">
              {tokenDisplay}
            </code>
            <p className="text-[11px] text-muted-foreground">
              Guarde no cofre de credenciais da plataforma do agente, nunca no corpo da ferramenta.
            </p>
          </div>
        </div>
      </div>

      {/* Corpo da ferramenta */}
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="flex items-center justify-between bg-muted/40 px-4 py-2">
          <span className="text-xs font-medium text-muted-foreground">
            Argumentos a declarar na ferramenta
          </span>
          <button
            onClick={() => copy(toolBody, "body")}
            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded border border-border hover:bg-muted transition-colors"
          >
            {copied === "body" ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
            {copied === "body" ? "Copiado!" : "Copiar"}
          </button>
        </div>
        <pre className="overflow-x-auto p-4 text-[11px] leading-relaxed bg-[#1a1a2e] text-[#e2e8f0]">
          {toolBody}
        </pre>
      </div>

      {/* Campos */}
      <div className="rounded-md bg-muted/50 border border-border p-4 text-xs space-y-2">
        <p className="font-semibold text-foreground text-sm">Campos aceitos</p>
        <p className="text-muted-foreground">
          Todos opcionais — mas é preciso chegar pelo menos um entre{" "}
          <code className="font-mono">nome</code>, <code className="font-mono">telefone</code> e{" "}
          <code className="font-mono">conversa_id</code>.
        </p>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {CAMPOS.map(([field, desc]) => (
            <div key={field} className="flex gap-2">
              <code className="shrink-0 bg-muted rounded px-1 font-mono text-[11px] text-foreground">
                {field}
              </code>
              <span className="text-muted-foreground">{desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Os dois avisos que evitam a integração silenciosamente quebrada */}
      <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-4 text-xs space-y-3">
        <p className="flex items-center gap-2 font-semibold text-foreground text-sm">
          <TriangleAlert size={14} className="text-amber-500 shrink-0" />
          Antes de confiar nesta ferramenta
        </p>
        <div className="space-y-2 text-muted-foreground leading-relaxed">
          <p>
            <strong className="text-foreground">Não ponha texto fixo no corpo.</strong> Em
            ferramenta HTTP de agente, só chega o que o modelo passa como argumento:
            constante e variável de contexto somem no caminho e a chamada volta 400.
            É por isso que o identificador do CRM está na URL e o token no header.
          </p>
          <p>
            <strong className="text-foreground">
              Não dependa dela para não perder lead.
            </strong>{" "}
            O agente decide se chama a ferramenta, e às vezes não chama — a conversa fica
            impecável e o dado não chega. Deixe a criação do lead com o webhook da conversa
            (n8n, acima) e use esta ferramenta só para o interesse. Assim, quando o agente
            esquecer, perde-se o enriquecimento e nunca o lead.
          </p>
        </div>
      </div>
    </div>
  );
}

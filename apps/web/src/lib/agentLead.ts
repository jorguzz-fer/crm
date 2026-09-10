/**
 * Captura de lead vinda de um agente conversacional (fazer.ai agents).
 *
 * ── Por que este módulo existe ────────────────────────────────────────────────
 *
 * Um agente de IA não é um formulário. Três diferenças mudam o desenho:
 *
 * 1. **Ele não sabe o telefone de quem fala com ele.** O agente é um modelo
 *    dentro de uma conversa; o número está no canal, não no contexto dele.
 *    Quando obrigado a informar, ele inventa ("não informado", "whatsapp da
 *    conversa"). Por isso o telefone chega pelo webhook do Chatwoot e o
 *    agente só enriquece — nunca é ele a fonte do telefone.
 *
 * 2. **Ele esquece de chamar a ferramenta.** Medido em produção: 2 chamadas
 *    em 3 conversas. Captura que funciona em 2 de 3 não é captura. Por isso o
 *    lead nasce no webhook (que não esquece) e o que vem do agente é
 *    enriquecimento — se faltar, perde-se o interesse, nunca o lead.
 *
 * 3. **Todo campo vem sujo.** Número em texto, nome ausente, resumo com três
 *    quebras de linha. As funções abaixo são a fronteira entre o que o agente
 *    diz e o que entra no banco.
 *
 * Tudo aqui é função pura, sem Prisma e sem Next — é o que o vitest deste app
 * cobre (ver `vitest.config.ts`).
 */

// Limites do que cabe em cada coluna / faz sentido numa tela de CRM.
const MAX_NAME = 200;
const MAX_TITLE = 200;

/**
 * Textos que o modelo escreve quando não sabe o dado. Tratar como ausência:
 * um lead chamado "não informado" é ruído que ninguém consegue trabalhar.
 */
const PLACEHOLDERS = new Set([
  "nao informado",
  "não informado",
  "nao informada",
  "não informada",
  "desconhecido",
  "desconhecida",
  "sem nome",
  "n/a",
  "na",
  "null",
  "undefined",
  "-",
  "cliente",
  "whatsapp da conversa",
]);

/**
 * Variável de template que a plataforma do agente não resolveu, ex.
 * `{{conversation_id}}`. Chegou até aqui porque o prompt a exibia literal e o
 * modelo copiou o que viu (2026-09-10: virou "Conversa: conversa
 * {{conversation_id}}" numa nota e um lead duplicado). Qualquer valor que
 * contenha isso é ausência de dado, nunca dado.
 */
const UNRESOLVED_TEMPLATE = /\{\{[\s\S]*?\}\}/;

function isPlaceholder(value: string): boolean {
  return PLACEHOLDERS.has(value.trim().toLowerCase()) || UNRESOLVED_TEMPLATE.test(value);
}

/** Reduz um telefone ao que ele tem de estável: os dígitos. */
export function normalizePhone(raw: string | null | undefined): string {
  if (!raw) return "";
  return String(raw).replace(/\D/g, "");
}

/**
 * Formas em que o mesmo telefone brasileiro aparece nas duas pontas.
 *
 * O Chatwoot entrega `+5511936242622`; um formulário do site entrega
 * `11936242622`. Sem isto, a mesma pessoa vira dois leads.
 *
 * Deliberadamente **não** normaliza o nono dígito: `11936242622` e
 * `1136242622` podem ser duas linhas diferentes, e casar por engano é pior
 * que duplicar — mistura o histórico de duas pessoas.
 */
export function phoneVariants(raw: string | null | undefined): string[] {
  const digits = normalizePhone(raw);
  if (!digits) return [];

  const out = [digits];

  if (digits.startsWith("55") && digits.length >= 12) {
    // 55 + DDD (2) + número (8 ou 9)
    out.push(digits.slice(2));
  } else if (digits.length === 10 || digits.length === 11) {
    // DDD + número, sem código do país
    out.push(`55${digits}`);
  }

  return out;
}

/**
 * Nome que o CRM aceita: mínimo 2 caracteres, sem os textos que o modelo
 * inventa. Cai para o telefone, que é o identificador que sempre existe.
 */
export function safeLeadName(
  name: string | null | undefined,
  phone: string | null | undefined,
): string {
  const clean = (name ?? "").trim();

  if (clean.length >= 2 && !isPlaceholder(clean)) {
    return clean.slice(0, MAX_NAME);
  }

  const digits = normalizePhone(phone);
  return digits ? `WhatsApp ${digits}` : "Lead sem nome";
}

/**
 * Texto livre gerado pelo modelo: apara, colapsa quebras e trunca.
 * Devolve `null` quando não sobrou nada — para a nota não ganhar linha vazia.
 */
export function sanitizeAgentText(
  value: string | null | undefined,
  max: number,
): string | null {
  if (!value) return null;
  const clean = String(value).replace(/\s+/g, " ").trim();
  if (!clean || UNRESOLVED_TEMPLATE.test(clean)) return null;
  return clean.slice(0, max);
}

/**
 * Número de vidas de um contrato B2B. O agente manda `40`, `"40"` ou
 * `"cerca de 40 vidas"` — as três significam a mesma coisa.
 */
export function parseHeadcount(value: unknown): number | null {
  if (value === null || value === undefined) return null;

  // O sinal entra na captura de propósito: sem ele, "-5" casaria "5".
  const match = String(value).match(/-?\d+/);
  if (!match) return null;

  const n = Number(match[0]);
  if (!Number.isFinite(n) || n <= 0 || n > 1_000_000) return null;

  return n;
}

/** As três personas que a Wendy atende, como um humano lê no CRM. */
const PERSONAS: Record<string, string> = {
  pf: "Pessoa física",
  b2b: "Empresa (B2B)",
  licenciado: "Licenciado / candidato a licenciado",
};

export function personaLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  return PERSONAS[String(value).trim().toLowerCase()] ?? null;
}

export type LeadStatus =
  | "NOVO"
  | "EM_CONTATO"
  | "QUALIFICADO"
  | "DESQUALIFICADO"
  | "CONVERTIDO";

/** Quão avançado é cada status — usado para nunca andar para trás. */
const STATUS_RANK: Record<LeadStatus, number> = {
  NOVO: 0,
  EM_CONTATO: 1,
  QUALIFICADO: 2,
  DESQUALIFICADO: 2,
  CONVERTIDO: 3,
};

/**
 * Status do lead depois do que o agente reportou.
 *
 * Duas travas, porque quem reporta é um modelo e ele revê a mesma pessoa em
 * conversas diferentes:
 *
 * - **Nunca rebaixa.** Uma conversa de suporte com quem o comercial já
 *   qualificou não pode desfazer esse trabalho.
 * - **Nunca toca em CONVERTIDO.** Cliente fechado é resultado, não palpite
 *   de agente.
 *
 * A desqualificação explícita é a exceção que passa por cima de QUALIFICADO:
 * é informação nova e negativa, e o comercial precisa vê-la.
 */
export function resolveLeadStatus(
  reported: string | null | undefined,
  current: LeadStatus,
): LeadStatus {
  if (current === "CONVERTIDO") return "CONVERTIDO";

  const normalized = String(reported ?? "").trim().toLowerCase();

  if (normalized === "desqualificado") return "DESQUALIFICADO";

  const next: LeadStatus | null =
    normalized === "qualificado" ? "QUALIFICADO"
    : normalized === "em_contato" ? "EM_CONTATO"
    : null;

  if (!next) return current;

  return STATUS_RANK[next] > STATUS_RANK[current] ? next : current;
}

export interface AgentNoteInput {
  /** Nome do agente, para o humano saber quem escreveu. */
  agentName?: string | null;
  persona?: string | null;
  interest?: string | null;
  headcount?: number | null;
  summary?: string | null;
  nextStep?: string | null;
  externalRef?: string | null;
}

/**
 * A nota que o vendedor humano vai ler antes de ligar.
 *
 * O cabeçalho sai sempre — nota ausente e nota pobre são coisas diferentes,
 * e quem abre o lead precisa saber que o agente passou por ali.
 */
export function buildAgentNote(input: AgentNoteInput): string {
  const agent = sanitizeAgentText(input.agentName, 40) ?? "Agente";
  const lines = [`[${agent} — interesse identificado]`];

  const persona = personaLabel(input.persona);
  if (persona) lines.push(`Persona: ${persona}`);

  const interest = sanitizeAgentText(input.interest, 300);
  if (interest) lines.push(`Interesse: ${interest}`);

  if (input.headcount) lines.push(`Vidas: ${input.headcount}`);

  const summary = sanitizeAgentText(input.summary, 1500);
  if (summary) lines.push(`Resumo: ${summary}`);

  const nextStep = sanitizeAgentText(input.nextStep, 300);
  if (nextStep) lines.push(`Próximo passo: ${nextStep}`);

  const ref = sanitizeAgentText(input.externalRef, 120);
  if (ref) lines.push(`Conversa: ${ref}`);

  return lines.join("\n");
}

/** Título da oportunidade no funil: quem é + o que quer. */
export function opportunityTitle(
  name: string,
  interest: string | null | undefined,
): string {
  const clean = sanitizeAgentText(interest, 80);
  const title = clean ? `${name} — ${clean}` : name;
  return title.slice(0, MAX_TITLE);
}

/**
 * Referência estável de uma conversa do Chatwoot: `chatwoot:<conta>:<conversa>`.
 *
 * Devolve `null` se qualquer metade faltar — referência pela metade não
 * correlaciona nada e ainda casaria com outros leads incompletos.
 */
export function chatwootExternalRef(
  accountId: string | number | null | undefined,
  conversationId: string | number | null | undefined,
): string | null {
  const account = String(accountId ?? "").trim();
  const conversation = String(conversationId ?? "").trim();

  if (!/^\d+$/.test(account) || !/^\d+$/.test(conversation)) return null;

  return `chatwoot:${account}:${conversation}`;
}

/**
 * PII redaction utilities.
 *
 * Use estes helpers ANTES de gravar dados em logs (Sentry, AuditLog.meta,
 * console). Garante que CPF, CNPJ, e-mail, telefone, tokens e senhas não
 * vazem em histórico de logs — exigência LGPD art. 46.
 */

// ─── Padrões textuais (busca em string livre) ────────────────────────────────

const CPF_RE = /(\d{3})[.\s]?(\d{3})[.\s]?(\d{3})[-\s]?(\d{2})/g;
const CNPJ_RE = /(\d{2})[.\s]?(\d{3})[.\s]?(\d{3})[/\s]?(\d{4})[-\s]?(\d{2})/g;
const EMAIL_RE = /([A-Za-z0-9._%+-]+)@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;
// Telefone BR: opcional +55, opcional DDD com parênteses, opcional 9 inicial, 4+4 ou 4+5 dígitos
const PHONE_BR_RE = /(\+?55[\s-]?)?\(?(\d{2})\)?[\s-]?(9?)[\s-]?(\d{4})[-\s]?(\d{4})/g;

// ─── Mascaramento por valor pontual ──────────────────────────────────────────

/** CPF: mantém os 3 primeiros e os 2 últimos dígitos (`123.***.***-89`). */
export function maskCpf(cpf: string): string {
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11) return cpf;
  return `${digits.slice(0, 3)}.***.***-${digits.slice(-2)}`;
}

// CNPJ: mantém os 2 primeiros e os 2 últimos dígitos (ex.: 12.***.***\/****-89).
export function maskCnpj(cnpj: string): string {
  const digits = cnpj.replace(/\D/g, "");
  if (digits.length !== 14) return cnpj;
  return `${digits.slice(0, 2)}.***.***/****-${digits.slice(-2)}`;
}

/** Email: mantém 1º char do local e domínio inteiro (`f***@example.com`). */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at <= 0 || at === email.length - 1) return email;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (!domain.includes(".")) return email;
  const masked =
    local.length <= 1 ? "*" : local[0] + "*".repeat(Math.min(local.length - 1, 6));
  return `${masked}@${domain}`;
}

/** Telefone: mantém últimos 4 dígitos, mascara o resto (`+55 (11) ****-1234`). */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8) return phone;
  const last4 = digits.slice(-4);

  // < 10 dígitos: provavelmente número local sem DDD — só mascara a frente.
  if (digits.length < 10) return `****-${last4}`;

  // Layout BR: [DDI 1-3?][DDD 2][9?][NÚMERO 8]
  // Sem DDI: 10 (fixo) ou 11 (celular) dígitos.
  // Com DDI 55: 12 ou 13. Tudo que sobra na frente do bloco "10 ou 11" é o DDI.
  const localLen = digits.length === 10 || digits.length === 12 ? 10 : 11;
  const ddiDigits = digits.length > localLen ? digits.slice(0, digits.length - localLen) : "";
  const local = digits.slice(-localLen);
  const ddd = local.slice(0, 2);
  const ddi = ddiDigits ? `+${ddiDigits} ` : "";
  return `${ddi}(${ddd}) ****-${last4}`.trim();
}

// ─── Redação em texto livre ──────────────────────────────────────────────────

/**
 * Aplica todas as regras de mascaramento numa string. Útil para logs de
 * mensagens, stack traces, ou qualquer texto que possa conter PII embutida.
 */
export function redactString(input: string): string {
  if (typeof input !== "string" || input.length === 0) return input;
  return input
    // CNPJ ANTES de CPF (CNPJ é mais longo, evita match parcial)
    .replace(CNPJ_RE, (_, a, _b, _c, _d, e) => `${a}.***.***/****-${e}`)
    .replace(CPF_RE, (_, a, _b, _c, d) => `${a}.***.***-${d}`)
    .replace(EMAIL_RE, (_, local, domain) => maskEmail(`${local}@${domain}`))
    .replace(PHONE_BR_RE, (match, ddi, ddd, _nine, _mid, last) => {
      // Heurística: precisa de pelo menos 10 dígitos pra ser telefone, senão
      // pode ser CEP/data e a gente devolve o original.
      const digits = match.replace(/\D/g, "");
      if (digits.length < 10) return match;
      const ddiPart = ddi ? `+${ddi.replace(/\D/g, "")} ` : "";
      return `${ddiPart}(${ddd}) ****-${last}`;
    });
}

// ─── Redação em objetos arbitrários ──────────────────────────────────────────

const SENSITIVE_KEYS = new Set([
  "password",
  "passwordhash",
  "senha",
  "secret",
  "token",
  "apikey",
  "api_key",
  "accesstoken",
  "refreshtoken",
  "authorization",
  "cookie",
  "session",
  "creditcard",
  "cardnumber",
  "cvv",
]);

const PII_KEY_MASKERS: Record<string, (v: string) => string> = {
  email: maskEmail,
  cpf: maskCpf,
  cnpj: maskCnpj,
  phone: maskPhone,
  telefone: maskPhone,
  celular: maskPhone,
  whatsapp: maskPhone,
};

const MAX_DEPTH = 10;

/**
 * Sanitiza um objeto recursivamente:
 *   - chaves sensíveis (password, token, apikey, ...) → `"[redacted]"`
 *   - chaves de PII conhecida (email, cpf, phone, ...) → valor mascarado
 *   - strings em qualquer lugar → `redactString` (CPF/email/etc embutidos)
 *   - arrays e objetos → recursão
 *
 * Retorna nova estrutura — o input original NÃO é mutado.
 */
export function redactObject<T>(input: T, depth = 0): T {
  if (depth > MAX_DEPTH) return "[truncated]" as unknown as T;
  if (input === null || input === undefined) return input;
  if (typeof input === "string") return redactString(input) as unknown as T;
  if (typeof input === "number" || typeof input === "boolean" || typeof input === "bigint") {
    return input;
  }
  if (input instanceof Date) return input;
  if (Array.isArray(input)) {
    return input.map((v) => redactObject(v, depth + 1)) as unknown as T;
  }
  if (typeof input !== "object") return input;

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    const keyLower = k.toLowerCase().replace(/[_-]/g, "");
    if (SENSITIVE_KEYS.has(keyLower)) {
      out[k] = "[redacted]";
      continue;
    }
    const masker = PII_KEY_MASKERS[keyLower];
    if (masker && typeof v === "string") {
      out[k] = masker(v);
      continue;
    }
    out[k] = redactObject(v, depth + 1);
  }
  return out as T;
}

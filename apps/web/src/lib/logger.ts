/**
 * Logger com redação automática de PII.
 *
 * Use este wrapper em vez de `console.error/warn/info` diretamente quando o
 * argumento puder conter dados de usuário (request body, payload de webhook,
 * stack trace de erro com mensagem do banco, etc.). Garante que CPF, CNPJ,
 * e-mail, telefone e chaves sensíveis (password, token, apikey) não vazem
 * em logs do servidor — exigência LGPD art. 46.
 *
 * Para mensagens 100% estáticas (`logger.error("[audit] failed")`), o custo
 * é mínimo: strings sem PII passam intactas pelo redactString.
 */

import { redactObject, redactString } from "@crm/validators";

function sanitize(arg: unknown): unknown {
  if (typeof arg === "string") return redactString(arg);
  if (arg instanceof Error) {
    // Preserva o tipo Error mas redacta a mensagem (que pode conter PII de
    // mensagens do Postgres tipo "duplicate key value (email)=(foo@bar.com)").
    const cloned = new Error(redactString(arg.message));
    cloned.name = arg.name;
    cloned.stack = arg.stack ? redactString(arg.stack) : undefined;
    return cloned;
  }
  if (arg === null || arg === undefined) return arg;
  if (typeof arg === "object") {
    try {
      // Clone defensivo: redactObject já não muta o input, mas estruturas
      // com getters/Proxies podem disparar efeitos colaterais.
      return redactObject(JSON.parse(JSON.stringify(arg)));
    } catch {
      // Objetos circulares ou não-serializáveis (Buffer, Stream): devolve
      // representação textual segura para não perder o log.
      return "[unserializable]";
    }
  }
  return arg;
}

function sanitizeAll(args: unknown[]): unknown[] {
  return args.map(sanitize);
}

export const logger = {
  info(...args: unknown[]) {
    console.info(...sanitizeAll(args));
  },
  warn(...args: unknown[]) {
    console.warn(...sanitizeAll(args));
  },
  error(...args: unknown[]) {
    console.error(...sanitizeAll(args));
  },
  debug(...args: unknown[]) {
    if (process.env.NODE_ENV !== "production") {
      console.debug(...sanitizeAll(args));
    }
  },
};

export type Logger = typeof logger;

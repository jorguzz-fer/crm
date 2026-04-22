import { describe, it, expect } from "vitest";
import {
  maskCpf,
  maskCnpj,
  maskEmail,
  maskPhone,
  redactString,
  redactObject,
} from "../pii";

// ─── maskCpf ──────────────────────────────────────────────────────────────────

describe("maskCpf", () => {
  it("mascara CPF formatado", () => {
    expect(maskCpf("123.456.789-00")).toBe("123.***.***-00");
  });
  it("mascara CPF só com dígitos", () => {
    expect(maskCpf("12345678900")).toBe("123.***.***-00");
  });
  it("devolve string original se não for CPF (11 dígitos)", () => {
    expect(maskCpf("123")).toBe("123");
    expect(maskCpf("123456789")).toBe("123456789");
  });
});

// ─── maskCnpj ─────────────────────────────────────────────────────────────────

describe("maskCnpj", () => {
  it("mascara CNPJ formatado", () => {
    expect(maskCnpj("12.345.678/0001-99")).toBe("12.***.***/****-99");
  });
  it("mascara CNPJ só com dígitos", () => {
    expect(maskCnpj("12345678000199")).toBe("12.***.***/****-99");
  });
  it("devolve string original se não for CNPJ (14 dígitos)", () => {
    expect(maskCnpj("123456789")).toBe("123456789");
  });
});

// ─── maskEmail ────────────────────────────────────────────────────────────────

describe("maskEmail", () => {
  it("mascara local mantendo primeira letra e domínio", () => {
    expect(maskEmail("fernando@example.com")).toBe("f******@example.com");
  });
  it("mascara local de 1 char com asterisco único", () => {
    expect(maskEmail("a@example.com")).toBe("*@example.com");
  });
  it("limita máscara a 6 asteriscos para locals longos", () => {
    expect(maskEmail("fernandojorge@example.com")).toBe("f******@example.com");
  });
  it("devolve original se não for email válido", () => {
    expect(maskEmail("não-é-email")).toBe("não-é-email");
    expect(maskEmail("@example.com")).toBe("@example.com");
    expect(maskEmail("foo@")).toBe("foo@");
    expect(maskEmail("foo@bar")).toBe("foo@bar");
  });
});

// ─── maskPhone ────────────────────────────────────────────────────────────────

describe("maskPhone", () => {
  it("mascara celular BR com +55 e DDD", () => {
    expect(maskPhone("+55 (11) 98765-4321")).toBe("+55 (11) ****-4321");
  });
  it("mascara celular BR só com dígitos", () => {
    expect(maskPhone("5511987654321")).toBe("+55 (11) ****-4321");
  });
  it("mascara fixo BR sem +55", () => {
    expect(maskPhone("(11) 3456-7890")).toBe("(11) ****-7890");
  });
  it("devolve original se < 8 dígitos", () => {
    expect(maskPhone("1234567")).toBe("1234567");
  });
});

// ─── redactString ─────────────────────────────────────────────────────────────

describe("redactString", () => {
  it("mascara CPF embutido em texto", () => {
    expect(redactString("Cliente CPF 123.456.789-00 confirmado")).toBe(
      "Cliente CPF 123.***.***-00 confirmado",
    );
  });
  it("mascara CNPJ antes de CPF (não confunde)", () => {
    expect(redactString("CNPJ 12.345.678/0001-99 ok")).toBe(
      "CNPJ 12.***.***/****-99 ok",
    );
  });
  it("mascara e-mail embutido", () => {
    expect(redactString("contato: fernando@example.com agora")).toBe(
      "contato: f******@example.com agora",
    );
  });
  it("mascara múltiplos PIIs no mesmo texto", () => {
    const out = redactString(
      "João (CPF 111.222.333-44, e-mail joao@acme.com, fone +55 (11) 98765-4321)",
    );
    expect(out).toContain("111.***.***-44");
    expect(out).toContain("j***@acme.com");
    expect(out).toContain("(11) ****-4321");
  });
  it("não confunde CEP com telefone (< 10 dígitos)", () => {
    expect(redactString("CEP 04567-890")).toBe("CEP 04567-890");
  });
  it("preserva strings vazias", () => {
    expect(redactString("")).toBe("");
  });
});

// ─── redactObject ─────────────────────────────────────────────────────────────

describe("redactObject", () => {
  it("redige chaves sensíveis (password, token, apikey...)", () => {
    const out = redactObject({
      user: "fer",
      password: "secret123",
      token: "abc.def.ghi",
      apiKey: "sk-xyz",
      api_key: "sk-xyz",
      authorization: "Bearer xyz",
    });
    expect(out).toEqual({
      user: "fer",
      password: "[redacted]",
      token: "[redacted]",
      apiKey: "[redacted]",
      api_key: "[redacted]",
      authorization: "[redacted]",
    });
  });

  it("mascara PII por chave (email, cpf, phone)", () => {
    const out = redactObject({
      email: "fernando@example.com",
      cpf: "123.456.789-00",
      phone: "+55 (11) 98765-4321",
      telefone: "1133334444",
      whatsapp: "5511987654321",
    });
    expect(out.email).toBe("f******@example.com");
    expect(out.cpf).toBe("123.***.***-00");
    expect(out.phone).toBe("+55 (11) ****-4321");
    expect(out.telefone).toBe("(11) ****-4444");
    expect(out.whatsapp).toBe("+55 (11) ****-4321");
  });

  it("redacta PII embutida em strings de campos quaisquer", () => {
    const out = redactObject({
      mensagem: "Recebido CPF 123.456.789-00 do cliente",
    });
    expect(out.mensagem).toBe("Recebido CPF 123.***.***-00 do cliente");
  });

  it("recorre em arrays e objetos aninhados", () => {
    const out = redactObject({
      leads: [
        { name: "A", email: "a@b.com", password: "x" },
        { name: "B", email: "bruno@b.com" },
      ],
    });
    // local de 1 char vira "*"
    expect(out.leads[0].email).toBe("*@b.com");
    expect(out.leads[0].password).toBe("[redacted]");
    // local 5 chars: 1ª letra + 4 asteriscos
    expect(out.leads[1].email).toBe("b****@b.com");
  });

  it("preserva números, booleans e Date", () => {
    const date = new Date("2026-01-01");
    const out = redactObject({
      count: 42,
      enabled: true,
      createdAt: date,
    });
    expect(out.count).toBe(42);
    expect(out.enabled).toBe(true);
    expect(out.createdAt).toBe(date);
  });

  it("trunca recursão excessiva (depth > 10)", () => {
    type Nested = { next?: Nested; value?: string };
    let nested: Nested = { value: "fim" };
    for (let i = 0; i < 15; i++) nested = { next: nested };
    const out = redactObject(nested) as Nested;
    let cursor: Nested | string | undefined = out;
    let depth = 0;
    while (cursor && typeof cursor === "object" && cursor.next) {
      cursor = cursor.next;
      depth++;
      if (depth > 20) break;
    }
    // Deve ter truncado em algum ponto antes de chegar nos 15 níveis
    expect(depth).toBeLessThanOrEqual(11);
  });

  it("não muta o input original", () => {
    const input = { password: "x", email: "a@b.com" };
    const out = redactObject(input);
    expect(input.password).toBe("x");
    expect(input.email).toBe("a@b.com");
    expect(out).not.toBe(input);
  });

  it("trata null e undefined", () => {
    expect(redactObject(null)).toBe(null);
    expect(redactObject(undefined)).toBe(undefined);
  });

  it("normaliza chaves com hífen/underscore (api_key, api-key, ApiKey)", () => {
    const out = redactObject({
      "api_key": "x",
      "api-key": "y",
      "ApiKey": "z",
      "ACCESS_TOKEN": "w",
    });
    expect(out["api_key"]).toBe("[redacted]");
    expect(out["api-key"]).toBe("[redacted]");
    expect(out["ApiKey"]).toBe("[redacted]");
    expect(out["ACCESS_TOKEN"]).toBe("[redacted]");
  });
});

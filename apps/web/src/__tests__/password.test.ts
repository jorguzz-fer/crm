import { describe, it, expect } from "vitest";
import { validatePassword } from "@/lib/password";

describe("validatePassword", () => {

  // ── Comprimento mínimo ────────────────────────────────────────────────────

  describe("comprimento mínimo (10 chars)", () => {
    it("aceita senha com exatamente 10 caracteres", () => {
      expect(validatePassword("Abc1!abcde").ok).toBe(true);
    });
    it("aceita senha longa (100+ chars)", () => {
      const long = "Abc1!" + "x".repeat(100);
      expect(validatePassword(long).ok).toBe(true);
    });
    it("rejeita senha com 9 caracteres", () => {
      const result = validatePassword("Abc1!abcd");
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/10/);
    });
    it("rejeita senha vazia", () => {
      expect(validatePassword("").ok).toBe(false);
    });
    it("rejeita string vazia com mensagem de obrigatoriedade", () => {
      const result = validatePassword("");
      expect(result.error).toMatch(/obrigatória/i);
    });
  });

  // ── Complexidade (3 de 4 classes) ─────────────────────────────────────────

  describe("complexidade — mínimo 3 classes de caracteres", () => {
    it("aceita: minúscula + maiúscula + dígito", () => {
      expect(validatePassword("AbcAbc1234").ok).toBe(true);
    });
    it("aceita: minúscula + maiúscula + símbolo", () => {
      expect(validatePassword("AbcAbc!!!!").ok).toBe(true);
    });
    it("aceita: minúscula + dígito + símbolo", () => {
      expect(validatePassword("abc1234!@#$").ok).toBe(true);
    });
    it("aceita: maiúscula + dígito + símbolo", () => {
      expect(validatePassword("ABC1234!@#$").ok).toBe(true);
    });
    it("aceita: todas as 4 classes", () => {
      expect(validatePassword("Abc1!xyz789").ok).toBe(true);
    });
    it("rejeita: só minúsculas (1 classe)", () => {
      const result = validatePassword("abcdefghij");
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/3/);
    });
    it("rejeita: minúscula + maiúscula apenas (2 classes)", () => {
      expect(validatePassword("AbcAbcAbcA").ok).toBe(false);
    });
    it("rejeita: minúscula + dígito apenas (2 classes)", () => {
      expect(validatePassword("abc1234567").ok).toBe(false);
    });
    it("rejeita: só dígitos (1 classe)", () => {
      expect(validatePassword("1234567890").ok).toBe(false);
    });
    it("rejeita: maiúscula + símbolo apenas (2 classes)", () => {
      expect(validatePassword("ABCDE!@#$%").ok).toBe(false);
    });
  });

  // ── Blocklist de senhas comuns ────────────────────────────────────────────

  describe("blocklist de senhas comuns", () => {
    it("rejeita senha contendo '12345678'", () => {
      expect(validatePassword("Abc!12345678").ok).toBe(false);
    });
    it("rejeita senha contendo '123456789'", () => {
      expect(validatePassword("Abc!123456789").ok).toBe(false);
    });
    it("rejeita senha contendo '1234567890'", () => {
      expect(validatePassword("Abc!1234567890").ok).toBe(false);
    });
    it("rejeita senha contendo 'password' (case-insensitive)", () => {
      expect(validatePassword("PASSWORD!123").ok).toBe(false);
    });
    it("rejeita senha contendo 'senha12345'", () => {
      expect(validatePassword("ABCsenha12345!").ok).toBe(false);
    });
    it("rejeita senha contendo 'qwerty'", () => {
      expect(validatePassword("QWERTYqwerty1!").ok).toBe(false);
    });
    it("rejeita senha contendo 'qwerty123'", () => {
      expect(validatePassword("Abc!qwerty123").ok).toBe(false);
    });
    it("rejeita senha contendo 'admin' (case-insensitive)", () => {
      expect(validatePassword("ADMIN!abc123").ok).toBe(false);
    });
    it("rejeita senha contendo 'admin123'", () => {
      expect(validatePassword("Xadmin123!XYZ").ok).toBe(false);
    });
    it("aceita senha forte que não contém padrões comuns", () => {
      expect(validatePassword("Tr0ub4dor&3").ok).toBe(true);
    });
  });

  // ── Tipos inválidos de entrada ────────────────────────────────────────────

  describe("entradas inválidas", () => {
    it("rejeita null (não é string)", () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(validatePassword(null as any).ok).toBe(false);
    });
    it("rejeita undefined (não é string)", () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(validatePassword(undefined as any).ok).toBe(false);
    });
    it("rejeita número (não é string)", () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(validatePassword(12345678901 as any).ok).toBe(false);
    });
  });

  // ── Retorno correto ───────────────────────────────────────────────────────

  describe("estrutura do retorno", () => {
    it("retorna { ok: true } sem campo error em sucesso", () => {
      const result = validatePassword("Abc1!abcde");
      expect(result.ok).toBe(true);
      expect(result.error).toBeUndefined();
    });
    it("retorna { ok: false, error: string } em falha", () => {
      const result = validatePassword("fraca");
      expect(result.ok).toBe(false);
      expect(typeof result.error).toBe("string");
      expect(result.error!.length).toBeGreaterThan(0);
    });
  });
});

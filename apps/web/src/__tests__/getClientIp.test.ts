import { describe, it, expect } from "vitest";
import { getClientIp } from "@/lib/audit";

// Helper: cria um Request com os headers especificados
function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request("https://example.com", { headers });
}

describe("getClientIp", () => {

  // ── x-forwarded-for ───────────────────────────────────────────────────────

  describe("x-forwarded-for", () => {
    it("retorna o IP do header x-forwarded-for", () => {
      const req = makeRequest({ "x-forwarded-for": "203.0.113.5" });
      expect(getClientIp(req)).toBe("203.0.113.5");
    });

    it("retorna apenas o PRIMEIRO IP de uma lista separada por vírgula", () => {
      const req = makeRequest({ "x-forwarded-for": "203.0.113.5, 10.0.0.1, 192.168.0.1" });
      expect(getClientIp(req)).toBe("203.0.113.5");
    });

    it("faz trim em espaços ao redor do IP", () => {
      const req = makeRequest({ "x-forwarded-for": "  203.0.113.5  , 10.0.0.1" });
      expect(getClientIp(req)).toBe("203.0.113.5");
    });

    it("aceita IPv6 em x-forwarded-for", () => {
      const req = makeRequest({ "x-forwarded-for": "2001:db8::1" });
      expect(getClientIp(req)).toBe("2001:db8::1");
    });
  });

  // ── x-real-ip (fallback) ──────────────────────────────────────────────────

  describe("x-real-ip (fallback quando x-forwarded-for ausente)", () => {
    it("retorna IP do header x-real-ip", () => {
      const req = makeRequest({ "x-real-ip": "198.51.100.42" });
      expect(getClientIp(req)).toBe("198.51.100.42");
    });

    it("prefere x-forwarded-for sobre x-real-ip quando ambos presentes", () => {
      const req = makeRequest({
        "x-forwarded-for": "203.0.113.5",
        "x-real-ip": "198.51.100.42",
      });
      expect(getClientIp(req)).toBe("203.0.113.5");
    });
  });

  // ── Sem headers de IP ─────────────────────────────────────────────────────

  describe("sem headers de IP", () => {
    it("retorna null quando nenhum header de IP está presente", () => {
      const req = makeRequest();
      expect(getClientIp(req)).toBeNull();
    });

    it("retorna null com headers irrelevantes", () => {
      const req = makeRequest({ "content-type": "application/json", "accept": "*/*" });
      expect(getClientIp(req)).toBeNull();
    });
  });
});

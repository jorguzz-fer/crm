import { describe, it, expect } from "vitest";
import { readdirSync } from "fs";
import { fileURLToPath } from "url";
import { isTenantDoorPath, RESERVED_SEGMENTS } from "@/lib/routes";

describe("isTenantDoorPath", () => {
  it("reconhece um slug de cliente na raiz", () => {
    expect(isTenantDoorPath("/alumine")).toBe(true);
    expect(isTenantDoorPath("/clinica-sao-jorge")).toBe(true);
    expect(isTenantDoorPath("/cliente01")).toBe(true);
  });

  it("não trata rotas do app como porta de cliente", () => {
    for (const rota of ["/dashboard", "/leads", "/painel", "/login", "/signup", "/api"]) {
      expect(isTenantDoorPath(rota)).toBe(false);
    }
  });

  it("só vale para o primeiro nível", () => {
    // /alumine/leads não existe — o app segue nas rotas atuais depois do login
    expect(isTenantDoorPath("/alumine/leads")).toBe(false);
    expect(isTenantDoorPath("/api/leads")).toBe(false);
  });

  it("rejeita a raiz e caminhos vazios", () => {
    expect(isTenantDoorPath("/")).toBe(false);
    expect(isTenantDoorPath("")).toBe(false);
  });

  it("rejeita o que não casa com o formato de slug", () => {
    // Maiúsculas, acentos, espaços, ponto (arquivos) e caracteres especiais
    for (const caminho of ["/Alumine", "/alumíne", "/alu mine", "/sw.js", "/alu_mine", "/a"]) {
      expect(isTenantDoorPath(caminho)).toBe(false);
    }
  });

  it("respeita o limite de 50 caracteres do slug", () => {
    expect(isTenantDoorPath("/" + "a".repeat(50))).toBe(true);
    expect(isTenantDoorPath("/" + "a".repeat(51))).toBe(false);
  });
});

describe("RESERVED_SEGMENTS", () => {
  // Guard: uma rota nova em app/ que não entre na lista viraria "porta de
  // cliente" no middleware e ficaria acessível sem sessão.
  it("cobre todas as rotas de primeiro nível existentes em app/", () => {
    const appDir = fileURLToPath(new URL("../app", import.meta.url));

    const topLevel = readdirSync(appDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);

    const segments = topLevel.flatMap((name) => {
      // Grupos de rota — (app), (public) — não aparecem na URL: desce um nível
      if (name.startsWith("(") && name.endsWith(")")) {
        return readdirSync(`${appDir}/${name}`, { withFileTypes: true })
          .filter((e) => e.isDirectory())
          .map((e) => e.name);
      }
      return [name];
    });

    const faltando = segments
      // actions/ não é rota; [tenant] é justamente a porta de cliente
      .filter((s) => s !== "actions" && !s.startsWith("["))
      .filter((s) => !RESERVED_SEGMENTS.has(s));

    expect(faltando).toEqual([]);
  });
});

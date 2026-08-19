import { describe, it, expect } from "vitest";
import {
  buildListHref,
  nextSort,
  pageRange,
  parsePage,
  parseSort,
  totalPages,
} from "@/lib/listParams";

describe("buildListHref", () => {
  it("retorna o path puro quando não há parâmetros", () => {
    expect(buildListHref("/leads")).toBe("/leads");
    expect(buildListHref("/leads", {})).toBe("/leads");
  });

  it("omite valores vazios, nulos e indefinidos", () => {
    expect(
      buildListHref("/leads", { q: "", status: null, source: undefined, page: 2 })
    ).toBe("/leads?page=2");
  });

  it("omite strings compostas só de espaços", () => {
    expect(buildListHref("/leads", { q: "   " })).toBe("/leads");
  });

  it("codifica caracteres que quebrariam a querystring", () => {
    // Regressão: antes o link era montado por concatenação e `&` cortava a URL
    const href = buildListHref("/leads", { q: "Silva & Cia #1", page: 3 });
    expect(href).toBe("/leads?q=Silva+%26+Cia+%231&page=3");

    const parsed = new URL(href, "https://app.example.com");
    expect(parsed.searchParams.get("q")).toBe("Silva & Cia #1");
    expect(parsed.searchParams.get("page")).toBe("3");
  });

  it("preserva acentos de forma decodificável", () => {
    const href = buildListHref("/leads", { q: "Indicação" });
    expect(new URL(href, "https://x.dev").searchParams.get("q")).toBe("Indicação");
  });

  it("aceita números e mantém a ordem das chaves", () => {
    expect(buildListHref("/contatos", { q: "ana", page: 2 })).toBe(
      "/contatos?q=ana&page=2"
    );
  });
});

describe("parsePage", () => {
  it("usa 1 como padrão quando ausente ou inválido", () => {
    expect(parsePage(undefined)).toBe(1);
    expect(parsePage("")).toBe(1);
    expect(parsePage("abc")).toBe(1);
  });

  it("nunca retorna menos que 1", () => {
    expect(parsePage("0")).toBe(1);
    expect(parsePage("-5")).toBe(1);
  });

  it("trunca frações", () => {
    expect(parsePage("3.9")).toBe(3);
  });

  it("lê páginas válidas", () => {
    expect(parsePage("7")).toBe(7);
  });
});

describe("totalPages", () => {
  it("retorna ao menos 1 mesmo sem registros", () => {
    expect(totalPages(0, 20)).toBe(1);
  });

  it("arredonda para cima", () => {
    expect(totalPages(21, 20)).toBe(2);
    expect(totalPages(40, 20)).toBe(2);
    expect(totalPages(41, 20)).toBe(3);
  });

  it("é resiliente a perPage inválido", () => {
    expect(totalPages(50, 0)).toBe(1);
  });
});

describe("parseSort", () => {
  const ALLOWED = ["name", "score", "createdAt"] as const;
  const FALLBACK = { field: "createdAt", dir: "desc" } as const;

  it("cai no fallback quando o campo não está na whitelist", () => {
    // Proteção: `?sort=` arbitrário não pode virar orderBy no Prisma
    expect(parseSort(undefined, undefined, ALLOWED, FALLBACK)).toEqual(FALLBACK);
    expect(parseSort("passwordHash", "asc", ALLOWED, FALLBACK)).toEqual(FALLBACK);
  });

  it("aceita campo válido com direção explícita", () => {
    expect(parseSort("name", "desc", ALLOWED, FALLBACK)).toEqual({
      field: "name",
      dir: "desc",
    });
  });

  it("usa asc quando a direção é inválida e o campo não tem padrão", () => {
    expect(parseSort("name", "sideways", ALLOWED, FALLBACK)).toEqual({
      field: "name",
      dir: "asc",
    });
  });

  it("respeita a direção padrão do campo", () => {
    expect(parseSort("score", undefined, ALLOWED, FALLBACK, { score: "desc" })).toEqual({
      field: "score",
      dir: "desc",
    });
  });
});

describe("nextSort", () => {
  it("inverte a direção ao clicar no campo já ordenado", () => {
    expect(nextSort({ field: "name", dir: "asc" }, "name")).toEqual({
      field: "name",
      dir: "desc",
    });
    expect(nextSort({ field: "name", dir: "desc" }, "name")).toEqual({
      field: "name",
      dir: "asc",
    });
  });

  it("usa a direção padrão ao trocar de campo", () => {
    expect(nextSort({ field: "name", dir: "desc" }, "score", { score: "desc" })).toEqual({
      field: "score",
      dir: "desc",
    });
    expect(nextSort({ field: "score", dir: "desc" }, "name")).toEqual({
      field: "name",
      dir: "asc",
    });
  });
});

describe("pageRange", () => {
  it("calcula o intervalo da primeira página", () => {
    expect(pageRange(1, 20, 137)).toEqual({ from: 1, to: 20 });
  });

  it("calcula o intervalo de uma página intermediária", () => {
    expect(pageRange(2, 20, 137)).toEqual({ from: 21, to: 40 });
  });

  it("limita o fim ao total na última página", () => {
    expect(pageRange(7, 20, 137)).toEqual({ from: 121, to: 137 });
  });

  it("retorna zeros quando não há registros", () => {
    expect(pageRange(1, 20, 0)).toEqual({ from: 0, to: 0 });
  });
});

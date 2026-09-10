/**
 * Lógica pura da captura de lead vinda de agente conversacional (fazer.ai).
 *
 * Todo dado aqui nasce dentro de um modelo de linguagem: vem sujo, vem
 * ausente, vem em formato inventado. Estas funções são a fronteira entre o
 * que o agente diz e o que entra no banco.
 */

import { describe, it, expect } from "vitest";
import {
  normalizePhone,
  phoneVariants,
  safeLeadName,
  sanitizeAgentText,
  parseHeadcount,
  personaLabel,
  resolveLeadStatus,
  buildAgentNote,
  opportunityTitle,
  chatwootExternalRef,
} from "@/lib/agentLead";

describe("normalizePhone", () => {
  it("mantém apenas dígitos", () => {
    expect(normalizePhone("+55 (11) 93624-2622")).toBe("5511936242622");
  });

  it("devolve string vazia para entrada sem dígito", () => {
    expect(normalizePhone("não informado")).toBe("");
    expect(normalizePhone(null)).toBe("");
    expect(normalizePhone(undefined)).toBe("");
  });
});

describe("phoneVariants", () => {
  it("casa o mesmo número com e sem o código do país", () => {
    // O Chatwoot entrega +5511936242622; um formulário entrega 11936242622.
    // São a mesma pessoa e precisam casar na deduplicação.
    expect(phoneVariants("+5511936242622")).toEqual(
      expect.arrayContaining(["5511936242622", "11936242622"]),
    );
    expect(phoneVariants("11936242622")).toEqual(
      expect.arrayContaining(["5511936242622", "11936242622"]),
    );
  });

  it("não inventa variante para número curto demais", () => {
    // "5511" sem o 55 viraria "11" — casaria com qualquer coisa.
    expect(phoneVariants("5511")).toEqual(["5511"]);
  });

  it("não duplica quando não há variante", () => {
    expect(phoneVariants("11936242622")).toHaveLength(2);
    expect(phoneVariants("447911123456")).toEqual(["447911123456"]);
  });

  it("devolve lista vazia para telefone ausente", () => {
    expect(phoneVariants("")).toEqual([]);
    expect(phoneVariants(null)).toEqual([]);
  });
});

describe("safeLeadName", () => {
  it("preserva um nome válido", () => {
    expect(safeLeadName("Maria Silva", "11999998888")).toBe("Maria Silva");
  });

  it("cai para o telefone quando o nome não chega", () => {
    // O CRM recusa name com menos de 2 caracteres (400 Required).
    expect(safeLeadName("", "11999998888")).toBe("WhatsApp 11999998888");
    expect(safeLeadName("J", "11999998888")).toBe("WhatsApp 11999998888");
    expect(safeLeadName(null, "11999998888")).toBe("WhatsApp 11999998888");
  });

  it("cai para um rótulo genérico quando não há nome nem telefone", () => {
    expect(safeLeadName(null, null)).toBe("Lead sem nome");
  });

  it("recusa os textos que o modelo inventa no lugar do nome", () => {
    // Medido na Alumine: o agente manda isto quando não sabe o dado.
    expect(safeLeadName("não informado", "11999998888")).toBe("WhatsApp 11999998888");
    expect(safeLeadName("Não Informado", "11999998888")).toBe("WhatsApp 11999998888");
    expect(safeLeadName("desconhecido", null)).toBe("Lead sem nome");
    expect(safeLeadName("n/a", null)).toBe("Lead sem nome");
  });

  it("corta nome absurdamente longo no limite do banco", () => {
    expect(safeLeadName("a".repeat(500), null)).toHaveLength(200);
  });
});

describe("sanitizeAgentText", () => {
  it("apara espaços", () => {
    expect(sanitizeAgentText("  quer o CARE+  ", 100)).toBe("quer o CARE+");
  });

  it("devolve null para vazio", () => {
    expect(sanitizeAgentText("", 100)).toBeNull();
    expect(sanitizeAgentText("   ", 100)).toBeNull();
    expect(sanitizeAgentText(null, 100)).toBeNull();
  });

  it("trunca no limite", () => {
    expect(sanitizeAgentText("a".repeat(50), 10)).toHaveLength(10);
  });

  it("colapsa quebras de linha para a nota não virar parede de texto", () => {
    expect(sanitizeAgentText("linha um\n\n\nlinha dois", 100)).toBe("linha um linha dois");
  });
});

describe("parseHeadcount", () => {
  it("aceita número", () => {
    expect(parseHeadcount(40)).toBe(40);
  });

  it("aceita número em texto — que é como o modelo manda", () => {
    expect(parseHeadcount("40")).toBe(40);
    expect(parseHeadcount("cerca de 40 vidas")).toBe(40);
    expect(parseHeadcount("40 funcionários")).toBe(40);
  });

  it("devolve null quando não há número", () => {
    expect(parseHeadcount("não sei")).toBeNull();
    expect(parseHeadcount(null)).toBeNull();
    expect(parseHeadcount(undefined)).toBeNull();
  });

  it("ignora valores impossíveis", () => {
    expect(parseHeadcount(0)).toBeNull();
    expect(parseHeadcount(-5)).toBeNull();
    expect(parseHeadcount(99_999_999)).toBeNull();
  });
});

describe("personaLabel", () => {
  it("traduz as três personas da Wendy", () => {
    expect(personaLabel("pf")).toBe("Pessoa física");
    expect(personaLabel("b2b")).toBe("Empresa (B2B)");
    expect(personaLabel("licenciado")).toBe("Licenciado / candidato a licenciado");
  });

  it("aceita a persona como o agente escreve", () => {
    expect(personaLabel("PF")).toBe("Pessoa física");
    expect(personaLabel(" B2B ")).toBe("Empresa (B2B)");
  });

  it("devolve null para persona desconhecida", () => {
    expect(personaLabel("outra")).toBeNull();
    expect(personaLabel(null)).toBeNull();
  });
});

describe("resolveLeadStatus", () => {
  it("promove para QUALIFICADO quando o agente qualificou", () => {
    expect(resolveLeadStatus("qualificado", "NOVO")).toBe("QUALIFICADO");
    expect(resolveLeadStatus("qualificado", "EM_CONTATO")).toBe("QUALIFICADO");
  });

  it("marca EM_CONTATO quando houve conversa sem qualificação", () => {
    expect(resolveLeadStatus("em_contato", "NOVO")).toBe("EM_CONTATO");
  });

  it("aceita desqualificação explícita", () => {
    expect(resolveLeadStatus("desqualificado", "NOVO")).toBe("DESQUALIFICADO");
    expect(resolveLeadStatus("desqualificado", "QUALIFICADO")).toBe("DESQUALIFICADO");
  });

  it("nunca rebaixa um lead já qualificado por engano do agente", () => {
    // A Wendy revê a mesma pessoa numa conversa de suporte; isso não pode
    // desfazer o trabalho do comercial.
    expect(resolveLeadStatus("em_contato", "QUALIFICADO")).toBe("QUALIFICADO");
  });

  it("nunca mexe em lead já convertido", () => {
    expect(resolveLeadStatus("qualificado", "CONVERTIDO")).toBe("CONVERTIDO");
    expect(resolveLeadStatus("desqualificado", "CONVERTIDO")).toBe("CONVERTIDO");
  });

  it("mantém o status atual quando o agente não reporta nada", () => {
    expect(resolveLeadStatus(null, "EM_CONTATO")).toBe("EM_CONTATO");
    expect(resolveLeadStatus("qualquer coisa", "NOVO")).toBe("NOVO");
  });
});

describe("buildAgentNote", () => {
  it("monta a nota com o que o atendente humano precisa saber", () => {
    const nota = buildAgentNote({
      agentName:   "Wendy",
      persona:     "b2b",
      interest:    "CARE+ com gestão NR-1",
      headcount:   40,
      summary:     "Transportadora com 40 funcionários, quer atender a NR-1.",
      nextStep:    "Pediu proposta — aguarda o comercial.",
      externalRef: "chatwoot:8:1042",
    });

    expect(nota).toContain("[Wendy — interesse identificado]");
    expect(nota).toContain("Persona: Empresa (B2B)");
    expect(nota).toContain("Interesse: CARE+ com gestão NR-1");
    expect(nota).toContain("Vidas: 40");
    expect(nota).toContain("Transportadora com 40 funcionários");
    expect(nota).toContain("Próximo passo: Pediu proposta");
    expect(nota).toContain("Conversa: chatwoot:8:1042");
  });

  it("omite as linhas que não vieram", () => {
    const nota = buildAgentNote({ agentName: "Wendy", interest: "assinatura PF" });
    expect(nota).toContain("Interesse: assinatura PF");
    expect(nota).not.toContain("Persona:");
    expect(nota).not.toContain("Vidas:");
    expect(nota).not.toContain("Próximo passo:");
  });

  it("sempre tem cabeçalho, mesmo sem nenhum campo", () => {
    // Nota vazia no CRM é pior que nota pobre: o humano não sabe se o agente
    // passou por ali.
    expect(buildAgentNote({})).toBe("[Agente — interesse identificado]");
  });
});

describe("opportunityTitle", () => {
  it("junta nome e interesse", () => {
    expect(opportunityTitle("Maria Silva", "CARE+")).toBe("Maria Silva — CARE+");
  });

  it("usa só o nome quando não há interesse", () => {
    expect(opportunityTitle("Maria Silva", null)).toBe("Maria Silva");
  });

  it("respeita o limite de título", () => {
    expect(opportunityTitle("a".repeat(300), "b".repeat(300)).length).toBeLessThanOrEqual(200);
  });
});

describe("chatwootExternalRef", () => {
  it("monta a referência da conversa", () => {
    expect(chatwootExternalRef(8, 1042)).toBe("chatwoot:8:1042");
    expect(chatwootExternalRef("8", "1042")).toBe("chatwoot:8:1042");
  });

  it("devolve null sem id de conversa — referência pela metade não correlaciona nada", () => {
    expect(chatwootExternalRef(8, null)).toBeNull();
    expect(chatwootExternalRef(null, 1042)).toBeNull();
    expect(chatwootExternalRef(8, "abc")).toBeNull();
  });
});

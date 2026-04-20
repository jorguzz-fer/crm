import { describe, it, expect } from "vitest";
import {
  emailSchema,
  slugSchema,
  passwordSchema,
  paginationSchema,
  createLeadSchema,
  updateLeadSchema,
  createCompanySchema,
  createContactSchema,
  createOpportunitySchema,
  createActivitySchema,
  createTaskSchema,
  createNoteSchema,
} from "../index";

// ─── emailSchema ──────────────────────────────────────────────────────────────

describe("emailSchema", () => {
  it("aceita e-mail válido", () => {
    expect(emailSchema.safeParse("user@example.com").success).toBe(true);
  });
  it("rejeita e-mail sem @", () => {
    expect(emailSchema.safeParse("invalido").success).toBe(false);
  });
  it("rejeita e-mail com mais de 200 chars", () => {
    const long = "a".repeat(195) + "@b.com"; // 201 chars
    expect(emailSchema.safeParse(long).success).toBe(false);
  });
});

// ─── slugSchema ───────────────────────────────────────────────────────────────

describe("slugSchema", () => {
  it("aceita slug válido", () => {
    expect(slugSchema.safeParse("minha-empresa-123").success).toBe(true);
  });
  it("rejeita letras maiúsculas", () => {
    expect(slugSchema.safeParse("MinhaEmpresa").success).toBe(false);
  });
  it("rejeita espaços", () => {
    expect(slugSchema.safeParse("minha empresa").success).toBe(false);
  });
  it("rejeita slug muito curto (< 2 chars)", () => {
    expect(slugSchema.safeParse("a").success).toBe(false);
  });
  it("rejeita slug muito longo (> 50 chars)", () => {
    expect(slugSchema.safeParse("a".repeat(51)).success).toBe(false);
  });
});

// ─── passwordSchema ───────────────────────────────────────────────────────────

describe("passwordSchema", () => {
  it("aceita senha com 10+ caracteres", () => {
    expect(passwordSchema.safeParse("senha-forte-1").success).toBe(true);
  });
  it("rejeita senha com menos de 10 caracteres", () => {
    expect(passwordSchema.safeParse("curta123").success).toBe(false);
  });
  it("rejeita senha vazia", () => {
    expect(passwordSchema.safeParse("").success).toBe(false);
  });
  it("rejeita senha com mais de 200 caracteres", () => {
    expect(passwordSchema.safeParse("x".repeat(201)).success).toBe(false);
  });
});

// ─── paginationSchema ─────────────────────────────────────────────────────────

describe("paginationSchema", () => {
  it("usa defaults quando campos estão ausentes", () => {
    const result = paginationSchema.parse({});
    expect(result.page).toBe(1);
    expect(result.perPage).toBe(20);
  });
  it("converte strings para números", () => {
    const result = paginationSchema.parse({ page: "3", perPage: "50" });
    expect(result.page).toBe(3);
    expect(result.perPage).toBe(50);
  });
  it("rejeita page < 1", () => {
    expect(paginationSchema.safeParse({ page: 0 }).success).toBe(false);
  });
  it("rejeita perPage > 100", () => {
    expect(paginationSchema.safeParse({ perPage: 101 }).success).toBe(false);
  });
});

// ─── createLeadSchema ─────────────────────────────────────────────────────────

describe("createLeadSchema", () => {
  const valid = { name: "João Silva", email: "joao@empresa.com" };

  it("aceita lead mínimo (só nome)", () => {
    expect(createLeadSchema.safeParse({ name: "Maria" }).success).toBe(true);
  });
  it("aceita lead completo", () => {
    expect(
      createLeadSchema.safeParse({
        ...valid,
        phone: "+55 11 99999-9999",
        company: "Empresa LTDA",
        source: "WEBSITE",
        status: "NOVO",
      }).success
    ).toBe(true);
  });
  it("rejeita nome vazio", () => {
    expect(createLeadSchema.safeParse({ name: "" }).success).toBe(false);
  });
  it("rejeita nome com 1 char", () => {
    expect(createLeadSchema.safeParse({ name: "A" }).success).toBe(false);
  });
  it("rejeita e-mail inválido", () => {
    expect(createLeadSchema.safeParse({ name: "João", email: "não-é-email" }).success).toBe(false);
  });
  it("aceita email como string vazia (campo opcional)", () => {
    expect(createLeadSchema.safeParse({ name: "João", email: "" }).success).toBe(true);
  });
  it("rejeita source inválido", () => {
    expect(createLeadSchema.safeParse({ name: "João", source: "TIKTOK" }).success).toBe(false);
  });
  it("aplica default source = OUTRO", () => {
    const result = createLeadSchema.parse({ name: "João" });
    expect(result.source).toBe("OUTRO");
  });
  it("aplica default status = NOVO", () => {
    const result = createLeadSchema.parse({ name: "João" });
    expect(result.status).toBe("NOVO");
  });
});

// ─── updateLeadSchema ─────────────────────────────────────────────────────────

describe("updateLeadSchema", () => {
  it("aceita objeto vazio (todos os campos opcionais)", () => {
    expect(updateLeadSchema.safeParse({}).success).toBe(true);
  });
  it("aceita atualização parcial (só status)", () => {
    expect(updateLeadSchema.safeParse({ status: "QUALIFICADO" }).success).toBe(true);
  });
  it("rejeita status inválido", () => {
    expect(updateLeadSchema.safeParse({ status: "INVALIDO" }).success).toBe(false);
  });
});

// ─── createCompanySchema ──────────────────────────────────────────────────────

describe("createCompanySchema", () => {
  it("aceita empresa mínima (só nome)", () => {
    expect(createCompanySchema.safeParse({ name: "Acme Corp" }).success).toBe(true);
  });
  it("aceita URL de website válida", () => {
    expect(createCompanySchema.safeParse({ name: "Acme", website: "https://acme.com" }).success).toBe(true);
  });
  it("rejeita URL sem protocolo", () => {
    expect(createCompanySchema.safeParse({ name: "Acme", website: "acme.com" }).success).toBe(false);
  });
  it("aceita website vazio (string vazia = sem site)", () => {
    expect(createCompanySchema.safeParse({ name: "Acme", website: "" }).success).toBe(true);
  });
  it("rejeita nome muito curto", () => {
    expect(createCompanySchema.safeParse({ name: "A" }).success).toBe(false);
  });
});

// ─── createContactSchema ──────────────────────────────────────────────────────

describe("createContactSchema", () => {
  it("aceita contato mínimo (só nome)", () => {
    expect(createContactSchema.safeParse({ name: "Ana Lima" }).success).toBe(true);
  });
  it("aceita e-mail vazio como opcional", () => {
    expect(createContactSchema.safeParse({ name: "Ana", email: "" }).success).toBe(true);
  });
  it("rejeita e-mail inválido", () => {
    expect(createContactSchema.safeParse({ name: "Ana", email: "errado" }).success).toBe(false);
  });
});

// ─── createOpportunitySchema ──────────────────────────────────────────────────

describe("createOpportunitySchema", () => {
  const baseOpp = {
    title: "Venda de software",
    pipelineId: "cuid1234567890abcdef12345",
    stageId: "cuid1234567890abcdef12345",
  };

  it("aceita oportunidade mínima", () => {
    expect(createOpportunitySchema.safeParse(baseOpp).success).toBe(true);
  });
  it("aplica default probability = 0", () => {
    const result = createOpportunitySchema.parse(baseOpp);
    expect(result.probability).toBe(0);
  });
  it("rejeita probability > 100", () => {
    expect(createOpportunitySchema.safeParse({ ...baseOpp, probability: 101 }).success).toBe(false);
  });
  it("rejeita probability negativo", () => {
    expect(createOpportunitySchema.safeParse({ ...baseOpp, probability: -1 }).success).toBe(false);
  });
  it("rejeita value negativo", () => {
    expect(createOpportunitySchema.safeParse({ ...baseOpp, value: -100 }).success).toBe(false);
  });
  it("aceita value muito alto (999M)", () => {
    expect(createOpportunitySchema.safeParse({ ...baseOpp, value: 999_999_999 }).success).toBe(true);
  });
  it("rejeita título muito curto", () => {
    expect(createOpportunitySchema.safeParse({ ...baseOpp, title: "X" }).success).toBe(false);
  });
});

// ─── createActivitySchema ─────────────────────────────────────────────────────

describe("createActivitySchema", () => {
  it("aceita atividade mínima", () => {
    expect(
      createActivitySchema.safeParse({ type: "LIGACAO", subject: "Ligação inicial" }).success
    ).toBe(true);
  });
  it("rejeita tipo inválido", () => {
    expect(
      createActivitySchema.safeParse({ type: "TWEET", subject: "Post" }).success
    ).toBe(false);
  });
  it("aceita todos os tipos válidos", () => {
    const types = ["LIGACAO", "EMAIL", "REUNIAO", "WHATSAPP", "VISITA", "OUTRO"] as const;
    for (const type of types) {
      expect(createActivitySchema.safeParse({ type, subject: "Assunto" }).success).toBe(true);
    }
  });
  it("rejeita duration > 1440 (max 1 dia em minutos)", () => {
    expect(
      createActivitySchema.safeParse({ type: "REUNIAO", subject: "Reunião", duration: 1441 }).success
    ).toBe(false);
  });
});

// ─── createTaskSchema ─────────────────────────────────────────────────────────

describe("createTaskSchema", () => {
  const baseTask = {
    title: "Fazer follow-up",
    assignedTo: "cuid1234567890abcdef12345",
  };

  it("aceita tarefa mínima", () => {
    expect(createTaskSchema.safeParse(baseTask).success).toBe(true);
  });
  it("aplica default priority = MEDIA", () => {
    const result = createTaskSchema.parse(baseTask);
    expect(result.priority).toBe("MEDIA");
  });
  it("aceita todas as prioridades", () => {
    const priorities = ["BAIXA", "MEDIA", "ALTA", "URGENTE"] as const;
    for (const priority of priorities) {
      expect(createTaskSchema.safeParse({ ...baseTask, priority }).success).toBe(true);
    }
  });
  it("rejeita prioridade inválida", () => {
    expect(createTaskSchema.safeParse({ ...baseTask, priority: "NORMAL" }).success).toBe(false);
  });
  it("rejeita título muito curto", () => {
    expect(createTaskSchema.safeParse({ ...baseTask, title: "X" }).success).toBe(false);
  });
});

// ─── createNoteSchema ─────────────────────────────────────────────────────────

describe("createNoteSchema", () => {
  it("aceita nota mínima (só content)", () => {
    expect(createNoteSchema.safeParse({ content: "Nota de teste" }).success).toBe(true);
  });
  it("rejeita content vazio", () => {
    expect(createNoteSchema.safeParse({ content: "" }).success).toBe(false);
  });
  it("rejeita content com mais de 5000 chars", () => {
    expect(createNoteSchema.safeParse({ content: "x".repeat(5001) }).success).toBe(false);
  });
  it("aceita content no limite (5000 chars)", () => {
    expect(createNoteSchema.safeParse({ content: "x".repeat(5000) }).success).toBe(true);
  });
});

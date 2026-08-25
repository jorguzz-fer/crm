import { describe, it, expect } from "vitest";
import {
  createTenantSchema,
  isPlan,
  normalizeSlug,
  PLANS,
  setActiveSchema,
  setPlanSchema,
  slugSchema,
} from "@/lib/platform";

const VALID_TENANT = {
  tenantName: "Clínica São Jorge",
  tenantSlug: "clinica-sao-jorge",
  plan: "PRO" as const,
  adminName: "Jorge Fernandes",
  adminEmail: "jorge@clinica.com.br",
  adminPassword: "SenhaForte#2026",
};

const CUID = "clh3k8x9a0000qzrmn831i7rn";

describe("normalizeSlug", () => {
  it("remove acentos e troca espaços por hifens", () => {
    expect(normalizeSlug("Clínica São Jorge")).toBe("clinica-sao-jorge");
  });

  it("descarta pontuação e símbolos", () => {
    expect(normalizeSlug("Açaí & Cia. Ltda!")).toBe("acai-cia-ltda");
  });

  it("colapsa hifens repetidos e apara as pontas", () => {
    expect(normalizeSlug("  --Empresa   X--  ")).toBe("empresa-x");
  });

  it("trunca em 50 caracteres sem deixar hífen na ponta", () => {
    const slug = normalizeSlug("a".repeat(48) + " bcde");
    expect(slug.length).toBeLessThanOrEqual(50);
    expect(slug.endsWith("-")).toBe(false);
  });

  it("sempre produz algo que passa no slugSchema", () => {
    for (const nome of ["Clínica São Jorge", "Açaí & Cia.", "Empresa   X"]) {
      expect(slugSchema.safeParse(normalizeSlug(nome)).success).toBe(true);
    }
  });

  it("retorna vazio quando não sobra nada aproveitável", () => {
    expect(normalizeSlug("!!! ???")).toBe("");
  });
});

describe("slugSchema", () => {
  it("aceita minúsculas, números e hifens", () => {
    expect(slugSchema.safeParse("cliente-01").success).toBe(true);
  });

  it("rejeita maiúsculas, espaços e caracteres especiais", () => {
    for (const invalido of ["Cliente", "cli ente", "cliente_01", "cliente!", "ç"]) {
      expect(slugSchema.safeParse(invalido).success).toBe(false);
    }
  });

  it("rejeita slug curto demais ou longo demais", () => {
    expect(slugSchema.safeParse("a").success).toBe(false);
    expect(slugSchema.safeParse("a".repeat(51)).success).toBe(false);
  });
});

describe("isPlan", () => {
  it("reconhece os planos válidos", () => {
    for (const plan of PLANS) expect(isPlan(plan)).toBe(true);
  });

  it("rejeita qualquer outro valor", () => {
    // Protege o filtro do painel: ?plan= arbitrário não vai para o WHERE
    for (const invalido of ["", "free", "GOLD", "DROP TABLE"]) {
      expect(isPlan(invalido)).toBe(false);
    }
  });
});

describe("createTenantSchema", () => {
  it("aceita um cadastro completo", () => {
    expect(createTenantSchema.safeParse(VALID_TENANT).success).toBe(true);
  });

  it("exige nome do cliente com ao menos 2 caracteres", () => {
    const r = createTenantSchema.safeParse({ ...VALID_TENANT, tenantName: "X" });
    expect(r.success).toBe(false);
  });

  it("rejeita slug fora do padrão", () => {
    const r = createTenantSchema.safeParse({ ...VALID_TENANT, tenantSlug: "Clínica São Jorge" });
    expect(r.success).toBe(false);
  });

  it("rejeita plano inexistente", () => {
    const r = createTenantSchema.safeParse({ ...VALID_TENANT, plan: "GOLD" });
    expect(r.success).toBe(false);
  });

  it("rejeita e-mail inválido", () => {
    const r = createTenantSchema.safeParse({ ...VALID_TENANT, adminEmail: "jorge@" });
    expect(r.success).toBe(false);
  });

  it("rejeita senha com menos de 10 caracteres", () => {
    const r = createTenantSchema.safeParse({ ...VALID_TENANT, adminPassword: "Curta#1" });
    expect(r.success).toBe(false);
  });
});

describe("setPlanSchema", () => {
  it("aceita cuid + plano válido", () => {
    expect(setPlanSchema.safeParse({ tenantId: CUID, plan: "ENTERPRISE" }).success).toBe(true);
  });

  it("rejeita id que não é cuid", () => {
    expect(setPlanSchema.safeParse({ tenantId: "1; DROP TABLE", plan: "PRO" }).success).toBe(false);
  });
});

describe("setActiveSchema", () => {
  it("aceita booleano", () => {
    expect(setActiveSchema.safeParse({ tenantId: CUID, active: false }).success).toBe(true);
  });

  it("rejeita string no lugar do booleano", () => {
    expect(setActiveSchema.safeParse({ tenantId: CUID, active: "false" }).success).toBe(false);
  });
});

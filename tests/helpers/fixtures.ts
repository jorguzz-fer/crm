/**
 * Builders de fixtures para testes.
 *
 * Convenção: cada builder aceita `overrides: Partial<T>` e retorna objeto completo.
 * IDs são cuid-like (string) pra bater com schema Prisma.
 *
 * NOTA: estes builders criam **objetos em memória**. Pra inserir no DB de teste,
 * envolva com helpers de `db.ts` (ex: `makeLeadInDb`).
 */

let counter = 0;
const nextId = (prefix: string): string => `${prefix}_${Date.now().toString(36)}_${(counter++).toString(36)}`;

export interface TestTenant {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  plan: string;
  createdAt: Date;
  updatedAt: Date;
}

export function makeTenant(overrides: Partial<TestTenant> = {}): TestTenant {
  const id = overrides.id ?? nextId("tenant");
  return {
    id,
    name: "Tenant Teste",
    slug: `slug-${id}`,
    active: true,
    plan: "FREE",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export interface TestUser {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  active: boolean;
  role: "SUPERADMIN" | "ADMIN" | "SUPERVISOR" | "ANALYST" | "VIEWER";
  createdAt: Date;
  updatedAt: Date;
}

export function makeUser(overrides: Partial<TestUser> & { tenantId: string }): TestUser {
  const id = overrides.id ?? nextId("user");
  return {
    id,
    name: "User Teste",
    email: `user-${id}@test.local`,
    active: true,
    role: "ANALYST",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export interface TestLead {
  id: string;
  tenantId: string;
  name: string;
  email: string | null;
  phone: string | null;
  source: "WEBSITE" | "WHATSAPP" | "INSTAGRAM" | "FACEBOOK" | "INDICACAO" | "EVENTO" | "COLD_OUTREACH" | "OUTRO";
  status: "NOVO" | "EM_CONTATO" | "QUALIFICADO" | "DESQUALIFICADO" | "CONVERTIDO";
  assignedTo: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function makeLead(overrides: Partial<TestLead> & { tenantId: string }): TestLead {
  const id = overrides.id ?? nextId("lead");
  return {
    id,
    name: "Lead Teste",
    email: `lead-${id}@test.local`,
    phone: "+5511999999999",
    source: "OUTRO",
    status: "NOVO",
    assignedTo: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export interface TestAttribution {
  id: string;
  tenantId: string;
  leadId: string;
  fbclid: string | null;
  fbp: string | null;
  fbc: string | null;
  ctwaClid: string | null;
  gclid: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  landingPage: string | null;
  createdAt: Date;
}

export function makeAttribution(overrides: Partial<TestAttribution> & { tenantId: string; leadId: string }): TestAttribution {
  const id = overrides.id ?? nextId("attr");
  return {
    id,
    fbclid: null,
    fbp: null,
    fbc: null,
    ctwaClid: null,
    gclid: null,
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    landingPage: null,
    createdAt: new Date(),
    ...overrides,
  };
}

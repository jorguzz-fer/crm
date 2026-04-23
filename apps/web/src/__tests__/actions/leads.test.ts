/**
 * Testes de integração (Prisma mockado) para actions de leads.
 *
 * Foco: isolamento cross-tenant — garantir que nenhuma mutation
 * acessa ou modifica registros de outro tenant.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

// ── Mocks declarados ANTES dos imports das actions ────────────────────────────

vi.mock("@/lib/authz", () => ({
  requireRole: vi.fn(),
  requireAuth: vi.fn(),
  ROLES_WRITE:  ["SUPERADMIN", "ADMIN", "SUPERVISOR", "ANALYST"],
  ROLES_MANAGE: ["SUPERADMIN", "ADMIN", "SUPERVISOR"],
}));

vi.mock("@crm/db", () => ({
  prisma: {
    lead: {
      findFirst:  vi.fn(),
      create:     vi.fn(),
      update:     vi.fn(),
      delete:     vi.fn(),
    },
    user:  { findFirst: vi.fn() },
    note:  { create:    vi.fn() },
    stage: { findFirst: vi.fn() },
    opportunity: { create: vi.fn() },
    $transaction: vi.fn(),
  },
  Prisma: { InputJsonValue: {} },
}));

vi.mock("next/cache",      () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect:       vi.fn() }));
vi.mock("@/lib/audit",     () => ({ logAudit: vi.fn(), getClientIp: vi.fn(() => null) }));

// ── Imports pós-mock ───────────────────────────────────────────────────────────

import { requireRole } from "@/lib/authz";
import { prisma } from "@crm/db";
import { redirect } from "next/navigation";

import {
  createLeadAction,
  updateLeadAction,
  deleteLeadAction,
  convertLeadAction,
  createNoteAction,
} from "@/app/actions/leads";

// ── Helpers ───────────────────────────────────────────────────────────────────

const TENANT_A = "tenant-aaa";
const TENANT_B = "tenant-bbb";
const USER_ID  = "user-001";

const sessionA = {
  user: { id: USER_ID, tenantId: TENANT_A, role: "ADMIN", name: "Admin A", email: "a@a.com" },
};

function fd(entries: Record<string, string>): FormData {
  const form = new FormData();
  for (const [k, v] of Object.entries(entries)) form.append(k, v);
  return form;
}

function authorizeAs(session: typeof sessionA) {
  (requireRole as Mock).mockResolvedValue({ session });
}

function unauthorize() {
  (requireRole as Mock).mockResolvedValue({
    error: new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 }),
  });
}

// ── createLeadAction ──────────────────────────────────────────────────────────

describe("createLeadAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authorizeAs(sessionA);
    // Prisma.create retorna o lead criado
    (prisma.lead.create as Mock).mockResolvedValue({ id: "lead-1", name: "Novo Lead" });
  });

  it("rejeita se não autorizado", async () => {
    unauthorize();
    const result = await createLeadAction(null, fd({ name: "Lead" }));
    expect(result).toMatchObject({ error: "Sem permissão" });
    expect(prisma.lead.create).not.toHaveBeenCalled();
  });

  it("cria lead com tenantId da sessão — nunca do formData", async () => {
    await createLeadAction(null, fd({
      name: "Novo Lead",
      // Tentativa de injetar outro tenant via body — deve ser ignorada
      tenantId: TENANT_B,
    }));

    expect(prisma.lead.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tenantId: TENANT_A }),
      })
    );
  });

  it("rejeita nome muito curto (< 2 chars)", async () => {
    const result = await createLeadAction(null, fd({ name: "X" }));
    expect(result).toMatchObject({ error: expect.any(String) });
    expect(prisma.lead.create).not.toHaveBeenCalled();
  });

  it("valida que assignedTo pertence ao tenant antes de criar", async () => {
    (prisma.user.findFirst as Mock).mockResolvedValue(null); // usuário de outro tenant
    const result = await createLeadAction(null, fd({
      name: "Lead Teste",
      assignedTo: "user-de-outro-tenant",
    }));
    expect(result).toMatchObject({ error: expect.any(String) });
    expect(prisma.lead.create).not.toHaveBeenCalled();
  });
});

// ── updateLeadAction ──────────────────────────────────────────────────────────

describe("updateLeadAction — isolamento cross-tenant", () => {
  const LEAD_ID = "lead-abc";

  beforeEach(() => {
    vi.clearAllMocks();
    authorizeAs(sessionA);
    (prisma.lead.update as Mock).mockResolvedValue({ id: LEAD_ID });
  });

  it("rejeita se não autorizado", async () => {
    unauthorize();
    const result = await updateLeadAction(null, fd({ id: LEAD_ID, name: "Lead" }));
    expect(result).toMatchObject({ error: "Sem permissão" });
  });

  it("retorna erro quando lead não pertence ao tenant (cross-tenant guard)", async () => {
    // findFirst retorna null → lead existe mas é de outro tenant
    (prisma.lead.findFirst as Mock).mockResolvedValue(null);
    const result = await updateLeadAction(null, fd({ id: LEAD_ID, name: "Lead" }));
    expect(result).toMatchObject({ error: "Lead não encontrado" });
  });

  it("NÃO chama update quando findFirst retorna null", async () => {
    (prisma.lead.findFirst as Mock).mockResolvedValue(null);
    await updateLeadAction(null, fd({ id: LEAD_ID, name: "Lead" }));
    expect(prisma.lead.update).not.toHaveBeenCalled();
  });

  it("chama findFirst com tenantId da sessão — nunca do body", async () => {
    (prisma.lead.findFirst as Mock).mockResolvedValue({ id: LEAD_ID });
    await updateLeadAction(null, fd({
      id: LEAD_ID,
      name: "Lead",
      // Tentativa de bypassar tenant via body — deve ser ignorada
      tenantId: TENANT_B,
    }));
    expect(prisma.lead.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: TENANT_A }),
      })
    );
  });

  it("sucesso: chama update quando lead pertence ao tenant", async () => {
    (prisma.lead.findFirst as Mock).mockResolvedValue({ id: LEAD_ID });
    (prisma.lead.update as Mock).mockResolvedValue({ id: LEAD_ID, status: "EM_CONTATO" });
    await updateLeadAction(null, fd({ id: LEAD_ID, name: "Lead Atualizado" }));
    // updateLeadAction termina com redirect() — não retorna { success: true }
    expect(prisma.lead.update).toHaveBeenCalledOnce();
  });
});

// ── deleteLeadAction ──────────────────────────────────────────────────────────

describe("deleteLeadAction — isolamento cross-tenant", () => {
  const LEAD_ID = "lead-del";

  beforeEach(() => {
    vi.clearAllMocks();
    authorizeAs(sessionA);
    (prisma.lead.delete as Mock).mockResolvedValue({ id: LEAD_ID });
  });

  it("rejeita se não autorizado", async () => {
    unauthorize();
    await deleteLeadAction(fd({ id: LEAD_ID }));
    expect(prisma.lead.delete).not.toHaveBeenCalled();
  });

  it("NÃO deleta quando lead não pertence ao tenant", async () => {
    (prisma.lead.findFirst as Mock).mockResolvedValue(null); // outro tenant
    await deleteLeadAction(fd({ id: LEAD_ID }));
    expect(prisma.lead.delete).not.toHaveBeenCalled();
  });

  it("chama findFirst com tenantId da sessão", async () => {
    (prisma.lead.findFirst as Mock).mockResolvedValue(null);
    await deleteLeadAction(fd({ id: LEAD_ID }));
    expect(prisma.lead.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: LEAD_ID, tenantId: TENANT_A }),
      })
    );
  });

  it("deleta e redireciona quando lead pertence ao tenant", async () => {
    (prisma.lead.findFirst as Mock).mockResolvedValue({ id: LEAD_ID, name: "Lead" });
    await deleteLeadAction(fd({ id: LEAD_ID }));
    expect(prisma.lead.delete).toHaveBeenCalledWith({ where: { id: LEAD_ID } });
    expect(redirect).toHaveBeenCalledWith("/leads");
  });
});

// ── convertLeadAction ─────────────────────────────────────────────────────────

describe("convertLeadAction — isolamento cross-tenant", () => {
  const LEAD_ID  = "lead-conv";
  const STAGE_ID = "stage-001";

  beforeEach(() => {
    vi.clearAllMocks();
    authorizeAs(sessionA);

    // $transaction chama o callback com o próprio prisma mockado
    (prisma.$transaction as Mock).mockImplementation(
      async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma)
    );
    (prisma.opportunity.create as Mock).mockResolvedValue({ id: "opp-1" });
    (prisma.lead.update as Mock).mockResolvedValue({ id: LEAD_ID });
  });

  it("rejeita se não autorizado", async () => {
    unauthorize();
    const result = await convertLeadAction(null, fd({ leadId: LEAD_ID, stageId: STAGE_ID, title: "Opp" }));
    expect(result).toMatchObject({ error: "Sem permissão" });
  });

  it("rejeita quando lead não pertence ao tenant (cross-tenant guard no lead)", async () => {
    (prisma.lead.findFirst as Mock).mockResolvedValue(null); // lead de outro tenant
    const result = await convertLeadAction(null, fd({ leadId: LEAD_ID, stageId: STAGE_ID, title: "Opp" }));
    expect(result).toMatchObject({ error: "Lead não encontrado" });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejeita quando stage não pertence ao tenant (cross-tenant guard no stage)", async () => {
    (prisma.lead.findFirst as Mock).mockResolvedValue({ id: LEAD_ID, name: "Lead", status: "NOVO" });
    (prisma.stage.findFirst as Mock).mockResolvedValue(null); // stage de outro tenant
    const result = await convertLeadAction(null, fd({ leadId: LEAD_ID, stageId: STAGE_ID, title: "Opp" }));
    expect(result).toMatchObject({ error: "Estágio inválido" });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejeita lead já CONVERTIDO", async () => {
    (prisma.lead.findFirst as Mock).mockResolvedValue({ id: LEAD_ID, name: "Lead", status: "CONVERTIDO" });
    const result = await convertLeadAction(null, fd({ leadId: LEAD_ID, stageId: STAGE_ID, title: "Opp" }));
    expect(result).toMatchObject({ error: "Lead já foi convertido" });
  });

  it("rejeita dados obrigatórios ausentes (sem title)", async () => {
    const result = await convertLeadAction(null, fd({ leadId: LEAD_ID, stageId: STAGE_ID }));
    expect(result).toMatchObject({ error: "Dados obrigatórios ausentes" });
  });

  it("executa transaction quando lead e stage pertencem ao tenant", async () => {
    (prisma.lead.findFirst as Mock).mockResolvedValue({ id: LEAD_ID, name: "Lead", status: "NOVO" });
    (prisma.stage.findFirst as Mock).mockResolvedValue({ id: STAGE_ID, pipelineId: "pipe-1" });

    await convertLeadAction(null, fd({ leadId: LEAD_ID, stageId: STAGE_ID, title: "Oportunidade" }));

    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(prisma.opportunity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tenantId: TENANT_A, leadId: LEAD_ID }),
      })
    );
    expect(prisma.lead.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "CONVERTIDO" }),
      })
    );
    expect(redirect).toHaveBeenCalledWith(expect.stringContaining("/pipeline/"));
  });

  it("cria oportunidade com tenantId da sessão — nunca do formData", async () => {
    (prisma.lead.findFirst as Mock).mockResolvedValue({ id: LEAD_ID, name: "Lead", status: "NOVO" });
    (prisma.stage.findFirst as Mock).mockResolvedValue({ id: STAGE_ID, pipelineId: "pipe-1" });

    await convertLeadAction(null, fd({
      leadId: LEAD_ID, stageId: STAGE_ID, title: "Opp",
      tenantId: TENANT_B, // injeção de tenant via body — deve ser ignorada
    }));

    expect(prisma.opportunity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tenantId: TENANT_A }), // sempre da sessão
      })
    );
  });
});

// ── createNoteAction ─────────────────────────────────────────────────────────

describe("createNoteAction (addLeadNote) — isolamento cross-tenant", () => {
  const LEAD_ID = "lead-note";

  beforeEach(() => {
    vi.clearAllMocks();
    authorizeAs(sessionA);
    (prisma.note.create as Mock).mockResolvedValue({ id: "note-1" });
  });

  it("NÃO cria nota quando lead não pertence ao tenant", async () => {
    (prisma.lead.findFirst as Mock).mockResolvedValue(null);
    const result = await createNoteAction(null, fd({ leadId: LEAD_ID, content: "Nota" }));
    expect(result).toMatchObject({ error: "Lead não encontrado" });
    expect(prisma.note.create).not.toHaveBeenCalled();
  });

  it("cria nota com tenantId da sessão quando lead pertence ao tenant", async () => {
    (prisma.lead.findFirst as Mock).mockResolvedValue({ id: LEAD_ID });
    const result = await createNoteAction(null, fd({ leadId: LEAD_ID, content: "Nota de teste" }));
    expect(result).toMatchObject({ success: true });
    expect(prisma.note.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tenantId: TENANT_A, leadId: LEAD_ID }),
      })
    );
  });

  it("rejeita conteúdo vazio", async () => {
    const result = await createNoteAction(null, fd({ leadId: LEAD_ID, content: "" }));
    expect(result).toMatchObject({ error: "Conteúdo obrigatório" });
    expect(prisma.note.create).not.toHaveBeenCalled();
  });
});

/**
 * Testes de integração (Prisma mockado) para actions de oportunidades.
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
    opportunity: {
      findFirst: vi.fn(),
      create:    vi.fn(),
      update:    vi.fn(),
      delete:    vi.fn(),
    },
    stage: { findFirst: vi.fn() },
    lead:  { findFirst: vi.fn() },
    note:  { create:    vi.fn() },
  },
  Prisma: { InputJsonValue: {} },
}));

vi.mock("next/cache",      () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect:       vi.fn() }));
vi.mock("@/lib/audit",     () => ({ logAudit: vi.fn(), getClientIp: vi.fn(() => null) }));

// ── Imports pós-mock ───────────────────────────────────────────────────────────

import { requireRole } from "@/lib/authz";
import { prisma }      from "@crm/db";
import { redirect }    from "next/navigation";

import {
  createOpportunityAction,
  moveOpportunityAction,
  deleteOpportunityAction,
  updateOpportunityStatusAction,
  addOpportunityNoteAction,
} from "@/app/actions/opportunities";

// ── Helpers ───────────────────────────────────────────────────────────────────

const TENANT_A   = "tenant-aaa";
const USER_ID    = "user-001";

// CUIDs mínimos válidos para o Zod (começa com "c", pelo menos 9 chars)
const PIPELINE_ID = "cltest0pipeline000000001";
const STAGE_ID    = "cltest0stage0000000000001";
const OPP_ID      = "cltest0opp00000000000001";
const LEAD_ID     = "cltest0lead0000000000001";

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

// ── createOpportunityAction ───────────────────────────────────────────────────

describe("createOpportunityAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authorizeAs(sessionA);
    (prisma.stage.findFirst as Mock).mockResolvedValue({ id: STAGE_ID, pipelineId: PIPELINE_ID });
    (prisma.opportunity.create as Mock).mockResolvedValue({ id: OPP_ID, title: "Opp", stageId: STAGE_ID });
  });

  it("rejeita se não autorizado", async () => {
    unauthorize();
    const result = await createOpportunityAction(null, fd({
      title: "Oportunidade", pipelineId: PIPELINE_ID, stageId: STAGE_ID,
    }));
    expect(result).toMatchObject({ error: "Sem permissão" });
    expect(prisma.opportunity.create).not.toHaveBeenCalled();
  });

  it("rejeita dados inválidos (título muito curto)", async () => {
    const result = await createOpportunityAction(null, fd({
      title: "X", pipelineId: PIPELINE_ID, stageId: STAGE_ID,
    }));
    expect(result).toMatchObject({ error: expect.any(String) });
    expect(prisma.opportunity.create).not.toHaveBeenCalled();
  });

  it("rejeita quando stage não pertence ao tenant (cross-tenant guard)", async () => {
    (prisma.stage.findFirst as Mock).mockResolvedValue(null); // stage de outro tenant
    const result = await createOpportunityAction(null, fd({
      title: "Oportunidade Teste", pipelineId: PIPELINE_ID, stageId: STAGE_ID,
    }));
    expect(result).toMatchObject({ error: "Estágio inválido" });
    expect(prisma.opportunity.create).not.toHaveBeenCalled();
  });

  it("valida stage com tenantId da sessão — nunca do formData", async () => {
    await createOpportunityAction(null, fd({
      title: "Oportunidade Teste",
      pipelineId: PIPELINE_ID,
      stageId:    STAGE_ID,
      // Tentativa de injetar outro tenant via body — deve ser ignorada
    }));
    expect(prisma.stage.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: TENANT_A }),
      })
    );
  });

  it("rejeita quando leadId não pertence ao tenant (cross-tenant guard)", async () => {
    (prisma.lead.findFirst as Mock).mockResolvedValue(null); // lead de outro tenant
    const result = await createOpportunityAction(null, fd({
      title: "Oportunidade Teste",
      pipelineId: PIPELINE_ID,
      stageId:    STAGE_ID,
      leadId:     LEAD_ID,
    }));
    expect(result).toMatchObject({ error: "Lead inválido" });
    expect(prisma.opportunity.create).not.toHaveBeenCalled();
  });

  it("cria oportunidade com tenantId da sessão — nunca do formData", async () => {
    await createOpportunityAction(null, fd({
      title:      "Oportunidade Teste",
      pipelineId: PIPELINE_ID,
      stageId:    STAGE_ID,
    }));
    expect(prisma.opportunity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tenantId: TENANT_A }),
      })
    );
  });

  it("sucesso: retorna { success: true } quando dados são válidos", async () => {
    const result = await createOpportunityAction(null, fd({
      title:      "Oportunidade Válida",
      pipelineId: PIPELINE_ID,
      stageId:    STAGE_ID,
    }));
    expect(result).toMatchObject({ success: true });
    expect(prisma.opportunity.create).toHaveBeenCalledOnce();
  });
});

// ── moveOpportunityAction ─────────────────────────────────────────────────────

describe("moveOpportunityAction — isolamento cross-tenant", () => {
  const STAGE_ID_B = "cltest0stage0000000000002"; // estágio de destino

  beforeEach(() => {
    vi.clearAllMocks();
    authorizeAs(sessionA);
    (prisma.opportunity.update as Mock).mockResolvedValue({ id: OPP_ID });
  });

  it("não atualiza se não autorizado", async () => {
    unauthorize();
    await moveOpportunityAction(OPP_ID, STAGE_ID_B);
    expect(prisma.opportunity.update).not.toHaveBeenCalled();
  });

  it("não atualiza quando oportunidade não pertence ao tenant", async () => {
    (prisma.opportunity.findFirst as Mock).mockResolvedValue(null); // outro tenant
    (prisma.stage.findFirst       as Mock).mockResolvedValue({ id: STAGE_ID_B });
    await moveOpportunityAction(OPP_ID, STAGE_ID_B);
    expect(prisma.opportunity.update).not.toHaveBeenCalled();
  });

  it("não atualiza quando stage de destino não pertence ao tenant", async () => {
    (prisma.opportunity.findFirst as Mock).mockResolvedValue({ id: OPP_ID, stageId: STAGE_ID });
    (prisma.stage.findFirst       as Mock).mockResolvedValue(null); // stage de outro tenant
    await moveOpportunityAction(OPP_ID, STAGE_ID_B);
    expect(prisma.opportunity.update).not.toHaveBeenCalled();
  });

  it("não atualiza quando oportunidade já está no stage de destino", async () => {
    // opp já está em STAGE_ID_B
    (prisma.opportunity.findFirst as Mock).mockResolvedValue({ id: OPP_ID, stageId: STAGE_ID_B });
    (prisma.stage.findFirst       as Mock).mockResolvedValue({ id: STAGE_ID_B });
    await moveOpportunityAction(OPP_ID, STAGE_ID_B);
    expect(prisma.opportunity.update).not.toHaveBeenCalled();
  });

  it("atualiza quando oportunidade e stage pertencem ao tenant", async () => {
    (prisma.opportunity.findFirst as Mock).mockResolvedValue({ id: OPP_ID, stageId: STAGE_ID });
    (prisma.stage.findFirst       as Mock).mockResolvedValue({ id: STAGE_ID_B });
    await moveOpportunityAction(OPP_ID, STAGE_ID_B);
    expect(prisma.opportunity.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: OPP_ID }, data: { stageId: STAGE_ID_B } })
    );
  });

  it("chama findFirst com tenantId da sessão para oportunidade e stage", async () => {
    (prisma.opportunity.findFirst as Mock).mockResolvedValue({ id: OPP_ID, stageId: STAGE_ID });
    (prisma.stage.findFirst       as Mock).mockResolvedValue({ id: STAGE_ID_B });
    await moveOpportunityAction(OPP_ID, STAGE_ID_B);
    expect(prisma.opportunity.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: TENANT_A }) })
    );
    expect(prisma.stage.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: TENANT_A }) })
    );
  });
});

// ── deleteOpportunityAction ───────────────────────────────────────────────────

describe("deleteOpportunityAction — isolamento cross-tenant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authorizeAs(sessionA);
    (prisma.opportunity.delete as Mock).mockResolvedValue({ id: OPP_ID });
  });

  it("não deleta quando não autorizado", async () => {
    unauthorize();
    await deleteOpportunityAction(fd({ id: OPP_ID }));
    expect(prisma.opportunity.delete).not.toHaveBeenCalled();
  });

  it("não deleta quando oportunidade não pertence ao tenant", async () => {
    (prisma.opportunity.findFirst as Mock).mockResolvedValue(null); // outro tenant
    await deleteOpportunityAction(fd({ id: OPP_ID }));
    expect(prisma.opportunity.delete).not.toHaveBeenCalled();
  });

  it("chama findFirst com tenantId da sessão", async () => {
    (prisma.opportunity.findFirst as Mock).mockResolvedValue(null);
    await deleteOpportunityAction(fd({ id: OPP_ID }));
    expect(prisma.opportunity.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: OPP_ID, tenantId: TENANT_A }),
      })
    );
  });

  it("deleta e redireciona quando pertence ao tenant", async () => {
    (prisma.opportunity.findFirst as Mock).mockResolvedValue({ id: OPP_ID, title: "Opp" });
    await deleteOpportunityAction(fd({ id: OPP_ID }));
    expect(prisma.opportunity.delete).toHaveBeenCalledWith({ where: { id: OPP_ID } });
    expect(redirect).toHaveBeenCalledWith("/pipeline");
  });
});

// ── updateOpportunityStatusAction ─────────────────────────────────────────────

describe("updateOpportunityStatusAction — isolamento cross-tenant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authorizeAs(sessionA);
    (prisma.opportunity.update as Mock).mockResolvedValue({ id: OPP_ID });
  });

  it("rejeita se não autorizado", async () => {
    unauthorize();
    const result = await updateOpportunityStatusAction(null, fd({ id: OPP_ID, status: "GANHA" }));
    expect(result).toMatchObject({ error: "Sem permissão" });
  });

  it("rejeita status inválido", async () => {
    const result = await updateOpportunityStatusAction(null, fd({ id: OPP_ID, status: "INVALIDO" }));
    expect(result).toMatchObject({ error: "Dados inválidos" });
    expect(prisma.opportunity.update).not.toHaveBeenCalled();
  });

  it("rejeita sem id", async () => {
    const result = await updateOpportunityStatusAction(null, fd({ status: "GANHA" }));
    expect(result).toMatchObject({ error: "Dados inválidos" });
    expect(prisma.opportunity.update).not.toHaveBeenCalled();
  });

  it("retorna erro quando oportunidade não pertence ao tenant (cross-tenant guard)", async () => {
    (prisma.opportunity.findFirst as Mock).mockResolvedValue(null);
    const result = await updateOpportunityStatusAction(null, fd({ id: OPP_ID, status: "GANHA" }));
    expect(result).toMatchObject({ error: "Oportunidade não encontrada" });
    expect(prisma.opportunity.update).not.toHaveBeenCalled();
  });

  it("chama findFirst com tenantId da sessão", async () => {
    (prisma.opportunity.findFirst as Mock).mockResolvedValue({ id: OPP_ID, title: "Opp", status: "ABERTA" });
    await updateOpportunityStatusAction(null, fd({ id: OPP_ID, status: "GANHA" }));
    expect(prisma.opportunity.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: OPP_ID, tenantId: TENANT_A }),
      })
    );
  });

  it("sucesso: atualiza status ABERTA → GANHA", async () => {
    (prisma.opportunity.findFirst as Mock).mockResolvedValue({ id: OPP_ID, title: "Opp", status: "ABERTA" });
    const result = await updateOpportunityStatusAction(null, fd({ id: OPP_ID, status: "GANHA" }));
    expect(result).toMatchObject({ success: true });
    expect(prisma.opportunity.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: OPP_ID },
        data: expect.objectContaining({ status: "GANHA" }),
      })
    );
  });

  it("sucesso: atualiza status GANHA → ABERTA (reabertura)", async () => {
    (prisma.opportunity.findFirst as Mock).mockResolvedValue({ id: OPP_ID, title: "Opp", status: "GANHA" });
    const result = await updateOpportunityStatusAction(null, fd({ id: OPP_ID, status: "ABERTA" }));
    expect(result).toMatchObject({ success: true });
    expect(prisma.opportunity.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "ABERTA", closedAt: null }),
      })
    );
  });

  it("define closedAt quando status !== ABERTA", async () => {
    (prisma.opportunity.findFirst as Mock).mockResolvedValue({ id: OPP_ID, title: "Opp", status: "ABERTA" });
    await updateOpportunityStatusAction(null, fd({ id: OPP_ID, status: "PERDIDA" }));
    const call = (prisma.opportunity.update as Mock).mock.calls[0][0];
    expect(call.data.closedAt).toBeInstanceOf(Date);
  });
});

// ── addOpportunityNoteAction ──────────────────────────────────────────────────

describe("addOpportunityNoteAction — isolamento cross-tenant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authorizeAs(sessionA);
    (prisma.note.create as Mock).mockResolvedValue({ id: "note-1" });
  });

  it("rejeita se não autorizado", async () => {
    unauthorize();
    const result = await addOpportunityNoteAction(null, fd({ opportunityId: OPP_ID, content: "Nota" }));
    expect(result).toMatchObject({ error: "Sem permissão" });
    expect(prisma.note.create).not.toHaveBeenCalled();
  });

  it("rejeita conteúdo vazio", async () => {
    const result = await addOpportunityNoteAction(null, fd({ opportunityId: OPP_ID, content: "" }));
    expect(result).toMatchObject({ error: "Conteúdo obrigatório" });
    expect(prisma.note.create).not.toHaveBeenCalled();
  });

  it("NÃO cria nota quando oportunidade não pertence ao tenant", async () => {
    (prisma.opportunity.findFirst as Mock).mockResolvedValue(null); // outro tenant
    const result = await addOpportunityNoteAction(null, fd({ opportunityId: OPP_ID, content: "Nota" }));
    expect(result).toMatchObject({ error: "Oportunidade não encontrada" });
    expect(prisma.note.create).not.toHaveBeenCalled();
  });

  it("cria nota com tenantId da sessão quando oportunidade pertence ao tenant", async () => {
    (prisma.opportunity.findFirst as Mock).mockResolvedValue({ id: OPP_ID });
    const result = await addOpportunityNoteAction(null, fd({ opportunityId: OPP_ID, content: "Nota de reunião" }));
    expect(result).toMatchObject({ success: true });
    expect(prisma.note.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tenantId: TENANT_A, opportunityId: OPP_ID }),
      })
    );
  });

  it("chama findFirst com tenantId da sessão", async () => {
    (prisma.opportunity.findFirst as Mock).mockResolvedValue({ id: OPP_ID });
    await addOpportunityNoteAction(null, fd({ opportunityId: OPP_ID, content: "Nota" }));
    expect(prisma.opportunity.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: OPP_ID, tenantId: TENANT_A }),
      })
    );
  });
});

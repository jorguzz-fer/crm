/**
 * POST /api/public/agent/:tenantSlug/lead
 *
 * Porta de entrada para **ferramenta HTTP de agente conversacional**
 * (fazer.ai agents e equivalentes). Não substitui `/api/public/leads` — é
 * outro contrato, porque quem chama é um modelo de linguagem, não um sistema.
 *
 * ── Por que o tenant vem no caminho, e não no corpo ───────────────────────────
 *
 * Na plataforma fazer.ai, **o corpo de uma ferramenta HTTP só carrega o que o
 * agente passa como argumento**. Texto fixo escrito no corpo não chega; nem
 * variável de contexto. Medido: o mesmo corpo enviado por `curl` devolve 200 e
 * enviado pela plataforma devolve 400 `Required`.
 *
 * Consequência: uma tool HTTP **não consegue enviar `tenantSlug`**. Por isso
 * ele viaja na URL, que é configuração da ferramenta e não passa pelo modelo.
 * O token, pelo mesmo motivo, vai no header (vem do Cofre da plataforma).
 *
 * ── Por que aqui só se enriquece ──────────────────────────────────────────────
 *
 * O agente não sabe o telefone de quem fala com ele, e esquece de chamar a
 * ferramenta em ~1 de cada 3 conversas. O lead nasce no webhook do Chatwoot
 * (`/api/public/leads`, disparado por `conversation_created`), que não esquece
 * e tem o número. O que chega aqui é o **interesse** — quem é a pessoa, o que
 * ela quer, o que o comercial precisa saber antes de ligar.
 *
 * Se a ferramenta falhar ou o agente esquecer, perde-se o interesse. Nunca o lead.
 *
 * Ver `docs/integrations/wendy-wowmais-setup.md`.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { rateLimit } from "@/lib/rateLimit";
import { verifyPublicApiToken } from "@/lib/publicApiToken";
import {
  phoneVariants,
  safeLeadName,
  sanitizeAgentText,
  parseHeadcount,
  resolveLeadStatus,
  buildAgentNote,
  opportunityTitle,
  normalizePhone,
  type LeadStatus,
} from "@/lib/agentLead";
import { z } from "zod";

/**
 * Campos em português de propósito: o prompt do agente é em português, e o
 * modelo preenche argumento com muito mais acerto quando o nome do campo fala
 * a mesma língua da instrução que mandou preenchê-lo.
 */
const agentLeadSchema = z.object({
  nome: z.string().max(300).optional(),
  email: z.string().max(200).optional(),
  telefone: z.string().max(40).optional(),
  empresa: z.string().max(200).optional(),
  persona: z.string().max(40).optional(),
  interesse: z.string().max(400).optional(),
  // O modelo manda 40, "40" ou "cerca de 40 vidas" — parseHeadcount resolve.
  vidas: z.union([z.number(), z.string()]).optional(),
  resumo: z.string().max(4000).optional(),
  proximo_passo: z.string().max(500).optional(),
  situacao: z.enum(["qualificado", "em_contato", "desqualificado"]).optional(),
  // O agente copia daqui o {{conversation_id}} que o prompt dele resolve.
  conversa_id: z.union([z.number(), z.string().max(60)]).optional(),
  agente: z.string().max(60).optional(),
});

/** O mínimo do lead que esta rota precisa carregar entre os passos. */
interface LeadRef {
  id: string;
  status: LeadStatus;
  phone: string | null;
}

const SOURCE = "WHATSAPP" as const;

/** Janela em que uma segunda chamada idêntica é considerada repetição. */
const NOTE_DEDUPE_MINUTES = 5;

/**
 * Resposta de erro para o agente.
 *
 * Curta, em português e sem nada técnico: este texto entra no contexto do
 * modelo. Um `AxiosError` cru devolvido a um agente já mandou stack trace e
 * caminho de arquivo para dentro da conversa.
 */
function agentError(mensagem: string, status: number) {
  return NextResponse.json({ ok: false, erro: mensagem }, { status });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ tenantSlug: string }> },
) {
  const { tenantSlug } = await params;

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  // Limite por tenant, não por IP: todas as conversas de um agente saem do
  // mesmo servidor, então limitar por IP puniria o cliente inteiro por volume
  // normal. 120/min cobre folgado o pico de um agente de WhatsApp.
  const limit = await rateLimit({
    key: `agent-lead:${tenantSlug}`,
    windowSec: 60,
    max: 120,
  });
  if (!limit.allowed) {
    return agentError("Sistema ocupado. Tente de novo em instantes.", 429);
  }

  // ── Autenticação: só header. O agente não consegue mandar constante. ────────
  const token =
    req.headers.get("x-api-token") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    null;

  if (!token) return agentError("Não autorizado.", 401);

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: { id: true, active: true },
  });

  // Tenant inexistente e token errado devolvem a mesma coisa: não é papel
  // desta rota contar quais slugs existem.
  if (!tenant || !tenant.active || !verifyPublicApiToken(tenant.id, token)) {
    return agentError("Não autorizado.", 401);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return agentError("Não consegui ler os dados enviados.", 400);
  }

  const parsed = agentLeadSchema.safeParse(body);
  if (!parsed.success) {
    return agentError("Dados inválidos para registrar o interesse.", 400);
  }

  const d = parsed.data;

  const nome = sanitizeAgentText(d.nome, 200);
  const telefone = normalizePhone(d.telefone);
  const email = sanitizeAgentText(d.email, 200);
  const empresa = sanitizeAgentText(d.empresa, 200);
  const interesse = sanitizeAgentText(d.interesse, 300);
  const vidas = parseHeadcount(d.vidas);
  const conversaId = sanitizeAgentText(
    d.conversa_id === undefined ? null : String(d.conversa_id),
    60,
  );

  // Sem nenhum identificador não há o que registrar nem o que reencontrar.
  if (!nome && !telefone && !conversaId) {
    return agentError("Faltam dados para registrar o interesse.", 400);
  }

  // Só e-mail com cara de e-mail entra — o modelo às vezes escreve frase no campo.
  const emailValido = email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;

  // ── Reencontrar o lead que o webhook já criou ────────────────────────────────
  //
  // Duas pistas, nesta ordem, e nenhuma terceira:
  //
  //   1. a conversa (`externalRef`) — exata;
  //   2. o telefone — exato dentro do tenant.
  //
  // **Não casamos por nome de propósito.** Dois "João Silva" no mesmo dia
  // virariam um lead só, com o histórico de duas pessoas misturado. Duplicata
  // se resolve depois; dado de terceiro no cadastro de alguém, não.
  let lead: LeadRef | null = null;

  if (conversaId) {
    lead = await prisma.lead.findFirst({
      where: {
        tenantId: tenant.id,
        // O webhook grava "chatwoot:<conta>:<conversa>"; o agente conhece só
        // a conversa. O sufixo casa as duas pontas sem exigir que o agente
        // saiba o id da conta (que ele não tem como mandar).
        externalRef: { endsWith: `:${conversaId}` },
        anonymizedAt: null,
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, status: true, phone: true },
    });
  }

  if (!lead && telefone) {
    lead = await prisma.lead.findFirst({
      where: {
        tenantId: tenant.id,
        phone: { in: phoneVariants(telefone) },
        anonymizedAt: null,
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, status: true, phone: true },
    });
  }

  const nota = buildAgentNote({
    agentName: sanitizeAgentText(d.agente, 40),
    persona: d.persona,
    interest: interesse,
    headcount: vidas,
    summary: d.resumo,
    nextStep: d.proximo_passo,
    externalRef: conversaId ? `conversa ${conversaId}` : null,
  });

  const encontrado = lead;
  const criado = !encontrado;
  let leadId: string;

  if (encontrado) {
    // Enriquecimento: preenche o que está em branco, nunca sobrescreve o que
    // o CRM já sabe. Quem editou o lead na mão sabe mais que o agente.
    await prisma.lead.update({
      where: { id: encontrado.id },
      data: {
        status: resolveLeadStatus(d.situacao, encontrado.status),
        ...(nome ? { name: nome } : {}),
        ...(emailValido ? { email: emailValido } : {}),
        ...(empresa ? { company: empresa } : {}),
        ...(telefone && !encontrado.phone ? { phone: telefone } : {}),
      },
    });
    leadId = encontrado.id;
  } else {
    // Rede de segurança: o webhook não rodou (n8n fora, canal novo) ou a
    // conversa não correlacionou. Melhor um lead sem telefone que lead nenhum.
    const novo = await prisma.lead.create({
      data: {
        tenantId: tenant.id,
        name: safeLeadName(nome, telefone),
        email: emailValido,
        phone: telefone || null,
        company: empresa,
        source: SOURCE,
        status: resolveLeadStatus(d.situacao, "NOVO"),
        externalRef: conversaId ? `chatwoot:${conversaId}` : null,
      },
      select: { id: true },
    });
    leadId = novo.id;
  }

  // ── Nota ────────────────────────────────────────────────────────────────────
  // O agente pode repetir a chamada no mesmo turno. Nota repetida não é dado
  // novo, é ruído na tela de quem vai ler.
  const systemUser = await prisma.user.findFirst({
    where: { tenantId: tenant.id, role: { in: ["SUPERADMIN", "ADMIN"] } },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });

  if (systemUser) {
    const repetida = await prisma.note.findFirst({
      where: {
        tenantId: tenant.id,
        leadId,
        content: nota,
        createdAt: { gt: new Date(Date.now() - NOTE_DEDUPE_MINUTES * 60_000) },
      },
      select: { id: true },
    });

    if (!repetida) {
      await prisma.note.create({
        data: { tenantId: tenant.id, leadId, userId: systemUser.id, content: nota },
      });
    }
  }

  // ── Oportunidade no funil ────────────────────────────────────────────────────
  // Best-effort: tenant recém-criado ainda não tem pipeline padrão, e isso não
  // pode derrubar a captura do interesse.
  try {
    const jaTem = await prisma.opportunity.findFirst({
      where: { tenantId: tenant.id, leadId, status: "ABERTA" },
      select: { id: true },
    });

    if (!jaTem) {
      const pipeline = await prisma.pipeline.findFirst({
        where: { tenantId: tenant.id, isDefault: true },
        select: {
          id: true,
          stages: { orderBy: { order: "asc" }, take: 1, select: { id: true } },
        },
      });

      if (pipeline?.stages.length) {
        await prisma.opportunity.create({
          data: {
            tenantId: tenant.id,
            pipelineId: pipeline.id,
            stageId: pipeline.stages[0].id,
            leadId,
            title: opportunityTitle(safeLeadName(nome, telefone), interesse),
          },
        });
      }
    }
  } catch {
    console.error("[agent-lead] falha ao criar oportunidade para o lead", leadId);
  }

  if (systemUser) {
    await logAudit({
      tenantId: tenant.id,
      userId: systemUser.id,
      action: criado ? "lead.create" : "lead.update",
      entity: "Lead",
      entityId: leadId,
      meta: { via: "agent_api", agente: d.agente ?? null, persona: d.persona ?? null, criado },
      ip,
    });
  }

  // Resposta enxuta: ela entra no contexto do modelo. `registrado: true` é o
  // que o prompt manda ele conferir antes de dizer à pessoa que anotou.
  return NextResponse.json({ ok: true, registrado: true, lead_id: leadId, criado });
}

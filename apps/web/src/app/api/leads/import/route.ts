/**
 * POST /api/leads/import
 *
 * Importação de leads via CSV.
 * Aceita multipart/form-data com o campo "file" (CSV).
 *
 * Colunas aceitas (case-insensitive, qualquer ordem):
 *   name / nome              — obrigatório
 *   email                    — opcional
 *   phone / telefone         — opcional
 *   company / empresa        — opcional
 *   source / origem          — opcional (default: OUTRO)
 *   status                   — opcional (default: NOVO)
 *   notes / observacao       — opcional
 *
 * Exemplo de CSV:
 *   nome,email,telefone,empresa,origem
 *   "João Silva","joao@email.com","11999999999","Empresa X","WEBSITE"
 *
 * Limites: 5.000 linhas por upload, 10 MB máximo.
 * Processa em batch de 100 para não travar o DB.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole, ROLES_MANAGE } from "@/lib/authz";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

const MAX_ROWS  = 5_000;
const BATCH     = 100;
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

const sourceMap: Record<string, string> = {
  website: "WEBSITE", site: "WEBSITE",
  whatsapp: "WHATSAPP", zap: "WHATSAPP",
  instagram: "INSTAGRAM", insta: "INSTAGRAM",
  facebook: "FACEBOOK", fb: "FACEBOOK",
  linkedin: "LINKEDIN",
  indicacao: "INDICACAO", indicação: "INDICACAO", referral: "INDICACAO",
  evento: "EVENTO", event: "EVENTO",
  cold_outreach: "COLD_OUTREACH", prospecao: "COLD_OUTREACH", prospecção: "COLD_OUTREACH",
  outro: "OUTRO", other: "OUTRO",
};

const validSources = ["WEBSITE","WHATSAPP","INSTAGRAM","FACEBOOK","LINKEDIN",
                      "INDICACAO","EVENTO","COLD_OUTREACH","OUTRO"];
const validStatuses = ["NOVO","EM_CONTATO","QUALIFICADO","DESQUALIFICADO","CONVERTIDO"];

function normalizeSource(raw?: string): string {
  if (!raw) return "OUTRO";
  const key = raw.trim().toLowerCase().replace(/[\s-]/g, "_");
  return sourceMap[key] ?? (validSources.includes(raw.toUpperCase()) ? raw.toUpperCase() : "OUTRO");
}

function normalizeStatus(raw?: string): string {
  if (!raw) return "NOVO";
  const up = raw.trim().toUpperCase().replace(/\s/g, "_");
  return validStatuses.includes(up) ? up : "NOVO";
}

/** Parser CSV simples (sem dep externa) — lida com aspas e vírgulas em campos */
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  for (const line of lines) {
    if (!line.trim()) continue;
    const cells: string[] = [];
    let cur = "", inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
        else inQuote = !inQuote;
      } else if ((ch === "," || ch === ";") && !inQuote) {
        cells.push(cur.trim()); cur = "";
      } else {
        cur += ch;
      }
    }
    cells.push(cur.trim());
    rows.push(cells);
  }
  return rows;
}

export async function POST(req: Request) {
  const { session, error } = await requireRole(ROLES_MANAGE);
  if (error) return error;

  // Valida content-type
  const ct = req.headers.get("content-type") ?? "";
  if (!ct.includes("multipart/form-data")) {
    return NextResponse.json({ error: "Envie um arquivo CSV via multipart/form-data" }, { status: 400 });
  }

  let formData: FormData;
  try { formData = await req.formData(); }
  catch { return NextResponse.json({ error: "Erro ao ler o arquivo" }, { status: 400 }); }

  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "Campo 'file' é obrigatório" }, { status: 400 });
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Arquivo maior que 10 MB" }, { status: 400 });
  }

  const text = await file.text();
  const rows = parseCSV(text);
  if (rows.length < 2) return NextResponse.json({ error: "CSV vazio ou sem dados" }, { status: 400 });

  // Normaliza cabeçalho
  const header = rows[0].map(h => h.toLowerCase().replace(/[^a-z]/g, ""));
  const col = (aliases: string[]) => aliases.map(a => header.indexOf(a)).find(i => i >= 0) ?? -1;

  const colName    = col(["nome", "name"]);
  const colEmail   = col(["email"]);
  const colPhone   = col(["telefone", "phone", "celular"]);
  const colCompany = col(["empresa", "company"]);
  const colSource  = col(["origem", "source", "canal"]);
  const colStatus  = col(["status"]);
  const colNotes   = col(["observacao", "observação", "notes", "nota"]);

  if (colName < 0) {
    return NextResponse.json({ error: "Coluna 'nome' ou 'name' é obrigatória" }, { status: 400 });
  }

  const dataRows = rows.slice(1).slice(0, MAX_ROWS);
  if (dataRows.length === 0) return NextResponse.json({ error: "Nenhum dado encontrado" }, { status: 400 });

  const tenantId = session.user.tenantId;

  // Busca userId do sistema para notes
  const systemUserId = session.user.id;

  let created = 0;
  let skipped = 0;

  // Processa em batches para não sobrecarregar o DB
  for (let i = 0; i < dataRows.length; i += BATCH) {
    const batch = dataRows.slice(i, i + BATCH);

    await prisma.$transaction(async (tx) => {
      for (const row of batch) {
        const name = row[colName]?.trim();
        if (!name || name.length < 2) { skipped++; continue; }

        // Validação básica de e-mail
        const rawEmail = colEmail >= 0 ? row[colEmail]?.trim() : "";
        const email = rawEmail && z.string().email().safeParse(rawEmail).success
          ? rawEmail
          : null;

        const lead = await tx.lead.create({
          data: {
            tenantId,
            name,
            email,
            phone:   colPhone   >= 0 ? row[colPhone]?.trim()   || null : null,
            company: colCompany >= 0 ? row[colCompany]?.trim() || null : null,
            source:  normalizeSource(colSource >= 0 ? row[colSource] : undefined) as
                       "WEBSITE"|"WHATSAPP"|"INSTAGRAM"|"FACEBOOK"|"LINKEDIN"|"INDICACAO"|"EVENTO"|"COLD_OUTREACH"|"OUTRO",
            status:  normalizeStatus(colStatus >= 0 ? row[colStatus] : undefined) as
                       "NOVO"|"EM_CONTATO"|"QUALIFICADO"|"DESQUALIFICADO"|"CONVERTIDO",
          },
          select: { id: true },
        });

        // Nota de observação
        const notes = colNotes >= 0 ? row[colNotes]?.trim() : "";
        if (notes) {
          await tx.note.create({
            data: {
              tenantId,
              leadId:  lead.id,
              userId:  systemUserId,
              content: `[Importado via CSV]\n${notes}`,
            },
          });
        }

        created++;
      }
    });
  }

  await logAudit({
    tenantId,
    userId:   systemUserId,
    action:   "leads.import",
    entity:   "Lead",
    meta:     { created, skipped, filename: file.name, via: "csv_import" },
  });

  return NextResponse.json({
    ok: true,
    summary: { total: dataRows.length, created, skipped },
  });
}

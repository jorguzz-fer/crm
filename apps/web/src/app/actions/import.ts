"use server";

import { prisma } from "@crm/db";
import type { LeadSource, LeadStatus } from "@crm/db";
import { requireRole, ROLES_WRITE } from "@/lib/authz";
import { logAudit } from "@/lib/audit";
import { createLeadSchema } from "@crm/validators";

export interface ImportRowError {
  row: number;
  name: string;
  error: string;
}

export type ImportLeadsState =
  | { imported: number; errors: ImportRowError[] }
  | { error: string }
  | null;

// ── Parser CSV mínimo (RFC-4180 parcial) ─────────────────────────────────────
// Suporta campos entre aspas com vírgulas e aspas escapadas ("").
function parseCSV(text: string): string[][] {
  const results: string[][] = [];
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;  // pula linhas vazias e comentários

    const cols: string[] = [];
    let cur = "";
    let inQuote = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }  // "" → "
        else inQuote = !inQuote;
      } else if (ch === "," && !inQuote) {
        cols.push(cur.trim());
        cur = "";
      } else {
        cur += ch;
      }
    }
    cols.push(cur.trim());
    results.push(cols);
  }
  return results;
}

// ── Action ───────────────────────────────────────────────────────────────────

export async function importLeadsAction(
  _prev: ImportLeadsState,
  formData: FormData
): Promise<ImportLeadsState> {
  const { session, error } = await requireRole(ROLES_WRITE);
  if (error) return { error: "Sem permissão" };

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { error: "Nenhum arquivo enviado" };
  if (file.size > 5 * 1024 * 1024) return { error: "Arquivo muito grande (máx. 5 MB)" };

  const text = await file.text();
  const rows = parseCSV(text);

  if (rows.length === 0) return { error: "Arquivo vazio ou inválido" };

  // Detecta e valida cabeçalho (case-insensitive, sem acentos)
  const header = rows[0].map((h) =>
    h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  );
  const idx = {
    nome:    header.indexOf("nome"),
    email:   header.indexOf("email"),
    telefone: header.indexOf("telefone"),
    empresa:  header.indexOf("empresa"),
    origem:   header.indexOf("origem"),
    status:   header.indexOf("status"),
  };

  if (idx.nome === -1) {
    return { error: "Cabeçalho inválido: a coluna 'nome' é obrigatória" };
  }

  const dataRows = rows.slice(1);
  if (dataRows.length === 0) return { error: "Nenhuma linha de dados encontrada" };
  if (dataRows.length > 500) return { error: "Limite de 500 linhas por importação" };

  const tenantId = session!.user.tenantId;
  type LeadCreateInput = {
    tenantId: string; name: string; email: string | null; phone: string | null;
    company: string | null; source: LeadSource; status: LeadStatus;
  };
  const toCreate: LeadCreateInput[] = [];
  const errors: ImportRowError[] = [];

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const rowNum = i + 2; // +1 cabeçalho, +1 base-1
    const name = idx.nome >= 0 ? (row[idx.nome] ?? "") : "";

    const raw = {
      name:     name || undefined,
      email:    idx.email    >= 0 ? (row[idx.email]    || undefined) : undefined,
      phone:    idx.telefone >= 0 ? (row[idx.telefone] || undefined) : undefined,
      company:  idx.empresa  >= 0 ? (row[idx.empresa]  || undefined) : undefined,
      source:   idx.origem   >= 0 ? (row[idx.origem]   || "OUTRO")   : "OUTRO",
      status:   idx.status   >= 0 ? (row[idx.status]   || "NOVO")    : "NOVO",
    };

    const parsed = createLeadSchema.safeParse(raw);
    if (!parsed.success) {
      errors.push({
        row: rowNum,
        name: name || "(sem nome)",
        error: parsed.error.errors[0].message,
      });
      continue;
    }

    toCreate.push({
      tenantId,
      name:    parsed.data.name,
      email:   parsed.data.email    || null,
      phone:   parsed.data.phone    || null,
      company: parsed.data.company  || null,
      source:  parsed.data.source,
      status:  parsed.data.status,
    });
  }

  let imported = 0;
  if (toCreate.length > 0) {
    const result = await prisma.lead.createMany({ data: toCreate, skipDuplicates: false });
    imported = result.count;
  }

  await logAudit({
    tenantId,
    userId: session!.user.id,
    action: "lead.import",
    entity: "Lead",
    meta: { imported, errors: errors.length, total: dataRows.length },
  });

  return { imported, errors };
}

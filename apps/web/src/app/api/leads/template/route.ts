import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

const TEMPLATE = [
  // Cabeçalho
  "nome,email,telefone,empresa,origem,status",
  // Linha de exemplo 1
  "João Silva,joao@empresa.com,11999990001,Acme Ltda,WEBSITE,NOVO",
  // Linha de exemplo 2
  "Maria Santos,maria@email.com,21988887777,,INDICACAO,EM_CONTATO",
  // Linha de exemplo 3 (mínimo obrigatório: apenas nome)
  "Carlos Oliveira,,,,OUTRO,NOVO",
  // Comentário embutido (ignorado pelo importador)
  "",
  "# VALORES VÁLIDOS:",
  "# origem: WEBSITE | WHATSAPP | INSTAGRAM | FACEBOOK | INDICACAO | EVENTO | COLD_OUTREACH | OUTRO",
  "# status:  NOVO    | EM_CONTATO | QUALIFICADO | DESQUALIFICADO",
  "# Remova as linhas de comentário (que começam com #) antes de importar.",
].join("\r\n");

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return new Response(TEMPLATE, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="modelo-leads.csv"',
    },
  });
}

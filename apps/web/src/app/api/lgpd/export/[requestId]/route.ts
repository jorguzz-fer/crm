import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!["SUPERADMIN", "ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { requestId } = await params;

  // Cross-tenant safety — só permite ver o export do próprio tenant
  const request = await prisma.dataRequest.findFirst({
    where: {
      id: requestId,
      tenantId: session.user.tenantId,
      type: "EXPORT",
      status: "CONCLUIDO",
    },
    select: { exportData: true, entityName: true, createdAt: true },
  });

  if (!request || !request.exportData) {
    return NextResponse.json({ error: "Export não encontrado" }, { status: 404 });
  }

  const filename = `lgpd-export-${requestId.slice(-8)}.json`;
  const body = JSON.stringify(request.exportData, null, 2);

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

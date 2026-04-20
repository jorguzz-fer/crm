import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const START_TIME = Date.now();

/**
 * GET /api/health
 *
 * Health check público — usado pelo Coolify e monitores externos (Uptime Kuma).
 *
 * Respostas:
 *   200 { status: "ok",    db: "ok",    uptime: N, version: "x.y.z" }
 *   503 { status: "error", db: "error", error: "mensagem"            }
 */
export async function GET() {
  let dbStatus: "ok" | "error" = "error";
  let dbError: string | undefined;

  try {
    // Testa conectividade com o banco — query mínima
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = "ok";
  } catch (e) {
    dbError = e instanceof Error ? e.message : String(e);
  }

  const status = dbStatus === "ok" ? "ok" : "error";
  const httpStatus = status === "ok" ? 200 : 503;
  const uptimeSeconds = Math.floor((Date.now() - START_TIME) / 1000);

  const body: Record<string, unknown> = {
    status,
    db: dbStatus,
    uptime: uptimeSeconds,
    version: process.env.npm_package_version ?? "0.1.0",
    timestamp: new Date().toISOString(),
  };

  if (dbError) body.error = dbError;

  return NextResponse.json(body, { status: httpStatus });
}

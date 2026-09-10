/**
 * rateLimit — o que precisa valer no Postgres de produção.
 *
 * Achado nos logs em 2026-09-10: `ensureTable()` mandava CREATE TABLE e
 * CREATE INDEX numa única chamada `$executeRawUnsafe`. O Postgres recusa
 * duas instruções num prepared statement (`42601: cannot insert multiple
 * commands into a prepared statement`), o `catch` é fail-open, e o rate
 * limit — do login inclusive — nunca funcionou em produção. Silencioso,
 * porque a página abre normalmente.
 */

import { describe, it, expect, vi } from "vitest";
import type { Mock } from "vitest";

vi.mock("@crm/db", () => ({
  prisma: {
    $executeRawUnsafe: vi.fn(),
    $queryRawUnsafe: vi.fn(),
  },
}));

/**
 * `dbReady` é flag de módulo em rateLimit.ts — depois da primeira chamada o
 * ensureTable não roda mais. Cada caso importa o módulo fresco para ver o
 * caminho completo.
 */
async function load(count: bigint = BigInt(0)) {
  vi.resetModules();
  const { prisma } = await import("@crm/db");
  const { rateLimit } = await import("@/lib/rateLimit");

  const exec = prisma.$executeRawUnsafe as unknown as Mock;
  const query = prisma.$queryRawUnsafe as unknown as Mock;
  exec.mockReset().mockResolvedValue(0);
  query.mockReset().mockResolvedValue([{ count }]);

  return { rateLimit, exec, query };
}

/** Conta instruções SQL numa string: uma por `;` que separa comandos. */
function commandCount(sql: string): number {
  return sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0).length;
}

describe("rateLimit — compatível com prepared statements", () => {
  it("nunca manda mais de uma instrução por chamada ao banco", async () => {
    const { rateLimit, exec } = await load();

    await rateLimit({ key: "t:1", windowSec: 60, max: 5 });

    const chamadas = exec.mock.calls.map((c) => String(c[0]));
    expect(chamadas.length).toBeGreaterThan(0);

    for (const sql of chamadas) {
      expect(commandCount(sql), `mais de um comando em: ${sql.slice(0, 80)}…`).toBe(1);
    }
  });

  it("cria a tabela E o índice (não perde o índice ao separar)", async () => {
    const { rateLimit, exec } = await load();

    await rateLimit({ key: "t:1", windowSec: 60, max: 5 });

    const chamadas = exec.mock.calls.map((c) => String(c[0]));
    expect(chamadas.some((s) => /CREATE TABLE IF NOT EXISTS "RateLimitHit"/.test(s))).toBe(true);
    expect(chamadas.some((s) => /CREATE INDEX IF NOT EXISTS "RateLimitHit_key_hitAt_idx"/.test(s))).toBe(true);
  });

  it("permite quando abaixo do limite e registra o hit", async () => {
    const { rateLimit, exec } = await load(BigInt(2));

    const r = await rateLimit({ key: "t:1", windowSec: 60, max: 5 });

    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(2);
    expect(exec.mock.calls.some((c) => /INSERT INTO "RateLimitHit"/.test(String(c[0])))).toBe(true);
  });

  it("bloqueia quando no limite", async () => {
    const { rateLimit, query } = await load();
    query
      .mockResolvedValueOnce([{ count: BigInt(5) }])
      .mockResolvedValueOnce([{ hitAt: new Date() }]);

    const r = await rateLimit({ key: "t:1", windowSec: 60, max: 5 });

    expect(r.allowed).toBe(false);
    expect(r.retryAfterSec).toBeGreaterThanOrEqual(1);
  });
});

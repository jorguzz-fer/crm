/**
 * Setup/teardown do DB de teste.
 *
 * Estratégia:
 * - Cada teste de integração roda dentro de uma transação que é rollbackeada ao fim.
 * - Isso garante isolamento sem precisar truncar tabelas.
 *
 * Pré-requisito:
 * - Postgres test rodando (`docker compose -f docker-compose.test.yml up -d`)
 * - Migrations aplicadas (`DATABASE_URL=$TEST_URL pnpm --filter @crm/db exec prisma migrate deploy`)
 *
 * Esta implementação usa PrismaClient interactivo. Se o teste não precisa de DB,
 * não importe deste módulo — use fixtures em memória direto de `fixtures.ts`.
 */

// NOTA: import de PrismaClient acontece via @crm/db (no package real).
// Mantemos aqui uma interface para estabilizar o contrato — a impl vem quando
// o primeiro teste de integração for escrito.

export interface TestDbContext {
  /** Client Prisma ligado ao DB de teste, rodando dentro de uma transação */
  prisma: unknown; // PrismaClient | TransactionClient — tipado no consumer
  /** Rollback da transação (chamado automaticamente em teardown) */
  cleanup: () => Promise<void>;
}

const DEFAULT_TEST_URL = "postgresql://crm_test:crm_test_pass@localhost:5435/crm_test";

export function getTestDatabaseUrl(): string {
  return process.env.DATABASE_URL_TEST ?? DEFAULT_TEST_URL;
}

export async function setupTestDb(): Promise<TestDbContext> {
  throw new Error(
    "setupTestDb not implemented yet — será implementado ao escrever o primeiro teste de integração " +
      "(ex: packages/tracking/src/__tests__/webhook-hotmart.integration.test.ts).",
  );
}

export async function teardownTestDb(ctx: TestDbContext): Promise<void> {
  await ctx.cleanup();
}

import { makeTenant, type TestTenant } from "./fixtures";

/**
 * Helper para testes de isolamento multi-tenant.
 *
 * Uso:
 * ```ts
 * await expectTenantIsolation(async ({ tenantA, tenantB }) => {
 *   // Cria dado do tenant B
 *   // Roda operação como tenant A
 *   // Verifica que operação não vê/muta dado do tenant B
 * });
 * ```
 *
 * A assinatura encourages a forma do teste — se a função não testar explicitamente
 * separação entre tenantA e tenantB, o teste é inútil.
 */
export interface TenantIsolationContext {
  tenantA: TestTenant;
  tenantB: TestTenant;
}

export async function expectTenantIsolation(
  testFn: (ctx: TenantIsolationContext) => Promise<void>,
): Promise<void> {
  const ctx: TenantIsolationContext = {
    tenantA: makeTenant({ name: "Tenant A", slug: "tenant-a" }),
    tenantB: makeTenant({ name: "Tenant B", slug: "tenant-b" }),
  };
  await testFn(ctx);
}

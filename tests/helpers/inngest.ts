/**
 * Runner in-memory para testar Inngest functions sem subir o dev server.
 *
 * Padrão de uso:
 * ```ts
 * const runner = createTestInngestRunner();
 * await runner.send({ name: "lead/created", data: { tenantId: "t1", leadId: "l1" } });
 * await runner.waitForFunction("sdr-first-contact");
 * expect(runner.getEmittedEvents()).toContainEqual(...);
 * ```
 *
 * NOTA: Implementação real virá junto com o package `packages/jobs`.
 * Esta é a interface prevista — teste RED deixa definido o contrato.
 */

export interface InngestTestEvent {
  name: string;
  data: Record<string, unknown>;
  timestamp?: number;
}

export interface InngestTestRunner {
  send(event: InngestTestEvent): Promise<void>;
  getEmittedEvents(): InngestTestEvent[];
  waitForFunction(functionId: string, timeoutMs?: number): Promise<void>;
  reset(): void;
}

export function createTestInngestRunner(): InngestTestRunner {
  throw new Error(
    "createTestInngestRunner not implemented yet — will be provided by packages/jobs (Fase 3)",
  );
}

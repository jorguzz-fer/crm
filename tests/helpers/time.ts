import { vi } from "vitest";

/**
 * Congela o tempo em uma data específica. Chame dentro de `beforeEach` ou
 * no início do teste. Use `advanceTime(ms)` para avançar.
 * Sempre chamar `restoreTime()` no `afterEach` para não vazar entre testes.
 */
export function freezeTime(at: Date | string | number): void {
  const date = typeof at === "object" ? at : new Date(at);
  vi.useFakeTimers();
  vi.setSystemTime(date);
}

export function advanceTime(ms: number): void {
  vi.advanceTimersByTime(ms);
}

export function advanceDays(n: number): void {
  advanceTime(n * 24 * 60 * 60 * 1000);
}

export function restoreTime(): void {
  vi.useRealTimers();
}

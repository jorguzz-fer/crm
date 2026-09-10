/**
 * Guarda de registro do migrate.js.
 *
 * Em produção as migrations NÃO são aplicadas pelo `prisma migrate deploy`:
 * o container roda `apps/web/migrate.js` na subida, e ele só aplica o que
 * está na lista fixa `MIGRATIONS`. Uma pasta nova em
 * `packages/db/prisma/migrations/` que não entre nessa lista é silenciosa —
 * a subida imprime "todas as migrations concluídas", a coluna não existe, e
 * o primeiro request que a toca devolve 500.
 *
 * Aconteceu com a 0019_lead_external_ref em 2026-09-10. Este teste é o que
 * teria pego.
 */

import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(here, "../../../../packages/db/prisma/migrations");
const migrateJs = path.resolve(here, "../../migrate.js");

function migrationFolders(): string[] {
  return readdirSync(migrationsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

function registeredInMigrateJs(): string[] {
  const src = readFileSync(migrateJs, "utf8");
  return [...src.matchAll(/name:\s*"([^"]+)"/g)].map((m) => m[1]);
}

describe("migrate.js registra toda migration do Prisma", () => {
  it("cada pasta em packages/db/prisma/migrations está na lista MIGRATIONS", () => {
    const folders = migrationFolders();
    const registered = new Set(registeredInMigrateJs());

    const faltando = folders.filter((f) => !registered.has(f));

    expect(
      faltando,
      `Migrations sem entrada em apps/web/migrate.js (não serão aplicadas em produção): ${faltando.join(", ")}`,
    ).toEqual([]);
  });

  it("não registra migration que não existe em disco", () => {
    const folders = new Set(migrationFolders());
    const fantasmas = registeredInMigrateJs().filter((n) => !folders.has(n));
    expect(fantasmas).toEqual([]);
  });
});

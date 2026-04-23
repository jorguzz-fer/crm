# Test helpers (compartilhados entre packages)

Utilitários para testes de integração, tenant isolation, fixtures, webhooks assinados e controle de tempo.

## Uso

```ts
import { makeTenant, makeUser, makeLead } from "../../../tests/helpers/fixtures";
import { expectTenantIsolation } from "../../../tests/helpers/tenant-isolation";
import { signHotmartWebhook } from "../../../tests/helpers/webhooks";
import { freezeTime, advanceTime } from "../../../tests/helpers/time";
import { setupTestDb, teardownTestDb } from "../../../tests/helpers/db";
```

## Pré-requisitos

- Postgres test rodando: `docker compose -f docker-compose.test.yml up -d`
- `DATABASE_URL_TEST=postgresql://crm_test:crm_test_pass@localhost:5435/crm_test`
- `pnpm --filter @crm/db generate` para regenerar client
- Migrations aplicadas no DB de teste

## Convenções

- Cada teste de integração usa transação → rollback (via `setupTestDb`)
- Fixtures criam dados isolados por teste (cuid IDs)
- Nunca fazer `prisma.$executeRaw` pra apagar dados — usar transações

## Arquivos

- `db.ts` — setup/teardown com transações
- `fixtures.ts` — builders (makeTenant, makeUser, makeLead, etc.)
- `tenant-isolation.ts` — helper principal pra testar isolation
- `inngest.ts` — runner in-memory para Inngest functions
- `webhooks.ts` — assina payloads com secrets de teste (HMAC)
- `time.ts` — time travel determinístico (baseia-se em Vitest `vi.useFakeTimers`)
- `init-pgvector.sql` — habilita pgvector no DB de teste

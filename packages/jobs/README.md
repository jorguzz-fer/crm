# @crm/jobs

Inngest functions + contract de eventos.

## Escopo

- Event schemas (Zod) em `src/events.ts`
- Cliente Inngest compartilhado em `src/client.ts`
- Functions Inngest em `src/functions/` (a implementar — Fase 3)

## Quick start

```bash
pnpm install
pnpm --filter @crm/jobs test
```

## Eventos

Contrato completo em [`.coordination/EVENTS.md`](../../.coordination/EVENTS.md).

Todos os eventos obrigatoriamente incluem `tenantId`. Consumers **devem** validar tenant isolation antes de qualquer operação.

## Status

- [x] Event schemas + contract tests
- [x] Inngest client setup
- [ ] `firstContactFn` (Fase 3)
- [ ] `followupSequenceFn` (Fase 3)
- [ ] `classifyOnMessageFn` (Fase 3)
- [ ] `routeQualifiedFn` (Fase 3)

## Teste

Estratégia:
- **Contract tests**: schemas Zod rejeitam payloads malformados
- **Unit tests**: lógica de cada function em isolamento (Inngest `Inngest.createFunction` com step mocks)
- **Integration tests**: runner in-memory (`tests/helpers/inngest.ts`) + DB de teste
- **Idempotency tests**: mesmo evento 2x → efeito único
- **Tenant isolation tests**: evento com tenantId A não afeta dados de tenantId B

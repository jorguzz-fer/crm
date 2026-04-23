# Convenções de teste

Test-first (TDD) em tudo. No production code without a failing test first.

## Stack

- **Unit + integration:** Vitest 4.x
- **E2E:** Playwright 1.x (já configurado em `apps/web/playwright.config.ts`)
- **Mocks HTTP:** MSW (`msw` package) para contract tests de Meta/Google/Stripe/gateways
- **Fixtures:** helpers em `tests/helpers/` (shared) e `<package>/src/__tests__/fixtures/`

## Estrutura por package

```
packages/<name>/
├── src/
│   ├── index.ts
│   ├── <modules>.ts
│   └── __tests__/
│       ├── <module>.test.ts               ← unit
│       ├── <module>.integration.test.ts   ← toca DB/externo
│       ├── <module>.contract.test.ts      ← mocks API externa
│       ├── tenant-isolation.test.ts       ← OBRIGATÓRIO se toca tenant data
│       ├── fixtures/
│       │   └── *.json                     ← payloads reais capturados
│       └── helpers.ts                     ← makeX builders locais
├── vitest.config.ts
├── package.json
└── tsconfig.json
```

## Helpers compartilhados (tests/helpers/)

```
tests/
├── helpers/
│   ├── db.ts                   ← setup/teardown test DB (transação rollback)
│   ├── fixtures.ts             ← makeTenant, makeUser, makeLead, etc.
│   ├── tenant-isolation.ts     ← expectTenantIsolation(fn)
│   ├── inngest.ts              ← in-memory Inngest runner para testes
│   ├── webhooks.ts             ← sign payloads com secrets de teste (HMAC)
│   └── time.ts                 ← freezeTime, advanceTime
```

## Red-Green-Refactor

1. **RED:** escreva o teste. Rode `pnpm test <file>`. Confirme que falha **pelo motivo certo** (não por typo).
2. **GREEN:** código mínimo pra passar. Sem adicionar features além do que o teste pede.
3. **REFACTOR:** limpa, mantendo verde.

## Red flags

- Teste passa de primeira → você testou comportamento existente. Apaga e reescreva.
- Teste usa mock de tudo → design está acoplado, redesenhe.
- "Teste depois" → não é TDD. Apaga código e começa de novo.

## Cobertura mínima

- Funções puras: 95%+
- Handlers de webhook: 100% dos caminhos (assinatura válida/inválida, payload válido/malformado, tenant válido/inválido, idempotência)
- Guards de segurança: 100%
- UI: opcional, mas E2E cobre os caminhos críticos

## Tenant isolation — padrão obrigatório

```ts
// packages/<x>/src/__tests__/tenant-isolation.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { expectTenantIsolation, makeTenant, makeLead } from "@/tests/helpers";
import { someFunction } from "../index";

describe("<feature> — tenant isolation", () => {
  it("não expõe dado de outro tenant", async () => {
    await expectTenantIsolation(async ({ tenantA, tenantB }) => {
      const leadA = await makeLead({ tenantId: tenantA.id });
      const leadB = await makeLead({ tenantId: tenantB.id });
      
      // Operação rodando como tenant A
      const result = await someFunction({ session: { tenantId: tenantA.id }, leadId: leadB.id });
      
      // Não pode ler nem modificar lead do tenant B
      expect(result).toBeNull(); // ou throw, dependendo da API
    });
  });
});
```

## Golden tests (regression) em IA

Para assistants de IA (classifier, SDR), manter dataset fixo em `packages/ai/src/__tests__/fixtures/golden/*.json`. Cada PR que toca prompt **não pode** reduzir accuracy do golden set.

## E2E críticos (Playwright)

Os seguintes fluxos **precisam** de E2E antes de release:

1. Onboarding WhatsApp (connect Evolution OU Meta Cloud)
2. Primeira conversa: lead entra → IA responde → classifica → mostra no inbox
3. Follow-up: lead frio recebe mensagem D+1 após inatividade
4. Pagamento: webhook gateway → lead vira cliente → CAPI dispara

## CI

- Test gate: todos os testes verdes + coverage mínima
- Typecheck gate: `pnpm typecheck` verde em todos os packages
- Lint gate: `pnpm lint` verde
- Playwright: roda em PRs tocando `apps/web/src/app/**` e `packages/whatsapp|tracking|jobs`

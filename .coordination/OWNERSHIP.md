# Ownership de código entre sessões

Duas sessões Claude Code trabalham em paralelo neste repo. Esta divisão evita conflitos de merge.

## Sessão CRM (outra sessão, em andamento há mais tempo)

**Owner de:**
- `apps/web/src/app/(crm)/**` — rotas do CRM tradicional (leads, pipeline, deals, activities, tasks, notes, calendar, visits)
- `apps/web/src/app/(auth)/**` — login, signup, reset password
- `apps/web/src/app/(lgpd)/**` — páginas de privacidade, termos, consents, data requests
- `packages/ui` — shadcn components compartilhados
- `packages/validators` — zod schemas compartilhados (estende quando precisa)
- `packages/config` — configs compartilhadas

## Sessão Medicine/SDR (esta sessão)

**Owner de:**
- `apps/web/src/app/(sdr)/**` — inbox unificada, automations, playbooks, IA SDR
- `apps/web/src/app/api/webhooks/whatsapp/**` — recebe msgs do WhatsApp
- `apps/web/src/app/api/webhooks/hotmart/**`, `pagarme/**`, `paypal/**`, `stripe/**` — gateways
- `apps/web/src/app/api/inngest/**` — endpoint Inngest
- `apps/web/src/app/api/intake/**` — captura de leads server-side (attribution)
- `packages/whatsapp` — **NOVO** — adapter pattern (Evolution + Meta Cloud)
- `packages/jobs` — **NOVO** — Inngest functions (follow-up, routing, classification)
- `packages/tracking` — **NOVO** — Meta CAPI + Google Offline + attribution stitch + gateway adapters
- `packages/ai/src/assistants/sdr.ts` — conversa SDR multi-turno
- `packages/ai/src/assistants/classifier.ts` — scoring quente/morno/frio

## Compartilhados (coordenar antes de editar)

- `packages/db/prisma/schema.prisma` — schema source of truth
- `packages/db/prisma/migrations/**` — migrations sequenciais
- `packages/ai/src/index.ts` — registry de models/assistants (append-only na prática)
- `apps/web/src/middleware.ts` — PUBLIC_PATHS (ambas as sessões adicionam)
- `apps/web/next.config.ts` — headers + domínios (raro)
- `apps/web/package.json` — deps novas
- `.github/workflows/**` — CI (mesmo cuidado que schema)

## Protocolo de edição de arquivo compartilhado

1. Antes de editar: `git pull origin main`
2. Declarar no `.coordination/schema-changes.log` (append) se é schema, ou mensagem curta no commit se é outro shared file.
3. Fazer a mudança na sua branch (`feat/crm-*` ou `feat/sdr-*`)
4. Abrir PR. A outra sessão revisa o PR antes de merge.
5. Após merge: outra sessão faz `git pull` antes de continuar.

## Convenções de branch

- Sessão CRM: `feat/crm-<short-name>`, `fix/crm-<short-name>`
- Sessão SDR: `feat/sdr-<short-name>`, `feat/whatsapp-<short-name>`, `feat/tracking-<short-name>`, `fix/sdr-<short-name>`

## Se conflitar

- Main protegida — sempre via PR com rebase.
- Conflito em schema: quem abriu PR depois rebasa sobre o schema mergeado.
- Conflito em migration: **NÃO** editar migrations após aplicadas em dev. Criar migration nova em cima.

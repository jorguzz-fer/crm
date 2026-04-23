# @crm/whatsapp

Integração WhatsApp adapter-agnóstica. Um único consumer fala com `WhatsAppAdapter`; duas implementações (Evolution API e Meta Cloud API) moram em `src/adapters/`.

## Por que adapter pattern

A decisão final entre Evolution, Meta Cloud ou multi-provider está pendente em `.coordination/OPEN_QUESTIONS.md`. Enquanto isso:

- O resto da app depende **apenas** da interface `WhatsAppAdapter` — trocar o provedor é um ponto de configuração, não uma refatoração.
- Tenants diferentes podem usar provedores diferentes (self-hosted Evolution vs conta oficial Meta).
- Facilita testing (fácil mockar o adapter em integration tests do SDR).

## Adapters

- `createEvolutionAdapter(config)` — self-hosted, sem tarifa por conversa, risco de ban, multi-instância trivial.
- `createMetaCloudAdapter(config)` — oficial, suporta Click-to-WhatsApp Ads (`ctwa_clid` crítico pro tracking), Embedded Signup pra onboarding de clientes SaaS.

## Exportações

- `@crm/whatsapp` — interface canônica + schemas Zod
- `@crm/whatsapp/adapters/evolution`
- `@crm/whatsapp/adapters/meta-cloud`
- `@crm/whatsapp/webhooks` — handler compartilhado (verify → dedup → inngest)

## Status (Fase 0 — scaffold RED)

- [x] Tipos canônicos + schemas Zod (`InboundMessage`, `OutboundMessage`)
- [x] Interface `WhatsAppAdapter`
- [x] Contract tests
- [ ] Evolution adapter (Fase 1)
- [ ] Meta Cloud adapter (Fase 1)
- [ ] Handler compartilhado de webhook (Fase 1)
- [ ] Rate limit + dedup (Fase 1)
- [ ] Audit log por mensagem (Fase 1)

## Segurança

Toda rota de webhook que este package expõe **precisa**:
- `verifyWebhookSignature()` antes de qualquer parsing
- Rate limit por `providerInstanceId`
- Idempotência via `externalMessageId`
- Isolamento multi-tenant: `providerInstanceId` sempre validado contra `tenantId`
- Audit log em toda mensagem processada

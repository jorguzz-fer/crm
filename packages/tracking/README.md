# @crm/tracking

Atribuição e tracking de conversões server-side. Resolve o problema crítico de pixel furado.

## O problema que resolve

Tracking tradicional via pixel browser perde 30–70% dos eventos por:
- iOS 14.5+ ATT
- Ad blockers
- Cookies que morrem entre sessões
- **Principal:** quebra cross-domain quando lead sai pro WhatsApp e paga em Hotmart/Pagar.me

## Como resolve

1. **Client:** captura `fbclid`/`gclid`/UTMs/`_fbp`/`_fbc` na LP (`src/client`)
2. **Transição pro WhatsApp:** token único no link OU Click-to-WhatsApp Ads (`ctwa_clid`)
3. **Server-side events:** Meta CAPI + Google Offline Conversion Import (`src/server`)
4. **Gateway webhooks:** Hotmart/Pagar.me/PayPal/Stripe disparam conversão (`src/webhooks`)
5. **Stitching:** payment → Lead → Attribution → CAPI/Google (`src/attribution`)

## Exportações

- `@crm/tracking/client` — código rodável no browser (LP)
- `@crm/tracking/server` — código server-only (Meta CAPI, Google)
- `@crm/tracking/webhooks` — parsers de gateway
- `@crm/tracking` — index

## Status

- [x] Types (AttributionData, ConversionEventPayload) — Zod schemas
- [x] Client: captureFromUrl + readTrackingCookies
- [x] Contract tests
- [ ] Meta CAPI (Fase 4)
- [ ] Google Offline Conversion (Fase 4)
- [ ] Google Enhanced Conversions (Fase 4)
- [ ] Webhooks Hotmart/Pagar.me/PayPal/Stripe (Fase 4)
- [ ] Attribution stitcher (Fase 4)
- [ ] Dashboard queries ROAS (Fase 4)

## Segurança

Toda rota pública que este package expõe (webhooks, intake) **precisa**:
- Verificação de assinatura obrigatória (HMAC + provider-specific)
- Rate limit por IP
- Idempotência via `externalEventId`
- Hash SHA-256 em email/phone antes de enviar ao Meta/Google
- Audit log em toda conversão reportada

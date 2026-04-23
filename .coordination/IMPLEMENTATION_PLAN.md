# Plano de Implementação — Medicine/SDR

Fases ordenadas por ROI. Cada fase entrega **código + testes + gates de segurança**. Não avança sem verificação verde.

Relacionados:
- `OWNERSHIP.md` — divisão entre sessões
- `EVENTS.md` — contrato de eventos Inngest
- `SECURITY_CHECKLIST.md` — checklist obrigatório por PR
- `TEST_CONVENTIONS.md` — padrões de teste
- `OPEN_QUESTIONS.md` — decisões pendentes (resolver antes de começar a fase afetada)
- `schema-changes.log` — log append-only de mudanças no schema

---

## FASE 0 — Scaffold & Fundação ✅ (esta entrega)

**Entrega:**
- `.coordination/` (esses docs)
- `docker-compose.test.yml` + test helpers
- Skeletons de `packages/whatsapp`, `packages/jobs`, `packages/tracking` (vazios mas compilam)
- Extensões de `packages/ai` (sdr.ts + classifier.ts — só tipos + testes RED)
- Stubs de webhooks em `apps/web/src/app/api/` com validação de assinatura e testes RED
- CI workflows (`test.yml`, `security.yml`)

**Gates:**
- [ ] `pnpm typecheck` verde
- [ ] `pnpm test` roda (testes RED explícitos são OK — documentados como pending)
- [ ] Seção 12 do playbook rodada contra main — gaps abertos como issues

---

## FASE 1 — `packages/whatsapp` (3 dias) — ⚠️ depende de OPEN_QUESTIONS #1

**Entrega:**
- Interface `ChannelAdapter`
- `evolution.ts` (se continuar usando) — wrapper do Evolution API já em uso
- `meta-cloud.ts` (se decidir por Meta) — Cloud API + Embedded Signup + multi-WABA
- Criptografia AES-256-GCM para `accessToken`
- Webhook receiver unificado (`/api/webhooks/whatsapp`)

**Testes obrigatórios:**
- `webhook.hmac.test.ts` — rejeita assinatura inválida
- `webhook.parser.test.ts` — 25 fixtures (texto, mídia, interactive, referral CTWA)
- `send.integration.test.ts` — mock provider, valida payload
- `tenant-isolation.test.ts` — org A não usa WABA da org B
- `encryption.test.ts` — roundtrip do access token
- `embedded-signup.e2e.ts` — Playwright

**Definition of Done:** coverage ≥ 85% + E2E passa + zero warnings.

---

## FASE 2 — `packages/ai` (SDR + Classifier) (4 dias)

**Entrega:**
- `assistants/sdr.ts` — conversa multi-turno com playbook
- `assistants/classifier.ts` — tool use estruturado (quente/morno/frio/desqualificado)
- `context.ts` — context builder unificado multi-canal
- `guardrails.ts` — sanitizer, PII mask, jailbreak detector
- Dataset golden: 50 conversas sintéticas classificadas (usuário calibra depois)

**Testes obrigatórios:**
- `classifier.golden.test.ts` — 50 fixtures, accuracy ≥ 90%
- `sanitizer.test.ts` — strips HTML, blocks javascript:/data:
- `jailbreak.test.ts` — 20 tentativas conhecidas
- `pii-mask.test.ts` — log não vaza telefone/email
- `context.test.ts` — histórico unificado multi-canal
- `tenant-isolation.test.ts` — playbook de org A não aparece pra org B
- `llm.contract.test.ts` — mock Anthropic, valida prompt caching ativado (se migrado)

---

## FASE 3 — `packages/jobs` (Inngest) (2 dias)

**Entrega:**
- `functions/firstContact.ts` — dispara IA < 5s após `lead/created`
- `functions/followupSequence.ts` — D+1/D+3/D+7 + loop até responder
- `functions/classifyOnMessage.ts` — re-score após `message/received`
- `functions/routeQualified.ts` — distribui HOT pra vendedor (regras → IA depois)

**Testes obrigatórios:**
- `follow-up.test.ts` — time travel mockado, D+1 dispara após 24h
- `follow-up.cancel.test.ts` — lead responde → sequência para
- `idempotency.test.ts` — mesmo evento 2x → 1 mensagem
- `tenant-isolation.test.ts` — evento da org A não trigga função pra org B
- `contract.test.ts` — eventos respeitam schema Zod

---

## FASE 4 — `packages/tracking` (3 dias) ⭐ alta prioridade

**Entrega:**
- Schema: `Attribution`, `ConversionEvent`, `Transaction`, `Campaign`, `Product`
- `client/capture.ts` — script de browser (captura fbclid, gclid, utms, cookies)
- `server/meta-capi.ts` — CAPI com retry + dedup via `event_id`
- `server/google-offline.ts` — Offline Conversion Import
- `server/google-enhanced.ts` — Enhanced Conversions
- `webhooks/hotmart.ts`, `pagarme.ts`, `paypal.ts` — parsers + signature
- `attribution/stitch.ts` — payment → lead → attribution
- `dashboard/queries.ts` — ROAS, CPA, LTV por campanha

**Testes obrigatórios:**
- `capture.test.ts` — parse de URL params (20 casos)
- `meta-capi.dedup.test.ts` — event_id dedupa
- `google-offline.test.ts` — mock Google Ads API
- `webhook-hotmart.test.ts` — HMAC inválido → 401
- `webhook-pagarme.test.ts` — signature validation
- `webhook-paypal.test.ts` — IPN validation
- `attribution-stitch.test.ts` — payment.email casa com lead correto
- `tenant-isolation.test.ts` — payment da org A não vira conversion na org B
- `ctwa-clid.test.ts` — preserva Click-to-WhatsApp ID

---

## FASE 5 — `packages/knowledge` (RAG) (2 dias) — adiada

Implementar quando IA SDR precisar responder com informação específica de curso/produto do cliente.

---

## FASE 6 — `packages/billing` (Stripe) (3 dias) — por último

Implementar quando for abrir o SaaS pra outros clientes além do usuário.

---

## Roadmap de decisões (ordem)

1. OPEN_QUESTIONS #1 (Evolution vs Meta Cloud) — resolver antes da Fase 1
2. OPEN_QUESTIONS #2 (OpenRouter vs Anthropic direto) — resolver antes da Fase 2
3. Migration do schema com models novos (Attribution, etc.) — coordenar com sessão CRM

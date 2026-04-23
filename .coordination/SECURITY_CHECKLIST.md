# Security checklist — por feature e por PR

Destilado do playbook `nextjs-prisma-multitenant-security`. Copiar este checklist no description de todo PR que toca dados.

## Regra dos 5 pontos em rota mutadora

Toda rota `POST`/`PATCH`/`DELETE` (inclusive webhooks) deve ter:

- [ ] `requireAuth()` / `requireRole([...])` no topo (exceto webhooks públicos, que têm seu próprio guard)
- [ ] Se recebe `id` no body/params: `findFirst({ id, tenantId })` **antes** de `update`/`delete`
- [ ] Se recebe FKs (equipmentId, leadId, etc.): validar que FK pertence ao mesmo `tenantId` da sessão
- [ ] `logAudit({ action, entity, entityId, meta, ip })` após mutation bem-sucedida
- [ ] `rateLimit()` em rotas sensíveis (login, webhooks públicos, endpoints de IA, endpoints de billing, intake público)

## Webhooks públicos

- [ ] Verificação de assinatura **obrigatória** (HMAC-SHA256, ou método do provider)
- [ ] Sem assinatura válida → **401** imediato, sem ler body
- [ ] `rateLimit()` por IP (proteção contra flood do provider caso algo dê errado)
- [ ] Idempotência: dedup por `event.id`/`message_id`/`transaction_id` do provider
- [ ] Nunca logar `access_token`/`secret`/chaves em claro
- [ ] Resposta 200 rápida (< 5s) — processamento pesado vai pro Inngest

## Dados sensíveis

- [ ] Tokens (Meta, Stripe, gateway) armazenados **criptografados em repouso** (AES-256-GCM)
- [ ] Nunca retornar token/hash em response da API
- [ ] Email/phone em hash SHA-256 quando vai para Meta/Google
- [ ] PII em logs é sempre mascarada (módulo `@crm/validators/pii`)
- [ ] LGPD: `ConsentRecord` registrado em ações relevantes

## Multi-tenant isolation

- [ ] Toda query Prisma que toca dados de tenant filtra por `tenantId`
- [ ] Teste `tenant-isolation.test.ts` **obrigatório** em qualquer package que toque dados de tenant
- [ ] Evento Inngest: consumer filtra por `tenantId` antes de qualquer write
- [ ] Pgvector query (RAG): `WHERE tenantId = $1` em toda retrieve

## Build/Deploy

- [ ] Secrets **não** em `ARG`/`ENV` no Dockerfile — apenas runtime (Coolify/env vars)
- [ ] `next.config.ts` `images.remotePatterns` sem wildcard
- [ ] `next.config.ts` tem CSP + HSTS + X-Frame-Options DENY
- [ ] `session.maxAge` ≤ 8h

## Auditoria rápida (rodar antes de mergear feature grande)

```bash
# Rotas sem authz
grep -rL "requireAuth\|requireRole\|auth()\|verifySignature" apps/web/src/app/api

# Updates/deletes sem tenant check
grep -rn "prisma\.\w\+\.update\|prisma\.\w\+\.delete" apps/web/src \
  | grep -v "findFirst\|tenantId"

# Wildcard em remotePatterns
grep -n "hostname:.*\*" apps/web/next.config.ts

# Secrets em ARG
grep -nE "^ARG\s+(DATABASE_URL|AUTH_SECRET|.*_KEY|.*_TOKEN|.*_SECRET)" apps/web/Dockerfile
```

Qualquer hit = bloqueia merge.

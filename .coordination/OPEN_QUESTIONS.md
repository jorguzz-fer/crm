# Decisões arquiteturais em aberto

Tópicos que precisam de alinhamento entre sessões (e, em alguns casos, com o usuário) antes da implementação avançar.

---

## 1. WhatsApp: Evolution API vs Meta Cloud API

**Estado atual:** Schema modelado para Evolution API (`WhatsAppInstance`, `WhatsAppConversation`, `WhatsAppMessage`).

**Contexto:**
- Evolution API é um wrapper não-oficial que usa Baileys/WhatsApp Web multi-device.
- Meta Cloud API é o WhatsApp Business Platform oficial.

**Tradeoffs:**

| Critério | Evolution API | Meta Cloud API |
|---|---|---|
| Custo por msg | Grátis (self-hosted) | ~R$ 0,05–0,30/msg |
| Risco de ban | **Alto** em escala/envio ativo | **Zero** (se seguir ToS) |
| Setup pro cliente | QR code (número pessoal) | Embedded Signup (Business Manager) |
| Multi-número/WABA | Limitado, por tenant | Nativo |
| Templates aprovados | Não existe | Obrigatório p/ envio fora janela 24h |
| Mídia rica (botões, listas) | Limitada | Completa |
| Adequado pra SaaS B2B mid-market | ⚠️ arriscado | ✅ padrão da indústria |

**Recomendação desta sessão:** **Adapter pattern** — `packages/whatsapp` expõe interface única, com 2 implementações (`evolution.ts`, `meta-cloud.ts`). Cliente escolhe no onboarding. Starter/Growth ficam em Evolution (cheap). Scale/Enterprise em Meta Cloud (oficial).

**Schema change necessária:** `WhatsAppInstance.provider` (enum `EVOLUTION | META_CLOUD`). Meta Cloud requer campos adicionais (`wabaId`, `phoneNumberId`, `accessTokenEnc`, `qualityRating`, `messagingTier`).

**Aguardando decisão:** usuário ou sessão CRM confirmar qual caminho seguir.

---

## 2. Claude via OpenRouter vs Anthropic SDK direto

**Estado atual:** `packages/ai` usa OpenRouter (`createOpenAI` com baseURL OpenRouter).

**Tradeoffs:**

| Critério | OpenRouter | Anthropic SDK direto |
|---|---|---|
| Billing | Único (OpenRouter) | Anthropic separado |
| Fallback entre providers | Nativo | Manual |
| Prompt caching | ⚠️ Depende de suporte no OpenRouter (atualmente inconsistente) | ✅ Nativo, 90% economia |
| Surcharge | 5–10% | 0% |
| Latência | +1 hop | direto |

**Recomendação desta sessão:** para SDR em escala (muitas conversas, system prompts grandes), **prompt caching é crítico** — pode reduzir custo em 5–10x. Migrar `packages/ai` pra `@ai-sdk/anthropic` direto. OpenRouter pode ficar como fallback em `@ai-sdk/openai` pra models não-Claude (ex: se quiser A/B testar GPT-5).

**Aguardando decisão:** usuário.

---

## 3. Eventos Inngest — processamento síncrono vs assíncrono em webhooks

**Padrão adotado:** webhook recebe → valida assinatura → emite evento Inngest → responde 200 imediato. Processamento pesado vira job.

**Exceção:** webhook do WhatsApp que precisa responder com `challenge` (verificação inicial) — mantém handler síncrono só para esse path.

---

## 4. RLS (Row-Level Security) no Postgres

**Estado atual:** Isolation é feita só em código (filtros `tenantId` em cada query).

**Proposta:** adicionar RLS policies no Postgres como segunda camada de defesa. Em caso de bug em código, banco rejeita.

**Custo:** complexidade de ops (DATABASE_URL precisa setar `current_setting('app.tenant_id')` por request).

**Decisão adiada:** avaliar em Fase 5+. Por enquanto, testes de isolation cobrem.

---

## 5. Pgvector vs vector DB externo (Pinecone/Weaviate)

**Recomendação:** `pgvector` no mesmo Postgres. Simples, sem infra extra, performance suficiente pra <10M chunks. Só migrar se hit um limite real.

---

## 6. Scaffold branch merge strategy

**Proposta:**
- Scaffold é mergeado em `main` sem feature flag (só adiciona código novo, não muda comportamento de CRM existente)
- Testes da scaffold rodam em CI
- Sessão CRM pode continuar trabalhando em paralelo — os arquivos novos não tocam em áreas dela

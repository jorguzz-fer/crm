# Decisões arquiteturais em aberto

Tópicos que precisam de alinhamento entre sessões (e, em alguns casos, com o usuário) antes da implementação avançar.

---

## 1. WhatsApp: Evolution API vs Meta Cloud API ✅ DECIDIDO

**Decisão (2026-04-23):** Ambos — **adapter pattern conforme previsto**.
- Fase 1 (dev/testes internos): Evolution API ou Z-API
- Produção real com clientes: Meta Cloud API oficial

**Schema change necessária (Fase 1):** adicionar campo `provider` (enum `EVOLUTION | ZAPI | META_CLOUD`) no model `WhatsAppInstance`, mais campos opcionais para Meta Cloud (`wabaId`, `phoneNumberId`, `accessTokenEnc`).

**Impacto nos adapters:**
- `src/adapters/evolution.ts` — implementar em Fase 1
- `src/adapters/meta-cloud.ts` — implementar quando primeiro cliente real entrar
- Z-API: mesma interface do Evolution (ambos são wrappers Baileys) — um único adapter cobre os dois com config diferente

---

## 2. Claude via OpenRouter vs Anthropic SDK direto ✅ DECIDIDO

**Decisão (2026-04-23):** **Manter OpenRouter por agora.** Migrar para Anthropic direto quando custo mensal superar ~$80 (ponto em que o caching paga a migração).

**Racional:**
- Hoje o volume ainda é zero — custo de migrar antes de ter dados reais é injustificado
- A troca é mínima: `createOpenAI(OpenRouter)` → `createAnthropic()`, 1 arquivo (`packages/ai/src/index.ts`)
- Vercel AI SDK abstrai o provider — chamadas de `classifyLead` e `generateFirstContact` não mudam
- OpenRouter mantém flexibilidade para A/B testar outros modelos durante Fase 2

**Trigger para migrar:** primeira fatura > $80/mês ou quando caching de system prompt valer mais que conveniência do multi-provider.

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

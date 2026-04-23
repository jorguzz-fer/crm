# Contrato de eventos Inngest

Todos os eventos passam pelo event bus Inngest. Nomes em `domain/action` (kebab-case no domain).

**Append-only.** Nunca renomear evento existente — criar novo `/v2` e deprecar o antigo.

## Schema de payload (base comum)

Todo evento inclui `tenantId`. Sem exceção. Isolation de tenant é enforcada nas funções que consomem.

```ts
// packages/shared/events.ts (ou packages/jobs/src/events.ts)
interface BaseEvent {
  tenantId: string;
  triggeredBy?: { userId?: string; source: "user" | "system" | "webhook" | "cron" };
  occurredAt?: string; // ISO
}
```

---

## Eventos definidos

### `lead/created`
Disparado quando um Lead é criado (por form, importador, API, conversa WhatsApp inbound).

```ts
{
  name: "lead/created";
  data: {
    tenantId: string;
    leadId: string;
    source: "WEBSITE" | "WHATSAPP" | "INSTAGRAM" | "FACEBOOK" | "INDICACAO" | "EVENTO" | "COLD_OUTREACH" | "OUTRO";
    channel?: "whatsapp" | "email" | "sms" | "webchat" | "instagram";
    attributionId?: string; // FK → Attribution
    initialMessage?: string; // se veio de conversa
  };
}
```

Consumers:
- `jobs.sdr.firstContact` → IA SDR manda primeira mensagem
- `jobs.tracking.fireLeadEvent` → Meta CAPI "Lead"

---

### `lead/updated`
Campos relevantes mudaram (status, assignee, tags).

```ts
{ name: "lead/updated"; data: { tenantId: string; leadId: string; changes: Record<string, { before: unknown; after: unknown }> } }
```

Consumers: analytics/audit só.

---

### `lead/classified`
IA classificou o lead (quente/morno/frio/desqualificado).

```ts
{
  name: "lead/classified";
  data: {
    tenantId: string;
    leadId: string;
    score: "HOT" | "WARM" | "COLD" | "DISQUALIFIED";
    confidence: number; // 0..1
    reasons: string[]; // ex: ["respondeu em <5min", "médico confirmado"]
    modelUsed: string; // "claude-haiku-4-5" etc.
  };
}
```

Consumers:
- `jobs.sdr.route` → decide próximo passo (humano, nutrição, descarte)
- `apps/web` real-time UI (atualiza Kanban)

---

### `lead/qualified`
Lead passou critérios (normalmente: HOT com confidence ≥ 0.75 + contato mínimo).

```ts
{ name: "lead/qualified"; data: { tenantId: string; leadId: string; qualifiedBy: "ai" | "human"; userId?: string } }
```

Consumers:
- `jobs.sdr.assign` → distribui pra vendedor
- `jobs.tracking.fireQualifiedEvent` → CAPI custom event

---

### `message/received`
Mensagem inbound chegou em qualquer canal.

```ts
{
  name: "message/received";
  data: {
    tenantId: string;
    conversationId: string;
    messageId: string;
    leadId?: string;
    channel: "whatsapp" | "email" | "sms" | "webchat" | "instagram";
    content: { type: "text" | "image" | "audio" | "video" | "document" | "location" | "interactive"; body?: string; mediaUrl?: string };
    from: string; // telefone, email, handle
    receivedAt: string;
    providerMetadata?: Record<string, unknown>; // ex: ctwa_clid, fbclid
  };
}
```

Consumers:
- `jobs.sdr.respond` → IA responde
- `jobs.sdr.reclassify` → atualiza score
- `jobs.tracking.captureAdReferral` → extrai `ctwa_clid` se tiver

---

### `message/sent`
Mensagem outbound saiu com sucesso.

```ts
{ name: "message/sent"; data: { tenantId: string; conversationId: string; messageId: string; channel: string; sentBy: "ai" | "human"; userId?: string } }
```

Consumers: audit, analytics.

---

### `followup/scheduled`
Uma sequência de follow-up foi agendada pra um lead.

```ts
{ name: "followup/scheduled"; data: { tenantId: string; leadId: string; sequenceId: string; nextStepAt: string } }
```

---

### `deal/won` / `deal/lost`
Oportunidade fechou.

```ts
{ name: "deal/won"; data: { tenantId: string; opportunityId: string; leadId?: string; value: number; currency: string; closedBy?: string } }
```

Consumers:
- `jobs.tracking.firePurchaseEvent` → Meta CAPI + Google Offline Conversion
- Notification ao gestor

---

### `payment/received`
Webhook de gateway confirmou pagamento.

```ts
{
  name: "payment/received";
  data: {
    tenantId: string;
    gateway: "hotmart" | "pagarme" | "paypal" | "stripe";
    externalId: string;
    amount: number;
    currency: string;
    buyerEmail?: string;
    buyerPhone?: string;
    productExternalId?: string;
    rawPayload: Record<string, unknown>;
  };
}
```

Consumers:
- `jobs.tracking.matchPaymentToLead` → costura payment → lead → attribution → Meta/Google
- `jobs.billing.recordRevenue` (futuro)

---

### `conversion/reported`
Evento foi enviado a Meta CAPI ou Google Offline (para audit).

```ts
{ name: "conversion/reported"; data: { tenantId: string; platform: "meta" | "google"; eventType: string; leadId: string; value?: number; externalEventId: string; success: boolean; errorMessage?: string } }
```

---

## Regras

1. **NUNCA** sem `tenantId` no payload. Isolation é enforcada no consumer, mas o evento precisa do dado.
2. **Nomes imutáveis.** Versão nova = `lead/qualified/v2`, não rename.
3. **Payload imutável.** Se precisar adicionar campo, é optional (`?`).
4. **Consumer idempotente.** Todo handler assume que vai ser chamado 2x no pior caso — usar `externalEventId` ou dedup key.
5. **Documentar aqui antes de emitir.** Evento sem entrada neste arquivo não deve existir em runtime.

## Processo pra adicionar evento

1. Abrir PR editando este arquivo + adicionando o tipo em `packages/jobs/src/events.ts`.
2. Escrever teste de contract (Zod) no commit do evento.
3. Implementar emitter.
4. Implementar consumers com teste de idempotência.

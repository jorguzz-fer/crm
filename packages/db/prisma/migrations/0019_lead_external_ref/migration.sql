-- AlterTable: Lead.externalRef
-- Referência do registro na origem externa que criou o lead ("<sistema>:<id>",
-- ex. "chatwoot:8:1042"). Permite que o mesmo evento externo não vire dois
-- leads e que um agente de IA reencontre o lead da conversa em que está.
-- Não-breaking: coluna nova opcional, sem default.

ALTER TABLE "Lead" ADD COLUMN "externalRef" TEXT;

-- CreateIndex
-- externalRef: correlação da integração externa (n8n/Chatwoot → agente).
-- phone: deduplicação por telefone no intake público.
CREATE INDEX "Lead_tenantId_externalRef_idx" ON "Lead"("tenantId", "externalRef");
CREATE INDEX "Lead_tenantId_phone_idx"       ON "Lead"("tenantId", "phone");

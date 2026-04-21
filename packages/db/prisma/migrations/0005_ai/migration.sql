-- Fase 5: IA — tabelas de log e alertas de acompanhamento

CREATE TYPE "FollowUpAlertType" AS ENUM ('SEM_INTERACAO', 'TAREFA_VENCIDA', 'OPORTUNIDADE_PARADA');

CREATE TABLE "AiInvocationLog" (
    "id"         TEXT NOT NULL,
    "tenantId"   TEXT NOT NULL,
    "userId"     TEXT,
    "assistant"  TEXT NOT NULL,
    "entityType" TEXT,
    "entityId"   TEXT,
    "tokens"     INTEGER,
    "costUsd"    DOUBLE PRECISION,
    "latencyMs"  INTEGER,
    "model"      TEXT,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiInvocationLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiFollowUpAlert" (
    "id"        TEXT NOT NULL,
    "tenantId"  TEXT NOT NULL,
    "leadId"    TEXT,
    "type"      "FollowUpAlertType" NOT NULL,
    "message"   TEXT NOT NULL,
    "daysStale" INTEGER,
    "dismissed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiFollowUpAlert_pkey" PRIMARY KEY ("id")
);

-- Índices
CREATE INDEX "AiInvocationLog_tenantId_assistant_createdAt_idx"
    ON "AiInvocationLog"("tenantId", "assistant", "createdAt");
CREATE INDEX "AiInvocationLog_tenantId_entityType_entityId_idx"
    ON "AiInvocationLog"("tenantId", "entityType", "entityId");

CREATE INDEX "AiFollowUpAlert_tenantId_dismissed_createdAt_idx"
    ON "AiFollowUpAlert"("tenantId", "dismissed", "createdAt");
CREATE INDEX "AiFollowUpAlert_tenantId_leadId_idx"
    ON "AiFollowUpAlert"("tenantId", "leadId");

-- Foreign keys
ALTER TABLE "AiInvocationLog"
    ADD CONSTRAINT "AiInvocationLog_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AiFollowUpAlert"
    ADD CONSTRAINT "AiFollowUpAlert_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AiFollowUpAlert"
    ADD CONSTRAINT "AiFollowUpAlert_leadId_fkey"
    FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

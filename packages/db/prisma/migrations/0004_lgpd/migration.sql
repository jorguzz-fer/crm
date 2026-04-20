-- CreateEnum
CREATE TYPE "ConsentBasis" AS ENUM ('CONTRATO', 'LEGITIMO_INTERESSE', 'CONSENTIMENTO', 'OBRIGACAO_LEGAL');

-- CreateEnum
CREATE TYPE "DataRequestType" AS ENUM ('EXPORT', 'DELETE');

-- CreateEnum
CREATE TYPE "DataRequestStatus" AS ENUM ('PENDENTE', 'APROVADO', 'REJEITADO', 'CONCLUIDO');

-- AlterTable Lead — campo para indicar anonimização LGPD
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "anonymizedAt" TIMESTAMP(3);

-- AlterTable Contact — campo para indicar anonimização LGPD
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "anonymizedAt" TIMESTAMP(3);

-- CreateTable ConsentRecord
CREATE TABLE "ConsentRecord" (
    "id"          TEXT NOT NULL,
    "tenantId"    TEXT NOT NULL,
    "entityType"  TEXT NOT NULL,
    "entityId"    TEXT NOT NULL,
    "entityName"  TEXT NOT NULL,
    "basis"       "ConsentBasis" NOT NULL,
    "notes"       TEXT,
    "collectedBy" TEXT NOT NULL,
    "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt"   TIMESTAMP(3),

    CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable DataRequest
CREATE TABLE "DataRequest" (
    "id"          TEXT NOT NULL,
    "tenantId"    TEXT NOT NULL,
    "type"        "DataRequestType" NOT NULL,
    "entityType"  TEXT NOT NULL,
    "entityId"    TEXT NOT NULL,
    "entityName"  TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "status"      "DataRequestStatus" NOT NULL DEFAULT 'PENDENTE',
    "processedBy" TEXT,
    "processedAt" TIMESTAMP(3),
    "exportData"  JSONB,
    "notes"       TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex ConsentRecord
CREATE INDEX IF NOT EXISTS "ConsentRecord_tenantId_entityType_entityId_idx"
    ON "ConsentRecord"("tenantId", "entityType", "entityId");

CREATE INDEX IF NOT EXISTS "ConsentRecord_tenantId_collectedAt_idx"
    ON "ConsentRecord"("tenantId", "collectedAt");

-- CreateIndex DataRequest
CREATE INDEX IF NOT EXISTS "DataRequest_tenantId_status_idx"
    ON "DataRequest"("tenantId", "status");

CREATE INDEX IF NOT EXISTS "DataRequest_tenantId_createdAt_idx"
    ON "DataRequest"("tenantId", "createdAt");

-- AddForeignKey ConsentRecord
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_collectedBy_fkey"
    FOREIGN KEY ("collectedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey DataRequest
ALTER TABLE "DataRequest" ADD CONSTRAINT "DataRequest_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DataRequest" ADD CONSTRAINT "DataRequest_requestedBy_fkey"
    FOREIGN KEY ("requestedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DataRequest" ADD CONSTRAINT "DataRequest_processedBy_fkey"
    FOREIGN KEY ("processedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

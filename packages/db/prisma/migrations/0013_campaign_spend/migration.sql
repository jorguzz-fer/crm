-- Migration 0013: CampaignSpend — gasto diário por campanha para ROAS/CPL
-- Non-breaking: new table only

CREATE TABLE IF NOT EXISTS "CampaignSpend" (
  "id"           TEXT             NOT NULL,
  "tenantId"     TEXT             NOT NULL,
  "platform"     TEXT             NOT NULL,
  "campaignId"   TEXT             NOT NULL,
  "campaignName" TEXT,
  "adSetId"      TEXT,
  "adSetName"    TEXT,
  "date"         TIMESTAMP(3)     NOT NULL,
  "spend"        DOUBLE PRECISION NOT NULL,
  "impressions"  INTEGER          NOT NULL DEFAULT 0,
  "clicks"       INTEGER          NOT NULL DEFAULT 0,
  "currency"     TEXT             NOT NULL DEFAULT 'BRL',
  "createdAt"    TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CampaignSpend_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CampaignSpend"
  ADD CONSTRAINT "CampaignSpend_tenantId_platform_campaignId_date_key"
    UNIQUE ("tenantId", "platform", "campaignId", "date");

ALTER TABLE "CampaignSpend"
  ADD CONSTRAINT "CampaignSpend_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "CampaignSpend_tenantId_platform_date_idx"
  ON "CampaignSpend"("tenantId", "platform", "date");

CREATE INDEX IF NOT EXISTS "CampaignSpend_tenantId_campaignId_idx"
  ON "CampaignSpend"("tenantId", "campaignId");

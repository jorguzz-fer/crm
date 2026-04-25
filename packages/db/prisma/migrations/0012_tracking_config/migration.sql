-- Migration 0012: TenantTrackingConfig — per-tenant gateway credentials
-- Non-breaking: new table only

CREATE TABLE IF NOT EXISTS "TenantTrackingConfig" (
  "id"                   TEXT         NOT NULL,
  "tenantId"             TEXT         NOT NULL,
  "metaPixelId"          TEXT,
  "metaAccessToken"      TEXT,
  "hotmartHottok"        TEXT,
  "pagarmeWebhookSecret" TEXT,
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TenantTrackingConfig_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "TenantTrackingConfig"
  ADD CONSTRAINT "TenantTrackingConfig_tenantId_key" UNIQUE ("tenantId");

ALTER TABLE "TenantTrackingConfig"
  ADD CONSTRAINT "TenantTrackingConfig_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

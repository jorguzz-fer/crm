-- Migration 0011: Attribution + ConversionEvent models for Phase 4 tracking
-- Non-breaking: new tables only, no changes to existing columns/tables

CREATE TABLE IF NOT EXISTS "Attribution" (
  "id"          TEXT        NOT NULL,
  "tenantId"    TEXT        NOT NULL,
  "leadId"      TEXT        NOT NULL,
  "fbclid"      TEXT,
  "fbp"         TEXT,
  "fbc"         TEXT,
  "ctwaClid"    TEXT,
  "gclid"       TEXT,
  "gbraid"      TEXT,
  "wbraid"      TEXT,
  "utmSource"   TEXT,
  "utmMedium"   TEXT,
  "utmCampaign" TEXT,
  "utmContent"  TEXT,
  "utmTerm"     TEXT,
  "landingPage" TEXT,
  "referrer"    TEXT,
  "userAgent"   TEXT,
  "ip"          TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Attribution_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Attribution"
  ADD CONSTRAINT "Attribution_leadId_key" UNIQUE ("leadId");

ALTER TABLE "Attribution"
  ADD CONSTRAINT "Attribution_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Attribution"
  ADD CONSTRAINT "Attribution_leadId_fkey"
    FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "Attribution_tenantId_idx"  ON "Attribution"("tenantId");
CREATE INDEX IF NOT EXISTS "Attribution_fbclid_idx"    ON "Attribution"("fbclid");
CREATE INDEX IF NOT EXISTS "Attribution_gclid_idx"     ON "Attribution"("gclid");
CREATE INDEX IF NOT EXISTS "Attribution_ctwaClid_idx"  ON "Attribution"("ctwaClid");

CREATE TABLE IF NOT EXISTS "ConversionEvent" (
  "id"              TEXT         NOT NULL,
  "tenantId"        TEXT         NOT NULL,
  "leadId"          TEXT,
  "platform"        TEXT         NOT NULL,
  "eventType"       TEXT         NOT NULL,
  "externalEventId" TEXT         NOT NULL,
  "status"          TEXT         NOT NULL DEFAULT 'pending',
  "errorMessage"    TEXT,
  "value"           DOUBLE PRECISION,
  "currency"        TEXT         NOT NULL DEFAULT 'BRL',
  "sentAt"          TIMESTAMP(3),
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConversionEvent_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ConversionEvent"
  ADD CONSTRAINT "ConversionEvent_externalEventId_key" UNIQUE ("externalEventId");

ALTER TABLE "ConversionEvent"
  ADD CONSTRAINT "ConversionEvent_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "ConversionEvent_tenantId_platform_createdAt_idx"
  ON "ConversionEvent"("tenantId", "platform", "createdAt");
CREATE INDEX IF NOT EXISTS "ConversionEvent_tenantId_leadId_idx"
  ON "ConversionEvent"("tenantId", "leadId");
CREATE INDEX IF NOT EXISTS "ConversionEvent_externalEventId_idx"
  ON "ConversionEvent"("externalEventId");

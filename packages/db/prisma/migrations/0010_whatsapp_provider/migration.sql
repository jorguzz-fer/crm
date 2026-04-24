-- Migration 0010: WaProvider enum + WhatsAppInstance multi-provider fields
-- Non-breaking: new enum with default, all new columns are optional
--
-- NOTA: sem bloco DO $$ ... END $$ pois o migrate.js divide por ";"
-- e quebraria o dollar-quote. O migrate.js já ignora erro "already exists"
-- no catch, então CREATE TYPE sem IF NOT EXISTS é seguro aqui.

CREATE TYPE "WaProvider" AS ENUM ('EVOLUTION', 'ZAPI', 'META_CLOUD');

ALTER TABLE "WhatsAppInstance"
  ADD COLUMN IF NOT EXISTS "provider"       "WaProvider" NOT NULL DEFAULT 'EVOLUTION',
  ADD COLUMN IF NOT EXISTS "wabaId"         TEXT,
  ADD COLUMN IF NOT EXISTS "phoneNumberId"  TEXT,
  ADD COLUMN IF NOT EXISTS "accessTokenEnc" TEXT,
  ADD COLUMN IF NOT EXISTS "webhookSecret"  TEXT;

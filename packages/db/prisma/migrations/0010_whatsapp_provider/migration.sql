-- Migration 0010: WaProvider enum + WhatsAppInstance multi-provider fields
-- Non-breaking: new enum with default, all new columns are optional

-- Cria enum WaProvider
DO $$ BEGIN
  CREATE TYPE "WaProvider" AS ENUM ('EVOLUTION', 'ZAPI', 'META_CLOUD');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Adiciona coluna provider com default EVOLUTION
ALTER TABLE "WhatsAppInstance"
  ADD COLUMN IF NOT EXISTS "provider"       "WaProvider" NOT NULL DEFAULT 'EVOLUTION',
  ADD COLUMN IF NOT EXISTS "wabaId"         TEXT,
  ADD COLUMN IF NOT EXISTS "phoneNumberId"  TEXT,
  ADD COLUMN IF NOT EXISTS "accessTokenEnc" TEXT,
  ADD COLUMN IF NOT EXISTS "webhookSecret"  TEXT;

-- V2 Features: 2FA TOTP + Personal Access Tokens + Whisper Transcription

-- ── 2FA TOTP fields on User ───────────────────────────────────────────────────
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "twoFactorSecret"  TEXT;

-- ── Personal Access Tokens (Chrome Extension, API integrations) ───────────────
CREATE TABLE IF NOT EXISTS "PersonalAccessToken" (
  "id"         TEXT      NOT NULL PRIMARY KEY,
  "tenantId"   TEXT      NOT NULL,
  "userId"     TEXT      NOT NULL,
  "name"       TEXT      NOT NULL,
  "tokenHash"  TEXT      NOT NULL,
  "lastUsedAt" TIMESTAMP,
  "expiresAt"  TIMESTAMP,
  "createdAt"  TIMESTAMP NOT NULL DEFAULT NOW(),

  CONSTRAINT "PersonalAccessToken_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE,
  CONSTRAINT "PersonalAccessToken_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "PersonalAccessToken_tokenHash_key"
  ON "PersonalAccessToken"("tokenHash");
CREATE INDEX IF NOT EXISTS "PersonalAccessToken_tenantId_idx"
  ON "PersonalAccessToken"("tenantId");
CREATE INDEX IF NOT EXISTS "PersonalAccessToken_userId_idx"
  ON "PersonalAccessToken"("userId");

-- ── Whisper Transcription ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Transcription" (
  "id"           TEXT      NOT NULL PRIMARY KEY,
  "tenantId"     TEXT      NOT NULL,
  "userId"       TEXT      NOT NULL,
  "audioKey"     TEXT      NOT NULL,
  "filename"     TEXT      NOT NULL,
  "durationSec"  DOUBLE PRECISION,
  "language"     TEXT      NOT NULL DEFAULT 'pt',
  "text"         TEXT,
  "status"       TEXT      NOT NULL DEFAULT 'PENDING',
  "errorMessage" TEXT,
  "entityType"   TEXT,
  "entityId"     TEXT,
  "consentGiven" BOOLEAN   NOT NULL DEFAULT false,
  "createdAt"    TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt"    TIMESTAMP NOT NULL DEFAULT NOW(),

  CONSTRAINT "Transcription_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE,
  CONSTRAINT "Transcription_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Transcription_audioKey_key"
  ON "Transcription"("audioKey");
CREATE INDEX IF NOT EXISTS "Transcription_tenantId_status_idx"
  ON "Transcription"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "Transcription_tenantId_entityType_entityId_idx"
  ON "Transcription"("tenantId", "entityType", "entityId");

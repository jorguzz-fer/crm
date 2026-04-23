-- Migration 0009: campos de scoring de temperatura no Lead
ALTER TABLE "Lead"
  ADD COLUMN IF NOT EXISTS "score"          INTEGER,
  ADD COLUMN IF NOT EXISTS "scoreLabel"     TEXT,
  ADD COLUMN IF NOT EXISTS "scoreUpdatedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Lead_tenantId_score_idx" ON "Lead"("tenantId", "score");

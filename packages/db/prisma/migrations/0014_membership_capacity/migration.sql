-- Migration 0014: Membership capacity fields for smart lead distribution
-- Non-breaking: new columns with defaults

ALTER TABLE "Membership"
  ADD COLUMN IF NOT EXISTS "acceptingLeads" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "maxLeads"       INTEGER;

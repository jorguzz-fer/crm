-- CreateTable: Visit (visitas de campo com geolocalização opcional)
CREATE TABLE "Visit" (
  "id"            TEXT NOT NULL,
  "tenantId"      TEXT NOT NULL,
  "userId"        TEXT NOT NULL,
  "leadId"        TEXT,
  "companyId"     TEXT,
  "opportunityId" TEXT,
  "subject"       TEXT NOT NULL,
  "notes"         TEXT,
  "outcome"       TEXT,
  "lat"           DOUBLE PRECISION,
  "lng"           DOUBLE PRECISION,
  "address"       TEXT,
  "visitedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Visit_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "Visit_tenantId_visitedAt_idx" ON "Visit"("tenantId", "visitedAt");
CREATE INDEX "Visit_tenantId_userId_idx"    ON "Visit"("tenantId", "userId");
CREATE INDEX "Visit_leadId_idx"             ON "Visit"("leadId");
CREATE INDEX "Visit_companyId_idx"          ON "Visit"("companyId");

-- ForeignKeys
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Visit" ADD CONSTRAINT "Visit_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Visit" ADD CONSTRAINT "Visit_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Visit" ADD CONSTRAINT "Visit_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Visit" ADD CONSTRAINT "Visit_opportunityId_fkey"
  FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

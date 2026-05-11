-- CreateTable: MetaLeadForm
-- Vincula Facebook Pages a tenants para receber leads via Meta Lead Ads webhook

CREATE TABLE "MetaLeadForm" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "pageName" TEXT,
    "accessToken" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetaLeadForm_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MetaLeadForm_pageId_key" ON "MetaLeadForm"("pageId");
CREATE INDEX "MetaLeadForm_tenantId_idx" ON "MetaLeadForm"("tenantId");

-- AddForeignKey
ALTER TABLE "MetaLeadForm" ADD CONSTRAINT "MetaLeadForm_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

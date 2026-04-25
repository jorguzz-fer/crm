-- CreateTable
CREATE TABLE "Attachment" (
    "id"            TEXT NOT NULL,
    "tenantId"      TEXT NOT NULL,
    "userId"        TEXT NOT NULL,
    "key"           TEXT NOT NULL,
    "filename"      TEXT NOT NULL,
    "mimeType"      TEXT NOT NULL,
    "size"          INTEGER NOT NULL,
    "noteId"        TEXT,
    "visitId"       TEXT,
    "leadId"        TEXT,
    "opportunityId" TEXT,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Attachment_key_key"                   ON "Attachment"("key");
CREATE INDEX "Attachment_tenantId_noteId_idx"              ON "Attachment"("tenantId", "noteId");
CREATE INDEX "Attachment_tenantId_visitId_idx"             ON "Attachment"("tenantId", "visitId");
CREATE INDEX "Attachment_tenantId_leadId_idx"              ON "Attachment"("tenantId", "leadId");
CREATE INDEX "Attachment_tenantId_opportunityId_idx"       ON "Attachment"("tenantId", "opportunityId");

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_noteId_fkey"
    FOREIGN KEY ("noteId") REFERENCES "Note"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_visitId_fkey"
    FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_leadId_fkey"
    FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_opportunityId_fkey"
    FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

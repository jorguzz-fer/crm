-- Migration: 0006_whatsapp
-- V2: WhatsApp via Evolution API

CREATE TYPE "WaStatus" AS ENUM ('DISCONNECTED', 'CONNECTING', 'CONNECTED');
CREATE TYPE "WaMessageType" AS ENUM ('TEXT', 'IMAGE', 'AUDIO', 'VIDEO', 'DOCUMENT', 'STICKER', 'UNKNOWN');

CREATE TABLE "WhatsAppInstance" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "instanceName" TEXT NOT NULL,
    "phone" TEXT,
    "status" "WaStatus" NOT NULL DEFAULT 'DISCONNECTED',
    "qrCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WhatsAppInstance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WhatsAppInstance_tenantId_key" ON "WhatsAppInstance"("tenantId");
CREATE UNIQUE INDEX "WhatsAppInstance_instanceName_key" ON "WhatsAppInstance"("instanceName");

CREATE TABLE "WhatsAppConversation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "remoteJid" TEXT NOT NULL,
    "remotePhone" TEXT NOT NULL,
    "remoteName" TEXT,
    "leadId" TEXT,
    "contactId" TEXT,
    "unreadCount" INTEGER NOT NULL DEFAULT 0,
    "lastMessageAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WhatsAppConversation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WhatsAppConversation_instanceId_remoteJid_key" ON "WhatsAppConversation"("instanceId", "remoteJid");
CREATE INDEX "WhatsAppConversation_tenantId_lastMessageAt_idx" ON "WhatsAppConversation"("tenantId", "lastMessageAt" DESC);
CREATE INDEX "WhatsAppConversation_tenantId_leadId_idx" ON "WhatsAppConversation"("tenantId", "leadId");
CREATE INDEX "WhatsAppConversation_tenantId_contactId_idx" ON "WhatsAppConversation"("tenantId", "contactId");

CREATE TABLE "WhatsAppMessage" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "waMessageId" TEXT NOT NULL,
    "fromMe" BOOLEAN NOT NULL,
    "body" TEXT,
    "mediaType" "WaMessageType" NOT NULL DEFAULT 'TEXT',
    "mediaUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "timestamp" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WhatsAppMessage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WhatsAppMessage_waMessageId_key" ON "WhatsAppMessage"("waMessageId");
CREATE INDEX "WhatsAppMessage_conversationId_timestamp_idx" ON "WhatsAppMessage"("conversationId", "timestamp");
CREATE INDEX "WhatsAppMessage_tenantId_timestamp_idx" ON "WhatsAppMessage"("tenantId", "timestamp");

ALTER TABLE "WhatsAppInstance"
    ADD CONSTRAINT "WhatsAppInstance_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WhatsAppConversation"
    ADD CONSTRAINT "WhatsAppConversation_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WhatsAppConversation"
    ADD CONSTRAINT "WhatsAppConversation_instanceId_fkey"
    FOREIGN KEY ("instanceId") REFERENCES "WhatsAppInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WhatsAppConversation"
    ADD CONSTRAINT "WhatsAppConversation_leadId_fkey"
    FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WhatsAppConversation"
    ADD CONSTRAINT "WhatsAppConversation_contactId_fkey"
    FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WhatsAppMessage"
    ADD CONSTRAINT "WhatsAppMessage_conversationId_fkey"
    FOREIGN KEY ("conversationId") REFERENCES "WhatsAppConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: User.isPlatformAdmin
-- Acesso ao painel da plataforma (/painel), cross-tenant. Default false —
-- habilitado manualmente via set-platform-admin.js.

ALTER TABLE "User" ADD COLUMN "isPlatformAdmin" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "User_isPlatformAdmin_idx" ON "User"("isPlatformAdmin");

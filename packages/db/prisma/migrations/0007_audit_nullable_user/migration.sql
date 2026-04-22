-- Migration: 0007_audit_nullable_user
-- Permite userId nulo em AuditLog para ações do sistema
-- (cronjobs de retenção LGPD, webhooks anônimos, jobs de IA agendados).

ALTER TABLE "AuditLog" ALTER COLUMN "userId" DROP NOT NULL;

-- A FK existente já permite NULL automaticamente quando a coluna é nullable;
-- Postgres não exige recriar a constraint. Mas garantimos o ON DELETE SET NULL
-- pra preservar o histórico se um usuário for removido.
ALTER TABLE "AuditLog" DROP CONSTRAINT IF EXISTS "AuditLog_userId_fkey";
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Align audit logs with the current Prisma AuditLog model.
-- The organizations table is not present in this local schema history yet,
-- so this migration adds only the nullable column and index required by Prisma.

ALTER TABLE "audit_logs"
  ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

CREATE INDEX IF NOT EXISTS "audit_logs_organizationId_idx" ON "audit_logs"("organizationId");

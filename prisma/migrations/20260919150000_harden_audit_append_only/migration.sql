ALTER TABLE "audit_logs"
  ADD COLUMN "requestId" TEXT,
  ADD COLUMN "reason" TEXT,
  ADD COLUMN "transactionId" TEXT,
  ADD COLUMN "approvalChain" JSONB;

ALTER TABLE "organization_audit_logs"
  ADD COLUMN "requestId" TEXT,
  ADD COLUMN "reason" TEXT,
  ADD COLUMN "transactionId" TEXT,
  ADD COLUMN "approvalChain" JSONB;

ALTER TABLE "transactions" ADD COLUMN "requestId" TEXT;
ALTER TABLE "notifications" ADD COLUMN "requestId" TEXT;

CREATE INDEX "audit_logs_requestId_idx" ON "audit_logs"("requestId");
CREATE INDEX "audit_logs_transactionId_idx" ON "audit_logs"("transactionId");
CREATE INDEX "organization_audit_logs_requestId_idx" ON "organization_audit_logs"("requestId");
CREATE INDEX "organization_audit_logs_transactionId_idx" ON "organization_audit_logs"("transactionId");
CREATE INDEX "transactions_requestId_idx" ON "transactions"("requestId");
CREATE INDEX "notifications_requestId_idx" ON "notifications"("requestId");

CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_setting('app.audit_maintenance', true) = 'true' THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  RAISE EXCEPTION 'Audit records are append-only';
END;
$$;

CREATE TRIGGER audit_logs_append_only
BEFORE UPDATE OR DELETE ON "audit_logs"
FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();

CREATE TRIGGER organization_audit_logs_append_only
BEFORE UPDATE OR DELETE ON "organization_audit_logs"
FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();

ALTER TABLE "users"
  ADD COLUMN "deletionRequestedAt" TIMESTAMP(3),
  ADD COLUMN "deletionScheduledFor" TIMESTAMP(3),
  ADD COLUMN "anonymizedAt" TIMESTAMP(3),
  ADD COLUMN "deletionReason" TEXT;

CREATE INDEX "users_deletionScheduledFor_anonymizedAt_idx"
  ON "users"("deletionScheduledFor", "anonymizedAt");

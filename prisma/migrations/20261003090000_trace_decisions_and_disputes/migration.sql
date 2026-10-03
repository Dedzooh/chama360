-- Store decision context and timeline data for member-visible reviews.
ALTER TABLE "loans" ADD COLUMN "decisionReason" VARCHAR(500);
ALTER TABLE "welfare_claims" ADD COLUMN "statusHistory" JSONB;
ALTER TABLE "disputes"
  ADD COLUMN "relatedEntityType" TEXT,
  ADD COLUMN "relatedEntityId" TEXT,
  ADD COLUMN "activity" JSONB;

CREATE INDEX "disputes_organizationId_relatedEntityType_relatedEntityId_idx"
  ON "disputes"("organizationId", "relatedEntityType", "relatedEntityId");

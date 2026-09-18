ALTER TABLE "refresh_tokens" ADD COLUMN "familyId" TEXT;
ALTER TABLE "refresh_tokens" ADD COLUMN "usedAt" TIMESTAMP(3);

UPDATE "refresh_tokens" SET "familyId" = "id" WHERE "familyId" IS NULL;
ALTER TABLE "refresh_tokens" ALTER COLUMN "familyId" SET NOT NULL;

CREATE INDEX "refresh_tokens_familyId_isRevoked_idx" ON "refresh_tokens"("familyId", "isRevoked");
-- Restore fields still used by the public chama, membership, contribution, and
-- invitation APIs. The organization consolidation remains in place; these
-- columns provide backwards-compatible runtime configuration.
ALTER TABLE "chamas"
ADD COLUMN "maxMembers" INTEGER NOT NULL DEFAULT 50,
ADD COLUMN "contributionAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN "contributionFrequency" "Frequency" NOT NULL DEFAULT 'MONTHLY',
ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'KES',
ADD COLUMN "shareableLink" TEXT,
ADD COLUMN "qrCode" TEXT;

CREATE UNIQUE INDEX "chamas_shareableLink_key" ON "chamas"("shareableLink");
CREATE INDEX "chamas_visibility_status_idx" ON "chamas"("visibility", "status");

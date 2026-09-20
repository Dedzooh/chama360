ALTER TABLE "users" ADD COLUMN "referralCode" TEXT;
CREATE UNIQUE INDEX "users_referralCode_key" ON "users"("referralCode");

CREATE TABLE "referrals" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "referrerId" TEXT NOT NULL,
  "referredOrganizationId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'REGISTERED',
  "rewardMonths" INTEGER NOT NULL DEFAULT 1,
  "convertedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "referrals_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "referrals_code_key" ON "referrals"("code");
CREATE UNIQUE INDEX "referrals_referredOrganizationId_key" ON "referrals"("referredOrganizationId");
CREATE INDEX "referrals_referrerId_status_idx" ON "referrals"("referrerId", "status");
CREATE INDEX "referrals_status_createdAt_idx" ON "referrals"("status", "createdAt");
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referredOrganizationId_fkey" FOREIGN KEY ("referredOrganizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE TABLE "contribution_allocations" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "sourceContributionId" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "period" TEXT NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "monthlyAmount" DECIMAL(10,2) NOT NULL,
  "allocatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "contribution_allocations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "contribution_allocations_sourceContributionId_period_key" ON "contribution_allocations"("sourceContributionId", "period");
CREATE INDEX "contribution_allocations_organizationId_memberId_period_idx" ON "contribution_allocations"("organizationId", "memberId", "period");
ALTER TABLE "contribution_allocations" ADD CONSTRAINT "contribution_allocations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contribution_allocations" ADD CONSTRAINT "contribution_allocations_sourceContributionId_fkey" FOREIGN KEY ("sourceContributionId") REFERENCES "contributions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contribution_allocations" ADD CONSTRAINT "contribution_allocations_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "contribution_credits" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "balance" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "contribution_credits_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "contribution_credits_organizationId_memberId_key" ON "contribution_credits"("organizationId", "memberId");
CREATE INDEX "contribution_credits_memberId_idx" ON "contribution_credits"("memberId");
ALTER TABLE "contribution_credits" ADD CONSTRAINT "contribution_credits_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contribution_credits" ADD CONSTRAINT "contribution_credits_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

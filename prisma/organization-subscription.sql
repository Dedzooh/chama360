ALTER TYPE "SubscriptionPlan" ADD VALUE IF NOT EXISTS 'STARTER';
ALTER TYPE "SubscriptionPlan" ADD VALUE IF NOT EXISTS 'ENTERPRISE';

DO $$ BEGIN
  CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'ANNUAL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "plan_change_requests" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "plan_change_requests" ADD COLUMN IF NOT EXISTS "billingCycle" "BillingCycle" NOT NULL DEFAULT 'MONTHLY';

CREATE TABLE IF NOT EXISTS "organization_subscriptions" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "plan" "SubscriptionPlan" NOT NULL DEFAULT 'FREE',
  "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
  "billingCycle" "BillingCycle" NOT NULL DEFAULT 'MONTHLY',
  "trialEndsAt" TIMESTAMP(3),
  "currentPeriodStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "currentPeriodEnd" TIMESTAMP(3),
  "gracePeriodEnd" TIMESTAMP(3),
  "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
  "provider" TEXT,
  "providerReference" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "organization_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "organization_subscriptions_organizationId_key" ON "organization_subscriptions"("organizationId");
CREATE UNIQUE INDEX IF NOT EXISTS "organization_subscriptions_providerReference_key" ON "organization_subscriptions"("providerReference");
CREATE INDEX IF NOT EXISTS "organization_subscriptions_plan_status_idx" ON "organization_subscriptions"("plan", "status");
CREATE INDEX IF NOT EXISTS "plan_change_requests_organizationId_status_idx" ON "plan_change_requests"("organizationId", "status");

DO $$ BEGIN
  ALTER TABLE "organization_subscriptions" ADD CONSTRAINT "organization_subscriptions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "plan_change_requests" ADD CONSTRAINT "plan_change_requests_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

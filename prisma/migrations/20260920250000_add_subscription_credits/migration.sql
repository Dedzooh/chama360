CREATE TABLE "subscription_credits" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "referralId" TEXT NOT NULL,
  "months" INTEGER NOT NULL,
  "appliedAt" TIMESTAMP(3),
  "appliedSubscriptionId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "subscription_credits_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "subscription_credits_referralId_key" ON "subscription_credits"("referralId");
CREATE INDEX "subscription_credits_userId_appliedAt_idx" ON "subscription_credits"("userId", "appliedAt");

ALTER TABLE "subscription_credits" ADD CONSTRAINT "subscription_credits_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "subscription_credits" ADD CONSTRAINT "subscription_credits_referralId_fkey" FOREIGN KEY ("referralId") REFERENCES "referrals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
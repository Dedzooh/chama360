CREATE TABLE "commercial_funnel_events" (
  "id" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "visitorId" TEXT,
  "userId" TEXT,
  "organizationId" TEXT,
  "plan" "SubscriptionPlan",
  "billingCycle" "BillingCycle",
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "commercial_funnel_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "commercial_funnel_events_eventType_createdAt_idx" ON "commercial_funnel_events"("eventType", "createdAt");
CREATE INDEX "commercial_funnel_events_organizationId_eventType_idx" ON "commercial_funnel_events"("organizationId", "eventType");
ALTER TABLE "commercial_funnel_events" ADD CONSTRAINT "commercial_funnel_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "commercial_funnel_events" ADD CONSTRAINT "commercial_funnel_events_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
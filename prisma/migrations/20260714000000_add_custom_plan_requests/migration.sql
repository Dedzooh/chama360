CREATE TABLE "custom_plan_requests" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "requestedById" TEXT NOT NULL,
  "contactName" TEXT NOT NULL,
  "contactEmail" TEXT NOT NULL,
  "contactPhone" TEXT,
  "estimatedMembers" INTEGER,
  "requirements" TEXT NOT NULL,
  "preferredTimeline" TEXT,
  "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
  "adminNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "custom_plan_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "custom_plan_requests_organizationId_status_idx" ON "custom_plan_requests"("organizationId", "status");
CREATE INDEX "custom_plan_requests_status_createdAt_idx" ON "custom_plan_requests"("status", "createdAt");

ALTER TABLE "custom_plan_requests" ADD CONSTRAINT "custom_plan_requests_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "custom_plan_requests" ADD CONSTRAINT "custom_plan_requests_requestedById_fkey"
  FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

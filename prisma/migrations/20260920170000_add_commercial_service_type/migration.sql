ALTER TABLE "custom_plan_requests"
ADD COLUMN "serviceType" TEXT NOT NULL DEFAULT 'ENTERPRISE_IMPLEMENTATION';

CREATE INDEX "custom_plan_requests_serviceType_idx" ON "custom_plan_requests"("serviceType");
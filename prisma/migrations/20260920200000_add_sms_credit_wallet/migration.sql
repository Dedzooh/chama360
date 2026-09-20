CREATE TABLE "organization_sms_credits" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "balance" INTEGER NOT NULL DEFAULT 0,
  "consumed" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "organization_sms_credits_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "organization_sms_credits_organizationId_key" ON "organization_sms_credits"("organizationId");
ALTER TABLE "organization_sms_credits" ADD CONSTRAINT "organization_sms_credits_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
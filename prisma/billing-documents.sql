DO $$ BEGIN CREATE TYPE "BillingDocumentType" AS ENUM ('INVOICE', 'RECEIPT', 'CREDIT_NOTE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "BillingDocumentStatus" AS ENUM ('ISSUED', 'PAID', 'VOID', 'REFUNDED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "billing_documents" (
  "id" TEXT NOT NULL,
  "documentNumber" TEXT NOT NULL,
  "type" "BillingDocumentType" NOT NULL,
  "status" "BillingDocumentStatus" NOT NULL DEFAULT 'ISSUED',
  "organizationId" TEXT NOT NULL,
  "paymentRequestId" TEXT,
  "plan" "SubscriptionPlan" NOT NULL,
  "billingCycle" "BillingCycle" NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'KES',
  "subtotal" DECIMAL(12,2) NOT NULL,
  "taxRate" DECIMAL(6,3) NOT NULL DEFAULT 0,
  "taxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "total" DECIMAL(12,2) NOT NULL,
  "periodStart" TIMESTAMP(3), "periodEnd" TIMESTAMP(3), "paymentReference" TEXT,
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "paidAt" TIMESTAMP(3), "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "billing_documents_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "billing_documents_documentNumber_key" ON "billing_documents"("documentNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "billing_documents_paymentRequestId_type_key" ON "billing_documents"("paymentRequestId", "type");
CREATE INDEX IF NOT EXISTS "billing_documents_organizationId_issuedAt_idx" ON "billing_documents"("organizationId", "issuedAt");
CREATE INDEX IF NOT EXISTS "billing_documents_status_type_idx" ON "billing_documents"("status", "type");
DO $$ BEGIN ALTER TABLE "billing_documents" ADD CONSTRAINT "billing_documents_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "billing_documents" ADD CONSTRAINT "billing_documents_paymentRequestId_fkey" FOREIGN KEY ("paymentRequestId") REFERENCES "plan_change_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

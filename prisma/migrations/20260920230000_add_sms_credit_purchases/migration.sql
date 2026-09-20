ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'SMS_CREDIT_PURCHASE';
CREATE TABLE "sms_credit_purchases" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "requestedById" TEXT NOT NULL,
  "credits" INTEGER NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "checkoutRequestId" TEXT,
  "mpesaReceipt" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "paidAt" TIMESTAMP(3),
  CONSTRAINT "sms_credit_purchases_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "sms_credit_purchases_checkoutRequestId_key" ON "sms_credit_purchases"("checkoutRequestId");
CREATE UNIQUE INDEX "sms_credit_purchases_mpesaReceipt_key" ON "sms_credit_purchases"("mpesaReceipt");
CREATE INDEX "sms_credit_purchases_organizationId_status_idx" ON "sms_credit_purchases"("organizationId", "status");
ALTER TABLE "sms_credit_purchases" ADD CONSTRAINT "sms_credit_purchases_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sms_credit_purchases" ADD CONSTRAINT "sms_credit_purchases_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
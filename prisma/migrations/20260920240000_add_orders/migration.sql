CREATE TABLE "orders" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "requestedById" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "amount" DECIMAL(12,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'KES',
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "paymentTransactionId" TEXT,
  "fulfilledAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "sms_credit_purchases" ADD COLUMN "orderId" TEXT;
CREATE UNIQUE INDEX "sms_credit_purchases_orderId_key" ON "sms_credit_purchases"("orderId");
CREATE INDEX "orders_organizationId_status_idx" ON "orders"("organizationId", "status");
CREATE INDEX "orders_type_status_idx" ON "orders"("type", "status");
ALTER TABLE "orders" ADD CONSTRAINT "orders_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sms_credit_purchases" ADD CONSTRAINT "sms_credit_purchases_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

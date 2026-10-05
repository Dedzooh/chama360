-- Payment -> Allocation -> Obligation architecture.
-- A ContributionPayment is one real-world money movement (e.g. one M-Pesa
-- transaction) with a distinct payer (who sent the money) and any number of
-- allocations (whose Chama obligation it settles). OrganizationPaymentMethod
-- is the Chama's own collection channel (Till / PayBill / Treasurer M-Pesa /
-- Bank), separate from the Chama360 platform subscription number.

CREATE TYPE "ChamaPaymentChannelType" AS ENUM ('MPESA_TILL', 'MPESA_PAYBILL', 'TREASURER_MPESA', 'BANK', 'OTHER');

CREATE TYPE "ChamaPaymentMethodStatus" AS ENUM ('ACTIVE', 'PENDING_VERIFICATION', 'DISABLED');

CREATE TYPE "ContributionPaymentStatus" AS ENUM ('PENDING', 'COMPLETED', 'RECONCILIATION_REQUIRED', 'REJECTED', 'REVERSED');

CREATE TYPE "PaymentAllocationKind" AS ENUM ('CONTRIBUTION', 'CREDIT', 'UNALLOCATED');

-- CreateTable
CREATE TABLE "organization_payment_methods" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "channelType" "ChamaPaymentChannelType" NOT NULL,
    "label" TEXT NOT NULL,
    "tillNumber" TEXT,
    "paybillNumber" TEXT,
    "accountNumber" TEXT,
    "bankName" TEXT,
    "bankAccountName" TEXT,
    "bankAccountNumber" TEXT,
    "phone" TEXT,
    "recipientName" TEXT,
    "instructions" TEXT,
    "status" "ChamaPaymentMethodStatus" NOT NULL DEFAULT 'ACTIVE',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_payment_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contribution_payments" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "chamaId" TEXT,
    "payerUserId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "allocatedAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "paymentMethodId" TEXT,
    "paymentMethod" "PaymentMethod",
    "transactionReference" TEXT,
    "status" "ContributionPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "confirmation" JSONB,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedById" TEXT,
    "reversedById" TEXT,
    "reverseReason" TEXT,
    "reversedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contribution_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contribution_payment_allocations" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "contributionId" TEXT,
    "kind" "PaymentAllocationKind" NOT NULL DEFAULT 'CONTRIBUTION',
    "period" TEXT,
    "contributionType" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "confirmedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contribution_payment_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "organization_payment_methods_organizationId_status_idx" ON "organization_payment_methods"("organizationId", "status");

-- CreateIndex
CREATE INDEX "contribution_payments_organizationId_status_idx" ON "contribution_payments"("organizationId", "status");

-- CreateIndex
CREATE INDEX "contribution_payments_payerUserId_idx" ON "contribution_payments"("payerUserId");

-- CreateIndex
CREATE INDEX "contribution_payments_transactionReference_idx" ON "contribution_payments"("transactionReference");

-- CreateIndex
CREATE INDEX "contribution_payment_allocations_paymentId_idx" ON "contribution_payment_allocations"("paymentId");

-- CreateIndex
CREATE INDEX "contribution_payment_allocations_memberId_period_idx" ON "contribution_payment_allocations"("memberId", "period");

-- CreateIndex
CREATE INDEX "contribution_payment_allocations_contributionId_idx" ON "contribution_payment_allocations"("contributionId");

-- AddForeignKey
ALTER TABLE "organization_payment_methods" ADD CONSTRAINT "organization_payment_methods_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_payment_methods" ADD CONSTRAINT "organization_payment_methods_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_payment_methods" ADD CONSTRAINT "organization_payment_methods_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contribution_payments" ADD CONSTRAINT "contribution_payments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contribution_payments" ADD CONSTRAINT "contribution_payments_payerUserId_fkey" FOREIGN KEY ("payerUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contribution_payments" ADD CONSTRAINT "contribution_payments_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "organization_payment_methods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contribution_payments" ADD CONSTRAINT "contribution_payments_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contribution_payments" ADD CONSTRAINT "contribution_payments_reversedById_fkey" FOREIGN KEY ("reversedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contribution_payment_allocations" ADD CONSTRAINT "contribution_payment_allocations_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "contribution_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contribution_payment_allocations" ADD CONSTRAINT "contribution_payment_allocations_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contribution_payment_allocations" ADD CONSTRAINT "contribution_payment_allocations_contributionId_fkey" FOREIGN KEY ("contributionId") REFERENCES "contributions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contribution_payment_allocations" ADD CONSTRAINT "contribution_payment_allocations_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "SubscriptionPlan" AS ENUM ('FREE', 'STARTER', 'GROWTH', 'PRO', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'ANNUAL');

-- CreateEnum
CREATE TYPE "BillingDocumentType" AS ENUM ('INVOICE', 'RECEIPT', 'CREDIT_NOTE');

-- CreateEnum
CREATE TYPE "BillingDocumentStatus" AS ENUM ('ISSUED', 'PAID', 'VOID', 'REFUNDED');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PlanChangeStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OrganizationCommitteeStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "OrganizationBranchStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "LoanRepaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'REVERSED');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'APOLOGY', 'LATE', 'EXCUSED');

-- CreateEnum
CREATE TYPE "WelfareClaimType" AS ENUM ('EMERGENCY', 'MEDICAL', 'FUNERAL', 'EDUCATION', 'OTHER');

-- CreateEnum
CREATE TYPE "WelfareClaimStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'PARTIALLY_APPROVED', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MeetingStatus" AS ENUM ('SCHEDULED', 'ONGOING', 'COMPLETED', 'CLOSED', 'CANCELLED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ChamaStatus" ADD VALUE 'INACTIVE';
ALTER TYPE "ChamaStatus" ADD VALUE 'ARCHIVED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ChamaType" ADD VALUE 'SAVINGS';
ALTER TYPE "ChamaType" ADD VALUE 'INVESTMENT';
ALTER TYPE "ChamaType" ADD VALUE 'WELFARE';
ALTER TYPE "ChamaType" ADD VALUE 'FAMILY';
ALTER TYPE "ChamaType" ADD VALUE 'STAFF';
ALTER TYPE "ChamaType" ADD VALUE 'CHURCH';
ALTER TYPE "ChamaType" ADD VALUE 'HYBRID';
ALTER TYPE "ChamaType" ADD VALUE 'BUSINESS';
ALTER TYPE "ChamaType" ADD VALUE 'COMMUNITY';
ALTER TYPE "ChamaType" ADD VALUE 'YOUTH';

-- AlterEnum
ALTER TYPE "ContributionStatus" ADD VALUE 'REVERSED';

-- AlterEnum
ALTER TYPE "Frequency" ADD VALUE 'DAILY';

-- AlterEnum
ALTER TYPE "LoanStatus" ADD VALUE 'REJECTED';

-- AlterEnum
ALTER TYPE "VoteStatus" ADD VALUE 'CLOSED';

-- DropForeignKey
ALTER TABLE "vote_casts" DROP CONSTRAINT "vote_casts_optionId_fkey";

-- DropIndex
DROP INDEX "chamas_shareableLink_key";

-- DropIndex
DROP INDEX "chamas_type_status_idx";

-- DropIndex
DROP INDEX "chamas_visibility_idx";

-- DropIndex
DROP INDEX "chamas_visibility_status_idx";

-- DropIndex
DROP INDEX "users_kycStatus_isActive_idx";

-- DropIndex
DROP INDEX "vote_casts_optionId_memberId_key";

-- AlterTable
ALTER TABLE "chamas" DROP COLUMN "contributionAmount",
DROP COLUMN "contributionFrequency",
DROP COLUMN "currency",
DROP COLUMN "maxMembers",
DROP COLUMN "qrCode",
DROP COLUMN "shareableLink",
ADD COLUMN     "county" TEXT,
ADD COLUMN     "createdById" TEXT NOT NULL,
ADD COLUMN     "logoUrl" TEXT,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "modules" JSONB,
ADD COLUMN     "organizationId" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "shortCode" TEXT,
ADD COLUMN     "town" TEXT,
ALTER COLUMN "description" DROP NOT NULL,
ALTER COLUMN "visibility" SET DEFAULT 'INVITE_ONLY',
ALTER COLUMN "settings" DROP NOT NULL;

-- AlterTable
ALTER TABLE "contributions" ADD COLUMN     "contributionType" TEXT,
ADD COLUMN     "organizationId" TEXT,
ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "period" TEXT,
ADD COLUMN     "recordedById" TEXT,
ADD COLUMN     "reference" TEXT,
ADD COLUMN     "reverseReason" TEXT,
ADD COLUMN     "reversedAt" TIMESTAMP(3),
ADD COLUMN     "reversedById" TEXT;

-- AlterTable
ALTER TABLE "disputes" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "loans" ADD COLUMN     "amountApproved" DECIMAL(14,2),
ADD COLUMN     "amountRequested" DECIMAL(14,2) NOT NULL,
ADD COLUMN     "guarantorsData" JSONB,
ADD COLUMN     "memberId" TEXT,
ADD COLUMN     "organizationId" TEXT,
ADD COLUMN     "purpose" TEXT,
ADD COLUMN     "repaymentPeriodMonths" INTEGER,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" TEXT,
ALTER COLUMN "amount" SET DATA TYPE DECIMAL(14,2),
ALTER COLUMN "interestRate" SET DATA TYPE DECIMAL(5,2),
ALTER COLUMN "dueDate" DROP NOT NULL,
ALTER COLUMN "balance" SET DATA TYPE DECIMAL(14,2);

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "dedupeKey" TEXT,
ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "activatedAt" TIMESTAMP(3),
ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "organizationId" TEXT,
ADD COLUMN     "suspendedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "vote_casts" DROP COLUMN "optionId",
ADD COLUMN     "organizationId" TEXT NOT NULL,
ADD COLUMN     "selectedOption" TEXT NOT NULL,
ADD COLUMN     "voteId" TEXT NOT NULL,
ADD COLUMN     "votedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "votes" ADD COLUMN     "closedById" TEXT,
ADD COLUMN     "closesAt" TIMESTAMP(3),
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "meetingId" TEXT,
ADD COLUMN     "organizationId" TEXT;

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plan" "SubscriptionPlan" NOT NULL DEFAULT 'FREE',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "currentPeriodStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentPeriodEnd" TIMESTAMP(3),
    "gracePeriodEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "provider" TEXT,
    "providerReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_change_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT,
    "requestedPlan" "SubscriptionPlan" NOT NULL,
    "billingCycle" "BillingCycle" NOT NULL DEFAULT 'MONTHLY',
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "phone" TEXT,
    "status" "PlanChangeStatus" NOT NULL DEFAULT 'PENDING',
    "checkoutRequestId" TEXT,
    "merchantRequestId" TEXT,
    "receiptNumber" TEXT,
    "failureReason" TEXT,
    "paidAt" TIMESTAMP(3),
    "callbackPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plan_change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_subscriptions" (
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

-- CreateTable
CREATE TABLE "billing_documents" (
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
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "paymentReference" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_committees" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "OrganizationCommitteeStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_committees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_branches" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "location" TEXT,
    "status" "OrganizationBranchStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_repayments" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "paymentMethod" "PaymentMethod",
    "reference" TEXT,
    "recordedById" TEXT,
    "paidAt" TIMESTAMP(3),
    "status" "LoanRepaymentStatus" NOT NULL DEFAULT 'PENDING',
    "repaidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loan_repayments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "welfare_claims" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "memberId" TEXT,
    "type" "WelfareClaimType" NOT NULL,
    "claimType" TEXT,
    "amountRequested" DECIMAL(14,2) NOT NULL,
    "amountApproved" DECIMAL(14,2),
    "reason" TEXT,
    "status" "WelfareClaimStatus" NOT NULL DEFAULT 'PENDING',
    "description" TEXT NOT NULL,
    "documents" JSONB,
    "supportingDocuments" JSONB,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "welfare_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meetings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "dateTime" TIMESTAMP(3) NOT NULL,
    "venue" TEXT,
    "agenda" JSONB,
    "minutes" JSONB,
    "scheduledFor" TIMESTAMP(3),
    "location" TEXT,
    "status" "MeetingStatus" NOT NULL DEFAULT 'SCHEDULED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meetings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meeting_attendance" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'ABSENT',
    "notes" TEXT,
    "recordedById" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meeting_attendance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_userId_key" ON "subscriptions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_providerReference_key" ON "subscriptions"("providerReference");

-- CreateIndex
CREATE INDEX "subscriptions_plan_status_idx" ON "subscriptions"("plan", "status");

-- CreateIndex
CREATE UNIQUE INDEX "plan_change_requests_checkoutRequestId_key" ON "plan_change_requests"("checkoutRequestId");

-- CreateIndex
CREATE INDEX "plan_change_requests_userId_status_idx" ON "plan_change_requests"("userId", "status");

-- CreateIndex
CREATE INDEX "plan_change_requests_organizationId_status_idx" ON "plan_change_requests"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "organization_subscriptions_organizationId_key" ON "organization_subscriptions"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "organization_subscriptions_providerReference_key" ON "organization_subscriptions"("providerReference");

-- CreateIndex
CREATE INDEX "organization_subscriptions_plan_status_idx" ON "organization_subscriptions"("plan", "status");

-- CreateIndex
CREATE UNIQUE INDEX "billing_documents_documentNumber_key" ON "billing_documents"("documentNumber");

-- CreateIndex
CREATE INDEX "billing_documents_organizationId_issuedAt_idx" ON "billing_documents"("organizationId", "issuedAt");

-- CreateIndex
CREATE INDEX "billing_documents_status_type_idx" ON "billing_documents"("status", "type");

-- CreateIndex
CREATE UNIQUE INDEX "billing_documents_paymentRequestId_type_key" ON "billing_documents"("paymentRequestId", "type");

-- CreateIndex
CREATE INDEX "organization_committees_organizationId_status_idx" ON "organization_committees"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "organization_committees_organizationId_name_key" ON "organization_committees"("organizationId", "name");

-- CreateIndex
CREATE INDEX "organization_branches_organizationId_status_idx" ON "organization_branches"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "organization_branches_organizationId_name_key" ON "organization_branches"("organizationId", "name");

-- CreateIndex
CREATE INDEX "loan_repayments_organizationId_status_idx" ON "loan_repayments"("organizationId", "status");

-- CreateIndex
CREATE INDEX "loan_repayments_loanId_idx" ON "loan_repayments"("loanId");

-- CreateIndex
CREATE INDEX "loan_repayments_memberId_idx" ON "loan_repayments"("memberId");

-- CreateIndex
CREATE INDEX "loan_repayments_recordedById_idx" ON "loan_repayments"("recordedById");

-- CreateIndex
CREATE INDEX "welfare_claims_organizationId_status_idx" ON "welfare_claims"("organizationId", "status");

-- CreateIndex
CREATE INDEX "welfare_claims_requestedById_status_idx" ON "welfare_claims"("requestedById", "status");

-- CreateIndex
CREATE INDEX "meetings_organizationId_status_idx" ON "meetings"("organizationId", "status");

-- CreateIndex
CREATE INDEX "meetings_dateTime_idx" ON "meetings"("dateTime");

-- CreateIndex
CREATE INDEX "meeting_attendance_organizationId_meetingId_idx" ON "meeting_attendance"("organizationId", "meetingId");

-- CreateIndex
CREATE INDEX "meeting_attendance_memberId_idx" ON "meeting_attendance"("memberId");

-- CreateIndex
CREATE INDEX "meeting_attendance_recordedById_idx" ON "meeting_attendance"("recordedById");

-- CreateIndex
CREATE UNIQUE INDEX "meeting_attendance_meetingId_memberId_key" ON "meeting_attendance"("meetingId", "memberId");

-- CreateIndex
CREATE UNIQUE INDEX "chamas_shortCode_key" ON "chamas"("shortCode");

-- CreateIndex
CREATE UNIQUE INDEX "chamas_organizationId_key" ON "chamas"("organizationId");

-- CreateIndex
CREATE INDEX "chamas_createdById_idx" ON "chamas"("createdById");

-- CreateIndex
CREATE INDEX "contributions_organizationId_status_idx" ON "contributions"("organizationId", "status");

-- CreateIndex
CREATE INDEX "contributions_organizationId_dueDate_idx" ON "contributions"("organizationId", "dueDate");

-- CreateIndex
CREATE INDEX "contributions_reference_idx" ON "contributions"("reference");

-- CreateIndex
CREATE INDEX "contributions_recordedById_idx" ON "contributions"("recordedById");

-- CreateIndex
CREATE INDEX "disputes_organizationId_status_idx" ON "disputes"("organizationId", "status");

-- CreateIndex
CREATE INDEX "loan_guarantors_loanId_idx" ON "loan_guarantors"("loanId");

-- CreateIndex
CREATE INDEX "loan_guarantors_memberId_idx" ON "loan_guarantors"("memberId");

-- CreateIndex
CREATE INDEX "loans_organizationId_status_idx" ON "loans"("organizationId", "status");

-- CreateIndex
CREATE INDEX "loans_memberId_status_idx" ON "loans"("memberId", "status");

-- CreateIndex
CREATE INDEX "loans_reviewedById_idx" ON "loans"("reviewedById");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_dedupeKey_key" ON "notifications"("dedupeKey");

-- CreateIndex
CREATE INDEX "notifications_organizationId_status_idx" ON "notifications"("organizationId", "status");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE INDEX "transactions_organizationId_type_idx" ON "transactions"("organizationId", "type");

-- CreateIndex
CREATE INDEX "transactions_organizationId_status_idx" ON "transactions"("organizationId", "status");

-- CreateIndex
CREATE INDEX "vote_casts_organizationId_voteId_idx" ON "vote_casts"("organizationId", "voteId");

-- CreateIndex
CREATE UNIQUE INDEX "vote_casts_voteId_memberId_key" ON "vote_casts"("voteId", "memberId");

-- CreateIndex
CREATE INDEX "votes_organizationId_status_idx" ON "votes"("organizationId", "status");

-- CreateIndex
CREATE INDEX "votes_meetingId_status_idx" ON "votes"("meetingId", "status");

-- CreateIndex
CREATE INDEX "votes_closedById_idx" ON "votes"("closedById");

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_change_requests" ADD CONSTRAINT "plan_change_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_change_requests" ADD CONSTRAINT "plan_change_requests_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_subscriptions" ADD CONSTRAINT "organization_subscriptions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_documents" ADD CONSTRAINT "billing_documents_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_documents" ADD CONSTRAINT "billing_documents_paymentRequestId_fkey" FOREIGN KEY ("paymentRequestId") REFERENCES "plan_change_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_committees" ADD CONSTRAINT "organization_committees_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_branches" ADD CONSTRAINT "organization_branches_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chamas" ADD CONSTRAINT "chamas_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chamas" ADD CONSTRAINT "chamas_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_reversedById_fkey" FOREIGN KEY ("reversedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_repayments" ADD CONSTRAINT "loan_repayments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_repayments" ADD CONSTRAINT "loan_repayments_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "loans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_repayments" ADD CONSTRAINT "loan_repayments_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_repayments" ADD CONSTRAINT "loan_repayments_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "meetings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vote_casts" ADD CONSTRAINT "vote_casts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vote_casts" ADD CONSTRAINT "vote_casts_voteId_fkey" FOREIGN KEY ("voteId") REFERENCES "votes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "welfare_claims" ADD CONSTRAINT "welfare_claims_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "welfare_claims" ADD CONSTRAINT "welfare_claims_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "welfare_claims" ADD CONSTRAINT "welfare_claims_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_attendance" ADD CONSTRAINT "meeting_attendance_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_attendance" ADD CONSTRAINT "meeting_attendance_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_attendance" ADD CONSTRAINT "meeting_attendance_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_attendance" ADD CONSTRAINT "meeting_attendance_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

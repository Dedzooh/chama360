-- CreateEnum
CREATE TYPE "KycStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ChamaType" AS ENUM ('ROSCA', 'ASCA', 'NORMAL');

-- CreateEnum
CREATE TYPE "Frequency" AS ENUM ('WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('PUBLIC', 'PRIVATE', 'INVITE_ONLY');

-- CreateEnum
CREATE TYPE "ChamaStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "MemberRole" AS ENUM ('FOUNDER', 'CHAIR', 'TREASURER', 'SECRETARY', 'AUDITOR', 'MEMBER');

-- CreateEnum
CREATE TYPE "MemberStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'EXITED');

-- CreateEnum
CREATE TYPE "ContributionStatus" AS ENUM ('PENDING', 'PAID', 'OVERDUE', 'PARTIAL');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('MPESA', 'BANK', 'CASH');

-- CreateEnum
CREATE TYPE "LoanStatus" AS ENUM ('PENDING', 'APPROVED', 'ACTIVE', 'DEFAULTED', 'PAID');

-- CreateEnum
CREATE TYPE "GuarantorStatus" AS ENUM ('ACTIVE', 'RELEASED', 'CLAIMED');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('CONTRIBUTION', 'LOAN_DISBURSEMENT', 'LOAN_PAYMENT', 'PAYOUT', 'PENALTY', 'SHARE_OUT');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REVERSED');

-- CreateEnum
CREATE TYPE "DisputeCategory" AS ENUM ('CONTRIBUTION', 'LOAN', 'PAYOUT', 'GOVERNANCE', 'OTHER');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'VOTING', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "EvidenceType" AS ENUM ('DOCUMENT', 'IMAGE', 'SCREENSHOT', 'RECEIPT');

-- CreateEnum
CREATE TYPE "VoteType" AS ENUM ('SIMPLE_MAJORITY', 'WEIGHTED_CONTRIBUTION', 'ROLE_RESTRICTED');

-- CreateEnum
CREATE TYPE "VoteStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('CONTRIBUTION_DUE', 'MEETING_REMINDER', 'LOAN_OVERDUE', 'DISPUTE_RAISED', 'VOTE_STARTED', 'PAYOUT_READY', 'GENERAL_UPDATE');

-- CreateEnum
CREATE TYPE "NotificationPriority" AS ENUM ('CRITICAL', 'IMPORTANT', 'INFO');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'FAILED');

-- CreateEnum
CREATE TYPE "NotificationChannelType" AS ENUM ('SMS', 'EMAIL', 'PUSH', 'IN_APP');

-- CreateEnum
CREATE TYPE "NotificationChannelStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'FAILED');

-- CreateEnum
CREATE TYPE "BackgroundJobType" AS ENUM ('NOTIFICATION_DELIVERY', 'CONTRIBUTION_REMINDER', 'PENALTY_CALCULATION', 'LOAN_INTEREST_CALCULATION', 'PAYOUT_PROCESSING', 'SHARE_OUT_CALCULATION', 'DATA_RECONCILIATION', 'AUDIT_CLEANUP', 'REPORT_GENERATION');

-- CreateEnum
CREATE TYPE "BackgroundJobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'PAYMENT_PROCESSED', 'LOAN_APPROVED', 'LOAN_DISBURSED', 'DISPUTE_RAISED', 'VOTE_CAST', 'MEMBER_JOINED', 'MEMBER_SUSPENDED', 'CHAMA_CREATED', 'CONTRIBUTION_MADE', 'PAYOUT_PROCESSED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "nationalId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "kycStatus" "KycStatus" NOT NULL DEFAULT 'PENDING',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "mfaSecret" TEXT,
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isRevoked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chamas" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ChamaType" NOT NULL,
    "description" TEXT NOT NULL,
    "maxMembers" INTEGER NOT NULL,
    "contributionAmount" DECIMAL(10,2) NOT NULL,
    "contributionFrequency" "Frequency" NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "visibility" "Visibility" NOT NULL DEFAULT 'PUBLIC',
    "shareableLink" TEXT NOT NULL,
    "qrCode" TEXT NOT NULL,
    "status" "ChamaStatus" NOT NULL DEFAULT 'ACTIVE',
    "settings" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chamas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chama_memberships" (
    "chamaId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "MemberRole" NOT NULL DEFAULT 'MEMBER',
    "status" "MemberStatus" NOT NULL DEFAULT 'PENDING',
    "reliabilityScore" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chama_memberships_pkey" PRIMARY KEY ("chamaId","userId")
);

-- CreateTable
CREATE TABLE "contributions" (
    "id" TEXT NOT NULL,
    "chamaId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paidDate" TIMESTAMP(3),
    "status" "ContributionStatus" NOT NULL DEFAULT 'PENDING',
    "paymentMethod" "PaymentMethod",
    "transactionRef" TEXT,
    "penalties" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contributions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loans" (
    "id" TEXT NOT NULL,
    "chamaId" TEXT NOT NULL,
    "borrowerId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "interestRate" DECIMAL(5,4) NOT NULL,
    "status" "LoanStatus" NOT NULL DEFAULT 'PENDING',
    "disbursedAt" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3) NOT NULL,
    "balance" DECIMAL(10,2) NOT NULL,
    "riskScore" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_guarantors" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "guaranteedAmount" DECIMAL(10,2) NOT NULL,
    "collateralLocked" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "status" "GuarantorStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loan_guarantors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "chamaId" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "fromMemberId" TEXT,
    "toMemberId" TEXT,
    "reference" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disputes" (
    "id" TEXT NOT NULL,
    "chamaId" TEXT NOT NULL,
    "raisedBy" TEXT NOT NULL,
    "againstMember" TEXT,
    "relatedTransaction" TEXT,
    "category" "DisputeCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
    "resolution" JSONB,
    "immutableHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "disputes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence" (
    "id" TEXT NOT NULL,
    "disputeId" TEXT NOT NULL,
    "type" "EvidenceType" NOT NULL,
    "filename" TEXT NOT NULL,
    "s3Key" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "votes" (
    "id" TEXT NOT NULL,
    "chamaId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "VoteType" NOT NULL,
    "quorumRequired" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "VoteStatus" NOT NULL DEFAULT 'DRAFT',
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "autoExecute" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vote_options" (
    "id" TEXT NOT NULL,
    "voteId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "vote_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vote_casts" (
    "id" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "castAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vote_casts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "chamaId" TEXT,
    "type" "NotificationType" NOT NULL,
    "priority" "NotificationPriority" NOT NULL DEFAULT 'INFO',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "scheduledFor" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "acknowledgedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_channels" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "type" "NotificationChannelType" NOT NULL,
    "address" TEXT NOT NULL,
    "status" "NotificationChannelStatus" NOT NULL DEFAULT 'PENDING',
    "deliveredAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "smsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "pushEnabled" BOOLEAN NOT NULL DEFAULT true,
    "inAppEnabled" BOOLEAN NOT NULL DEFAULT true,
    "quietHoursStart" TEXT,
    "quietHoursEnd" TEXT,
    "priorityOverride" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "background_jobs" (
    "id" TEXT NOT NULL,
    "type" "BackgroundJobType" NOT NULL,
    "status" "BackgroundJobStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB,
    "result" JSONB,
    "error" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "background_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "userId" TEXT,
    "chamaId" TEXT,
    "oldValues" JSONB,
    "newValues" JSONB,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "users_nationalId_key" ON "users"("nationalId");

-- CreateIndex
CREATE INDEX "users_kycStatus_idx" ON "users"("kycStatus");

-- CreateIndex
CREATE INDEX "users_isActive_idx" ON "users"("isActive");

-- CreateIndex
CREATE INDEX "users_kycStatus_isActive_idx" ON "users"("kycStatus", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "chamas_shareableLink_key" ON "chamas"("shareableLink");

-- CreateIndex
CREATE INDEX "chamas_type_idx" ON "chamas"("type");

-- CreateIndex
CREATE INDEX "chamas_status_idx" ON "chamas"("status");

-- CreateIndex
CREATE INDEX "chamas_visibility_idx" ON "chamas"("visibility");

-- CreateIndex
CREATE INDEX "chamas_type_status_idx" ON "chamas"("type", "status");

-- CreateIndex
CREATE INDEX "chamas_visibility_status_idx" ON "chamas"("visibility", "status");

-- CreateIndex
CREATE INDEX "chama_memberships_status_idx" ON "chama_memberships"("status");

-- CreateIndex
CREATE INDEX "chama_memberships_role_idx" ON "chama_memberships"("role");

-- CreateIndex
CREATE INDEX "chama_memberships_userId_status_idx" ON "chama_memberships"("userId", "status");

-- CreateIndex
CREATE INDEX "chama_memberships_chamaId_status_idx" ON "chama_memberships"("chamaId", "status");

-- CreateIndex
CREATE INDEX "chama_memberships_reliabilityScore_idx" ON "chama_memberships"("reliabilityScore");

-- CreateIndex
CREATE INDEX "contributions_status_idx" ON "contributions"("status");

-- CreateIndex
CREATE INDEX "contributions_dueDate_idx" ON "contributions"("dueDate");

-- CreateIndex
CREATE INDEX "contributions_chamaId_status_idx" ON "contributions"("chamaId", "status");

-- CreateIndex
CREATE INDEX "contributions_memberId_status_idx" ON "contributions"("memberId", "status");

-- CreateIndex
CREATE INDEX "contributions_chamaId_dueDate_idx" ON "contributions"("chamaId", "dueDate");

-- CreateIndex
CREATE INDEX "contributions_transactionRef_idx" ON "contributions"("transactionRef");

-- CreateIndex
CREATE INDEX "loans_status_idx" ON "loans"("status");

-- CreateIndex
CREATE INDEX "loans_dueDate_idx" ON "loans"("dueDate");

-- CreateIndex
CREATE INDEX "loans_chamaId_status_idx" ON "loans"("chamaId", "status");

-- CreateIndex
CREATE INDEX "loans_borrowerId_status_idx" ON "loans"("borrowerId", "status");

-- CreateIndex
CREATE INDEX "loans_riskScore_idx" ON "loans"("riskScore");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_reference_key" ON "transactions"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_idempotencyKey_key" ON "transactions"("idempotencyKey");

-- CreateIndex
CREATE INDEX "transactions_type_idx" ON "transactions"("type");

-- CreateIndex
CREATE INDEX "transactions_status_idx" ON "transactions"("status");

-- CreateIndex
CREATE INDEX "transactions_chamaId_type_idx" ON "transactions"("chamaId", "type");

-- CreateIndex
CREATE INDEX "transactions_chamaId_status_idx" ON "transactions"("chamaId", "status");

-- CreateIndex
CREATE INDEX "transactions_fromMemberId_idx" ON "transactions"("fromMemberId");

-- CreateIndex
CREATE INDEX "transactions_toMemberId_idx" ON "transactions"("toMemberId");

-- CreateIndex
CREATE INDEX "transactions_createdAt_idx" ON "transactions"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "disputes_immutableHash_key" ON "disputes"("immutableHash");

-- CreateIndex
CREATE UNIQUE INDEX "vote_casts_optionId_memberId_key" ON "vote_casts"("optionId", "memberId");

-- CreateIndex
CREATE INDEX "notifications_status_idx" ON "notifications"("status");

-- CreateIndex
CREATE INDEX "notifications_priority_idx" ON "notifications"("priority");

-- CreateIndex
CREATE INDEX "notifications_type_idx" ON "notifications"("type");

-- CreateIndex
CREATE INDEX "notifications_recipientId_status_idx" ON "notifications"("recipientId", "status");

-- CreateIndex
CREATE INDEX "notifications_chamaId_status_idx" ON "notifications"("chamaId", "status");

-- CreateIndex
CREATE INDEX "notifications_scheduledFor_idx" ON "notifications"("scheduledFor");

-- CreateIndex
CREATE INDEX "notification_channels_status_idx" ON "notification_channels"("status");

-- CreateIndex
CREATE INDEX "notification_channels_type_idx" ON "notification_channels"("type");

-- CreateIndex
CREATE INDEX "notification_channels_notificationId_status_idx" ON "notification_channels"("notificationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_userId_key" ON "notification_preferences"("userId");

-- CreateIndex
CREATE INDEX "background_jobs_status_idx" ON "background_jobs"("status");

-- CreateIndex
CREATE INDEX "background_jobs_type_idx" ON "background_jobs"("type");

-- CreateIndex
CREATE INDEX "background_jobs_scheduledAt_idx" ON "background_jobs"("scheduledAt");

-- CreateIndex
CREATE INDEX "background_jobs_type_status_idx" ON "background_jobs"("type", "status");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_idx" ON "audit_logs"("entityType");

-- CreateIndex
CREATE INDEX "audit_logs_entityId_idx" ON "audit_logs"("entityId");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_chamaId_idx" ON "audit_logs"("chamaId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chama_memberships" ADD CONSTRAINT "chama_memberships_chamaId_fkey" FOREIGN KEY ("chamaId") REFERENCES "chamas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chama_memberships" ADD CONSTRAINT "chama_memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_chamaId_fkey" FOREIGN KEY ("chamaId") REFERENCES "chamas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_chamaId_fkey" FOREIGN KEY ("chamaId") REFERENCES "chamas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_borrowerId_fkey" FOREIGN KEY ("borrowerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_guarantors" ADD CONSTRAINT "loan_guarantors_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "loans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_guarantors" ADD CONSTRAINT "loan_guarantors_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_chamaId_fkey" FOREIGN KEY ("chamaId") REFERENCES "chamas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_fromMemberId_fkey" FOREIGN KEY ("fromMemberId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_toMemberId_fkey" FOREIGN KEY ("toMemberId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_chamaId_fkey" FOREIGN KEY ("chamaId") REFERENCES "chamas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_raisedBy_fkey" FOREIGN KEY ("raisedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_againstMember_fkey" FOREIGN KEY ("againstMember") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "disputes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_chamaId_fkey" FOREIGN KEY ("chamaId") REFERENCES "chamas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vote_options" ADD CONSTRAINT "vote_options_voteId_fkey" FOREIGN KEY ("voteId") REFERENCES "votes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vote_casts" ADD CONSTRAINT "vote_casts_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "vote_options"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vote_casts" ADD CONSTRAINT "vote_casts_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_chamaId_fkey" FOREIGN KEY ("chamaId") REFERENCES "chamas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_channels" ADD CONSTRAINT "notification_channels_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_chamaId_fkey" FOREIGN KEY ("chamaId") REFERENCES "chamas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

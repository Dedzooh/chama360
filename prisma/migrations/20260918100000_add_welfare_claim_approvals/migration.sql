-- CreateEnum
CREATE TYPE "WelfareClaimApprovalDecision" AS ENUM ('APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "welfare_claim_approvals" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "approverId" TEXT NOT NULL,
    "decision" "WelfareClaimApprovalDecision" NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "welfare_claim_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "welfare_claim_approvals_claimId_approverId_key" ON "welfare_claim_approvals"("claimId", "approverId");
CREATE INDEX "welfare_claim_approvals_claimId_decision_idx" ON "welfare_claim_approvals"("claimId", "decision");
CREATE INDEX "welfare_claim_approvals_approverId_idx" ON "welfare_claim_approvals"("approverId");

-- AddForeignKey
ALTER TABLE "welfare_claim_approvals" ADD CONSTRAINT "welfare_claim_approvals_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "welfare_claims"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "welfare_claim_approvals" ADD CONSTRAINT "welfare_claim_approvals_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
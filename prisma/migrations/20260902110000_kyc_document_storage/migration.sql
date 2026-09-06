CREATE TYPE "KycDocumentStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED');

CREATE TABLE "kyc_documents" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "status" "KycDocumentStatus" NOT NULL DEFAULT 'PENDING',
  "frontObjectKey" TEXT NOT NULL,
  "frontContentType" TEXT NOT NULL,
  "backObjectKey" TEXT,
  "backContentType" TEXT,
  "documentNumberHash" TEXT NOT NULL,
  "documentNumberLast4" TEXT NOT NULL,
  "issueDate" TIMESTAMP(3),
  "expiryDate" TIMESTAMP(3),
  "issuingAuthority" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "kyc_documents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "kyc_documents_userId_status_idx" ON "kyc_documents"("userId", "status");
CREATE INDEX "kyc_documents_documentNumberHash_idx" ON "kyc_documents"("documentNumberHash");
ALTER TABLE "kyc_documents" ADD CONSTRAINT "kyc_documents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

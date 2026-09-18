-- CreateEnum
CREATE TYPE "MpesaCallbackInboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED');

-- CreateTable
CREATE TABLE "mpesa_callback_inbox" (
    "id" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "checkoutRequestId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "MpesaCallbackInboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mpesa_callback_inbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mpesa_callback_inbox_eventKey_key" ON "mpesa_callback_inbox"("eventKey");
CREATE INDEX "mpesa_callback_inbox_status_nextAttemptAt_idx" ON "mpesa_callback_inbox"("status", "nextAttemptAt");
CREATE INDEX "mpesa_callback_inbox_checkoutRequestId_idx" ON "mpesa_callback_inbox"("checkoutRequestId");
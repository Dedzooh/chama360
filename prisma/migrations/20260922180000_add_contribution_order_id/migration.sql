ALTER TABLE "contributions"
ADD COLUMN "orderId" TEXT;

CREATE UNIQUE INDEX "contributions_orderId_key"
ON "contributions"("orderId");

ALTER TABLE "plan_change_requests" ADD COLUMN "orderId" TEXT;

CREATE UNIQUE INDEX "plan_change_requests_orderId_key" ON "plan_change_requests"("orderId");

ALTER TABLE "plan_change_requests" ADD CONSTRAINT "plan_change_requests_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
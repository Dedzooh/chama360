ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "dedupeKey" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "notifications_dedupeKey_key" ON "notifications"("dedupeKey") WHERE "dedupeKey" IS NOT NULL;

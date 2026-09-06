ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "emailVerifiedAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phoneVerifiedAt" TIMESTAMP(3);

-- Existing accounts predate enforced verification. Preserve their access while
-- requiring all newly registered accounts to complete verification.
UPDATE "users"
SET "emailVerifiedAt" = COALESCE("emailVerifiedAt", "createdAt"),
    "phoneVerifiedAt" = COALESCE("phoneVerifiedAt", "createdAt")
WHERE "isActive" = true;

-- Existing plaintext refresh tokens cannot be converted without retaining the
-- credentials during migration. Revoke them and require one fresh sign-in.
DELETE FROM "refresh_tokens";

-- Some early databases were created without the Prisma-generated unique
-- constraint. Keep the migration valid for both schema histories.
ALTER TABLE "refresh_tokens" DROP CONSTRAINT IF EXISTS "refresh_tokens_token_key";
ALTER TABLE "refresh_tokens" RENAME COLUMN "token" TO "tokenHash";
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_tokenHash_key" UNIQUE ("tokenHash");

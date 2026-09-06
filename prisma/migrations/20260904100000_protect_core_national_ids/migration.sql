ALTER TABLE "users" ADD COLUMN "nationalIdHash" TEXT;
ALTER TABLE "users" ADD COLUMN "nationalIdLast4" TEXT;
ALTER TABLE "users" ALTER COLUMN "nationalId" DROP NOT NULL;

CREATE UNIQUE INDEX "users_nationalIdHash_key" ON "users"("nationalIdHash");

-- Existing rows are converted by the keyed application backfill. NOT VALID
-- permits those rows temporarily but enforces NULL for every new or changed row.
ALTER TABLE "users"
ADD CONSTRAINT "users_nationalId_plaintext_disabled"
CHECK ("nationalId" IS NULL) NOT VALID;

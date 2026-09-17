CREATE TABLE "mfa_recovery_codes" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mfa_recovery_codes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "mfa_recovery_codes_codeHash_key" ON "mfa_recovery_codes"("codeHash");
CREATE INDEX "mfa_recovery_codes_userId_usedAt_idx" ON "mfa_recovery_codes"("userId", "usedAt");
ALTER TABLE "mfa_recovery_codes" ADD CONSTRAINT "mfa_recovery_codes_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

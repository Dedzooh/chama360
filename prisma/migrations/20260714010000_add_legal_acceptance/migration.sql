ALTER TABLE "users"
  ADD COLUMN "termsAcceptedAt" TIMESTAMP(3),
  ADD COLUMN "privacyAcceptedAt" TIMESTAMP(3),
  ADD COLUMN "legalVersion" TEXT;

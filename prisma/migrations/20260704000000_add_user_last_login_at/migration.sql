-- Align the users table with the current Prisma User model.

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP(3);

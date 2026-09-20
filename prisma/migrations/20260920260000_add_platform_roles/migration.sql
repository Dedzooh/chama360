CREATE TYPE "PlatformRole" AS ENUM ('PLATFORM_OWNER', 'PLATFORM_ADMIN', 'FINANCE_ADMIN', 'SUPPORT_ADMIN');

ALTER TABLE "users" ADD COLUMN "platformRole" "PlatformRole";

CREATE INDEX "users_platformRole_idx" ON "users"("platformRole");